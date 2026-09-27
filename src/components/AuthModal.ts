import { authService, AuthUserProfile } from "../services/auth0";
import { logToTerminal } from "../services/terminalLog";

export class AuthModalComponent {
  private container: HTMLElement;
  private isSignUp: boolean = false;
  private onSuccessCallback: (user: AuthUserProfile) => void;

  constructor(callbacks: { onSuccess: (user: AuthUserProfile) => void }) {
    this.onSuccessCallback = callbacks.onSuccess;
    this.container = document.createElement("div");
    this.container.className = "auth-overlay";
    this.render();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public show() {
    this.container.classList.add("visible", "interactive");
  }

  public hide() {
    this.container.classList.remove("visible", "interactive");
  }

  public isVisible(): boolean {
    return this.container.classList.contains("visible");
  }

  private render() {
    this.container.innerHTML = `
      <div class="auth-card glass-panel">
        <div class="auth-header">
          <div class="auth-brand-icon">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2" fill="none"></circle>
              <circle cx="12" cy="12" r="4" fill="white"></circle>
            </svg>
          </div>
          <h2 class="auth-title">Screendial</h2>
          <p class="auth-subtitle">Sign in to activate your intelligent screen companion</p>
        </div>

        <div class="auth-error-banner" id="auth-error" style="display: none;"></div>

        <form class="auth-form" id="auth-form" autocomplete="on">
          <div class="auth-input-group">
            <label class="auth-label" for="auth-email">Email Address</label>
            <div class="auth-input-wrapper">
              <svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
              </svg>
              <input 
                type="email" 
                id="auth-email" 
                class="auth-input" 
                placeholder="name@example.com" 
                required 
                autocomplete="email"
              />
            </div>
          </div>

          <div class="auth-input-group">
            <div class="auth-label-row">
              <label class="auth-label" for="auth-password">Password</label>
            </div>
            <div class="auth-input-wrapper">
              <svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <input 
                type="password" 
                id="auth-password" 
                class="auth-input" 
                placeholder="••••••••" 
                required 
                minlength="8"
                autocomplete="current-password"
              />
              <button type="button" class="auth-password-toggle" id="auth-password-toggle" title="Toggle password visibility">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" class="auth-btn auth-btn-primary" id="auth-submit-btn">
            <span class="auth-btn-text">Sign In</span>
            <div class="spinner-iridescent auth-spinner" style="display: none;"></div>
          </button>
        </form>

        <div class="auth-footer">
          <span class="auth-footer-text">Don't have an account?</span>
          <button type="button" class="auth-toggle-mode" id="auth-toggle-mode">Sign up</button>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents() {
    const form = this.container.querySelector<HTMLFormElement>("#auth-form")!;
    const emailInput = this.container.querySelector<HTMLInputElement>("#auth-email")!;
    const passwordInput = this.container.querySelector<HTMLInputElement>("#auth-password")!;
    const togglePasswordBtn = this.container.querySelector<HTMLButtonElement>("#auth-password-toggle")!;
    const toggleModeBtn = this.container.querySelector<HTMLButtonElement>("#auth-toggle-mode")!;

    // Toggle password visibility
    togglePasswordBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      togglePasswordBtn.style.opacity = isPassword ? "1" : "0.5";
    });

    // Toggle between Sign In and Sign Up
    toggleModeBtn.addEventListener("click", () => {
      this.isSignUp = !this.isSignUp;
      const title = this.container.querySelector<HTMLElement>(".auth-title")!;
      const subtitle = this.container.querySelector<HTMLElement>(".auth-subtitle")!;
      const submitText = this.container.querySelector<HTMLElement>(".auth-btn-text")!;
      const footerText = this.container.querySelector<HTMLElement>(".auth-footer-text")!;
      const errorBanner = this.container.querySelector<HTMLElement>("#auth-error")!;
      errorBanner.style.display = "none";

      if (this.isSignUp) {
        title.textContent = "Create Account";
        subtitle.textContent = "Create your Screendial account to get started";
        submitText.textContent = "Sign Up";
        footerText.textContent = "Already have an account?";
        toggleModeBtn.textContent = "Sign in";
        passwordInput.setAttribute("minlength", "8");
        passwordInput.setAttribute("autocomplete", "new-password");
      } else {
        title.textContent = "Screendial";
        subtitle.textContent = "Sign in to activate your intelligent screen companion";
        submitText.textContent = "Sign In";
        footerText.textContent = "Don't have an account?";
        toggleModeBtn.textContent = "Sign up";
        passwordInput.setAttribute("minlength", "8");
        passwordInput.setAttribute("autocomplete", "current-password");
      }
    });

    // Form submit (Email/Password → Auth0 API)
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        this.showError("Please enter both email and password.");
        return;
      }

      const mode = this.isSignUp ? "SIGNUP" : "LOGIN";
      logToTerminal("AuthModal", `Form submitted: ${mode} for email "${email}"`);

      this.setLoading(true, this.isSignUp ? "Creating Account..." : "Signing In...");
      this.hideError();

      try {
        let user: AuthUserProfile;
        if (this.isSignUp) {
          user = await authService.signup(email, password);
        } else {
          user = await authService.login(email, password);
        }

        logToTerminal("AuthModal", `${mode} succeeded for user: ${user.email}`);
        this.setLoading(false);
        this.hide();
        this.onSuccessCallback(user);
      } catch (err: any) {
        const errorText =
          typeof err?.message === "string" && err.message.trim()
            ? err.message
            : typeof err === "string"
            ? err
            : "Authentication failed. Please check your credentials.";

        logToTerminal("AuthModal", `${mode} failed: "${errorText}"`);
        this.setLoading(false);
        this.showError(errorText);
      }
    });
  }

  private setLoading(loading: boolean, label?: string) {
    const submitBtn = this.container.querySelector<HTMLButtonElement>("#auth-submit-btn")!;
    const btnText = this.container.querySelector<HTMLElement>(".auth-btn-text")!;
    const spinner = this.container.querySelector<HTMLElement>(".auth-spinner")!;

    if (loading) {
      submitBtn.disabled = true;
      btnText.textContent = label || (this.isSignUp ? "Signing Up..." : "Signing In...");
      spinner.style.display = "block";
    } else {
      submitBtn.disabled = false;
      btnText.textContent = this.isSignUp ? "Sign Up" : "Sign In";
      spinner.style.display = "none";
    }
  }

  private showError(msg: any) {
    let cleanMsg = "";
    if (typeof msg === "string") {
      cleanMsg = msg;
    } else if (msg && typeof msg === "object") {
      cleanMsg = msg.message || JSON.stringify(msg);
    } else {
      cleanMsg = "Authentication failed. Please try again.";
    }

    const errorBanner = this.container.querySelector<HTMLElement>("#auth-error")!;
    errorBanner.textContent = cleanMsg;
    errorBanner.style.display = "block";
  }

  private hideError() {
    const errorBanner = this.container.querySelector<HTMLElement>("#auth-error")!;
    errorBanner.textContent = "";
    errorBanner.style.display = "none";
  }
}
