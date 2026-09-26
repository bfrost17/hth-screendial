export class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;

  private isAudioEnabled: boolean = false;

  constructor(initialAudioEnabled: boolean = false) {
    this.isAudioEnabled = initialAudioEnabled;
    this.preloadSounds();
  }

  public setAudioEnabled(enabled: boolean): void {
    this.isAudioEnabled = enabled;
    if (!enabled && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
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

  public async stopRecording(): Promise<string | null> {
    if (!this.mediaRecorder || !this.isRecording) return null;

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = (reader.result as string).split(",")[1];
          resolve(base64Data);
        };
        // Stop audio tracks
        this.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
        this.isRecording = false;
        this.playSound("listening_ended");
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
      if (onStart) onStart();
      if (onDone) onDone();
      return;
    }

    if (!("speechSynthesis" in window)) {
      if (onStart) onStart();
      if (onDone) onDone();
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
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.playSound("agent_done");
      if (onDone) onDone();
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      if (!started && onStart) onStart();
      if (onDone) onDone();
    };

    window.speechSynthesis.speak(utterance);
  }
}
