const TOKEN_STORAGE_KEY = "quickmailAuthToken";
const EMAIL_STORAGE_KEY = "quickmailAuthEmail";
const OTP_SENT_AT_KEY = "quickmailOtpSentAt";
const OTP_PENDING_EMAIL_KEY = "quickmailPendingEmail";
const HAS_SEEN_WELCOME_KEY = "quickmailHasSeenWelcome";
const DEFAULT_API_BASE_URL = "https://quick-email-ai-production.up.railway.app";
const RESEND_COOLDOWN_MS = 30_000;
const OTP_EXPIRY_MS = 5 * 60_000;

const welcomeStep = document.getElementById("welcomeStep");
const emailStep = document.getElementById("emailStep");
const otpStep = document.getElementById("otpStep");
const dashboardStep = document.getElementById("dashboardStep");
const emailInput = document.getElementById("emailInput");
const accountHint = document.getElementById("accountHint");
const getStartedButton = document.getElementById("getStartedButton");
const backToWelcomeButton = document.getElementById("backToWelcomeButton");
const closePopupButton = document.getElementById("closePopupButton");
const sendOtpButton = document.getElementById("sendOtpButton");
const showPasswordLoginButton = document.getElementById("showPasswordLoginButton");
const toggleOtpButton = document.getElementById("toggleOtpButton");
const passwordLoginStep = document.getElementById("passwordLoginStep");
const passwordInput = document.getElementById("passwordInput");
const passwordLoginButton = document.getElementById("passwordLoginButton");
const backToOtpLoginButton = document.getElementById("backToOtpLoginButton");
const verifyOtpButton = document.getElementById("verifyOtpButton");
const resendOtpButton = document.getElementById("resendOtpButton");
const openGmailButton = document.getElementById("openGmailButton");
const logoutButton = document.getElementById("logoutButton");
const setPasswordInput = document.getElementById("setPasswordInput");
const setPasswordButton = document.getElementById("setPasswordButton");
const otpInputs = Array.from(document.querySelectorAll(".otp-input"));
const otpEmailLabel = document.getElementById("otpEmailLabel");
const otpExpiryLabel = document.getElementById("otpExpiryLabel");
const successEmailLabel = document.getElementById("successEmailLabel");
const errorBox = document.getElementById("errorBox");
const infoBox = document.getElementById("infoBox");
const successMark = document.querySelector(".success-mark");

let otpIntervalId = null;
let latestAccountState = { exists: false, verified: false, hasPassword: false };

if (successMark) {
  successMark.innerHTML = "&#10003;";
}

initialize();

async function initialize() {
  const stored = await chrome.storage.local.get([
    TOKEN_STORAGE_KEY,
    EMAIL_STORAGE_KEY,
    OTP_SENT_AT_KEY,
    OTP_PENDING_EMAIL_KEY,
    HAS_SEEN_WELCOME_KEY
  ]);

  if (stored[TOKEN_STORAGE_KEY] && stored[EMAIL_STORAGE_KEY]) {
    showDashboard(stored[EMAIL_STORAGE_KEY]);
    return;
  }

  const pendingEmail = stored[OTP_PENDING_EMAIL_KEY];
  const sentAt = stored[OTP_SENT_AT_KEY];
  if (pendingEmail && sentAt && Date.now() - sentAt < OTP_EXPIRY_MS) {
    showOtpStep(pendingEmail, sentAt);
    return;
  }

  showEmailStep();
}

getStartedButton?.addEventListener("click", async () => {
  await chrome.storage.local.set({ [HAS_SEEN_WELCOME_KEY]: true });
  clearStatus();
  showEmailStep();
});

backToWelcomeButton?.addEventListener("click", () => {
  clearStatus();
  showEmailStep();
});

closePopupButton?.addEventListener("click", () => window.close());

emailInput?.addEventListener("input", () => {
  latestAccountState = { exists: false, verified: false, hasPassword: false };
  if (accountHint) {
    accountHint.hidden = true;
    accountHint.textContent = "";
  }
  if (showPasswordLoginButton) {
    showPasswordLoginButton.hidden = true;
  }
  if (toggleOtpButton) {
    toggleOtpButton.hidden = true;
  }
});

emailInput?.addEventListener("blur", async () => {
  const email = emailInput.value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return;
  }
  await updateAccountStatus(email);
});

sendOtpButton.addEventListener("click", async () => {
  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    showError("Enter your email address.");
    return;
  }

  setLoading(sendOtpButton, true, "Sending...");
  clearStatus();

  try {
    await postJson("/auth/send-otp", { email });
    const sentAt = Date.now();
    await chrome.storage.local.set({
      [OTP_PENDING_EMAIL_KEY]: email,
      [OTP_SENT_AT_KEY]: sentAt,
      [HAS_SEEN_WELCOME_KEY]: true
    });
    showOtpStep(email, sentAt);
    showInfo("OTP sent. Check your inbox.");
  } catch (error) {
    showError(error.message || "Could not send OTP.");
  } finally {
    setLoading(sendOtpButton, false, "Send OTP");
  }
});

showPasswordLoginButton?.addEventListener("click", () => {
  passwordLoginStep.hidden = false;
  showPasswordLoginButton.hidden = true;
  if (toggleOtpButton) {
    toggleOtpButton.hidden = false;
  }
  passwordInput?.focus();
});

toggleOtpButton?.addEventListener("click", () => {
  passwordLoginStep.hidden = true;
  if (showPasswordLoginButton && latestAccountState.hasPassword) {
    showPasswordLoginButton.hidden = false;
  }
  toggleOtpButton.hidden = true;
});

backToOtpLoginButton?.addEventListener("click", () => {
  passwordLoginStep.hidden = true;
  if (showPasswordLoginButton && latestAccountState.hasPassword) {
    showPasswordLoginButton.hidden = false;
  }
  if (toggleOtpButton) {
    toggleOtpButton.hidden = true;
  }
});

passwordLoginButton?.addEventListener("click", async () => {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();

  if (!email) {
    showError("Enter your email address first.");
    return;
  }

  if (!password) {
    showError("Enter your password.");
    return;
  }

  setLoading(passwordLoginButton, true, "Signing in...");
  clearStatus();

  try {
    const response = await postJson("/auth/login", { email, password });
    await chrome.storage.local.set({
      [TOKEN_STORAGE_KEY]: response.token,
      [EMAIL_STORAGE_KEY]: response.email,
      [HAS_SEEN_WELCOME_KEY]: true
    });
    await chrome.storage.local.remove([OTP_PENDING_EMAIL_KEY, OTP_SENT_AT_KEY]);
    showDashboard(response.email);
  } catch (error) {
    showError(error.message || "Password login failed.");
  } finally {
    setLoading(passwordLoginButton, false, "Sign In With Password");
  }
});

verifyOtpButton.addEventListener("click", async () => {
  const otp = otpInputs.map((input) => input.value).join("").trim();
  const { [OTP_PENDING_EMAIL_KEY]: email } = await chrome.storage.local.get([OTP_PENDING_EMAIL_KEY]);

  if (!email) {
    showError("Email session expired. Please send OTP again.");
    showEmailStep();
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    showError("Enter the 6-digit OTP.");
    return;
  }

  setLoading(verifyOtpButton, true, "Verifying...");
  clearStatus();

  try {
    const response = await postJson("/auth/verify-otp", { email, otp });
    await chrome.storage.local.set({
      [TOKEN_STORAGE_KEY]: response.token,
      [EMAIL_STORAGE_KEY]: response.email,
      [HAS_SEEN_WELCOME_KEY]: true
    });
    await chrome.storage.local.remove([OTP_PENDING_EMAIL_KEY, OTP_SENT_AT_KEY]);
    showDashboard(response.email);
  } catch (error) {
    showError(error.message || "OTP verification failed.");
  } finally {
    setLoading(verifyOtpButton, false, "Verify OTP");
  }
});

resendOtpButton.addEventListener("click", async () => {
  const { [OTP_PENDING_EMAIL_KEY]: email } = await chrome.storage.local.get([OTP_PENDING_EMAIL_KEY]);
  if (!email) {
    showError("Email session expired. Please send OTP again.");
    showEmailStep();
    return;
  }

  setLoading(resendOtpButton, true, "Resending...");
  clearStatus();
  try {
    await postJson("/auth/send-otp", { email });
    const sentAt = Date.now();
    await chrome.storage.local.set({ [OTP_SENT_AT_KEY]: sentAt });
    showOtpStep(email, sentAt);
    showInfo("OTP resent successfully.");
  } catch (error) {
    showError(error.message || "Could not resend OTP.");
  } finally {
    setLoading(resendOtpButton, false, "Resend OTP");
  }
});

openGmailButton?.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://mail.google.com/" });
  window.close();
});

logoutButton?.addEventListener("click", async () => {
  await chrome.storage.local.remove([
    TOKEN_STORAGE_KEY,
    EMAIL_STORAGE_KEY,
    OTP_PENDING_EMAIL_KEY,
    OTP_SENT_AT_KEY
  ]);
  clearStatus();
  showEmailStep();
});

setPasswordButton?.addEventListener("click", async () => {
  const password = setPasswordInput.value.trim();
  if (!password) {
    showError("Enter a password to save.");
    return;
  }

  setLoading(setPasswordButton, true, "Saving...");
  clearStatus();

  try {
    await postJson("/auth/set-password", { password }, true);
    setPasswordInput.value = "";
    showInfo("Password saved. Next time you can sign in with password.");
  } catch (error) {
    showError(error.message || "Could not save password.");
  } finally {
    setLoading(setPasswordButton, false, "Save Password");
  }
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

function showWelcomeStep() {
  stopOtpTimer();
  welcomeStep.hidden = false;
  emailStep.hidden = true;
  otpStep.hidden = true;
  dashboardStep.hidden = true;
}

function showEmailStep() {
  stopOtpTimer();
  clearStatus();
  if (welcomeStep) {
    welcomeStep.hidden = true;
  }
  emailStep.hidden = false;
  otpStep.hidden = true;
  dashboardStep.hidden = true;
  if (passwordLoginStep) {
    passwordLoginStep.hidden = true;
  }
  if (showPasswordLoginButton) {
    showPasswordLoginButton.hidden = true;
  }
  if (toggleOtpButton) {
    toggleOtpButton.hidden = true;
  }
}

function showOtpStep(email, sentAt) {
  clearStatus();
  welcomeStep.hidden = true;
  emailStep.hidden = true;
  otpStep.hidden = false;
  dashboardStep.hidden = true;
  otpEmailLabel.textContent = email;
  otpInputs.forEach((input) => (input.value = ""));
  otpInputs[0]?.focus();
  startOtpTimer(sentAt);
}

function showDashboard(email) {
  stopOtpTimer();
  clearStatus();
  welcomeStep.hidden = true;
  emailStep.hidden = true;
  otpStep.hidden = true;
  dashboardStep.hidden = false;
  successEmailLabel.textContent = email;
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

async function postJson(path, payload, withAuth = false) {
  const apiBaseUrl = await getApiBaseUrl();
  const headers = { "Content-Type": "application/json" };

  if (withAuth) {
    const stored = await chrome.storage.local.get([TOKEN_STORAGE_KEY]);
    if (!stored[TOKEN_STORAGE_KEY]) {
      throw new Error("Please sign in first.");
    }
    headers.Authorization = `Bearer ${stored[TOKEN_STORAGE_KEY]}`;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
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

async function updateAccountStatus(email) {
  try {
    const status = await postJson("/auth/account-status", { email });
    latestAccountState = status;

    if (!accountHint) {
      return;
    }

    if (status.exists && status.hasPassword) {
      accountHint.hidden = false;
      accountHint.textContent = "Account found. You can log in with password or continue with OTP.";
      if (showPasswordLoginButton) {
        showPasswordLoginButton.hidden = false;
      }
      return;
    }

    if (status.exists) {
      accountHint.hidden = false;
      accountHint.textContent = "Account found. Continue with OTP to sign in or create a password later.";
      return;
    }

    accountHint.hidden = false;
    accountHint.textContent = "New account. We will create it after OTP verification.";
  } catch {
    // Ignore lookup failures so login flow keeps working.
  }
}

async function getApiBaseUrl() {
  return DEFAULT_API_BASE_URL.replace(/\/+$/, "");
}

function setLoading(button, isLoading, label) {
  button.disabled = isLoading;
  button.textContent = label;
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

function clearStatus() {
  errorBox.hidden = true;
  infoBox.hidden = true;
}
