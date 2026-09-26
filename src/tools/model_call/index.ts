import { ToolCall, ScreenCapturePayload } from "../types";
import { HighlightTool } from "../highlight";
import { OverlayTool } from "../overlay";
import { CodeOverlayTool } from "../code_overlay";
import { ToDoOverlayTool } from "../to_do_overlay";
import { VoiceTool } from "../voice";
import { Skill } from "../../skills";

/**
 * Chat message history contract.
 */
export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: number;
}

/**
 * Client-side tool orchestrator for invoking the Google Gemini Multimodal model.
 */
export class ModelCallTool {
  private apiKey: string = "";
  private modelName: string = "gemini-3.5-flash"; // Standard efficient multimodal reasoning model
  private chatHistory: ChatMessage[] = [];

  constructor() {
    this.apiKey =
      localStorage.getItem("screendial_api_key") ||
      (import.meta.env.VITE_GEMINI_API_KEY as string) ||
      "";
    this.modelName =
      localStorage.getItem("screendial_model") || "gemini-3.5-flash";
    this.loadHistory();
  }

  /**
   * Loads persisted conversation history from LocalStorage.
   */
  private loadHistory() {
    try {
      const saved = localStorage.getItem("screendial_chat_history");
      if (saved) {
        this.chatHistory = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("[ModelCallTool] Failed to parse chat history:", e);
      this.chatHistory = [];
    }
  }

  /**
   * Persists current conversation history to LocalStorage (cap at 20 turns).
   */
  private saveHistory() {
    try {
      if (this.chatHistory.length > 20) {
        this.chatHistory = this.chatHistory.slice(-20);
      }
      localStorage.setItem("screendial_chat_history", JSON.stringify(this.chatHistory));
    } catch (e) {
      console.warn("[ModelCallTool] Failed to save chat history:", e);
    }
  }

  /**
   * Retrieves conversation history.
   */
  public getHistory(): ChatMessage[] {
    return this.chatHistory;
  }

  /**
   * Completely clears local and session chat history.
   */
  public clearHistory(): void {
    this.chatHistory = [];
    localStorage.removeItem("screendial_chat_history");
    console.log("[ModelCallTool] Conversation history has been cleared.");
  }

  public setApiKey(key: string) {
    this.apiKey = key.trim();
    localStorage.setItem("screendial_api_key", this.apiKey);
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public setModelName(model: string) {
    this.modelName = model.trim();
    localStorage.setItem("screendial_model", this.modelName);
  }

  public getModelName(): string {
    return this.modelName;
  }

  public hasApiKey(): boolean {
    return this.apiKey.length > 5;
  }

  /**
   * Aggregates screen captures, user commands, and active application skills, 
   * submitting them to the Google Gemini API to return actionable visual tools.
   */
  public async execute(params: {
    screens: Record<string, ScreenCapturePayload>;
    userQuery?: string;
    audioBase64?: string;
    activeApp?: string;
    skill?: Skill;
  }): Promise<ToolCall[]> {
    if (!this.hasApiKey()) {
      throw new Error("GEMINI_API_KEY is not set. Please provide your API key in Settings.");
    }

    const appName = params.activeApp || "Desktop";
    const skillContent = params.skill
      ? `Active Skill: ${params.skill.name}\n${params.skill.content}`
      : "General desktop workflow guidance.";

    // Compile active display descriptors for the model
    let displayLayoutContext = "ACTIVE SCREEN GEOMETRY LOG:\n";
    for (const [id, s] of Object.entries(params.screens)) {
      displayLayoutContext += `- Screen ID "${id}": Name="${s.name}" resolution=${s.width}x${s.height} px, logical position=(${s.x}, ${s.y})\n`;
    }

    const systemInstruction = `
You are Screendial, an intelligent, real-time desktop copilot and workflow guide.
You observe the user's active screens, listen to their request, and provide immediate step-by-step visual guidance.

CRITICAL ROLE RULE:
You are strictly here for workflow guidance. You are a passive helper overlay—you DO NOT move the mouse cursor or press keyboard shortcuts for the user. Do not try to perform mechanical tasks.

Active Application: ${appName}
${skillContent}

${displayLayoutContext}

RULES FOR PRESENTATION:
1. Observe the provided screen captures and identify which screen/monitor ID is relevant to answer or fulfill the user request.
2. Under 'highlight', coordinates 'box_2d' are normalized [ymin, xmin, ymax, xmax] from 0 to 1000 relative to that specific screen's width and height.
3. You can present normal text guides via 'overlay', code snippets via 'code_overlay', and checklists via 'to_do_overlay'. Make sure to specify the correct target 'screen_id' as a string (e.g. "0", "1") for each tool.
4. Always accompany visual overlays with 'voice' spoken guidance providing clear, succinct audio feedback.
`;

    const contentsParts: any[] = [];

    // Attach all captured screens natively to the multimodal context
    for (const [id, s] of Object.entries(params.screens)) {
      contentsParts.push({
        text: `IMAGE CAPTURE FOR SCREEN ID "${id}" (${s.name}):`
      });
      contentsParts.push({
        inlineData: {
          mimeType: s.mime_type || "image/jpeg",
          data: s.image_base64
        }
      });
    }

    if (params.audioBase64) {
      contentsParts.push({
        inlineData: {
          mimeType: "audio/wav",
          data: params.audioBase64
        }
      });
    }

    if (params.userQuery) {
      contentsParts.push({
        text: `User Command/Query: ${params.userQuery}`
      });
    } else if (!params.audioBase64) {
      contentsParts.push({
        text: "What is on my screens and how can I interact with this application?"
      });
    }

    // Build chat history context
    const contents: any[] = [];
    for (const msg of this.chatHistory) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }]
      });
    }

    // Append current turn
    contents.push({
      role: "user",
      parts: contentsParts
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    // Map declarations of our client tools
    const toolDeclarations = [
      new HighlightTool().declaration,
      new OverlayTool().declaration,
      new CodeOverlayTool().declaration,
      new ToDoOverlayTool().declaration,
      new VoiceTool().declaration
    ];

    const requestBody = {
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      tools: [
        {
          functionDeclarations: toolDeclarations
        }
      ],
      generationConfig: {
        temperature: 0.15
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Multimodal API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const actions: ToolCall[] = [];
    let modelTextResponse = "";

    const candidate = data.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          actions.push({
            tool: part.functionCall.name,
            args: part.functionCall.args || {}
          });
          if (part.functionCall.name === "voice" && part.functionCall.args?.text) {
            modelTextResponse = part.functionCall.args.text;
          }
        } else if (part.text) {
          const text = part.text.trim();
          if (text) {
            modelTextResponse = text;
            if (actions.length === 0) {
              actions.push({
                tool: "voice",
                args: { text }
              });
            }
          }
        }
      }
    }

    // Persist session history
    const userPromptText = params.userQuery || (params.audioBase64 ? "[Voice Command]" : "[Screen Guidance]");
    this.chatHistory.push({
      id: crypto.randomUUID(),
      role: "user",
      text: userPromptText,
      timestamp: Date.now()
    });

    if (modelTextResponse) {
      this.chatHistory.push({
        id: crypto.randomUUID(),
        role: "model",
        text: modelTextResponse,
        timestamp: Date.now()
      });
    }

    this.saveHistory();

    return actions;
  }
}
