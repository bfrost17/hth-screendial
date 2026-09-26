import { ModelCallTool } from "../tools/model_call";

/**
 * Backward-compatible wrapper exposing the new ModelCallTool 
 * under the legacy GeminiAgentService identifier.
 */
export class GeminiAgentService extends ModelCallTool {
  /**
   * Backward-compatible mapping of analyzeDesktop to ModelCallTool's execute method.
   */
  public async analyzeDesktop(
    screens: any,
    userQuery?: string,
    audioBase64?: string,
    activeApp?: string,
    skill?: any
  ): Promise<any> {
    // If we receive a single screen object rather than a dictionary (from legacy callers),
    // wrap it into a dictionary under key "0" (primary).
    const screensDict: Record<string, any> = screens && screens.image_base64 
      ? { "0": screens }
      : screens;

    return this.execute({
      screens: screensDict,
      userQuery,
      audioBase64,
      activeApp,
      skill
    });
  }
}
