# Superhuman Power Tools — Project Rules

## Overview
Chrome extension (Manifest V3) adding two features to mail.superhuman.com:
1. **Auto-Clicker**: Dismisses "SEND ANYWAY" / "SCHEDULE ANYWAY" popups automatically
2. **Gmail Filter Creation**: Extracts sender/subject, opens Gmail with pre-populated search (Alt+G)

## File Map

| File | Runs on | Purpose |
|------|---------|---------|
| `manifest.json` | Chrome | Extension config, permissions, content script registration |
| `background.js` | Service worker | Orchestrates filter creation: listens for shortcut/click, messages content script, stores data, opens Gmail tab |
| `content.js` | mail.superhuman.com | **Two features**: (1) Auto-clicker polling loop + focus-safe click (2) Email data extraction for filters |
| `gmail-content.js` | mail.google.com | Reads stored filter data, builds search query, navigates Gmail SPA via hash |
| `tests/content.test.js` | Node.js (Jest) | Unit tests for extractable logic |

## Key DOM Selectors (fragile — break if Superhuman updates UI)
- `.Alert-action.selected` — The auto-click target button
- `.ThreadPane-subject.isSelectable` / `[class*="ThreadPane-subject"]` — Email subject line
- `.ContactPane-email` / `.ContactPane-compose-to-link` — Sender email address
- `input[aria-label="Search mail"]` — Gmail search box (used to detect Gmail readiness)

## Architecture Patterns
- **Message passing**: background.js ↔ content.js via `chrome.tabs.sendMessage` / `chrome.runtime.onMessage`
- **Inter-script data**: `chrome.storage.local` as a one-shot queue (write → read → delete)
- **SPA navigation**: Gmail hash route (`#search/encoded-query`) triggers search
- **Polling**: 150ms interval for auto-clicker, 200ms interval for Gmail readiness
- **Cooldown**: 3-second debounce after each auto-click

## Conventions
- Manifest V3 only (no background pages, service workers only)
- Zero external dependencies — vanilla JS throughout
- No popup UI — toolbar icon triggers action directly
- Permissions: `activeTab` + `storage` only (minimal surface)
- All data stays local — no network requests

## Testing
- Run: `npm test` (or `npx jest --verbose`) from project root
- 38 tests across 8 describe blocks covering both features + background.js + gmail-content.js
- Tests mock Chrome APIs and DOM via jsdom; background.js tests use `process.nextTick` to flush microtasks (fake timers break `nextTick` in Jest)
- Test file: `tests/content.test.js`

## Git
- `node_modules/` must be in `.gitignore`
- No deploy step — extension is loaded unpacked via `chrome://extensions/`
