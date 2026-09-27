import { ElevenLabsService } from "./elevenlabs";

export interface RecordedAudio {
  blob: Blob;
  base64: string;
  mimeType: string;
}

export class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;
  private isAudioEnabled: boolean = false;
  private speechAudio: HTMLAudioElement | null = null;
  private elevenLabs: ElevenLabsService;

  constructor(
    initialAudioEnabled: boolean = false,
    elevenLabs: ElevenLabsService = new ElevenLabsService()
  ) {
    this.isAudioEnabled = initialAudioEnabled;
    this.elevenLabs = elevenLabs;
    this.preloadSounds();
  }

  public setAudioEnabled(enabled: boolean): void {
    this.isAudioEnabled = enabled;
    if (!enabled) {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      this.speechAudio?.pause();
      this.speechAudio = null;
    }
  }

  public toggleAudio(): boolean {
    this.setAudioEnabled(!this.isAudioEnabled);
    return this.isAudioEnabled;
  }

  public isAudioOutputEnabled(): boolean {
    return this.isAudioEnabled;
  }

  private preloadSounds() {
    const soundNames = [
      "listening_started",
      "listening_ended",
      "processing",
      "results_back",
      "agent_done"
    ];

    for (const name of soundNames) {
      const audio = new Audio(`/sounds/${name}.mp3`);
      audio.preload = "auto";
      this.sounds.set(name, audio);
    }
  }

  public playSound(name: string) {
    if (!this.isAudioEnabled) return;
    const audio = this.sounds.get(name);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch((err) => console.warn(`Sound '${name}' play failed:`, err));
    }
  }

  public async startRecording(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.playSound("listening_started");
      return true;
    } catch (err) {
      console.error("Microphone access error:", err);
      return false;
    }
  }

  public async stopRecording(): Promise<RecordedAudio | null> {
    if (!this.mediaRecorder || !this.isRecording) return null;

    return new Promise((resolve, reject) => {
      this.mediaRecorder!.onstop = async () => {
        const mimeType =
          this.mediaRecorder?.mimeType ||
          this.audioChunks.find((chunk) => chunk.type)?.type ||
          "application/octet-stream";
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
        this.isRecording = false;
        this.playSound("listening_ended");

        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error("Could not read recorded audio."));
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          if (typeof reader.result !== "string") {
            reject(new Error("Could not encode recorded audio."));
            return;
          }
          const base64Data = reader.result.split(",")[1];
          if (!base64Data) {
            reject(new Error("Recorded audio was empty."));
            return;
          }
          resolve({ blob: audioBlob, base64: base64Data, mimeType });
        };
      };

      this.mediaRecorder!.stop();
    });
  }

  public get recordingActive(): boolean {
    return this.isRecording;
  }

  public speak(
    text: string,
    onStart?: () => void,
    onDone?: () => void
  ): void {
    if (!this.isAudioEnabled) {
      onStart?.();
      onDone?.();
      return;
    }

    void this.prepareSpeech(text, onDone).then((play) => {
      onStart?.();
      play();
    });
  }

  /**
   * Synthesizes speech ahead of time (the ElevenLabs network round trip) and returns a
   * function that starts playback instantly. Lets a caller line narration up with other
   * output — e.g. visual tools dispatched from the same model response — so playback
   * begins the moment everything is ready instead of lagging behind while the audio is
   * still being fetched.
   */
  public async prepareSpeech(text: string, onDone?: () => void): Promise<() => void> {
    if (!this.isAudioEnabled) {
      return () => onDone?.();
    }

    if (!this.elevenLabs.canSpeak()) {
      return () => this.speakWithBrowser(text, undefined, onDone);
    }

    try {
      const audioBlob = await this.elevenLabs.synthesizeSpeech(text);
      if (!this.isAudioEnabled) {
        return () => onDone?.();
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.preload = "auto";

      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        URL.revokeObjectURL(audioUrl);
        if (this.speechAudio === audio) this.speechAudio = null;
      };
      const useBrowserFallback = () => {
        cleanup();
        if (this.isAudioEnabled) {
          this.speakWithBrowser(text, undefined, onDone);
        } else {
          onDone?.();
        }
      };

      return () => {
        this.speechAudio = audio;
        audio.onended = () => {
          cleanup();
          this.playSound("agent_done");
          onDone?.();
        };
        audio.onerror = () => {
          console.warn("[AudioManager] Prepared ElevenLabs audio failed to play; using browser speech.");
          useBrowserFallback();
        };
        audio.play().catch((err) => {
          console.warn("[AudioManager] Prepared speech could not start; using browser speech:", err);
          useBrowserFallback();
        });
      };
    } catch (err) {
      console.warn("[AudioManager] Failed to prepare ElevenLabs speech; falling back to browser voice:", err);
      return () => this.speakWithBrowser(text, undefined, onDone);
    }
  }

  private speakWithBrowser(
    text: string,
    onStart?: () => void,
    onDone?: () => void
  ): void {
    if (!this.isAudioEnabled) {
      onDone?.();
      return;
    }

    if (!("speechSynthesis" in window)) {
      onStart?.();
      onDone?.();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick best available voice (English natural / Ava / Samantha / Daniel)
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Samantha") ||
          v.name.includes("Ava") ||
          v.name.includes("Natural") ||
          v.name.includes("Google") ||
          v.name.includes("Siri"))
    ) || voices.find((v) => v.lang.startsWith("en"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    let started = false;
    utterance.onstart = () => {
      started = true;
      onStart?.();
    };

    utterance.onend = () => {
      this.playSound("agent_done");
      onDone?.();
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      if (!started) onStart?.();
      onDone?.();
    };

    window.speechSynthesis.speak(utterance);
  }
}
