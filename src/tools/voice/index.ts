import { ClientTool, VoiceArgs } from "../types";

/**
 * Tool for synthesizing real-time spoken guidance to the user.
 */
export class VoiceTool implements ClientTool {
  public name = "voice";

  public declaration = {
    name: "voice",
    description: "Speaks actionable real-time guidance directly to the user through high-quality synthetic voice output. Always use when giving spoken advice or guiding the user verbally.",
    parameters: {
      type: "OBJECT",
      properties: {
        text: {
          type: "STRING",
          description: "Clear, succinct verbal instructions or explanations to speak out loud."
        }
      },
      required: ["text"]
    }
  };

  /**
   * Executes the spoken audio synthesis.
   */
  public async execute(args: VoiceArgs, _overlayInstance: any, audioInstance: any): Promise<void> {
    console.log("[VoiceTool] Synthesizing spoken voice:", args.text);
    if (audioInstance && typeof audioInstance.speak === "function") {
      await audioInstance.speak(args.text);
    }
  }
}
