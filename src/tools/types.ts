/**
 * Base argument structure for all screen-targeted tools.
 */
export interface BaseToolArgs {
  /**
   * The targeted monitor or screen ID.
   */
  screen_id?: number | string;
}

/**
 * Arguments for the Highlight visual grounding tool.
 */
export interface HighlightArgs extends BaseToolArgs {
  label: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0..1000
  explanation: string;
}

/**
 * Legacy compatibility interface for drawing highlights.
 */
export interface HighlightElementArgs {
  screen_id?: number | string;
  label: string;
  box_2d: [number, number, number, number];
  explanation: string;
}

/**
 * Arguments for the normal text display Overlay tool.
 */
export interface OverlayArgs extends BaseToolArgs {
  text: string;
}

/**
 * Arguments for the Code Display Overlay tool.
 */
export interface CodeOverlayArgs extends BaseToolArgs {
  title: string;
  code: string;
  language?: string;
}

/**
 * Arguments for the To-Do Checklist Overlay tool.
 */
export interface ToDoOverlayArgs extends BaseToolArgs {
  title: string;
  items: string[];
}

/**
 * Arguments for the Voice output synthesis tool.
 */
export interface VoiceArgs {
  text: string;
}

/**
 * Represents a standard structured tool call returned by the AI model.
 */
export interface ToolCall {
  tool: string;
  args: Record<string, any>;
}

export interface ActionButton {
  label: string;
  shortcut?: string[];
}

/**
 * Legacy compatibility interface for rendering widgets.
 */
export interface ShowOutputWidgetArgs {
  screen_id?: number | string;
  widget_type: "checklist" | "action_card" | "code_snippet" | "info_card";
  title: string;
  items?: string[];
  code?: string;
  action_buttons?: ActionButton[];
}

/**
 * Interface representing a captured monitor payload from Tauri.
 */
export interface ScreenCapturePayload {
  name: string;
  width: number;
  height: number;
  scale_factor: number;
  x: number;
  y: number;
  image_base64: string;
  mime_type: string;
}

export interface MonitorLayout {
  id: number;
  is_primary: boolean;
  name: string;
  logical_x: number;
  logical_y: number;
  logical_width: number;
  logical_height: number;
}

export interface DesktopLayout {
  virtual_x: number;
  virtual_y: number;
  virtual_width: number;
  virtual_height: number;
  monitors: MonitorLayout[];
}

/**
 * Base Interface representing an independent, executable client-side tool.
 */
export interface ClientTool {
  /**
   * Unique identifier name of the tool.
   */
  name: string;

  /**
   * Gemini function declaration schema.
   */
  declaration: Record<string, any>;

  /**
   * Executes the tool's core presentation or automation logic.
   * @param args The parameters passed from the AI model.
   * @param overlayInstance The active overlay UI component renderer.
   * @param audioInstance The active audio sound/speech synthesis controller.
   * @param layout The current desktop monitor layout geometry.
   */
  execute(args: any, overlayInstance: any, audioInstance: any, layout?: DesktopLayout): void | Promise<void>;
}
