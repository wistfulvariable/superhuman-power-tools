# Superhuman Power Tools — Project Rules

## Overview
Chrome extension (Manifest V3) adding five features to mail.superhuman.com:
1. **Auto-Clicker**: Dismisses "SEND ANYWAY" / "SCHEDULE ANYWAY" popups automatically
2. **Gmail Filter Creation**: Extracts sender/subject, opens Gmail with pre-populated search (Alt+G)
3. **Comment Popup Blocker**: Hides "Comment & Share Conversation" hover popup via injected CSS
4. **Copy Email Button**: Adds a "Copy" button near the email header to copy email content (both HTML and plain text formats, like native Ctrl+C)
5. **AI Email Summarization**: Adds a "Summarize" button that streams email summary from Anthropic API into a sidebar with tabs (TL;DR, Key Takeaways)

## File Map

| File | Runs on | Purpose |
|------|---------|---------|
| `manifest.json` | Chrome | Extension config, permissions, content script registration |
| `background.js` | Service worker | Orchestrates filter creation + AI summarization via Anthropic API |
| `content.js` | mail.superhuman.com | **Five features**: (1) Comment popup blocker via CSS injection (2) Auto-clicker polling loop + focus-safe click (3) Email data extraction for filters (4) Copy email button injection (5) Summarize button + modal UI |
| `gmail-content.js` | mail.google.com | Reads stored filter data, builds search query, navigates Gmail SPA via hash |
| `tests/content.test.js` | Node.js (Jest) | Unit tests for extractable logic

## Key DOM Selectors (fragile — break if Superhuman updates UI)
- `.Alert-action.selected` — The auto-click target button
- `.ThreadPane-subject.isSelectable` / `[class*="ThreadPane-subject"]` — Email subject line (also used as copy button anchor)
- `.ContactPane-email` / `.ContactPane-compose-to-link` — Sender email address
- `.CommentInput-container.isHidden` — Comment/share hover popup (hidden via CSS injection)
- `input[aria-label="Search mail"]` — Gmail search box (used to detect Gmail readiness)
- `.SandboxedRender` — Container for email body content (Shadow DOM, see below)
- `.MessagePane-expanded.isFocus` — Currently focused/expanded email message

## Email Body Extraction (Copy/Summarize features)
Superhuman renders email content inside **Shadow DOM** for security isolation. The extraction functions:

- **`extractEmailBodyContent()`**: Returns `{ text, html }` — used by Copy button for rich clipboard
- **`extractEmailBodyText()`**: Wrapper returning just text — used by Summarize feature
- **`extractCleanTextFromShadow()`**: Extracts plain text with preserved line breaks and link URLs
- **`extractCleanHtmlFromShadow()`**: Extracts clean HTML (no styles/scripts)

Priority chain for finding email content:

1. **Shadow DOM** (Primary): `.SandboxedRender` elements contain open shadow roots with actual email HTML
   - Access via `element.shadowRoot` (open mode, accessible)
   - Must filter out `<style>`, `<script>`, `<link>` elements to get clean content
   - Cannot use `shadowRoot.cloneNode()` — iterate `childNodes` and clone each child instead
   - Preserves line breaks by walking DOM and adding `\n` around block elements
   - Preserves links in format: `Link Text (https://url.com)` for plain text
   - Prioritize `.MessagePane-expanded.isFocus .SandboxedRender` for currently viewed email

2. **sh-color classes**: Fallback for content outside shadow DOM (class contains `sh-color`)

3. **Standard selectors**: `.MessageBody`, `[class*="MessageBody-"]`, etc.

4. **Tables**: For HTML emails with table-based layouts

5. **Message containers**: Last resort, filters out UI strings like "@mention anyone"

## Clipboard API (Copy feature)
The Copy button uses `navigator.clipboard.write()` with `ClipboardItem` to copy both formats:
- `text/html` — Formatted HTML for rich text editors (Word, Google Docs, etc.)
- `text/plain` — Clean text for plain text editors

Falls back to `navigator.clipboard.writeText()` if `ClipboardItem` isn't supported.

## Architecture Patterns
- **Message passing**: background.js ↔ content.js via `chrome.tabs.sendMessage` / `chrome.runtime.onMessage`
- **Streaming**: Port-based via `chrome.runtime.connect()` for SSE from Anthropic API
- **Inter-script data**: `chrome.storage.local` as a one-shot queue (write → read → delete)
- **SPA navigation**: Gmail hash route (`#search/encoded-query`) triggers search
- **Polling**: 150ms interval for auto-clicker, 200ms interval for Gmail readiness
- **Cooldown**: 3-second debounce after each auto-click

## Streaming UI (Summarization)
- **Block-based rendering**: `splitIntoRenderableBlocks()` splits markdown into complete blocks (headers, paragraphs, lists)
- **Throttled updates**: 100ms interval to batch DOM updates during streaming
- **Fade-in animation**: `.shpt-paragraph-new` class with CSS animation for new blocks
- **No-animation finalization**: `.shpt-paragraph-final` class for final content (prevents flash at end)
- **Tab state tracking**: `tabPartialContent` object stores streaming content per tab for tab-switching
- **Persistent cache**: Summaries stored in `chrome.storage.local` keyed by email subject, survives page refresh
- **Fast-stream fallback**: When a stream completes before any throttled DOM update fires (common with short TL;DR responses), the `done` handler detects missing `streamingState` and renders directly via `renderMarkdown()` instead of relying on the block-based renderer
- **`streamDone` guard**: Each stream sets a `streamDone` flag on completion to prevent pending `setTimeout` callbacks from the throttle from corrupting already-finalized content
- **Service worker keepalive**: `background.js` uses a periodic `chrome.storage.local.get()` heartbeat (every 20s) while streams are active to prevent MV3 service worker termination; reference-counted via `activeStreams` so the interval stops when all streams complete
- **Silent disconnect recovery**: `port.onDisconnect` in content.js shows an error message whenever the tab received no content, even if `chrome.runtime.lastError` is unset (covers service worker idle termination)

## Conventions
- Manifest V3 only (no background pages, service workers only)
- Zero external dependencies — vanilla JS throughout
- No popup UI — toolbar icon triggers action directly
- Permissions: `activeTab` + `storage` + `host_permissions` for Anthropic API
- Data stays local except for AI summarization (sends email to Anthropic API)

## API Key Setup (AI Summarization)
Set your Anthropic API key via DevTools console on any Superhuman page:
```javascript
chrome.storage.local.set({ anthropicApiKey: 'sk-ant-...' })
```

## Testing
- Run: `npm test` (or `npx jest --verbose`) from project root
- Tests mock Chrome APIs and DOM via jsdom; background.js tests use `process.nextTick` to flush microtasks (fake timers break `nextTick` in Jest)
- Copy button tests mock both `ClipboardItem` constructor and `navigator.clipboard.write()`
- Test file: [tests/content.test.js](tests/content.test.js)
- **Note**: Some modal functionality tests have async timing issues and may fail intermittently

## Git
- `node_modules/` must be in `.gitignore`
- No deploy step — extension is loaded unpacked via `chrome://extensions/`
