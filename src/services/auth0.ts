import { logToTerminal } from "./terminalLog";

export const AUTH0_DOMAIN =
  import.meta.env.VITE_AUTH0_DOMAIN || "dev-f8tc8m2ocimu3olh.us.auth0.com";
export const AUTH0_CLIENT_ID =
  import.meta.env.VITE_AUTH0_CLIENT_ID || "2ZGjnWbSmUZJgKTtpXbYCTUfP6Rr1NMu";

/** Default Auth0 database connection name */
const AUTH0_CONNECTION = "Username-Password-Authentication";
const LOCAL_AUTH_KEY = "screendial_auth_session";

export interface AuthUserProfile {
  email: string;
  name?: string;
  sub?: string;
  picture?: string;
}

interface Auth0TokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface Auth0UserInfo {
  sub: string;
  email: string;
  name?: string;
  nickname?: string;
  picture?: string;
  email_verified?: boolean;
}

/**
 * Robust parser for Auth0 error responses.
 * Auth0 returns different structures depending on the error type:
 * - Password policy: { name: "PasswordStrengthError", policy: "* At least 15 chars...", description: { rules: [...] } }
 * - Bad credentials: { error: "invalid_grant", error_description: "Wrong email or password." }
 * - Invalid signup: { name: "BadRequestError", description: "The user already exists." }
 */
function extractAuth0ErrorMessage(rawBody: string, status: number): string {
  if (!rawBody || !rawBody.trim()) {
    return `Request failed with HTTP ${status}.`;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return rawBody;
  }

  if (typeof parsed === "string") {
    return parsed;
  }

  // 1. Password policy error
  if (parsed.policy && typeof parsed.policy === "string") {
    const lines = parsed.policy
      .split("\n")
      .map((l: string) => l.replace(/^\*\s*/, "").trim())
      .filter(Boolean);
    if (lines.length > 0) {
      return `Password requirement: ${lines.join("; ")}`;
    }
  }

  // 2. Rules array in description
  if (
    parsed.description &&
    typeof parsed.description === "object" &&
    Array.isArray(parsed.description.rules)
  ) {
    const unverified = parsed.description.rules.find((r: any) => r.verified === false);
    if (unverified?.message) {
      let msg: string = unverified.message;
      if (Array.isArray(unverified.format) && unverified.format.length > 0) {
        msg = msg.replace(/%d/g, String(unverified.format[0]));
      }
      return `Password requirement: ${msg}`;
    }
  }

  // 3. String description
  if (typeof parsed.description === "string" && parsed.description.trim()) {
    return parsed.description;
  }

  // 4. String error_description
  if (typeof parsed.error_description === "string" && parsed.error_description.trim()) {
    return parsed.error_description;
  }

  // 5. String message
  if (typeof parsed.message === "string" && parsed.message.trim()) {
    return parsed.message;
  }

  // 6. String error
  if (typeof parsed.error === "string" && parsed.error.trim()) {
    return parsed.error;
  }

  return `Authentication error (HTTP ${status}).`;
}

export class AuthService {
  private currentUser: AuthUserProfile | null = null;

  async init(): Promise<void> {
    logToTerminal("Auth0", "Initializing auth service...");
    logToTerminal("Auth0", `Domain: ${AUTH0_DOMAIN} | Client: ${AUTH0_CLIENT_ID}`);

    const stored = localStorage.getItem(LOCAL_AUTH_KEY);
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
        logToTerminal("Auth0", `Restored session for: ${this.currentUser?.email}`);
      } catch {
        logToTerminal("Auth0", "Corrupt stored session cleared.");
        localStorage.removeItem(LOCAL_AUTH_KEY);
      }
    } else {
      logToTerminal("Auth0", "No active session in localStorage.");
    }
  }

  /**
   * Sign up a new user via Auth0 Database Signup endpoint:
   * POST https://{domain}/dbconnections/signup
   */
  async signup(email: string, password: string): Promise<AuthUserProfile> {
    logToTerminal("Auth0", `[SIGNUP] Starting signup for: ${email}`);

    if (!email || !email.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    const url = `https://${AUTH0_DOMAIN}/dbconnections/signup`;
    const payload = {
      client_id: AUTH0_CLIENT_ID,
      email,
      password,
      connection: AUTH0_CONNECTION,
    };

    logToTerminal("Auth0", `[SIGNUP] POST ${url}`);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (networkErr: any) {
      logToTerminal("Auth0", `[SIGNUP] Network error: ${networkErr.message}`);
      throw new Error(`Network failure: ${networkErr.message}`);
    }

    logToTerminal("Auth0", `[SIGNUP] Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errBody = await res.text();
      logToTerminal("Auth0", `[SIGNUP] Error response from Auth0: ${errBody}`);
      const friendlyMsg = extractAuth0ErrorMessage(errBody, res.status);
      logToTerminal("Auth0", `[SIGNUP] Parsed error: "${friendlyMsg}"`);
      throw new Error(friendlyMsg);
    }

    const data = await res.json();
    logToTerminal("Auth0", `[SIGNUP] User successfully created in Auth0:`, {
      _id: data._id,
      email: data.email,
    });

    // Automatically log in newly created user to exchange tokens
    logToTerminal("Auth0", `[SIGNUP] Automatically logging in user after signup...`);
    return this.login(email, password);
  }

  /**
   * Log in with email and password via Auth0's password-realm grant:
   * POST https://{domain}/oauth/token
   */
  async login(email: string, password: string): Promise<AuthUserProfile> {
    logToTerminal("Auth0", `[LOGIN] Starting login for: ${email}`);

    if (!email || !email.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    if (!password) {
      throw new Error("Please enter your password.");
    }

    const url = `https://${AUTH0_DOMAIN}/oauth/token`;
    // Auth0 password-realm grant connects directly to the Username-Password-Authentication directory
    const payload = {
      grant_type: "http://auth0.com/oauth/grant-type/password-realm",
      username: email,
      password,
      client_id: AUTH0_CLIENT_ID,
      realm: AUTH0_CONNECTION,
      scope: "openid profile email",
    };

    logToTerminal("Auth0", `[LOGIN] POST ${url}`);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (networkErr: any) {
      logToTerminal("Auth0", `[LOGIN] Network error: ${networkErr.message}`);
      throw new Error(`Network failure: ${networkErr.message}`);
    }

    logToTerminal("Auth0", `[LOGIN] Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errBody = await res.text();
      logToTerminal("Auth0", `[LOGIN] Error response from Auth0: ${errBody}`);
      const friendlyMsg = extractAuth0ErrorMessage(errBody, res.status);
      logToTerminal("Auth0", `[LOGIN] Parsed error: "${friendlyMsg}"`);
      throw new Error(friendlyMsg);
    }

    const tokens: Auth0TokenResponse = await res.json();
    logToTerminal("Auth0", `[LOGIN] Tokens received successfully (expires_in: ${tokens.expires_in}s)`);

    // Fetch user profile from Auth0 /userinfo
    const profile = await this.fetchUserInfo(tokens.access_token);

    this.currentUser = profile;
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(profile));

    logToTerminal("Auth0", `[LOGIN] Login complete! User: ${profile.email}`);
    return profile;
  }

  /**
   * Fetch user info from Auth0's /userinfo endpoint
   */
  private async fetchUserInfo(accessToken: string): Promise<AuthUserProfile> {
    const url = `https://${AUTH0_DOMAIN}/userinfo`;
    logToTerminal("Auth0", `[USERINFO] GET ${url}`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    logToTerminal("Auth0", `[USERINFO] Status: ${res.status}`);

    if (!res.ok) {
      const errBody = await res.text();
      logToTerminal("Auth0", `[USERINFO] Failed: ${errBody}`);
      throw new Error(`Failed to fetch user profile (HTTP ${res.status}).`);
    }

    const info: Auth0UserInfo = await res.json();
    logToTerminal("Auth0", `[USERINFO] Profile fetched: ${info.email} (sub: ${info.sub})`);

    return {
      email: info.email,
      name: info.name || info.nickname || info.email.split("@")[0],
      sub: info.sub,
      picture: info.picture,
    };
  }

  async logout(): Promise<void> {
    logToTerminal("Auth0", `[LOGOUT] Logging out: ${this.currentUser?.email || "anonymous"}`);
    this.currentUser = null;
    localStorage.removeItem(LOCAL_AUTH_KEY);
    logToTerminal("Auth0", `[LOGOUT] Session cleared.`);
  }

  async isAuthenticated(): Promise<boolean> {
    if (this.currentUser) {
      return true;
    }

    const stored = localStorage.getItem(LOCAL_AUTH_KEY);
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
        return true;
      } catch {
        localStorage.removeItem(LOCAL_AUTH_KEY);
      }
    }
    return false;
  }

  async getUser(): Promise<AuthUserProfile | undefined> {
    return this.currentUser || undefined;
  }
}

export const authService = new AuthService();
