# QuickMail Frontend Interview Prep Deck

---

## Slide 1: Frontend Title

**QuickMail Chrome Extension**

Gmail-integrated frontend that:

- injects AI drafting controls into Gmail
- handles OTP and password-based user access
- stores JWT session locally
- sends protected requests to the backend API

---

## Slide 2: Frontend Goal

The frontend was built to make AI email drafting feel native inside Gmail instead of forcing users to switch to a separate app.

Main goals:

- keep the workflow inside Gmail
- make auth simple for users
- keep the UX fast
- connect securely with the backend

---

## Slide 3: Frontend Tech Choices

- Chrome Extension Manifest V3
- content scripts for Gmail UI integration
- background service worker for API communication
- popup/auth pages for login flow
- Chrome local storage for session persistence

Why this stack:

- fits Gmail integration naturally
- avoids building a separate web product
- keeps user actions close to the compose box

---

## Slide 4: Important Files

- `manifest.json`
- `content.js`
- `content.css`
- `background.js`
- `auth.html`
- `auth.js`
- `popup.html`
- `popup.js`

---

## Slide 5: Manifest Responsibilities

`manifest.json` defines:

- extension name and version
- permissions
- host permissions
- popup entry
- background service worker
- content script injection rules

Likely question:

"Why did you need host permissions?"

Suggested answer:

"The extension needs Gmail access for UI injection and backend host access for API calls."

---

## Slide 6: Content Script Role

`content.js` is the Gmail integration layer.

It:

- watches the Gmail DOM
- detects compose and reply editors
- injects the QuickMail button
- extracts email thread context
- inserts AI-generated output into the editor

---

## Slide 7: Why Content Script

Why not do everything from popup?

- popup cannot directly control Gmail editor state
- Gmail compose box lives in page DOM
- toolbar injection requires DOM observation
- reply/compose context must be read from Gmail page structure

---

## Slide 8: Background Worker Role

`background.js` handles:

- secure API request flow
- message passing from the content script
- opening auth popup when session is missing
- attaching JWT to protected requests

Why useful:

- keeps network logic separate from Gmail DOM logic
- makes content script cleaner

---

## Slide 9: Auth Pages

`auth.html/auth.js` and `popup.html/popup.js` manage:

- OTP send
- OTP verify
- password login
- password setup
- session recovery

Good interview line:

"I kept auth UI separate from Gmail injection logic so the extension stayed modular."

---

## Slide 10: How Login Works

1. user enters email
2. extension checks account status
3. user chooses OTP or password route
4. backend verifies credentials
5. JWT token is saved in `chrome.storage.local`
6. later protected requests reuse that token

---

## Slide 11: Why Chrome Local Storage

- shared across popup, auth window, and background worker
- persists after popup closes
- simple for session handling in extensions

Likely question:

"Why not cookies or sessionStorage?"

Suggested answer:

"Chrome local storage is more suitable for extension-wide shared state."

---

## Slide 12: Compose vs Reply Detection

In `content.js`:

- visible editor is located using contenteditable selectors
- nearby Gmail message blocks are scanned
- if thread text is found, request becomes `reply`
- if no previous thread context is found, request becomes `compose`

This is one of the most interview-worthy frontend parts.

---

## Slide 13: Tone Selection Feature

Frontend supports multiple tones:

- professional
- formal
- friendly
- polite
- firm
- custom tone

Why this matters:

- improves user control
- reduces prompt rewriting effort
- makes AI output more practical

---

## Slide 14: Request Flow To Backend

1. content script gathers:
   - email context
   - mode
   - tone
   - previous reply
   - instruction
2. sends message to background worker
3. background worker attaches JWT
4. request goes to `/api/email/generate`
5. backend returns generated draft
6. content script inserts it into Gmail

---

## Slide 15: Error Handling

Frontend handles:

- missing session
- expired session
- timeout
- invalid backend response
- missing email context
- missing compose instruction

Good answer:

"I tried to keep errors actionable so users know whether they need to log in again, retry, or add more input."

---

## Slide 16: Gmail DOM Challenges

Hard part:

- Gmail DOM is complex and dynamic
- compose boxes can appear in multiple layouts
- reply editors and fresh compose windows differ
- buttons and toolbars are not always in one fixed place

Strong answer:

"I used DOM scanning plus mutation observers so the extension could react to Gmail UI changes dynamically."

---

## Slide 17: Security From Frontend Side

- token stored locally
- token sent only to backend host
- protected routes use Bearer token
- auth popup opens when session is missing or expired

Improvement you can mention:

- stricter token lifecycle handling
- optional token refresh flow later

---

## Slide 18: Questions You May Be Asked

- Why build a Chrome extension instead of a website?
- How does the extension detect Gmail compose windows?
- Why use a background service worker?
- How is auth state shared across files?
- How do you insert generated text safely?
- How do you distinguish compose from reply?
- What happens if the token expires?
- How do you prevent breaking Gmail UX?

---

## Slide 19: Suggested Answers

### Why Chrome extension?

"Because the user already works inside Gmail, so the best UX is to assist them there directly."

### Why background worker?

"It keeps API logic separate and works well with Manifest V3 architecture."

### Why content script?

"Because Gmail UI access and toolbar injection require direct DOM interaction."

---

## Slide 20: Improvement Points

- add automated browser tests
- improve DOM selector resilience further
- support draft history
- support user preferences sync
- support refresh token flow

---

## Slide 21: Final Frontend Summary

This frontend shows:

- browser extension architecture understanding
- DOM integration skills
- real Gmail workflow support
- session handling with JWT
- structured integration with a Spring Boot backend
