# Superhuman Power Tools

A Chrome extension that adds productivity features to [Superhuman](https://mail.superhuman.com).

## Features

### 1. Auto-Clicker (automatic)
Automatically dismisses "SEND ANYWAY" and "SCHEDULE ANYWAY" confirmation popups so you never have to click them manually.

### 2. Gmail Filter Creation (Alt+G)
Press **Alt+G** on any email to jump to Gmail with a pre-populated search for creating filters based on the sender and subject.

### 3. Comment Popup Blocker (automatic)
Hides the annoying "Comment & Share Conversation" popup that appears when hovering over certain areas.

### 4. Copy Email Button
Adds a **Copy** button near the email header. Copies both HTML (for rich text editors) and plain text formats.

### 5. AI Email Summarization
Adds a **Summarize** button that uses Claude AI to analyze emails and provide:
- **TL;DR**: 2-4 bullet point summary
- **Key Takeaways**: Comprehensive analysis including response requirements, context, action items, and questions to consider

---

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the folder containing this extension

---

## Setup: AI Summarization

The Summarize feature requires an Anthropic API key. Follow these steps:

### Step 1: Get an API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key
5. Copy the key (it starts with `sk-ant-`)

### Step 2: Add the Key to the Extension

1. Open [Superhuman](https://mail.superhuman.com) in Chrome
2. Open Chrome DevTools:
   - **Windows/Linux**: Press `F12` or `Ctrl+Shift+I`
   - **Mac**: Press `Cmd+Option+I`
3. Click the **Console** tab
4. Paste this command, replacing `sk-ant-your-key-here` with your actual key:

```javascript
chrome.storage.local.set({ anthropicApiKey: 'sk-ant-your-key-here' })
```

5. Press **Enter**
6. You should see `undefined` — this means it worked
7. Close DevTools

### Step 3: Test It

1. Open any email in Superhuman
2. Look for the **Summarize** button near the subject line (next to Copy)
3. Click it to generate an AI summary

### Troubleshooting

**"API key not configured" error:**
- Make sure you ran the command on a Superhuman tab
- The key must start with `sk-ant-`
- Try the setup again

**To check if your key is saved:**
```javascript
chrome.storage.local.get('anthropicApiKey', result => console.log(result.anthropicApiKey ? 'Key is set' : 'No key found'))
```

**To remove your key:**
```javascript
chrome.storage.local.remove('anthropicApiKey')
```

---

## Usage Guide

### Summarize Button
1. Open an email in Superhuman
2. Click the **Summarize** button (next to Copy button)
3. A sidebar opens with two tabs:
   - **TL;DR**: Quick 2-4 bullet summary
   - **Key Takeaways**: Detailed analysis with response requirements, context, action items
4. Content streams in real-time as the AI generates it
5. Summaries are cached — clicking Summarize again reopens without regenerating
6. Press **Escape** or click **×** to close

### Copy Button
1. Open an email in Superhuman
2. Click the **Copy** button
3. Paste anywhere — HTML formatting is preserved in rich text editors like Word or Google Docs

### Gmail Filter (Alt+G)
1. Open an email in Superhuman
2. Press **Alt+G** (or click the toolbar icon)
3. Gmail opens with search pre-filled with sender/subject
4. Click **Show search options** → **Create filter** to finish

### Comment Popup Blocker
No action required. The popup is automatically hidden.

**Required Superhuman setting:** Enable **"Hide comment bar"** in Superhuman settings:
1. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows)
2. Type "Settings" and select it
3. Go to **Advanced**
4. Enable **"Hide comment bar"**

### Auto-Clicker
No action required. Confirmation popups are automatically dismissed within ~200ms.

---

## Privacy & Cost

### Privacy
- **Local processing**: All features except AI Summarization work entirely locally
- **AI Summarization**: Email content is sent to Anthropic's API for processing
- **No tracking**: This extension does not collect or transmit any analytics
- **API key storage**: Your key is stored locally in Chrome's extension storage

### Cost
AI Summarization uses Claude 3.5 Haiku. Typical costs:
- ~$0.01-0.03 per email summary
- Costs are displayed in the sidebar footer

---

## Debug API

Open DevTools console on any Superhuman page:

| Function | Returns |
|----------|---------|
| `getExtensionErrorReports()` | Last 10 tracked JS errors |
| `getExtensionEnvironment()` | Current page state and diagnostics |
| `checkCurrentFocus()` | Logs focus state |

---

## Architecture

```
mail.superhuman.com                              mail.google.com
┌────────────────────────────────┐              ┌──────────────────┐
│ content.js                     │              │ gmail-content.js │
│                                │              │                  │
│ • Auto-Clicker (polls 150ms)   │              │ Reads stored     │
│ • Comment Popup Blocker (CSS)  │              │ filter data,     │
│ • Copy Button                  │              │ navigates Gmail  │
│ • Summarize Button + Sidebar   │              │                  │
│ • Filter Data Extraction       │              │                  │
└────────────────────────────────┘              └──────────────────┘
         │                                               ▲
         │ messages                                      │
         ▼                                               │
┌────────────────────────────────────────────────────────┴───────┐
│ background.js (service worker)                                 │
│                                                                │
│ • Orchestrates filter creation flow                            │
│ • Streams AI summaries from Anthropic API                      │
│ • Manages chrome.storage for data passing                      │
└────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
├── manifest.json        # Extension config (Manifest V3)
├── background.js        # Service worker — filter creation + AI streaming
├── content.js           # Superhuman — all 5 features
├── gmail-content.js     # Gmail — filter search navigation
├── tests/
│   └── content.test.js  # Unit tests
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Send messages to active Superhuman tab |
| `storage` | Store API key and pass data between scripts |
| `host_permissions` | Connect to Anthropic API for summarization |

---

## Development

```bash
npm install    # Install test dependencies
npm test       # Run unit tests
```

---

## License

MIT
