const REQUEST_TIMEOUT_MS = 20000;
const TOKEN_STORAGE_KEY = "quickmailAuthToken";
const DEFAULT_API_BASE_URL = "https://quick-email-ai-production.up.railway.app";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_AUTH_POPUP") {
    openAuthPopup()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Could not open auth popup." }));
    return true;
  }

  if (message?.type === "GENERATE_AI_REPLY") {
    generateAiReply(message.payload)
      .then((text) => sendResponse({ ok: true, text }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Unknown error" }));

    return true;
  }

  return false;
});

async function generateAiReply(payload) {
  const emailContent = payload?.emailContent?.trim();
  const userInstruction = payload?.userInstruction?.trim() || "";
  const mode = payload?.mode === "compose" ? "compose" : "reply";
  if (!emailContent && !userInstruction) {
    throw new Error("Email context ya instruction missing.");
  }

  const storedAuth = await chrome.storage.local.get([TOKEN_STORAGE_KEY]);
  const token = storedAuth?.[TOKEN_STORAGE_KEY];
  if (!token) {
    throw new Error("Please sign in to QuickMail first.");
  }
  const apiUrl = `${DEFAULT_API_BASE_URL}/api/email/generate`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  let data;

  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        emailContent: emailContent ? emailContent.slice(0, 12000) : "",
        tone: payload.tone || "professional",
        previousReply: (payload.previousReply || "").trim().slice(0, 12000),
        userInstruction: userInstruction.slice(0, 4000),
        mode,
        variationIndex: payload.variationIndex || 1
      }),
      signal: controller.signal
    });

    data = await response.json().catch(() => null);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Check backend status.");
    }
    if (error instanceof TypeError) {
      throw new Error("The browser could not complete the backend request. Check CORS and backend availability.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const details = Array.isArray(data?.details) ? data.details.join(" | ") : "";
    if (response.status === 401 || response.status === 403) {
      throw new Error("Session expired. Please sign in again.");
    }
    throw new Error(data?.message || details || data?.error || `Backend request failed (${response.status}).`);
  }

  if (typeof data?.text !== "string" || !data.text.trim()) {
    throw new Error("The backend did not return a valid reply.");
  }

  return data.text.trim();
}

async function openAuthPopup() {
  const popupUrl = chrome.runtime.getURL("auth.html");
  await chrome.windows.create({
    url: popupUrl,
    type: "popup",
    width: 420,
    height: 640
  });
}
