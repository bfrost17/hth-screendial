import { ClientTool, ToDoOverlayArgs } from "../types";

/**
 * Tool for displaying an interactive checklist or to-do list on a specific screen overlay.
 */
export class ToDoOverlayTool implements ClientTool {
  public name = "to_do_overlay";

  public declaration = {
    name: "to_do_overlay",
    description: "Displays an interactive checklist of tasks or workflow steps on the specified screen/monitor ID so users can track their progress step-by-step.",
    parameters: {
      type: "OBJECT",
      properties: {
        screen_id: {
          type: "STRING",
          description: "The targeted monitor or screen ID (e.g. \"0\" for primary, \"1\", etc.) to display the checklist on."
        },
        title: {
          type: "STRING",
          description: "Title of the checklist, e.g. \"DaVinci Export Steps\""
        },
        items: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "An ordered list of workflow tasks or checklist steps."
        }
      },
      required: ["screen_id", "title", "items"]
    }
  };

  /**
   * Executes the to-do checklist display rendering on the overlay.
   */
  public async execute(args: ToDoOverlayArgs, overlayInstance: any, _audioInstance: any, layout?: any): Promise<void> {
    console.log(`[ToDoOverlayTool] Displaying checklist on Screen ${args.screen_id || 0}:`, args);
    if (overlayInstance && typeof overlayInstance.renderWidget === "function") {
      overlayInstance.renderWidget({
        widget_type: "checklist",
        title: `${args.title} (Screen ${args.screen_id || 0})`,
        items: args.items,
        screen_id: args.screen_id
      }, undefined, layout);
    }
  }
}
