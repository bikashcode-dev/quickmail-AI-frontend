const TOKEN_STORAGE_KEY = "quickmailAuthToken";
const EMAIL_STORAGE_KEY = "quickmailAuthEmail";
const OTP_PENDING_EMAIL_KEY = "quickmailPendingEmail";
const OTP_PENDING_PASSWORD_KEY = "quickmailPendingPassword";
const OTP_SENT_AT_KEY = "quickmailOtpSentAt";
const DEFAULT_API_BASE_URL = "https://quick-email-ai-production.up.railway.app";
const OTP_EXPIRY_MS = 5 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;

const loginStep = document.getElementById("loginStep");
const otpStep = document.getElementById("otpStep");
const helpStep = document.getElementById("helpStep");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const emailField = document.getElementById("emailField");
const emailInput = document.getElementById("emailInput");
const emailError = document.getElementById("emailError");
const passwordField = document.getElementById("passwordField");
const passwordInput = document.getElementById("passwordInput");
const passwordError = document.getElementById("passwordError");
const passwordToggleButton = document.getElementById("passwordToggleButton");
const showPasswordCheckbox = document.getElementById("showPasswordCheckbox");
const accountHint = document.getElementById("accountHint");
const loginButton = document.getElementById("loginButton");
const sendOtpButton = document.getElementById("sendOtpButton");

const googleButton = document.getElementById("googleButton");

const togglePrompt = document.getElementById("togglePrompt");
const toggleModeButton = document.getElementById("toggleModeButton");
const otpTitle = document.getElementById("otpTitle");
const otpPrefixLabel = document.getElementById("otpPrefixLabel");
const otpEmailLabel = document.getElementById("otpEmailLabel");
const otpSuffixLabel = document.getElementById("otpSuffixLabel");
const otpExpiryLabel = document.getElementById("otpExpiryLabel");
const verifyOtpButton = document.getElementById("verifyOtpButton");
const resendOtpButton = document.getElementById("resendOtpButton");
const backToLoginButton = document.getElementById("backToLoginButton");
const goToGmailButton = document.getElementById("goToGmailButton");
const backToAuthButton = document.getElementById("backToAuthButton");
const errorBox = document.getElementById("errorBox");
const infoBox = document.getElementById("infoBox");
const closeButton = document.getElementById("closeButton");
const otpInputs = Array.from(document.querySelectorAll(".otp-input"));

let mode = "login";
let otpIntervalId = null;
let otpPurpose = "login";
let latestAccountStatus = { exists: false, verified: false, hasPassword: false };

initialize();

async function initialize() {
  const stored = await chrome.storage.local.get([
    TOKEN_STORAGE_KEY,
    EMAIL_STORAGE_KEY,
    OTP_PENDING_EMAIL_KEY,
    OTP_PENDING_PASSWORD_KEY,
    OTP_SENT_AT_KEY
  ]);

  if (stored[TOKEN_STORAGE_KEY] && stored[EMAIL_STORAGE_KEY]) {
    showHelpStep(stored[EMAIL_STORAGE_KEY]);
    return;
  }

  const pendingEmail = stored[OTP_PENDING_EMAIL_KEY];
  const sentAt = stored[OTP_SENT_AT_KEY];
  if (pendingEmail && sentAt && Date.now() - sentAt < OTP_EXPIRY_MS) {
    showOtpStep(pendingEmail, sentAt, stored[OTP_PENDING_PASSWORD_KEY] ? "signup" : "login");
    return;
  }

  showLoginStep();
}

closeButton?.addEventListener("click", () => window.close());

showPasswordCheckbox?.addEventListener("change", () => {
  updatePasswordVisibility(showPasswordCheckbox.checked);
});

passwordToggleButton?.addEventListener("click", () => {
  const nextState = passwordInput.type === "password";
  showPasswordCheckbox.checked = nextState;
  updatePasswordVisibility(nextState);
});

emailInput?.addEventListener("blur", async () => {
  const email = normalizeEmail(emailInput.value);
  if (!email) {
    accountHint.hidden = true;
    return;
  }
  if (!isValidEmail(email)) {
    setFieldError("email", "Enter a valid email address.");
    accountHint.hidden = true;
    return;
  }
  await loadAccountStatus(email);
});

emailInput?.addEventListener("input", () => {
  clearStatus();
  clearFieldError("email");
  if (!emailInput.value.trim()) {
    accountHint.hidden = true;
  }
});

passwordInput?.addEventListener("input", () => {
  clearStatus();
  clearFieldError("password");
});

googleButton?.addEventListener("click", () => {
  showInfo("Google sign-in will be available soon.");
});

toggleModeButton?.addEventListener("click", () => {
  mode = mode === "login" ? "signup" : "login";
  clearStatus();
  accountHint.hidden = true;
  passwordInput.value = "";
  clearFieldError("email");
  clearFieldError("password");
  showPasswordCheckbox.checked = false;
  updatePasswordVisibility(false);
  syncModeUi();
});

loginButton?.addEventListener("click", async () => {
  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value.trim();

  if (!email) {
    setFieldError("email", "Enter your email address.");
    showError("Enter your email address.");
    return;
  }
  if (!isValidEmail(email)) {
    setFieldError("email", "Enter a valid email address.");
    showError("Enter a valid email address.");
    return;
  }
  if (!password) {
    setFieldError("password", "Enter your password.");
    showError("Enter your password.");
    return;
  }

  clearStatus();

  if (mode === "login") {
    await handleLogin(email, password);
    return;
  }

  await handleSignup(email, password);
});

sendOtpButton?.addEventListener("click", async () => {
  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value.trim();
  const isSignup = mode === "signup";

  if (!email) {
    setFieldError("email", "Enter your email address.");
    showError("Enter your email address.");
    return;
  }
  if (!isValidEmail(email)) {
    setFieldError("email", "Enter a valid email address.");
    showError("Enter a valid email address.");
    return;
  }
  if (isSignup && !password) {
    setFieldError("password", "Enter a password for your new account.");
    showError("Enter a password for your new account.");
    return;
  }

  setLoading(sendOtpButton, true, isSignup ? "Sending OTP..." : "Sending OTP...");
  clearStatus();

  try {
    if (!isSignup) {
      latestAccountStatus = await postJson("/auth/account-status", { email });
      if (!latestAccountStatus.exists) {
        throw new Error("Account not found. Use Sign up to create a new account.");
      }
    }

    await postJson("/auth/send-otp", { email });
    const sentAt = Date.now();
    await chrome.storage.local.set({
      [OTP_PENDING_EMAIL_KEY]: email,
      [OTP_PENDING_PASSWORD_KEY]: isSignup ? password : "",
      [OTP_SENT_AT_KEY]: sentAt
    });
    showOtpStep(email, sentAt, isSignup ? "signup" : "login");
    showInfo(isSignup ? "OTP sent. Verify to create your account." : "OTP sent. Verify to sign in.");
  } catch (error) {
    showError(error.message || "Could not send OTP.");
  } finally {
    setLoading(sendOtpButton, false, isSignup ? "Send OTP for signup" : "Use OTP instead");
  }
});

verifyOtpButton?.addEventListener("click", async () => {
  const otp = otpInputs.map((input) => input.value).join("").trim();
  const stored = await chrome.storage.local.get([OTP_PENDING_EMAIL_KEY, OTP_PENDING_PASSWORD_KEY]);
  const email = stored[OTP_PENDING_EMAIL_KEY];
  const pendingPassword = stored[OTP_PENDING_PASSWORD_KEY] || "";

  if (!email) {
    showError("Verification session expired. Please try again.");
    showLoginStep();
    return;
  }
  if (!/^\d{6}$/.test(otp)) {
    showError("Enter the 6-digit OTP.");
    return;
  }

  setLoading(verifyOtpButton, true, "Verifying...");
  clearStatus();

  try {
    const verifyResponse = await postJson("/auth/verify-otp", { email, otp });
    let token = verifyResponse.token;

    if (pendingPassword) {
      await postJson("/auth/set-password", { password: pendingPassword }, true, token);
      const loginResponse = await postJson("/auth/login", { email, password: pendingPassword });
      token = loginResponse.token;
    }

    await chrome.storage.local.set({
      [TOKEN_STORAGE_KEY]: token,
      [EMAIL_STORAGE_KEY]: email
    });
    await chrome.storage.local.remove([OTP_PENDING_EMAIL_KEY, OTP_PENDING_PASSWORD_KEY, OTP_SENT_AT_KEY]);
    showHelpStep(email);
  } catch (error) {
    showError(error.message || "OTP verification failed.");
  } finally {
    setLoading(verifyOtpButton, false, "Verify OTP");
  }
});

resendOtpButton?.addEventListener("click", async () => {
  const stored = await chrome.storage.local.get([OTP_PENDING_EMAIL_KEY]);
  const email = stored[OTP_PENDING_EMAIL_KEY];
  if (!email) {
    showError("Signup session expired. Please try again.");
    showLoginStep();
    return;
  }

  setLoading(resendOtpButton, true, "Resending...");
  clearStatus();

  try {
    await postJson("/auth/send-otp", { email });
    const sentAt = Date.now();
    await chrome.storage.local.set({ [OTP_SENT_AT_KEY]: sentAt });
    showOtpStep(email, sentAt, otpPurpose);
    showInfo("OTP resent successfully.");
  } catch (error) {
    showError(error.message || "Could not resend OTP.");
  } finally {
    setLoading(resendOtpButton, false, "Resend OTP");
  }
});

backToLoginButton?.addEventListener("click", async () => {
  await chrome.storage.local.remove([OTP_PENDING_EMAIL_KEY, OTP_PENDING_PASSWORD_KEY, OTP_SENT_AT_KEY]);
  showLoginStep();
});

goToGmailButton?.addEventListener("click", openGmailAndClose);

backToAuthButton?.addEventListener("click", () => {
  showLoginStep();
});

otpInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 1);
    if (input.value && otpInputs[index + 1]) {
      otpInputs[index + 1].focus();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !input.value && otpInputs[index - 1]) {
      otpInputs[index - 1].focus();
    }
  });
});

async function handleLogin(email, password) {
  setLoading(loginButton, true, "Logging in...");
  clearStatus();

  try {
    const response = await postJson("/auth/login", { email, password });
    await chrome.storage.local.set({
      [TOKEN_STORAGE_KEY]: response.token,
      [EMAIL_STORAGE_KEY]: response.email
    });
    await chrome.storage.local.remove([OTP_PENDING_EMAIL_KEY, OTP_PENDING_PASSWORD_KEY, OTP_SENT_AT_KEY]);
    showHelpStep(response.email);
  } catch (error) {
    applyAuthError(error.message || "Login failed.");
    showError(error.message || "Login failed.");
  } finally {
    setLoading(loginButton, false, "Login");
  }
}

async function handleSignup(email, password) {
  setLoading(loginButton, true, "Preparing...");
  clearStatus();

  try {
    latestAccountStatus = await postJson("/auth/account-status", { email });
    if (latestAccountStatus.exists) {
      setFieldError("email", "This email already has an account.");
      showError("Account already exists. Use login instead.");
      mode = "login";
      syncModeUi();
      return;
    }

    await postJson("/auth/send-otp", { email });
    const sentAt = Date.now();
    await chrome.storage.local.set({
      [OTP_PENDING_EMAIL_KEY]: email,
      [OTP_PENDING_PASSWORD_KEY]: password,
      [OTP_SENT_AT_KEY]: sentAt
    });
    showOtpStep(email, sentAt, "signup");
    showInfo("OTP sent. Verify to create your account.");
  } catch (error) {
    showError(error.message || "Could not start signup.");
  } finally {
    setLoading(loginButton, false, "Create account");
  }
}

async function loadAccountStatus(email) {
  try {
    latestAccountStatus = await postJson("/auth/account-status", { email });
    if (mode === "login") {
      if (!latestAccountStatus.exists) {
        showHint("No account found for this email. Use Sign up to create one.");
      } else if (!latestAccountStatus.hasPassword) {
        showHint("Account found, but password is not set. Use OTP instead.");
      } else {
        showHint("Account found. Enter your password to continue.");
      }
      return;
    }

    if (latestAccountStatus.exists) {
      showHint("This email already has an account. Use login instead.");
    } else {
      showHint("New account will be created after OTP verification.");
    }
  } catch {
    // Ignore lookup issues.
  }
}

function showLoginStep() {
  clearStatus();
  clearFieldError("email");
  clearFieldError("password");
  loginStep.hidden = false;
  otpStep.hidden = true;
  helpStep.hidden = true;
  emailInput.value = "";
  passwordInput.value = "";
  showPasswordCheckbox.checked = false;
  updatePasswordVisibility(false);
  accountHint.hidden = true;
  otpInputs.forEach((input) => (input.value = ""));
  stopOtpTimer();
  mode = "login";
  otpPurpose = "login";
  syncModeUi();
}

function showOtpStep(email, sentAt, purpose = "login") {
  clearStatus();
  loginStep.hidden = true;
  otpStep.hidden = false;
  helpStep.hidden = true;
  otpPurpose = purpose;
  otpTitle.textContent = purpose === "signup" ? "Verify your email" : "Sign in with OTP";
  otpEmailLabel.textContent = email;
  otpPrefixLabel.textContent = "We sent a 6-digit code to ";
  otpSuffixLabel.textContent = purpose === "signup"
    ? ". Enter it to create your account."
    : ". Enter it to continue.";
  otpInputs.forEach((input) => (input.value = ""));
  otpInputs[0]?.focus();
  startOtpTimer(sentAt);
}

function showHelpStep(email) {
  clearStatus();
  clearFieldError("email");
  clearFieldError("password");
  loginStep.hidden = true;
  otpStep.hidden = true;
  helpStep.hidden = false;
  authTitle.textContent = "QuickMail";
  authSubtitle.textContent = `Signed in as ${email}`;
}

function syncModeUi() {
  const isSignup = mode === "signup";
  authTitle.textContent = isSignup ? "Sign up" : "Login";
  authSubtitle.textContent = isSignup ? "Create your QuickMail account" : "Sign in to QuickMail";
  setButtonLabel(loginButton, isSignup ? "Create account" : "Login");
  setButtonLabel(sendOtpButton, isSignup ? "Send OTP for signup" : "Use OTP instead");
  togglePrompt.textContent = isSignup ? "Already have an account?" : "Don't have an account?";
  toggleModeButton.textContent = isSignup ? "Login" : "Sign up";
  passwordInput.autocomplete = isSignup ? "new-password" : "current-password";
}

function startOtpTimer(sentAt) {
  stopOtpTimer();
  otpIntervalId = setInterval(() => {
    const elapsed = Date.now() - sentAt;
    const remainingExpiry = Math.max(0, OTP_EXPIRY_MS - elapsed);
    const remainingResend = Math.max(0, RESEND_COOLDOWN_MS - elapsed);

    otpExpiryLabel.textContent = `OTP expires in ${formatTime(remainingExpiry)}`;
    resendOtpButton.disabled = remainingResend > 0;
    resendOtpButton.textContent = remainingResend > 0
      ? `Resend in ${Math.ceil(remainingResend / 1000)}s`
      : "Resend OTP";

    if (remainingExpiry <= 0) {
      stopOtpTimer();
      otpExpiryLabel.textContent = "OTP expired. Request a new one.";
      resendOtpButton.disabled = false;
    }
  }, 250);
}

function stopOtpTimer() {
  if (otpIntervalId) {
    clearInterval(otpIntervalId);
    otpIntervalId = null;
  }
}

function formatTime(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function postJson(path, payload, withAuth = false, tokenOverride = "") {
  const headers = { "Content-Type": "application/json" };
  if (withAuth) {
    const token = tokenOverride || (await chrome.storage.local.get([TOKEN_STORAGE_KEY]))[TOKEN_STORAGE_KEY];
    if (!token) {
      throw new Error("Please log in first.");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${DEFAULT_API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const details = Array.isArray(data?.details) ? data.details.join(" | ") : "";
    throw new Error(data?.message || details || data?.error || "Request failed.");
  }

  return data;
}

function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  if (!email || email.length > 254) {
    return false;
  }

  const basicPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!basicPattern.test(email)) {
    return false;
  }

  const [, domain = ""] = email.split("@");
  if (!domain || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return false;
  }

  const invalidTldTypos = [".cm", ".con", ".comm", ".cmo", ".coml", ".coom", ".orgg", ".nett"];
  return !invalidTldTypos.some((suffix) => domain.endsWith(suffix));
}

function setLoading(button, isLoading, label) {
  if (!button) {
    return;
  }
  button.disabled = isLoading;
  button.dataset.loading = isLoading ? "true" : "false";
  button.innerHTML = isLoading
    ? `<span class="button-content"><span class="button-label">${escapeHtml(label)}</span><span class="loading-wave" aria-hidden="true"><span class="loading-bar"></span><span class="loading-bar"></span><span class="loading-bar"></span><span class="loading-bar"></span></span></span>`
    : `<span class="button-content"><span class="button-label">${escapeHtml(label)}</span></span>`;
}

function setButtonLabel(button, label) {
  setLoading(button, false, label);
}

function showError(message) {
  errorBox.hidden = false;
  errorBox.textContent = message;
  infoBox.hidden = true;
}

function showInfo(message) {
  infoBox.hidden = false;
  infoBox.textContent = message;
  errorBox.hidden = true;
}

function showHint(message) {
  accountHint.hidden = false;
  accountHint.textContent = message;
}

function clearStatus() {
  errorBox.hidden = true;
  infoBox.hidden = true;
  errorBox.textContent = "";
  infoBox.textContent = "";
}

function openGmailAndClose() {
  chrome.tabs.create({ url: "https://mail.google.com/" });
  window.close();
}

function updatePasswordVisibility(visible) {
  passwordInput.type = visible ? "text" : "password";
  passwordToggleButton?.setAttribute("aria-label", visible ? "Hide password" : "Show password");
  const icon = passwordToggleButton?.querySelector(".field-icon");
  if (icon) {
    icon.classList.toggle("field-icon--eye-off", visible);
  }
}

function setFieldError(field, message) {
  const fieldShell = field === "email" ? emailField : passwordField;
  const fieldError = field === "email" ? emailError : passwordError;
  fieldShell?.classList.add("is-invalid");
  if (fieldError) {
    fieldError.hidden = false;
    fieldError.textContent = message;
  }
}

function clearFieldError(field) {
  const fieldShell = field === "email" ? emailField : passwordField;
  const fieldError = field === "email" ? emailError : passwordError;
  fieldShell?.classList.remove("is-invalid");
  if (fieldError) {
    fieldError.hidden = true;
    fieldError.textContent = "";
  }
}

function applyAuthError(message) {
  const normalized = String(message || "").toLowerCase();
  clearFieldError("email");
  clearFieldError("password");
  if (normalized.includes("email")) {
    setFieldError("email", message);
  }
  if (normalized.includes("password") || normalized.includes("account not found") || normalized.includes("verify")) {
    setFieldError(normalized.includes("account not found") ? "email" : "password", message);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
