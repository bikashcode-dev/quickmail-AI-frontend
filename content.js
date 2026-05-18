const DEFAULT_TONE = "professional";
const COMPOSE_BODY_SELECTORS = [
  'div[aria-label="Message Body"][contenteditable="true"]',
  'div[contenteditable="true"][g_editable="true"]',
  'div[role="textbox"][contenteditable="true"]'
];
const TOOLBAR_SELECTORS = [
  ".btC",
  ".gU.Up",
  ".aDh",
  ".aDj",
  ".amn",
  '[role="dialog"] .aDh',
  '[role="dialog"] .btC',
  '[role="group"]'
];
const SEND_BUTTON_SELECTORS = [
  'div[role="button"][data-tooltip^="Send"]',
  'div[role="button"][data-tooltip*="Send"]',
  'div[role="button"][aria-label^="Send"]',
  'div[role="button"][aria-label*="Send"]',
  "div.T-I.T-I-atl",
  "div.T-I-atl",
  'button[aria-label^="Send"]'
];
const EXTENSION_RUNTIME = globalThis.chrome?.runtime || globalThis.browser?.runtime || null;
const TONE_MEMORY_KEY = "quickmail-tone-memory";
const TONE_OPTIONS = [
  { value: "reply suggestion", label: "Reply Draft" },
  { value: "summarize", label: "Summarize Thread" },
  { value: "professional", label: "Professional" },
  { value: "formal", label: "Formal" },
  { value: "friendly", label: "Friendly" },
  { value: "polite", label: "Polite" },
  { value: "firm", label: "Firm" },
  { value: "confident", label: "Confident" },
  { value: "apologetic", label: "Apologetic" },
  { value: "humble", label: "Humble" },
  { value: "assertive", label: "Assertive" },
  { value: "persuasive", label: "Persuasive" },
  { value: "grateful", label: "Grateful" },
  { value: "urgent", label: "Urgent" },
  { value: "supportive", label: "Supportive" },
  { value: "concise", label: "Concise" },
  { value: "respectful", label: "Respectful" },
  { value: "custom", label: "Custom" }
];
const CUSTOM_TONE_PRESETS = [
  "warm and respectful",
  "soft and polite",
  "formal and concise",
  "friendly and clear"
];

let lastKnownUrl = location.href;
let scanScheduled = false;

startObservers();
scheduleScan();

function startObservers() {
  const observer = new MutationObserver(() => {
    scheduleScan();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener("popstate", scheduleScan);
  window.addEventListener("hashchange", scheduleScan);
  window.setInterval(checkUrlChange, 800);
}

function checkUrlChange() {
  if (location.href === lastKnownUrl) {
    return;
  }

  lastKnownUrl = location.href;
  scheduleScan();
}

function scheduleScan() {
  if (scanScheduled) {
    return;
  }

  scanScheduled = true;
  window.requestAnimationFrame(() => {
    scanScheduled = false;
    scanComposeWindows();
  });
}

function scanComposeWindows() {
  const composeBodies = findComposeBodies();

  composeBodies.forEach((composeBody) => {
    const composeContext = findComposeContext(composeBody);
    if (!composeContext) {
      return;
    }

    const { composeRoot, toolbar, sendButton } = composeContext;

    if (toolbar.querySelector(`.ai-reply-button[data-compose-id="${composeBody.dataset.aiComposeId || ""}"]`)) {
      return;
    }

    injectAiReplyButton(composeRoot, composeBody, toolbar, sendButton);
  });
}

function findComposeBodies() {
  const allMatches = COMPOSE_BODY_SELECTORS.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector))
  );

  return allMatches.filter((node, index) =>
    allMatches.indexOf(node) === index && isVisible(node)
  );
}

function findComposeContext(composeBody) {
  if (!composeBody.dataset.aiComposeId) {
    composeBody.dataset.aiComposeId = `compose-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const composeRoot =
    composeBody.closest('div[role="dialog"]') ||
    composeBody.closest(".M9") ||
    composeBody.closest(".aoI") ||
    composeBody.closest(".AD") ||
    composeBody.closest(".nH") ||
    composeBody.parentElement;

  const sendButton = findNearestSendButton(composeBody);
  if (!sendButton) {
    return null;
  }

  const toolbar = findToolbarFromSendButton(sendButton, composeRoot) || sendButton.parentElement;
  if (composeRoot && toolbar) {
    return {
      composeRoot,
      toolbar,
      sendButton
    };
  }

  return null;
}

function findNearestSendButton(composeBody) {
  const localRoot =
    composeBody.closest('div[role="dialog"]') ||
    composeBody.closest(".M9") ||
    composeBody.closest(".aoI") ||
    composeBody.closest(".AD") ||
    composeBody.closest(".nH") ||
    composeBody.parentElement;

  let current = localRoot || composeBody;
  let depth = 0;

  while (current && depth < 12) {
    for (const selector of SEND_BUTTON_SELECTORS) {
      const sendButtons = Array.from(current.querySelectorAll(selector)).filter(isVisible);
      if (sendButtons.length > 0) {
        const exact = sendButtons.find((button) => {
          const container = button.closest('div[role="dialog"], .M9, .aoI, .AD, .nH');
          return !localRoot || !container || container === localRoot;
        });

        return exact || sendButtons[0];
      }
    }

    current = current.parentElement;
    depth += 1;
  }

  return null;
}

function findToolbarFromSendButton(sendButton, composeRoot) {
  const localToolbar = TOOLBAR_SELECTORS.map((selector) => {
    if (!composeRoot) {
      return [];
    }

    return Array.from(composeRoot.querySelectorAll(selector)).filter(isVisible);
  }).flat();

  if (localToolbar.length > 0) {
    const matchingToolbar = localToolbar.find((node) => node.contains(sendButton));
    if (matchingToolbar) {
      return matchingToolbar;
    }
  }

  return (
    sendButton.closest(".btC") ||
    sendButton.closest(".gU.Up") ||
    sendButton.closest(".aDh") ||
    sendButton.closest(".aDj") ||
    sendButton.closest(".amn") ||
    sendButton.closest('[role="group"]') ||
    sendButton.parentElement
  );
}

function injectAiReplyButton(composeRoot, composeBody, toolbar, sendButton) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ai-reply-button";
  button.dataset.composeId = composeBody.dataset.aiComposeId || "";
  button.title = "Generate QuickMail draft";
  button.setAttribute("aria-label", "Generate QuickMail draft");
  button.dataset.state = "idle";
  button.innerHTML = `
    <span class="ai-reply-button__orb" aria-hidden="true">
      <span class="ai-reply-button__icon">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M4.5 7.75A1.75 1.75 0 0 1 6.25 6h8.1A1.75 1.75 0 0 1 16.1 7.75v6.5A1.75 1.75 0 0 1 14.35 16h-8.1A1.75 1.75 0 0 1 4.5 14.25z"></path>
          <path d="M5.6 7.1l4.7 3.7 4.7-3.7" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M18.2 4.2l.45 1.3 1.3.45-1.3.45-.45 1.3-.45-1.3-1.3-.45 1.3-.45z"></path>
        </svg>
      </span>
    </span>
    <span class="ai-reply-button__content">
      <span class="ai-reply-button__label">QuickMail</span>
    </span>
  `;

  button.addEventListener("click", async () => {
    try {
      setButtonState(button, "loading", "Drafting...");

      const emailContext = collectEmailContext(composeRoot, composeBody);
      const mode = detectMode(composeRoot, composeBody, emailContext);
      initializeToneState(composeRoot, mode);
      const currentDraft = cleanText(composeBody.innerText || composeBody.textContent || "");
      const previousReply = composeRoot.dataset.aiReplyLastReply || "";
      const userInstruction = resolveUserInstruction(composeRoot, currentDraft, previousReply, mode);
      const selectedTone = composeRoot.dataset.aiTone || DEFAULT_TONE;
      const customTone = composeRoot.dataset.aiCustomTone || "";
      const effectiveTone = resolveTone(composeRoot, userInstruction, selectedTone, customTone);

      if (mode === "compose" && !userInstruction) {
        throw new Error("Add a short instruction for compose mode, such as a leave request or follow-up email.");
      }

      if (mode === "reply" && !emailContext.trim()) {
        throw new Error("No email context was found for this draft.");
      }

      const variationIndex = Number(composeRoot.dataset.aiReplyVariationIndex || "0") + 1;

      const generatedReply = await requestAiReply({
        emailContent: emailContext,
        tone: effectiveTone,
        previousReply,
        userInstruction,
        mode,
        variationIndex
      });

      insertReply(composeBody, generatedReply);
      showAiGeneratedWarning(composeRoot, mode);
      composeRoot.dataset.aiReplyVariationIndex = String(variationIndex);
      composeRoot.dataset.aiReplyLastReply = generatedReply;
      composeRoot.dataset.aiReplyLastInstruction = userInstruction;
      setButtonState(button, "success", "Inserted");
      showInlineNotice(composeRoot, variationIndex > 1 ? "New draft inserted" : "Draft inserted");
    } catch (error) {
      console.error("AI Reply error:", error);
      setButtonState(button, "error", "Retry");
      if ((error.message || "").includes("Please sign in to QuickMail first.") || (error.message || "")
        .includes("Session expired. Please sign in again.")) {
        openAuthPopup();
      }
      showInlineNotice(composeRoot, error.message || "The draft could not be generated.", true);
    } finally {
      window.setTimeout(() => {
        setButtonState(button, "idle", "QuickMail");
      }, 1800);
    }
  });

  const buttonHost = ensureToneControls(composeRoot);
  buttonHost.dataset.composeId = composeBody.dataset.aiComposeId || "";
  const actionButton = buttonHost.querySelector(".ai-reply-button");
  if (!actionButton) {
    buttonHost.insertBefore(button, buttonHost.firstChild);
  }

  const sendAnchor = sendButton.closest('[role="button"]') || sendButton;
  const sendGroup =
    sendAnchor?.closest(".IZ, .Up, .dC") ||
    sendAnchor?.parentElement ||
    null;

  if (toolbar) {
    if (sendGroup && sendGroup.parentElement === toolbar) {
      toolbar.insertBefore(buttonHost, sendGroup);
    } else if (sendAnchor?.parentElement === toolbar) {
      toolbar.insertBefore(buttonHost, sendAnchor);
    } else {
      toolbar.prepend(buttonHost);
    }
    return;
  }

  if (sendAnchor?.parentElement) {
    sendAnchor.parentElement.insertBefore(buttonHost, sendAnchor);
  }
}

function ensureToneControls(composeRoot) {
  composeRoot.querySelectorAll(".ai-tone-bar").forEach((node) => node.remove());
  composeRoot.querySelectorAll(".ai-tone-floating").forEach((node) => node.remove());

  const existingHost = composeRoot.querySelector(".ai-reply-button-host");
  if (existingHost) {
    existingHost.querySelectorAll(".ai-tone-toggle, .ai-tone-popover").forEach((node) => node.remove());

    if (!existingHost.querySelector(".ai-tone-floating")) {
      const toneControls = createToneControls(composeRoot);
      existingHost.appendChild(toneControls.floating);
    }

    syncToneSelection(composeRoot);
    return existingHost;
  }

  composeRoot.dataset.aiTone = composeRoot.dataset.aiTone || DEFAULT_TONE;

  const host = document.createElement("div");
  host.className = "ai-reply-button-host";
  const toneControls = createToneControls(composeRoot);
  host.appendChild(toneControls.floating);

  syncToneSelection(composeRoot);
  return host;
}

function createToneControls(composeRoot) {
  const floating = document.createElement("div");
  floating.className = "ai-tone-floating";

  const toneToggle = document.createElement("button");
  toneToggle.type = "button";
  toneToggle.className = "ai-tone-toggle";
  toneToggle.setAttribute("aria-label", "Choose tone");
  toneToggle.setAttribute("aria-expanded", "false");
  toneToggle.innerHTML = `
    <span class="ai-tone-toggle__label">Tone</span>
    <span class="ai-tone-toggle__value">${getToneDisplayLabel(composeRoot)}</span>
    <span class="ai-tone-toggle__chevron" aria-hidden="true">▴</span>
  `;

  const tonePopover = document.createElement("div");
  tonePopover.className = "ai-tone-popover";
  tonePopover.hidden = true;
  tonePopover.innerHTML = `
    <div class="ai-tone-popover__recent" hidden></div>
    <div class="ai-tone-popover__list">
      ${TONE_OPTIONS.map((option) => `
        <button
          type="button"
          class="ai-tone-chip"
          data-tone="${option.value}"
          aria-pressed="false"
        >${option.label}</button>
      `).join("")}
      ${CUSTOM_TONE_PRESETS.map((preset) => `
        <button
          type="button"
          class="ai-tone-chip ai-tone-chip--custom"
          data-tone="custom"
          data-custom-tone="${preset}"
          aria-pressed="false"
        >${preset}</button>
      `).join("")}
    </div>
    <div class="ai-tone-custom-wrap" hidden>
      <input
        type="text"
        class="ai-tone-custom-input"
        placeholder="e.g. warm and respectful"
        maxlength="40"
      />
    </div>
  `;

  toneToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = !tonePopover.hidden;
    tonePopover.hidden = isOpen;
    toneToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });

  tonePopover.addEventListener("click", (event) => {
    const chip = event.target.closest(".ai-tone-chip");
    if (!chip) {
      return;
    }

    const customWrap = tonePopover.querySelector(".ai-tone-custom-wrap");
    const customInput = tonePopover.querySelector(".ai-tone-custom-input");
    composeRoot.dataset.aiTone = chip.dataset.tone || DEFAULT_TONE;
    const presetTone = sanitizeToneValue(chip.dataset.customTone || "");
    if (composeRoot.dataset.aiTone === "custom" && presetTone) {
      composeRoot.dataset.aiCustomTone = presetTone;
      if (customInput) {
        customInput.value = presetTone;
      }
    }
    const isCustom = composeRoot.dataset.aiTone === "custom";

    if (customWrap) {
      customWrap.hidden = !isCustom;
    }

    syncToneSelection(composeRoot);

    if (isCustom) {
      customInput?.focus();
      saveToneMemory(composeRoot);
      return;
    }

    saveToneMemory(composeRoot);
    tonePopover.hidden = true;
    toneToggle.setAttribute("aria-expanded", "false");
  });

  const customInput = tonePopover.querySelector(".ai-tone-custom-input");
  customInput?.addEventListener("input", () => {
    const safeTone = sanitizeToneValue(customInput.value);
    if (customInput.value !== safeTone) {
      customInput.value = safeTone;
    }
    composeRoot.dataset.aiCustomTone = safeTone;
    syncToneSelection(composeRoot);
    saveToneMemory(composeRoot);
  });

  document.addEventListener("click", (event) => {
    if (!floating.contains(event.target)) {
      tonePopover.hidden = true;
      toneToggle.setAttribute("aria-expanded", "false");
    }
  });

  floating.appendChild(toneToggle);
  floating.appendChild(tonePopover);

  return {
    floating
  };
}

function syncToneSelection(composeRoot) {
  const activeTone = composeRoot.dataset.aiTone || DEFAULT_TONE;
  composeRoot.querySelectorAll(".ai-tone-chip").forEach((chip) => {
    const isActive = chip.dataset.tone === activeTone;
    chip.dataset.active = isActive ? "true" : "false";
    chip.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  const toggleValue = composeRoot.querySelector(".ai-tone-toggle__value");
  if (toggleValue) {
    toggleValue.textContent = getToneDisplayLabel(composeRoot);
  }

  const customWrap = composeRoot.querySelector(".ai-tone-custom-wrap");
  if (customWrap) {
    customWrap.hidden = activeTone !== "custom";
  }

  renderRecentTones(composeRoot);
}

function resolveTone(composeRoot, userInstruction, selectedTone, customTone) {
  const inferredTone = inferToneFromInstruction(userInstruction);
  if (inferredTone) {
    composeRoot.dataset.aiTone = inferredTone;
    syncToneSelection(composeRoot);
    saveToneMemory(composeRoot);
    return inferredTone;
  }

  if (selectedTone === "custom") {
    return customTone || DEFAULT_TONE;
  }

  return selectedTone || DEFAULT_TONE;
}

function inferToneFromInstruction(userInstruction) {
  const normalized = (userInstruction || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  const toneMatchers = [
    { tone: "summarize", patterns: ["summarize", "summary", "summarise", "saransh", "short summary"] },
    { tone: "polite", patterns: ["polite", "politely", "vinamr", "vinamarta", "namr", "soft", "humbly"] },
    { tone: "formal", patterns: ["formal", "official", "proper", "professional tone", "adhikarik"] },
    { tone: "friendly", patterns: ["friendly", "casual", "warm", "pyar se", "friendly tone"] },
    { tone: "firm", patterns: ["aggressive", "firm", "strict", "strong", "sakht", "kadak", "assertive"] },
    { tone: "professional", patterns: ["professional", "normal", "simple", "business"] }
  ];

  const match = toneMatchers.find(({ patterns }) =>
    patterns.some((pattern) => normalized.includes(pattern))
  );

  return match?.tone || "";
}

function getToneDisplayLabel(composeRoot) {
  const activeTone = composeRoot.dataset.aiTone || DEFAULT_TONE;
  if (activeTone === "custom") {
    const customTone = (composeRoot.dataset.aiCustomTone || "").trim();
    return customTone ? `Custom: ${customTone}` : "Custom";
  }

  const match = TONE_OPTIONS.find((option) => option.value === activeTone);
  return match?.label || "Professional";
}

function sanitizeToneValue(value) {
  return (value || "")
    .replace(/[^a-zA-Z\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function initializeToneState(composeRoot, mode) {
  const memory = readToneMemory();
  const modeTone = mode === "reply" ? memory.replyTone : memory.composeTone;
  const modeCustomTone = mode === "reply" ? memory.replyCustomTone : memory.composeCustomTone;

  if (!composeRoot.dataset.aiTone) {
    composeRoot.dataset.aiTone = modeTone || DEFAULT_TONE;
  }

  if (!composeRoot.dataset.aiCustomTone && modeCustomTone) {
    composeRoot.dataset.aiCustomTone = modeCustomTone;
  }

  composeRoot.dataset.aiMode = mode;
}

function readToneMemory() {
  try {
    const raw = window.localStorage.getItem(TONE_MEMORY_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveToneMemory(composeRoot) {
  const memory = readToneMemory();
  const mode = composeRoot.dataset.aiMode || "compose";
  const tone = composeRoot.dataset.aiTone || DEFAULT_TONE;
  const customTone = composeRoot.dataset.aiCustomTone || "";
  const history = Array.isArray(memory.recentTones) ? memory.recentTones : [];
  const recentTones = [tone, ...history.filter((item) => item !== tone)].slice(0, 4);

  if (mode === "reply") {
    memory.replyTone = tone;
    memory.replyCustomTone = customTone;
  } else {
    memory.composeTone = tone;
    memory.composeCustomTone = customTone;
  }

  memory.recentTones = recentTones;

  try {
    window.localStorage.setItem(TONE_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Ignore storage issues and continue with in-memory UI state.
  }
}

function renderRecentTones(composeRoot) {
  const recentBox = composeRoot.querySelector(".ai-tone-popover__recent");
  if (!recentBox) {
    return;
  }

  const memory = readToneMemory();
  const recentTones = Array.isArray(memory.recentTones) ? memory.recentTones : [];
  const recentItems = recentTones
    .filter((tone) => tone && tone !== "custom")
    .map((tone) => {
      const label = TONE_OPTIONS.find((option) => option.value === tone)?.label || tone;
      return `<button type="button" class="ai-tone-recent" data-tone="${tone}">${label}</button>`;
    })
    .join("");

  recentBox.hidden = !recentItems;
  recentBox.innerHTML = recentItems;

  recentBox.querySelectorAll(".ai-tone-recent").forEach((button) => {
    button.onclick = () => {
      composeRoot.dataset.aiTone = button.dataset.tone || DEFAULT_TONE;
      syncToneSelection(composeRoot);
      saveToneMemory(composeRoot);
    };
  });
}


function setButtonState(button, state, labelText) {
  const label = button.querySelector(".ai-reply-button__label");
  if (label) {
    label.textContent = labelText;
  }

  button.disabled = state === "loading";
  button.dataset.state = state;
}

function collectEmailContext(composeRoot, composeBody) {
  if (isStandaloneCompose(composeRoot, composeBody)) {
    return "";
  }

  const threadRegion = findThreadRegion(composeRoot, composeBody);
  const messageScope = findMessageScope(threadRegion, composeRoot, composeBody);
  const composeDraft = cleanText(composeBody.innerText || composeBody.textContent || "");
  const subject = cleanText(
    threadRegion?.querySelector("h2.hP, h2[data-thread-perm-id]")?.textContent || ""
  );

  const sender = cleanText(
    messageScope?.querySelector(".gD, .go, .yP, .iv, .g2")?.textContent ||
      threadRegion?.querySelector(".gD, .go, .yP, .iv, .g2")?.textContent ||
      composeRoot.querySelector(".gD, .go, .yP, .iv")?.textContent ||
      ""
  );

  const latestMessage = extractLatestMessage(messageScope, composeBody);
  const threadText = extractThreadText(threadRegion, messageScope, composeBody);

  const context = [
    subject ? `Subject: ${subject}` : "",
    sender ? `Sender: ${sender}` : "",
    latestMessage ? `Latest message:\n${latestMessage}` : "",
    threadText ? `Thread context:\n${threadText}` : ""
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!context) {
    return "";
  }

  if (composeDraft && context === composeDraft) {
    return "";
  }

  return context;
}

function findThreadRegion(composeRoot, composeBody) {
  return (
    composeBody.closest('[role="list"]') ||
    composeBody.closest('.nH.if') ||
    composeRoot.closest('div[role="main"]') ||
    document.querySelector('div[role="main"]')
  );
}

function detectMode(composeRoot, composeBody, emailContext) {
  if (isStandaloneCompose(composeRoot, composeBody)) {
    return "compose";
  }

  if (emailContext && emailContext.trim()) {
    return "reply";
  }

  return "compose";
}

function isStandaloneCompose(composeRoot, composeBody) {
  const subjectInput = composeRoot.querySelector('input[name="subjectbox"], input[placeholder*="Subject"]');
  const recipientInput = composeRoot.querySelector('input[peoplekit-id], textarea[name="to"], input[aria-label^="To"]');
  const composeDialog = composeRoot.matches('div[role="dialog"]') || Boolean(composeRoot.closest('div[role="dialog"]'));
  const threadReplyContainer = composeBody.closest(".adn.ads, .h7, [data-message-id], .gs, [role=\"list\"]");

  if (subjectInput || recipientInput) {
    return true;
  }

  if (composeDialog && !threadReplyContainer) {
    return true;
  }

  return false;
}

function resolveUserInstruction(composeRoot, currentDraft, previousReply, mode) {
  const lastInstruction = composeRoot.dataset.aiReplyLastInstruction || "";

  if (!currentDraft) {
    return "";
  }

  if (previousReply && currentDraft === previousReply) {
    return lastInstruction;
  }

  if (mode === "reply" && !isLikelyReplyInstruction(currentDraft)) {
    return lastInstruction;
  }

  if (mode === "reply" && lastInstruction && currentDraft.startsWith(previousReply)) {
    return lastInstruction;
  }

  return currentDraft;
}

function isLikelyReplyInstruction(value) {
  const text = (value || "").trim();
  if (!text) {
    return false;
  }

  if (text.length > 180) {
    return false;
  }

  if ((text.match(/\n/g) || []).length > 2) {
    return false;
  }

  const lowered = text.toLowerCase();
  const looksLikeEmailBody = [
    "dear ",
    "best regards",
    "regards,",
    "sincerely",
    "thank you for",
    "i am writing"
  ].some((pattern) => lowered.includes(pattern));

  return !looksLikeEmailBody;
}

function findMessageScope(threadRegion, composeRoot, composeBody) {
  const replyContainer =
    composeBody.closest(".adn.ads") ||
    composeBody.closest(".bkK") ||
    composeBody.closest(".M9") ||
    composeBody.closest(".aoI");

  if (replyContainer) {
    const previousMessage = findPreviousVisibleMessage(replyContainer, threadRegion);
    if (previousMessage) {
      return previousMessage;
    }
  }

  const visibleMessages = getVisibleMessageBlocks(threadRegion || composeRoot);
  if (visibleMessages.length > 0) {
    return visibleMessages[visibleMessages.length - 1];
  }

  return threadRegion || composeRoot;
}

function findPreviousVisibleMessage(replyContainer, threadRegion) {
  let current = replyContainer.previousElementSibling;

  while (current) {
    if (isVisible(current) && current.querySelector(".a3s.aiL, .a3s")) {
      return current;
    }
    current = current.previousElementSibling;
  }

  const visibleMessages = getVisibleMessageBlocks(threadRegion);
  return visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;
}

function getVisibleMessageBlocks(root) {
  if (!root) {
    return [];
  }

  return Array.from(root.querySelectorAll(".adn.ads, .h7, [data-message-id], .gs"))
    .filter((node) => isVisible(node) && cleanText(node.innerText || node.textContent || ""));
}

function extractLatestMessage(messageScope, composeBody) {
  if (!messageScope) {
    return "";
  }

  const preferredContent = messageScope.querySelector(".a3s.aiL, .a3s");
  const fallbackContent = messageScope;
  const composeText = cleanText(composeBody.innerText || composeBody.textContent || "");
  const messageText = cleanText(
    preferredContent?.innerText ||
      preferredContent?.textContent ||
      fallbackContent.innerText ||
      fallbackContent.textContent ||
      ""
  );

  if (!messageText) {
    return "";
  }

  if (composeText && messageText === composeText) {
    return "";
  }

  return messageText.replace(composeText, "").trim().slice(-2500);
}

function extractThreadText(threadRegion, messageScope, composeBody) {
  const quotedBlocks = Array.from(
    (messageScope || threadRegion || composeBody.parentElement).querySelectorAll(".gmail_quote, blockquote, .h7")
  );

  const quotedText = quotedBlocks
    .map((node) => cleanText(node.innerText || node.textContent || ""))
    .filter(Boolean)
    .join("\n\n");

  if (quotedText) {
    return quotedText.slice(-5000);
  }

  const mainRegion = messageScope || threadRegion;

  if (!mainRegion) {
    return "";
  }

  const fullText = cleanText(mainRegion.innerText || mainRegion.textContent || "");
  const composeText = cleanText(composeBody.innerText || composeBody.textContent || "");

  if (!fullText) {
    return "";
  }

  return fullText.replace(composeText, "").trim().slice(-5000);
}

function cleanText(value) {
  return value.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function isVisible(node) {
  if (!node || !(node instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(node);
  return style.display !== "none" && style.visibility !== "hidden" && node.offsetParent !== null;
}

async function requestAiReply(payload) {
  if (!EXTENSION_RUNTIME?.sendMessage) {
    throw new Error("The extension runtime is unavailable. Reload the extension and try again.");
  }

  const result = await EXTENSION_RUNTIME.sendMessage({
    type: "GENERATE_AI_REPLY",
    payload
  });

  if (!result?.ok) {
    throw new Error(result?.error || "Backend response failed.");
  }

  return result.text || "";
}

function openAuthPopup() {
  if (!EXTENSION_RUNTIME?.sendMessage) {
    return;
  }

  EXTENSION_RUNTIME.sendMessage({ type: "OPEN_AUTH_POPUP" }).catch(() => {
    const popupUrl = EXTENSION_RUNTIME?.getURL?.("popup.html");
    if (popupUrl) {
      window.open(popupUrl, "_blank", "width=420,height=640");
    }
  });
}

function insertReply(composeBody, generatedReply) {
  composeBody.focus();

  const hasDraft = cleanText(composeBody.innerText || composeBody.textContent || "");
  if (hasDraft) {
    document.execCommand("selectAll", false, null);
  }

  const inserted = document.execCommand("insertText", false, generatedReply);
  if (!inserted) {
    composeBody.innerHTML = buildReplyHtml(generatedReply);
  }

  composeBody.dispatchEvent(new Event("input", { bubbles: true }));
  composeBody.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: generatedReply }));
  composeBody.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: generatedReply }));
  composeBody.dispatchEvent(new Event("change", { bubbles: true }));
}

function showInlineNotice(composeRoot, message, isError = false) {
  const existingNotice = composeRoot.querySelector(".ai-reply-notice");
  if (existingNotice) {
    existingNotice.remove();
  }

  const notice = document.createElement("div");
  notice.className = "ai-reply-notice";
  notice.dataset.variant = isError ? "error" : "success";
  notice.textContent = message;

  const composeBody = composeRoot.querySelector(COMPOSE_BODY_SELECTORS.join(","));
  const anchor = composeBody?.parentElement || composeRoot;
  anchor.appendChild(notice);

  window.setTimeout(() => {
    notice.remove();
  }, 2600);
}

function showAiGeneratedWarning(composeRoot, mode) {
  const existingWarning = composeRoot.querySelector(".ai-generated-warning");
  if (existingWarning) {
    existingWarning.remove();
  }

  composeRoot.classList.add("ai-compose-root");

  const message =
    mode === "reply"
      ? "AI reply added. Please review it once before sending."
      : "AI draft added. Please review it once before sending.";

  const warning = document.createElement("div");
  warning.className = "ai-generated-warning";
  warning.setAttribute("role", "note");
  warning.setAttribute("aria-live", "polite");
  warning.innerHTML = `
    <span class="ai-generated-warning__icon" aria-hidden="true">AI</span>
    <span class="ai-generated-warning__text">${message}</span>
    <button type="button" class="ai-generated-warning__close" aria-label="Dismiss warning">x</button>
  `;

  const closeButton = warning.querySelector(".ai-generated-warning__close");
  closeButton?.addEventListener("click", () => {
    warning.remove();
  });

  composeRoot.appendChild(warning);

  window.setTimeout(() => {
    warning.remove();
  }, 6000);
}

function buildReplyHtml(generatedReply) {
  const safeLines = generatedReply
    .split(/\r?\n/)
    .map((line) => escapeHtml(line));

  return safeLines
    .map((line) => (line ? `<div>${line}</div>` : "<div><br></div>"))
    .join("");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
