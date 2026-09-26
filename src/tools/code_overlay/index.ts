import { ClientTool, CodeOverlayArgs } from "../types";

/**
 * Tool for displaying code-formatted or terminal-styled snippets with copy capabilities on a specific screen overlay.
 */
export class CodeOverlayTool implements ClientTool {
  public name = "code_overlay";

  public declaration = {
    name: "code_overlay",
    description: "Displays a formatted code block or terminal/shell command with a copy utility on the specified screen/monitor ID. Use when showing commands, script blocks, or code edits.",
    parameters: {
      type: "OBJECT",
      properties: {
        screen_id: {
          type: "STRING",
          description: "The targeted monitor or screen ID (e.g. \"0\" for primary, \"1\", etc.) to display the code on."
        },
        title: {
          type: "STRING",
          description: "Descriptive title for this code snippet, e.g. \"Git Commit Command\""
        },
        code: {
          type: "STRING",
          description: "The raw code block, shell command, or script text."
        },
        language: {
          type: "STRING",
          description: "Optional language name for visual styling, e.g. \"bash\", \"javascript\", \"python\""
        }
      },
      required: ["screen_id", "title", "code"]
    }
  };

  /**
   * Executes the code display rendering on the overlay.
   */
  public async execute(args: CodeOverlayArgs, overlayInstance: any, _audioInstance: any, layout?: any): Promise<void> {
    console.log(`[CodeOverlayTool] Displaying code on Screen ${args.screen_id || 0}:`, args);
    if (overlayInstance && typeof overlayInstance.renderWidget === "function") {
      overlayInstance.renderWidget({
        widget_type: "code_snippet",
        title: `${args.title} (Screen ${args.screen_id || 0})`,
        code: args.code,
        screen_id: args.screen_id
      }, undefined, layout);
    }
  }
}
