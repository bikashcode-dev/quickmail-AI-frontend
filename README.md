# QuickMail Chrome Extension

QuickMail is a Chrome extension that adds AI-assisted email drafting directly inside Gmail. It connects to the deployed QuickMail backend on Railway for OTP auth, JWT-secured access, and AI draft generation.

## What It Does

- adds a QuickMail button inside Gmail compose and reply boxes
- supports both reply mode and fresh compose mode
- lets the user choose tone before generation
- stores auth token in Chrome local storage
- supports OTP verification and password login
- sends protected draft-generation requests to the backend API

## Project Files

- `manifest.json`: extension metadata and permissions
- `background.js`: service worker for API requests and popup handling
- `content.js`: Gmail DOM integration, tone UI, context extraction, and draft insertion
- `content.css`: injected Gmail-side styling
- `auth.html`: auth window UI
- `auth.js`: OTP signup/login flow
- `popup.html`: extension popup UI
- `popup.js`: popup auth/session flow

## How It Works

### Gmail Integration

`content.js` watches Gmail for compose windows, finds the correct toolbar, and injects a QuickMail action button. When the user clicks it:

1. the script reads the current compose context
2. it decides whether the action is `reply` or `compose`
3. it gathers tone, instruction, and previous variation data
4. it asks `background.js` to call the backend
5. the generated draft is inserted into the editor

### Authentication

The extension supports:

- OTP sign-in
- OTP-based account creation
- optional password setup after verification
- direct password login for existing users

Auth state is stored in `chrome.storage.local`.

### Backend Communication

The extension talks to:

`https://quick-email-ai-production.up.railway.app`

Main backend calls:

- `POST /auth/send-otp`
- `POST /auth/account-status`
- `POST /auth/verify-otp`
- `POST /auth/login`
- `POST /auth/set-password`
- `POST /api/email/generate`

## Permissions

- `storage`
- Gmail host permissions
- deployed backend host permission

## Notes

- manifest version: 3
- background service worker handles network requests
- content script is responsible for Gmail UI integration
- JWT token is attached to protected backend requests
