import { ClientTool, OverlayArgs } from "../types";

/**
 * Tool for displaying regular guidance text on a specific monitor/screen overlay.
 */
export class OverlayTool implements ClientTool {
  public name = "overlay";

  public declaration = {
    name: "overlay",
    description: "Displays normal, clean guidance or descriptive text on the specified screen/monitor ID to explain workflows or answer general questions.",
    parameters: {
      type: "OBJECT",
      properties: {
        screen_id: {
          type: "STRING",
          description: "The targeted monitor or screen ID (e.g. \"0\" for primary, \"1\", etc.) to display the overlay on."
        },
        text: {
          type: "STRING",
          description: "Succinct, descriptive guidance text or answer to the user's query."
        }
      },
      required: ["screen_id", "text"]
    }
  };

  /**
   * Executes the normal text display rendering on the overlay.
   */
  public async execute(args: OverlayArgs, overlayInstance: any, _audioInstance: any, layout?: any): Promise<void> {
    console.log(`[OverlayTool] Displaying text on Screen ${args.screen_id || 0}:`, args.text);
    if (overlayInstance && typeof overlayInstance.renderCallout === "function") {
      overlayInstance.renderCallout({
        label: `Screendial Guidance (Screen ${args.screen_id || 0})`,
        text: args.text,
        screen_id: args.screen_id
      }, layout);
    }
  }
}
