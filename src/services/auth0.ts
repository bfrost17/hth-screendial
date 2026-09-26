export const AUTH0_DOMAIN =
  import.meta.env.VITE_AUTH0_DOMAIN || "dev-f8tc8m2ocimu3olh.us.auth0.com";
export const AUTH0_CLIENT_ID =
  import.meta.env.VITE_AUTH0_CLIENT_ID || "2ZGjnWbSmUZJgKTtpXbYCTUfP6Rr1NMu";

/** Default Auth0 database connection name */
const AUTH0_CONNECTION = "Username-Password-Authentication";
const LOCAL_AUTH_KEY = "screendial_auth_session";

const LOG_PREFIX = "[Auth0]";

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

interface Auth0ErrorResponse {
  error: string;
  error_description: string;
  statusCode?: number;
  message?: string;
  description?: string;
}

interface Auth0UserInfo {
  sub: string;
  email: string;
  name?: string;
  nickname?: string;
  picture?: string;
  email_verified?: boolean;
}

export class AuthService {
  private currentUser: AuthUserProfile | null = null;

  async init(): Promise<void> {
    console.log(`${LOG_PREFIX} Initializing auth service...`);
    console.log(`${LOG_PREFIX} Domain: ${AUTH0_DOMAIN}`);
    console.log(`${LOG_PREFIX} Client ID: ${AUTH0_CLIENT_ID}`);
    console.log(`${LOG_PREFIX} Connection: ${AUTH0_CONNECTION}`);

    // Restore session from localStorage on launch
    const stored = localStorage.getItem(LOCAL_AUTH_KEY);
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
        console.log(`${LOG_PREFIX} Restored session for: ${this.currentUser?.email}`);
      } catch {
        console.warn(`${LOG_PREFIX} Corrupt session in localStorage, clearing.`);
        localStorage.removeItem(LOCAL_AUTH_KEY);
      }
    } else {
      console.log(`${LOG_PREFIX} No stored session found.`);
    }
  }

  /**
   * Sign up a new user via Auth0's Database Signup endpoint.
   * POST https://{domain}/dbconnections/signup
   */
  async signup(email: string, password: string): Promise<AuthUserProfile> {
    console.log(`${LOG_PREFIX} ── SIGNUP START ──`);
    console.log(`${LOG_PREFIX} Email: ${email}`);

    if (!email || !email.includes("@")) {
      console.error(`${LOG_PREFIX} Validation failed: invalid email`);
      throw new Error("Please enter a valid email address.");
    }
    if (!password || password.length < 8) {
      console.error(`${LOG_PREFIX} Validation failed: password too short (${password.length} chars, need 8+)`);
      throw new Error("Password must be at least 8 characters.");
    }

    const url = `https://${AUTH0_DOMAIN}/dbconnections/signup`;
    const payload = {
      client_id: AUTH0_CLIENT_ID,
      email,
      password,
      connection: AUTH0_CONNECTION,
    };

    console.log(`${LOG_PREFIX} POST ${url}`);
    console.log(`${LOG_PREFIX} Payload:`, { ...payload, password: "****" });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log(`${LOG_PREFIX} Signup response: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`${LOG_PREFIX} Signup FAILED — raw response body:`, errBody);

        let parsed: any = null;
        try { parsed = JSON.parse(errBody); } catch { /* not JSON */ }

        const msg =
          parsed?.description ||
          parsed?.message ||
          parsed?.error_description ||
          parsed?.policy ||
          `Sign up failed (HTTP ${res.status}).`;

        console.error(`${LOG_PREFIX} Signup error message: "${msg}"`);
        console.error(`${LOG_PREFIX} Signup error details:`, parsed);
        throw new Error(msg);
      }

      const successBody = await res.json();
      console.log(`${LOG_PREFIX} Signup SUCCESS — user created:`, {
        _id: successBody._id,
        email: successBody.email,
        email_verified: successBody.email_verified,
      });

      // After signup, log the user in to get tokens
      console.log(`${LOG_PREFIX} Now logging in after signup...`);
      return this.login(email, password);

    } catch (err: any) {
      if (err.message && !err.message.includes("HTTP")) {
        // Re-throw auth errors as-is
        throw err;
      }
      console.error(`${LOG_PREFIX} Signup network/fetch error:`, err);
      throw new Error(`Network error during signup: ${err.message}`);
    }
  }

  /**
   * Log in with email and password via Auth0's Resource Owner Password Grant.
   * POST https://{domain}/oauth/token
   */
  async login(email: string, password: string): Promise<AuthUserProfile> {
    console.log(`${LOG_PREFIX} ── LOGIN START ──`);
    console.log(`${LOG_PREFIX} Email: ${email}`);

    if (!email || !email.includes("@")) {
      console.error(`${LOG_PREFIX} Validation failed: invalid email`);
      throw new Error("Please enter a valid email address.");
    }
    if (!password || password.length < 1) {
      console.error(`${LOG_PREFIX} Validation failed: empty password`);
      throw new Error("Please enter your password.");
    }

    const url = `https://${AUTH0_DOMAIN}/oauth/token`;
    const payload = {
      grant_type: "password",
      username: email,
      password,
      client_id: AUTH0_CLIENT_ID,
      connection: AUTH0_CONNECTION,
      scope: "openid profile email",
    };

    console.log(`${LOG_PREFIX} POST ${url}`);
    console.log(`${LOG_PREFIX} Payload:`, { ...payload, password: "****" });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log(`${LOG_PREFIX} Login response: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`${LOG_PREFIX} Login FAILED — raw response body:`, errBody);

        let parsed: Auth0ErrorResponse | null = null;
        try { parsed = JSON.parse(errBody); } catch { /* not JSON */ }

        console.error(`${LOG_PREFIX} Login error details:`, parsed);

        const desc = parsed?.error_description || parsed?.description || parsed?.message || `Login failed (HTTP ${res.status}).`;
        const errCode = parsed?.error || "unknown_error";

        console.error(`${LOG_PREFIX} Error code: "${errCode}", description: "${desc}"`);

        // Provide friendlier messages for common errors
        if (desc.toLowerCase().includes("wrong email or password")) {
          throw new Error("Wrong email or password.");
        }
        if (desc.toLowerCase().includes("blocked")) {
          throw new Error("Too many failed attempts. Please try again later.");
        }
        if (errCode === "unauthorized_client") {
          throw new Error(`Grant type "password" is not enabled. Enable it in Auth0 Dashboard → Applications → Advanced Settings → Grant Types.`);
        }
        if (errCode === "access_denied") {
          throw new Error(`Access denied. Check that the "Username-Password-Authentication" connection is enabled for this application.`);
        }
        throw new Error(desc);
      }

      const tokens: Auth0TokenResponse = await res.json();
      console.log(`${LOG_PREFIX} Login SUCCESS — received tokens`);
      console.log(`${LOG_PREFIX}   token_type: ${tokens.token_type}`);
      console.log(`${LOG_PREFIX}   expires_in: ${tokens.expires_in}s`);
      console.log(`${LOG_PREFIX}   access_token: ${tokens.access_token?.substring(0, 20)}...`);
      console.log(`${LOG_PREFIX}   id_token present: ${!!tokens.id_token}`);

      // Fetch the full user profile from Auth0
      const profile = await this.fetchUserInfo(tokens.access_token);

      this.currentUser = profile;
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(profile));

      console.log(`${LOG_PREFIX} ── LOGIN COMPLETE ──`);
      console.log(`${LOG_PREFIX} Authenticated user:`, profile);

      return profile;

    } catch (err: any) {
      if (err.message && (
        err.message.includes("Wrong email") ||
        err.message.includes("Grant type") ||
        err.message.includes("Access denied") ||
        err.message.includes("Too many") ||
        err.message.includes("HTTP")
      )) {
        throw err;
      }
      console.error(`${LOG_PREFIX} Login network/fetch error:`, err);
      throw new Error(`Network error during login: ${err.message}`);
    }
  }

  /**
   * Fetch user info from Auth0's /userinfo endpoint using the access token.
   */
  private async fetchUserInfo(accessToken: string): Promise<AuthUserProfile> {
    const url = `https://${AUTH0_DOMAIN}/userinfo`;
    console.log(`${LOG_PREFIX} GET ${url}`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log(`${LOG_PREFIX} UserInfo response: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`${LOG_PREFIX} UserInfo FAILED — raw response:`, errBody);
      throw new Error(`Failed to fetch user profile (HTTP ${res.status}).`);
    }

    const info: Auth0UserInfo = await res.json();
    console.log(`${LOG_PREFIX} UserInfo:`, {
      sub: info.sub,
      email: info.email,
      name: info.name,
      email_verified: info.email_verified,
    });

    return {
      email: info.email,
      name: info.name || info.nickname || info.email.split("@")[0],
      sub: info.sub,
      picture: info.picture,
    };
  }

  async logout(): Promise<void> {
    console.log(`${LOG_PREFIX} Logging out user: ${this.currentUser?.email}`);
    this.currentUser = null;
    localStorage.removeItem(LOCAL_AUTH_KEY);
    console.log(`${LOG_PREFIX} Session cleared.`);
  }

  async isAuthenticated(): Promise<boolean> {
    if (this.currentUser) {
      console.log(`${LOG_PREFIX} isAuthenticated: true (in-memory user: ${this.currentUser.email})`);
      return true;
    }

    const stored = localStorage.getItem(LOCAL_AUTH_KEY);
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
        console.log(`${LOG_PREFIX} isAuthenticated: true (restored from localStorage: ${this.currentUser?.email})`);
        return true;
      } catch {
        console.warn(`${LOG_PREFIX} isAuthenticated: corrupt localStorage, clearing`);
        localStorage.removeItem(LOCAL_AUTH_KEY);
      }
    }

    console.log(`${LOG_PREFIX} isAuthenticated: false`);
    return false;
  }

  async getUser(): Promise<AuthUserProfile | undefined> {
    return this.currentUser || undefined;
  }
}

export const authService = new AuthService();
