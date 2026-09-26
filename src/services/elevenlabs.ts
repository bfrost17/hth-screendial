export interface TranscriptionInput {
  audio: Blob;
  mimeType: string;
}

export class ElevenLabsService {
  private readonly apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY?.trim() ?? "";
  private readonly voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID?.trim() ?? "";
  private readonly transcriptionModel =
    import.meta.env.VITE_ELEVENLABS_STT_MODEL?.trim() || "scribe_v1";
  private readonly speechModel =
    import.meta.env.VITE_ELEVENLABS_TTS_MODEL?.trim() || "eleven_multilingual_v2";

  public canTranscribe(): boolean {
    return this.apiKey.length > 0;
  }

  public canSpeak(): boolean {
    return this.apiKey.length > 0 && this.voiceId.length > 0;
  }

  public async transcribe(input: TranscriptionInput): Promise<string> {
    if (!this.canTranscribe()) {
      throw new Error("ElevenLabs transcription requires VITE_ELEVENLABS_API_KEY.");
    }

    const formData = new FormData();
    formData.append("file", input.audio, this.getFileName(input.mimeType));
    formData.append("model_id", this.transcriptionModel);

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": this.apiKey },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs transcription failed (${response.status}).`);
    }

    const result: { text?: string } = await response.json();
    const transcript = result.text?.trim();
    if (!transcript) {
      throw new Error("ElevenLabs returned an empty transcript.");
    }

    return transcript;
  }

  public async synthesizeSpeech(text: string): Promise<Blob> {
    if (!this.canSpeak()) {
      throw new Error("ElevenLabs speech requires an API key and voice ID.");
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: this.speechModel,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs speech synthesis failed (${response.status}).`);
    }

    return response.blob();
  }

  private getFileName(mimeType: string): string {
    if (mimeType.includes("webm")) return "recording.webm";
    if (mimeType.includes("ogg")) return "recording.ogg";
    if (mimeType.includes("mp4")) return "recording.mp4";
    if (mimeType.includes("wav")) return "recording.wav";
    return "recording.audio";
  }
}
