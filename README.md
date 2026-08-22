<div align="center">

<img src="https://capsule-render.vercel.app/api?type=venom&color=0:EA4335,25:FBBC05,50:34A853,75:4285F4,100:EA4335&height=210&section=header&text=QuickMail&fontSize=70&fontColor=ffffff&animation=twinkling&fontAlignY=35&desc=AI-Assisted%20Email%20Drafting%2C%20Right%20Inside%20Gmail&descAlignY=58&descSize=18" width="100%"/>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&duration=2800&pause=900&color=4285F4&center=true&vCenter=true&width=780&lines=Click+%E2%86%92+Pick+a+Tone+%E2%86%92+Generate+%E2%86%92+Inserted+in+Gmail;Works+in+Reply+Mode+and+Fresh+Compose+Mode;OTP+Auth+%2B+JWT-Secured+Backend+Requests" alt="Typing SVG" />

<br/>

![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Gmail](https://img.shields.io/badge/Integrates%20With-Gmail-EA4335?style=for-the-badge&logo=gmail&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![JWT](https://img.shields.io/badge/Auth-JWT%20Secured-34A853?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Railway](https://img.shields.io/badge/Backend-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)

<br/>

[![Stars](https://img.shields.io/github/stars/bikashcode-dev/quickmail-AI-frontend?style=for-the-badge&color=FBBC05)](https://github.com/bikashcode-dev/quickmail-AI-frontend/stargazers)
[![Last Commit](https://img.shields.io/github/last-commit/bikashcode-dev/quickmail-AI-frontend?style=for-the-badge&color=34A853)](https://github.com/bikashcode-dev/quickmail-AI-frontend/commits)

</div>

**QuickMail** is a Chrome extension that adds AI-assisted email drafting directly inside Gmail's compose and reply boxes. It connects to the deployed [QuickMail backend](https://quick-email-ai-production.up.railway.app) on Railway for OTP authentication, JWT-secured access, and AI draft generation.

---

## 📌 Table of Contents

- [What It Does](#-what-it-does)
- [How It Works — Gmail Integration](#-how-it-works--gmail-integration)
- [Authentication Flow](#-authentication-flow)
- [Backend Communication](#-backend-communication)
- [Project Files](#-project-files)
- [Permissions](#-permissions)
- [Notes](#-notes)

---

## ✨ What It Does

<table>
<tr><td>🖱️</td><td><b>Inline Gmail Button</b></td><td>Adds a QuickMail action button inside Gmail compose <i>and</i> reply toolbars</td></tr>
<tr><td>↩️</td><td><b>Dual Mode</b></td><td>Works in both <b>reply mode</b> and <b>fresh compose mode</b></td></tr>
<tr><td>🎭</td><td><b>Tone Selection</b></td><td>User picks a tone before generation (formal, friendly, concise, etc.)</td></tr>
<tr><td>🔐</td><td><b>Local Auth Storage</b></td><td>Auth token stored securely in Chrome local storage</td></tr>
<tr><td>📩</td><td><b>OTP + Password Auth</b></td><td>Supports OTP verification <i>and</i> password login</td></tr>
<tr><td>🛡️</td><td><b>Protected API Calls</b></td><td>Sends JWT-secured draft-generation requests to the backend</td></tr>
</table>

---

## 🔄 How It Works — Gmail Integration

`content.js` watches Gmail for compose windows, locates the correct toolbar, and injects the QuickMail action button.

```mermaid
flowchart TD
    A["👀 content.js watches Gmail DOM"] --> B["📥 Compose/Reply window detected"]
    B --> C["🔘 QuickMail button injected into toolbar"]
    C --> D["🖱️ User clicks QuickMail"]
    D --> E["📖 Read current compose context"]
    E --> F{"↩️ Reply or<br/>✍️ Compose?"}
    F --> G["🎭 Gather tone, instruction,<br/>previous variation data"]
    G --> H["📨 Ask background.js<br/>to call the backend"]
    H --> I["🤖 AI draft generated"]
    I --> J["✍️ Draft inserted into Gmail editor"]

    style A fill:#4285F4,color:#fff
    style D fill:#FBBC05,color:#000
    style H fill:#EA4335,color:#fff
    style J fill:#34A853,color:#fff
```

---

## 🔐 Authentication Flow

Auth state lives in `chrome.storage.local`. The extension supports four entry paths into the same secured session:

```mermaid
flowchart LR
    Start(["🚪 User opens<br/>auth.html / popup.html"]) --> Choice{Choose path}

    Choice -->|New user| OTP1["📧 OTP Sign-up"]
    Choice -->|Existing, no password| OTP2["📧 OTP Sign-in"]
    Choice -->|Existing, has password| PW["🔑 Password Login"]

    OTP1 --> Verify["✅ Verify OTP"]
    OTP2 --> Verify
    Verify --> SetPW["🔒 Optional: Set Password"]

    PW --> Token["🎟️ JWT Issued"]
    SetPW --> Token
    Verify --> Token

    Token --> Store["💾 Stored in chrome.storage.local"]
    Store --> Ready["✅ Ready for protected<br/>backend requests"]

    style Token fill:#4285F4,color:#fff
    style Store fill:#FBBC05,color:#000
    style Ready fill:#34A853,color:#fff
```

**Handled by:** `auth.js` (OTP signup/login flow) · `popup.js` (popup auth/session flow) · `background.js` (network + popup handling)

---

## 🌐 Backend Communication

**Base URL:**
```text
https://quick-email-ai-production.up.railway.app
```

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/auth/send-otp` | Send OTP to user's email |
| `POST` | `/auth/account-status` | Check if account exists / verification state |
| `POST` | `/auth/verify-otp` | Verify submitted OTP, issue JWT |
| `POST` | `/auth/login` | Password-based login |
| `POST` | `/auth/set-password` | Set password after OTP verification |
| `POST` | `/api/email/generate` | 🔐 Protected — generate AI email draft |

---

## 📁 Project Files

| File | Role |
|---|---|
| `manifest.json` | Extension metadata & permissions (Manifest V3) |
| `background.js` | Service worker — handles API requests & popup logic |
| `content.js` | Gmail DOM integration, tone UI, context extraction, draft insertion |
| `content.css` | Injected Gmail-side styling |
| `auth.html` | Auth window UI |
| `auth.js` | OTP signup/login flow |
| `popup.html` | Extension popup UI |
| `popup.js` | Popup auth/session flow |

```mermaid
flowchart LR
    subgraph Gmail["📧 Inside Gmail Tab"]
        CJ[content.js]
        CC[content.css]
    end
    subgraph Extension["🧩 Extension Chrome"]
        BG[background.js<br/>service worker]
        PU["popup.html + popup.js"]
        AU["auth.html + auth.js"]
    end
    subgraph BE["☁️ Railway Backend"]
        API[REST API]
    end

    CJ <-->|messages| BG
    PU <-->|messages| BG
    AU <-->|messages| BG
    BG <-->|JWT-secured HTTPS| API

    style Gmail fill:#EA4335,color:#fff
    style Extension fill:#4285F4,color:#fff
    style BE fill:#0B0D0E,color:#fff
```

---

## 🔑 Permissions

| Permission | Why |
|---|---|
| `storage` | Persist auth token & session state locally |
| Gmail host permission | Inject UI and read compose context inside Gmail |
| Deployed backend host permission | Allow JWT-secured requests to the Railway API |

---

## 📝 Notes

- 🧩 **Manifest version:** 3
- ⚙️ Background **service worker** handles all network requests
- 🖋️ **Content script** owns all Gmail UI integration
- 🔐 **JWT token** is attached to every protected backend request

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=venom&color=0:4285F4,25:34A853,50:FBBC05,75:EA4335,100:4285F4&height=110&section=footer" width="100%"/>

</div>
