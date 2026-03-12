# Superhuman Power Tools

A Chrome extension that adds two quality-of-life features to [Superhuman](https://mail.superhuman.com):

1. **Popup Auto-Clicker** — Automatically dismisses "SEND ANYWAY" and "SCHEDULE ANYWAY" confirmation popups so you never have to click them manually.
2. **Gmail Filter Creation** — One-click Gmail filter creation from the email you're viewing. Press **Alt+G** (or click the toolbar icon) and Gmail opens with the sender and subject pre-filled as a search query, ready to turn into a filter.

## Installation

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this folder

## Usage

### Popup Auto-Clicker (automatic)

No action required. When Superhuman shows a subject-line warning popup with a "SEND ANYWAY" or "SCHEDULE ANYWAY" button, the extension clicks it automatically within ~200ms.

**How it works:**
- Polls the page every 150ms for the alert button (`.Alert-action.selected`)
- When found, waits 50ms for DOM stability, then clicks
- Enters a 3-second cooldown to prevent duplicate clicks
- Preserves window focus after clicking

### Gmail Filter Creation (manual trigger)

1. Open an email in Superhuman
2. Trigger the extension:
   - **Keyboard shortcut**: `Alt+G`
   - **Toolbar button**: Click the extension icon
3. Gmail opens in a background tab with the search pre-populated (e.g. `from:sender@example.com subject:(Meeting Notes)`)
4. In the Gmail tab, click **Show search options** (the down-arrow in the search bar), then **Create filter** to finish setup

#### Status Badge

After triggering, a badge briefly appears on the toolbar icon:

| Badge | Color  | Meaning                                              |
|-------|--------|------------------------------------------------------|
| OK    | Green  | Data extracted, Gmail opened                         |
| ---   | Orange | No sender or subject found (email may not be open)   |
| ERR   | Red    | Content script not loaded (not on Superhuman)        |

## Debug API

Open the browser DevTools console on any Superhuman page and call:

| Function | Returns |
|----------|---------|
| `getExtensionErrorReports()` | Array of the last 10 tracked JS errors and promise rejections |
| `getExtensionEnvironment()` | Current page state: URL, window size, focus info, alert elements, recent errors |
| `checkCurrentFocus()` | Logs the current `document.hasFocus()` and `document.activeElement` |

## Architecture

```
mail.superhuman.com                                          mail.google.com
┌──────────────────────────────────────┐                    ┌──────────────────┐
│ content.js                           │                    │ gmail-content.js │
│                                      │                    │                  │
│ [Auto-Clicker]                       │                    │ Reads stored     │
│  polls 150ms → finds alert → clicks  │                    │ filter data,     │
│                                      │                    │ builds query,    │
│ [Filter Extraction]                  │◄── msg ──┐         │ sets location    │
│  extractEmailData() → {from,subject} │── data ──┤         │ hash             │
└──────────────────────────────────────┘          │         └──────────────────┘
                                                  │                  ▲
                                       ┌──────────┴────────┐        │
                                       │ background.js      │        │
                                       │ (service worker)   │        │
                                       │                    │        │
                                       │ stores data in     │── tab ─┘
                                       │ chrome.storage,    │
                                       │ opens Gmail tab    │
                                       └───────────────────┘
```

**Data flow (filter creation):**
1. `content.js` extracts sender email and subject from Superhuman's DOM
2. `background.js` stores the data in `chrome.storage.local` and opens Gmail
3. `gmail-content.js` reads the stored data, builds a search query, and navigates Gmail's SPA router via `location.hash`

**Data flow (auto-clicker):**
1. `content.js` polls every 150ms for `.Alert-action.selected`
2. When found with "SEND ANYWAY" or "SCHEDULE ANYWAY" text, clicks after 50ms delay
3. 3-second cooldown prevents duplicate clicks

## Project Structure

```
├── manifest.json        # Extension config (Manifest V3)
├── background.js        # Service worker — orchestrates filter creation flow
├── content.js           # Superhuman content script — auto-clicker + email extraction
├── gmail-content.js     # Gmail content script — triggers the filter search
├── tests/
│   └── content.test.js  # Unit tests for content script logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Permissions

| Permission  | Why                                                        |
|-------------|------------------------------------------------------------|
| `activeTab` | Send messages to the active Superhuman tab                 |
| `storage`   | Pass extracted data from Superhuman script to Gmail script |

No host permissions, no network requests, no data leaves the browser.

## Technical Notes

- **DOM selectors are fragile**: `.ThreadPane-subject`, `.ContactPane-email`, and `.Alert-action.selected` are discovered via DOM inspection and may break if Superhuman updates their UI.
- **Gmail search hash route**: `#search/` is a stable part of Gmail's SPA router.
- **Filter data lifecycle**: Extract → Store → Read → Delete (all local, immediate cleanup).
- **Error buffer**: Rolling buffer of the last 10 errors, kept in memory only (lost on page reload).
- **Focus preservation**: After auto-clicking, the extension monitors for focus loss and attempts `window.focus()` to restore it.
