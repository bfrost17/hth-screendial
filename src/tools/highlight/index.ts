import { ClientTool, HighlightArgs } from "../types";

/**
 * Tool for rendering visual highlights over physical UI elements.
 */
export class HighlightTool implements ClientTool {
  public name = "highlight";

  public declaration = {
    name: "highlight",
    description: "Draws a visual highlight bounding box and callout bubble over a physical UI element on the specified screen/monitor ID. Use ONLY when pointing out or locating a specific visible UI element is necessary or explicitly requested by the user.",
    parameters: {
      type: "OBJECT",
      properties: {
        screen_id: {
          type: "STRING",
          description: "The targeted monitor or screen ID (e.g. \"0\" for primary, \"1\", etc.) where the UI element is located."
        },
        label: {
          type: "STRING",
          description: "Descriptive name of the targeted button, input, menu, or element."
        },
        box_2d: {
          type: "ARRAY",
          items: { type: "INTEGER" },
          description: "Normalized bounding box coordinates [ymin, xmin, ymax, xmax] in the range 0 to 1000 relative to that specific screen."
        },
        explanation: {
          type: "STRING",
          description: "Clear, actionable step instruction displayed in the glass callout bubble."
        }
      },
      required: ["screen_id", "label", "box_2d", "explanation"]
    }
  };

  /**
   * Executes the visual highlight box drawing on the active overlay window.
   */
  public async execute(args: HighlightArgs, overlayInstance: any, _audioInstance: any, layout?: any): Promise<void> {
    console.log(`[HighlightTool] Executing highlight targeting Screen ${args.screen_id || 0}:`, args);
    // Draw the visual highlight directly on the overlay
    if (overlayInstance && typeof overlayInstance.renderHighlight === "function") {
      overlayInstance.renderHighlight({
        label: args.label,
        box_2d: args.box_2d,
        explanation: args.explanation,
        screen_id: args.screen_id
      }, layout);
    }
  }
}
