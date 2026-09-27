//! "Screendial" wake-word detection, via openWakeWord's streaming pipeline
//! (raw audio -> melspectrogram.onnx -> embedding_model.onnx -> custom classifier.onnx),
//! ported faithfully from openWakeWord's reference implementation
//! (`openwakeword/utils.py::AudioFeatures` and `openwakeword/model.py::Model.predict`)
//! since there's no Rust port of the library itself. Runs continuously on a background
//! thread; on detection it emits a `wake-word-detected` Tauri event, which the frontend
//! treats exactly like the tray's "Toggle Voice" action.

use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::sync::mpsc;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ort::session::Session;
use ort::value::Tensor;
use tauri::{AppHandle, Emitter};

const SAMPLE_RATE: u32 = 16_000;
const CHUNK_SAMPLES: usize = 1280; // 80ms @ 16kHz, openWakeWord's native frame size
const MELSPEC_CONTEXT_SAMPLES: usize = 160 * 3; // look-back context openWakeWord takes for each melspectrogram update
const MEL_BINS: usize = 32;
const EMBEDDING_WINDOW_FRAMES: usize = 76; // mel-frames per embedding-model call
const EMBEDDING_HOP_FRAMES: usize = 8; // mel-frames advanced per new 80ms chunk
const EMBEDDING_DIM: usize = 96;
const CLASSIFIER_WINDOW: usize = 16; // stacked embeddings per classifier call
const RAW_BUFFER_MAX_SAMPLES: usize = SAMPLE_RATE as usize * 10; // 10s ring buffer, matches upstream
const MELSPEC_BUFFER_MAX_ROWS: usize = 10 * 97; // ~10s of mel frames, matches upstream
const FEATURE_BUFFER_MAX_ROWS: usize = 120; // ~10s of embedding history, matches upstream
const WARMUP_CALLS: u32 = 5; // upstream zeroes predictions for the first 5 calls while buffers fill

/// Faithful port of `openwakeword.utils.AudioFeatures` + the classifier call in
/// `openwakeword.model.Model.predict`, minus everything Screendial doesn't use
/// (tflite, VAD, multi-model batching, verifier models).
pub struct WakeWordDetector {
    melspec_session: Session,
    embedding_session: Session,
    classifier_session: Session,

    raw_data_buffer: VecDeque<i16>,
    raw_data_remainder: Vec<i16>,
    accumulated_samples: usize,
    melspectrogram_buffer: Vec<[f32; MEL_BINS]>,
    feature_buffer: Vec<[f32; EMBEDDING_DIM]>,
    warmup_calls_remaining: u32,
}

impl WakeWordDetector {
    pub fn new(melspec_path: &Path, embedding_path: &Path, classifier_path: &Path) -> Result<Self, String> {
        let build = |path: &Path| -> Result<Session, String> {
            Session::builder()
                .map_err(|e| format!("Failed to create ONNX session builder: {e}"))?
                .commit_from_file(path)
                .map_err(|e| format!("Failed to load ONNX model at {}: {e}", path.display()))
        };

        let melspec_session = build(melspec_path)?;
        let embedding_session = build(embedding_path)?;
        let classifier_session = build(classifier_path)?;

        // Seed the melspectrogram buffer with `ones`, matching upstream's initial state
        // (openwakeword/utils.py: `self.melspectrogram_buffer = np.ones((76, 32))`).
        let melspectrogram_buffer = vec![[1.0f32; MEL_BINS]; EMBEDDING_WINDOW_FRAMES];

        Ok(Self {
            melspec_session,
            embedding_session,
            classifier_session,
            raw_data_buffer: VecDeque::with_capacity(RAW_BUFFER_MAX_SAMPLES),
            raw_data_remainder: Vec::new(),
            accumulated_samples: 0,
            melspectrogram_buffer,
            feature_buffer: Vec::new(),
            warmup_calls_remaining: WARMUP_CALLS,
        })
    }

    /// Feeds a chunk of 16kHz mono PCM16 audio (any length) into the detector and returns
    /// the current wake-word score (0.0-1.0ish; not guaranteed calibrated beyond that the
    /// custom classifier's own final layer produces it). Returns 0.0 while buffers are
    /// still warming up, matching upstream's behavior.
    pub fn process_chunk(&mut self, chunk: &[i16]) -> Result<f32, String> {
        let mut samples = if self.raw_data_remainder.is_empty() {
            chunk.to_vec()
        } else {
            let mut v = std::mem::take(&mut self.raw_data_remainder);
            v.extend_from_slice(chunk);
            v
        };

        if self.accumulated_samples + samples.len() >= CHUNK_SAMPLES {
            let remainder = (self.accumulated_samples + samples.len()) % CHUNK_SAMPLES;
            if remainder != 0 {
                let split_at = samples.len() - remainder;
                self.raw_data_remainder = samples.split_off(split_at);
                self.accumulated_samples += samples.len();
                self.raw_data_buffer.extend(samples.iter().copied());
            } else {
                self.accumulated_samples += samples.len();
                self.raw_data_buffer.extend(samples.iter().copied());
            }
        } else {
            self.accumulated_samples += samples.len();
            self.raw_data_buffer.extend(samples.iter().copied());
        }

        while self.raw_data_buffer.len() > RAW_BUFFER_MAX_SAMPLES {
            self.raw_data_buffer.pop_front();
        }

        if self.accumulated_samples >= CHUNK_SAMPLES && self.accumulated_samples % CHUNK_SAMPLES == 0 {
            self.update_melspectrogram(self.accumulated_samples)?;
            self.update_embeddings(self.accumulated_samples)?;
            self.accumulated_samples = 0;
        }

        if self.feature_buffer.len() > FEATURE_BUFFER_MAX_ROWS {
            let excess = self.feature_buffer.len() - FEATURE_BUFFER_MAX_ROWS;
            self.feature_buffer.drain(0..excess);
        }

        let score = if self.feature_buffer.len() >= CLASSIFIER_WINDOW {
            let start = self.feature_buffer.len() - CLASSIFIER_WINDOW;
            let window: Vec<[f32; EMBEDDING_DIM]> = self.feature_buffer[start..].to_vec();
            self.run_classifier(&window)?
        } else {
            0.0
        };

        if self.warmup_calls_remaining > 0 {
            self.warmup_calls_remaining -= 1;
            Ok(0.0)
        } else {
            Ok(score)
        }
    }

    fn update_melspectrogram(&mut self, n_samples: usize) -> Result<(), String> {
        let take_n = n_samples + MELSPEC_CONTEXT_SAMPLES;
        let start = self.raw_data_buffer.len().saturating_sub(take_n);
        let slice: Vec<i16> = self.raw_data_buffer.iter().skip(start).copied().collect();

        let new_rows = self.run_melspectrogram(&slice)?;
        self.melspectrogram_buffer.extend(new_rows);

        if self.melspectrogram_buffer.len() > MELSPEC_BUFFER_MAX_ROWS {
            let excess = self.melspectrogram_buffer.len() - MELSPEC_BUFFER_MAX_ROWS;
            self.melspectrogram_buffer.drain(0..excess);
        }

        Ok(())
    }

    fn update_embeddings(&mut self, n_samples: usize) -> Result<(), String> {
        let n_new_chunks = n_samples / CHUNK_SAMPLES;
        for i in (0..n_new_chunks).rev() {
            let offset = EMBEDDING_HOP_FRAMES * i;
            let Some(end) = self.melspectrogram_buffer.len().checked_sub(offset) else { continue };
            let Some(start) = end.checked_sub(EMBEDDING_WINDOW_FRAMES) else { continue };
            if end - start != EMBEDDING_WINDOW_FRAMES {
                continue;
            }
            let window: Vec<[f32; MEL_BINS]> = self.melspectrogram_buffer[start..end].to_vec();
            let embedding = self.run_embedding(&window)?;
            self.feature_buffer.push(embedding);
        }
        Ok(())
    }

    /// Runs `melspectrogram.onnx` on raw PCM16 samples (as float32, matching upstream's
    /// direct `int16 -> float32` cast with no [-1, 1] normalization) and applies the same
    /// `x/10 + 2` transform upstream uses to match the reference TensorFlow implementation.
    fn run_melspectrogram(&mut self, samples: &[i16]) -> Result<Vec<[f32; MEL_BINS]>, String> {
        let data: Vec<f32> = samples.iter().map(|&s| s as f32).collect();
        let input = Tensor::from_array((vec![1i64, data.len() as i64], data))
            .map_err(|e| format!("melspectrogram input tensor: {e}"))?;
        let outputs = self
            .melspec_session
            .run(ort::inputs![input])
            .map_err(|e| format!("melspectrogram inference: {e}"))?;
        let array = outputs[0]
            .try_extract_array::<f32>()
            .map_err(|e| format!("melspectrogram output: {e}"))?;

        let flat: Vec<f32> = array.iter().copied().collect();
        if flat.len() % MEL_BINS != 0 {
            return Err(format!(
                "melspectrogram output length {} isn't a multiple of {MEL_BINS} mel bins",
                flat.len()
            ));
        }

        let rows = flat
            .chunks_exact(MEL_BINS)
            .map(|row| {
                let mut out = [0f32; MEL_BINS];
                for (o, v) in out.iter_mut().zip(row) {
                    // Arbitrary transform openWakeWord applies to the raw ONNX melspectrogram
                    // output to match Google's reference TensorFlow speech_embedding model.
                    *o = v / 10.0 + 2.0;
                }
                out
            })
            .collect();

        Ok(rows)
    }

    fn run_embedding(&mut self, window: &[[f32; MEL_BINS]]) -> Result<[f32; EMBEDDING_DIM], String> {
        debug_assert_eq!(window.len(), EMBEDDING_WINDOW_FRAMES);
        let mut data = Vec::with_capacity(EMBEDDING_WINDOW_FRAMES * MEL_BINS);
        for row in window {
            data.extend_from_slice(row);
        }
        let input = Tensor::from_array((vec![1i64, EMBEDDING_WINDOW_FRAMES as i64, MEL_BINS as i64, 1i64], data))
            .map_err(|e| format!("embedding input tensor: {e}"))?;
        let outputs = self
            .embedding_session
            .run(ort::inputs![input])
            .map_err(|e| format!("embedding inference: {e}"))?;
        let array = outputs[0]
            .try_extract_array::<f32>()
            .map_err(|e| format!("embedding output: {e}"))?;

        let mut out = [0f32; EMBEDDING_DIM];
        for (o, v) in out.iter_mut().zip(array.iter()) {
            *o = *v;
        }
        Ok(out)
    }

    fn run_classifier(&mut self, window: &[[f32; EMBEDDING_DIM]]) -> Result<f32, String> {
        debug_assert_eq!(window.len(), CLASSIFIER_WINDOW);
        let mut data = Vec::with_capacity(CLASSIFIER_WINDOW * EMBEDDING_DIM);
        for row in window {
            data.extend_from_slice(row);
        }
        let input = Tensor::from_array((vec![1i64, CLASSIFIER_WINDOW as i64, EMBEDDING_DIM as i64], data))
            .map_err(|e| format!("classifier input tensor: {e}"))?;
        let outputs = self
            .classifier_session
            .run(ort::inputs![input])
            .map_err(|e| format!("classifier inference: {e}"))?;
        let array = outputs[0]
            .try_extract_array::<f32>()
            .map_err(|e| format!("classifier output: {e}"))?;

        array
            .iter()
            .next()
            .copied()
            .ok_or_else(|| "classifier produced no output".to_string())
    }
}

/// Streaming linear resampler + mono downmixer, converting whatever format/rate the mic
/// gives us into 16kHz mono, which is all openWakeWord's models accept.
struct Resampler {
    in_rate: f64,
    out_rate: f64,
    pos: f64,
    tail: Vec<f32>,
}

impl Resampler {
    fn new(in_rate: u32, out_rate: u32) -> Self {
        Self {
            in_rate: in_rate as f64,
            out_rate: out_rate as f64,
            pos: 0.0,
            tail: Vec::new(),
        }
    }

    /// `input` is mono, in "raw PCM16 magnitude" scale (i.e. NOT normalized to [-1, 1]).
    fn push(&mut self, input: &[f32]) -> Vec<f32> {
        self.tail.extend_from_slice(input);

        let step = self.in_rate / self.out_rate;
        let mut out = Vec::new();
        while self.pos + 1.0 < self.tail.len() as f64 {
            let idx = self.pos as usize;
            let frac = (self.pos - idx as f64) as f32;
            let s0 = self.tail[idx];
            let s1 = self.tail[idx + 1];
            out.push(s0 + (s1 - s0) * frac);
            self.pos += step;
        }

        let consumed = self.pos as usize;
        if consumed > 0 {
            self.tail.drain(0..consumed.min(self.tail.len()));
            self.pos -= consumed as f64;
        }

        out
    }
}

fn downmix_to_mono(data: &[f32], channels: u16) -> Vec<f32> {
    if channels <= 1 {
        return data.to_vec();
    }
    let channels = channels as usize;
    data.chunks_exact(channels)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect()
}

/// Model file names expected inside the resource directory passed to [`spawn`].
pub struct WakeWordModelPaths {
    pub melspectrogram: PathBuf,
    pub embedding: PathBuf,
    pub classifier: PathBuf,
}

/// Starts continuous "Screendial" wake-word listening on a dedicated background thread.
/// Non-fatal: logs and returns early if the mic or models can't be opened, since the
/// tray/mic-button voice path must keep working regardless of wake-word availability.
pub fn spawn(app: AppHandle, models: WakeWordModelPaths, threshold: f32) {
    std::thread::spawn(move || {
        if let Err(err) = run(app, models, threshold) {
            eprintln!("[Screendial] Wake-word listener disabled: {err}");
        }
    });
}

fn run(app: AppHandle, models: WakeWordModelPaths, threshold: f32) -> Result<(), String> {
    let mut detector = WakeWordDetector::new(&models.melspectrogram, &models.embedding, &models.classifier)?;

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "No default microphone input device available".to_string())?;
    let config = device
        .default_input_config()
        .map_err(|e| format!("Could not read default microphone config: {e}"))?;

    let in_rate = config.sample_rate().0;
    let channels = config.channels();
    let sample_format = config.sample_format();

    // Bounded so a stalled worker thread can't grow this unbounded; dropping frames under
    // backpressure is preferable to blocking the real-time audio callback.
    let (tx, rx) = mpsc::sync_channel::<Vec<f32>>(64);

    let err_fn = |err| eprintln!("[Screendial] Wake-word audio stream error: {err}");
    let stream_config: cpal::StreamConfig = config.into();

    let stream = match sample_format {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &stream_config,
            move |data: &[f32], _| {
                // cpal's f32 samples are normalized to [-1, 1]; scale back to PCM16 magnitude.
                let scaled: Vec<f32> = data.iter().map(|&s| s * 32768.0).collect();
                let _ = tx.try_send(scaled);
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::I16 => device.build_input_stream(
            &stream_config,
            move |data: &[i16], _| {
                let scaled: Vec<f32> = data.iter().map(|&s| s as f32).collect();
                let _ = tx.try_send(scaled);
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::U16 => device.build_input_stream(
            &stream_config,
            move |data: &[u16], _| {
                let scaled: Vec<f32> = data.iter().map(|&s| s as f32 - 32768.0).collect();
                let _ = tx.try_send(scaled);
            },
            err_fn,
            None,
        ),
        other => return Err(format!("Unsupported microphone sample format: {other:?}")),
    }
    .map_err(|e| format!("Could not open microphone input stream: {e}"))?;

    stream
        .play()
        .map_err(|e| format!("Could not start microphone input stream: {e}"))?;

    println!("[Screendial] Wake-word listener active (mic @ {in_rate}Hz, {channels}ch -> 16kHz mono).");
    let debug = std::env::var("SCREENDIAL_WAKE_DEBUG").is_ok_and(|v| v == "1");

    let mut resampler = Resampler::new(in_rate, SAMPLE_RATE);
    let mut pending: Vec<i16> = Vec::new();
    let mut above_threshold = false;
    let mut chunk_count: u64 = 0;

    while let Ok(frame) = rx.recv() {
        let mono = downmix_to_mono(&frame, channels);
        let resampled = resampler.push(&mono);
        pending.extend(resampled.iter().map(|&s| s.round().clamp(i16::MIN as f32, i16::MAX as f32) as i16));

        while pending.len() >= CHUNK_SAMPLES {
            let chunk: Vec<i16> = pending.drain(0..CHUNK_SAMPLES).collect();
            chunk_count += 1;
            match detector.process_chunk(&chunk) {
                Ok(score) => {
                    if debug {
                        let peak = chunk.iter().map(|&s| s.unsigned_abs()).max().unwrap_or(0);
                        println!("[Screendial][wake-debug] chunk={chunk_count} score={score:.4} mic_peak={peak}");
                    }
                    if score >= threshold {
                        if !above_threshold {
                            above_threshold = true;
                            println!("[Screendial] Wake word detected (score {score:.2}).");
                            let _ = app.emit("wake-word-detected", ());
                        }
                    } else {
                        above_threshold = false;
                    }
                }
                Err(err) => eprintln!("[Screendial] Wake-word processing error: {err}"),
            }
        }
    }

    Ok(())
}
