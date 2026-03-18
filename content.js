// Superhuman Power Tools — Content Script
// Runs on mail.superhuman.com
// Feature 1: Auto-clicks "SEND ANYWAY" / "SCHEDULE ANYWAY" popups
// Feature 2: Extracts email data for Gmail filter creation
// Feature 4: Copy email content button
// Feature 5: AI-powered email summarization via Anthropic API

console.log("Superhuman Power Tools loaded!");

// ============================================================================
// FEATURE 3: Hide "Comment & Share Conversation" hover popup
// The .CommentInput-container.isHidden element triggers a tether-positioned
// tooltip when the mouse hovers near the bottom of an email thread.
// We force it to stay invisible and ignore pointer events.
// ============================================================================

const style = document.createElement("style");
style.textContent = `
  .CommentInput-container.isHidden {
    display: none !important;
    pointer-events: none !important;
  }
`;
document.documentElement.appendChild(style);

// ============================================================================
// FEATURE 1: Popup Auto-Clicker (Focus-Safe)
// Automatically dismisses subject-line warning popups in Superhuman.
// Polls every 150ms for the alert button, clicks it, then enters a 3s cooldown.
// ============================================================================

let hasClicked = false;
let clickTimeout = null;
let errorReports = [];

// --- Error tracking (rolling buffer of 10) ---

window.addEventListener("error", function (event) {
  const report = {
    timestamp: new Date().toISOString(),
    type: "JavaScript Error",
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error ? event.error.toString() : "Unknown error",
    url: window.location.href,
    userAgent: navigator.userAgent,
    focusInfo: {
      activeElement: document.activeElement
        ? document.activeElement.tagName
        : "none",
      hasFocus: document.hasFocus(),
    },
  };
  errorReports.push(report);
  console.error("EXTENSION ERROR DETECTED:", report);
  if (errorReports.length > 10) {
    errorReports = errorReports.slice(-10);
  }
});

window.addEventListener("unhandledrejection", function (event) {
  const report = {
    timestamp: new Date().toISOString(),
    type: "Unhandled Promise Rejection",
    reason: event.reason ? event.reason.toString() : "Unknown rejection",
    url: window.location.href,
    userAgent: navigator.userAgent,
    focusInfo: {
      activeElement: document.activeElement
        ? document.activeElement.tagName
        : "none",
      hasFocus: document.hasFocus(),
    },
  };
  errorReports.push(report);
  console.error("PROMISE REJECTION DETECTED:", report);
  if (errorReports.length > 10) {
    errorReports = errorReports.slice(-10);
  }
});

// --- Environment report ---

function generateEnvironmentReport() {
  return {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    windowSize: `${window.innerWidth}x${window.innerHeight}`,
    documentReady: document.readyState,
    focus: {
      documentHasFocus: document.hasFocus(),
      activeElement: document.activeElement
        ? {
            tagName: document.activeElement.tagName,
            className: document.activeElement.className,
            id: document.activeElement.id,
          }
        : null,
      windowFocused: document.hasFocus(),
    },
    superhuman: {
      alertElements: document.querySelectorAll(".Alert-action").length,
      selectedAlerts: document.querySelectorAll(".Alert-action.selected").length,
      allAlerts: Array.from(document.querySelectorAll(".Alert-action")).map(
        (el) => ({
          text: el.textContent,
          classes: el.className,
          visible: el.offsetParent !== null,
        })
      ),
    },
    recentErrors: errorReports.slice(-5),
  };
}

// --- Polling loop (150ms) ---

setInterval(() => {
  if (hasClicked) return;

  const sendButton = document.querySelector(".Alert-action.selected");
  if (!sendButton) return;

  const buttonText = sendButton.textContent;

  if (buttonText.includes("SEND ANYWAY")) {
    console.log("Found SEND ANYWAY button, clicking in 50ms...");
    hasClicked = true;
    clickTimeout = setTimeout(() => {
      triggerFocusSafeClick(sendButton, "SEND ANYWAY");
      resetClickFlag();
    }, 50);
  } else if (buttonText.includes("SCHEDULE ANYWAY")) {
    console.log("Found SCHEDULE ANYWAY button, clicking in 50ms...");
    hasClicked = true;
    clickTimeout = setTimeout(() => {
      triggerFocusSafeClick(sendButton, "SCHEDULE ANYWAY");
      resetClickFlag();
    }, 50);
  }
}, 150);

// --- Click cooldown (3 seconds) ---

function resetClickFlag() {
  setTimeout(() => {
    hasClicked = false;
    console.log("Ready for next click");
  }, 3000);
}

// --- Focus-safe click ---

function triggerFocusSafeClick(element, buttonType) {
  const preClickReport = generateEnvironmentReport();
  console.log("PRE-CLICK ENVIRONMENT:", preClickReport);

  const originalActiveElement = document.activeElement;
  const originalHasFocus = document.hasFocus();

  console.log("Focus before click:", {
    activeElement: originalActiveElement
      ? originalActiveElement.tagName
      : "none",
    hasFocus: originalHasFocus,
  });

  try {
    console.log(`Auto-clicking ${buttonType} button`);
    console.log("Button properties:", {
      text: element.textContent,
      classes: element.className,
      visible: element.offsetParent !== null,
      disabled: element.disabled,
      style: element.style.cssText,
    });

    element.click();

    // Monitor focus changes after click
    setTimeout(() => {
      const postClickReport = generateEnvironmentReport();
      console.log("POST-CLICK ENVIRONMENT:", postClickReport);

      const newActiveElement = document.activeElement;
      const newHasFocus = document.hasFocus();

      console.log("Focus after click:", {
        activeElement: newActiveElement ? newActiveElement.tagName : "none",
        hasFocus: newHasFocus,
        focusChanged: originalActiveElement !== newActiveElement,
        focusLost: originalHasFocus && !newHasFocus,
      });

      if (originalHasFocus && !newHasFocus) {
        console.warn("Focus was lost after clicking button!");
        setTimeout(() => {
          if (!document.hasFocus()) {
            console.log("Attempting to restore window focus...");
            window.focus();
          }
        }, 100);
      }

      const stillExists = document.contains(element);
      console.log(`Button still exists after click: ${stillExists}`);
      if (stillExists) {
        console.warn(
          "Button still exists after click - click might not have worked"
        );
      }
    }, 1000);

    console.log(`Successfully clicked ${buttonType}`);
  } catch (error) {
    const errorReport = {
      timestamp: new Date().toISOString(),
      type: "Click Error",
      error: error.toString(),
      stack: error.stack,
      buttonType: buttonType,
      element: {
        tagName: element.tagName,
        className: element.className,
        textContent: element.textContent,
        disabled: element.disabled,
      },
      environment: preClickReport,
    };
    console.error("Error clicking button:", errorReport);
    errorReports.push(errorReport);
  }
}

// --- Debug API (call from DevTools console) ---

window.getExtensionErrorReports = function () {
  console.log("COMPLETE ERROR REPORT:");
  console.log(JSON.stringify(errorReports, null, 2));
  return errorReports;
};

window.getExtensionEnvironment = function () {
  const report = generateEnvironmentReport();
  console.log("CURRENT ENVIRONMENT:");
  console.log(JSON.stringify(report, null, 2));
  return report;
};

window.checkCurrentFocus = function () {
  console.log("CURRENT FOCUS STATE:", {
    documentHasFocus: document.hasFocus(),
    activeElement: document.activeElement
      ? {
          tagName: document.activeElement.tagName,
          className: document.activeElement.className,
          id: document.activeElement.id,
        }
      : "none",
  });
};

// ============================================================================
// FEATURE 2: Gmail Filter Data Extraction
// Extracts sender email and subject from the currently open Superhuman email.
// Called by background.js when the user triggers the filter shortcut (Alt+G).
// ============================================================================

function extractEmailData() {
  try {
    const subjectEl =
      document.querySelector(".ThreadPane-subject.isSelectable") ??
      document.querySelector('[class*="ThreadPane-subject"]');

    const fromEl =
      document.querySelector(".ContactPane-email") ??
      document.querySelector(".ContactPane-compose-to-link");

    const subject = subjectEl?.textContent?.trim() || null;
    const from = fromEl?.textContent?.trim() || null;

    return { from, subject };
  } catch (e) {
    return { error: e.message };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "extractEmailData") {
    sendResponse(extractEmailData());
  }
  return true;
});

// ============================================================================
// FEATURE 4: Copy Email Button
// Injects a button near the email header to copy the email body to clipboard.
// Uses MutationObserver to detect email view changes and inject the button.
// ============================================================================

// --- Button styles (shared by Copy and Summarize) ---
const btnStyles = document.createElement("style");
btnStyles.textContent = `
  .shpt-copy-btn,
  .shpt-summarize-btn {
    background: transparent;
    border: 1px solid #555;
    color: #999;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    cursor: pointer;
    margin-right: 8px;
    transition: all 0.15s ease;
    vertical-align: middle;
    line-height: 1;
  }
  .shpt-copy-btn:hover,
  .shpt-summarize-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: #777;
    color: #ccc;
  }
  .shpt-copy-btn:active,
  .shpt-summarize-btn:active {
    background: rgba(255, 255, 255, 0.15);
  }
  .shpt-copy-btn.shpt-copied {
    color: #4caf50;
    border-color: #4caf50;
  }
  .shpt-summarize-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  /* Summary Sidebar */
  .shpt-sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 380px;
    height: 100vh;
    background: #1a1a1a;
    border-left: 1px solid #333;
    display: flex;
    flex-direction: column;
    z-index: 999999;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.4);
    transform: translateX(100%);
    transition: transform 0.2s ease-out;
  }
  .shpt-sidebar.shpt-sidebar-open {
    transform: translateX(0);
  }
  .shpt-sidebar-body {
    padding: 10px;
    overflow-y: auto;
    flex: 1;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.5;
  }
  .shpt-sidebar-body h1 {
    font-size: 16px;
    margin: 1.5em 0 0.4em 0;
  }
  .shpt-sidebar-body h2 {
    font-size: 14px;
    margin: 1.4em 0 0.3em 0;
  }
  .shpt-sidebar-body h3 {
    font-size: 13px;
    margin: 1.2em 0 0.3em 0;
  }
  .shpt-sidebar-body h1, .shpt-sidebar-body h2, .shpt-sidebar-body h3 {
    color: #fff;
  }
  .shpt-sidebar-body h1:first-child,
  .shpt-sidebar-body h2:first-child,
  .shpt-sidebar-body h3:first-child {
    margin-top: 0;
  }
  /* Requires Response highlight */
  .shpt-response-yes {
    color: #4caf50;
    font-weight: 600;
  }
  .shpt-response-no {
    color: #888;
    font-weight: 600;
  }
  .shpt-response-maybe {
    color: #ffb74d;
    font-weight: 600;
  }
  .shpt-sidebar-body ul, .shpt-sidebar-body ol {
    padding-left: 1.2em;
    margin: 0.3em 0;
    list-style-type: disc;
  }
  .shpt-sidebar-body li {
    margin: 0.15em 0;
  }
  /* Nested lists - sub-items should be smaller/different */
  .shpt-sidebar-body ul ul,
  .shpt-sidebar-body ul ol {
    list-style-type: circle;
    margin: 0.1em 0;
  }
  .shpt-sidebar-body ul ul li,
  .shpt-sidebar-body ol ul li {
    font-size: 0.95em;
    color: #c0c0c0;
  }
  .shpt-sidebar-body p {
    margin: 0.3em 0;
  }
  .shpt-sidebar-body strong {
    color: #fff;
  }
  .shpt-sidebar-body em {
    color: #b0b0b0;
  }
  .shpt-sidebar-body code {
    background: #2a2a2a;
    padding: 1px 4px;
    border-radius: 2px;
    font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
    font-size: 0.9em;
  }
  .shpt-sidebar-body pre {
    background: #2a2a2a;
    padding: 8px;
    border-radius: 3px;
    overflow-x: auto;
    margin: 0.3em 0;
  }
  .shpt-sidebar-body pre code {
    background: none;
    padding: 0;
  }
  .shpt-sidebar-error {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
    padding: 8px;
    border-radius: 3px;
    border: 1px solid rgba(255, 107, 107, 0.3);
  }
  .shpt-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #999;
    font-size: 12px;
  }
  .shpt-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #333;
    border-top-color: #999;
    border-radius: 50%;
    animation: shpt-spin 1s linear infinite;
  }
  @keyframes shpt-spin {
    to { transform: rotate(360deg); }
  }
  .shpt-streaming-cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background: #999;
    margin-left: 2px;
    animation: shpt-blink 0.8s infinite;
    vertical-align: text-bottom;
  }
  @keyframes shpt-blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  /* Paragraph fade-in animation - gentle and smooth */
  .shpt-paragraph-new {
    animation: shpt-fade-in 0.6s ease-out forwards;
  }
  /* Ensure heading margins work inside streamed blocks */
  .shpt-paragraph-new > h1:first-child,
  .shpt-paragraph-new > h2:first-child,
  .shpt-paragraph-new > h3:first-child {
    margin-top: 0;
  }
  .shpt-paragraph-new + .shpt-paragraph-new > h1:first-child,
  .shpt-paragraph-new + .shpt-paragraph-new > h2:first-child,
  .shpt-paragraph-new + .shpt-paragraph-new > h3:first-child {
    margin-top: 1.4em;
  }
  @keyframes shpt-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Final block - no animation, just apply the final styling */
  .shpt-paragraph-final {
    opacity: 1;
    color: inherit;
    white-space: normal;
  }
  .shpt-paragraph-final > h1:first-child,
  .shpt-paragraph-final > h2:first-child,
  .shpt-paragraph-final > h3:first-child {
    margin-top: 0;
  }

  /* Streaming partial text - subtle styling */
  .shpt-streaming-partial {
    color: #b0b0b0;
    white-space: pre-wrap;
    font-family: inherit;
  }

  /* Summary tabs */
  .shpt-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid #333;
    padding: 0 10px;
    flex-shrink: 0;
    align-items: center;
  }
  .shpt-tab {
    background: transparent;
    border: none;
    color: #888;
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.15s ease;
  }
  .shpt-tab:hover {
    color: #bbb;
  }
  .shpt-tab.shpt-tab-active {
    color: #fff;
    border-bottom-color: #4a9eff;
  }
  .shpt-tab:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .shpt-tabs-close {
    margin-left: auto;
    background: transparent;
    border: none;
    color: #666;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    line-height: 1;
  }
  .shpt-tabs-close:hover {
    color: #fff;
  }

  /* Cost tracker */
  .shpt-sidebar-footer {
    padding: 8px 12px;
    border-top: 1px solid #333;
    font-size: 12px;
    color: #888;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
  }
  .shpt-cost-value {
    color: #aaa;
  }
`;
document.documentElement.appendChild(btnStyles);

// --- Helper to extract clean text from a shadow root (excluding styles/scripts) ---
function extractCleanTextFromShadow(shadowRoot) {
  if (!shadowRoot) return '';

  // We can't clone the shadow root directly, so we need to work with its children
  // Clone each child node into a container
  const container = document.createElement('div');

  // Get all child nodes and clone them (not the shadowRoot itself)
  for (const child of shadowRoot.childNodes) {
    // Skip style, script, and link elements
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tagName = child.tagName.toLowerCase();
      if (tagName === 'style' || tagName === 'script' ||
          (tagName === 'link' && child.rel === 'stylesheet')) {
        continue;
      }
    }
    container.appendChild(child.cloneNode(true));
  }

  // Also remove any nested style/script elements that were cloned
  container.querySelectorAll('style, script, link[rel="stylesheet"]').forEach(el => el.remove());

  // Convert to text while preserving line breaks
  // Replace block elements with newlines for better formatting
  const blockTags = ['div', 'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr'];

  // Walk through and insert newlines before/after block elements
  function getTextWithLineBreaks(node) {
    let text = '';

    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase();

        // Add newline before block elements
        if (blockTags.includes(tagName)) {
          if (text && !text.endsWith('\n')) {
            text += '\n';
          }
        }

        // Handle links - include the URL
        if (tagName === 'a' && child.href) {
          const linkText = child.textContent.trim();
          const href = child.href;
          // If link text is different from URL, include both
          if (linkText && linkText !== href && !linkText.startsWith('http')) {
            text += `${linkText} (${href})`;
          } else {
            text += href;
          }
        } else {
          // Recursively get text from children
          text += getTextWithLineBreaks(child);
        }

        // Add newline after block elements
        if (blockTags.includes(tagName) || tagName === 'br') {
          if (!text.endsWith('\n')) {
            text += '\n';
          }
        }
      }
    }

    return text;
  }

  const text = getTextWithLineBreaks(container);

  // Clean up excessive newlines (more than 2 in a row)
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// --- Helper to extract HTML from a shadow root (excluding styles/scripts) ---
function extractCleanHtmlFromShadow(shadowRoot) {
  if (!shadowRoot) return '';

  const container = document.createElement('div');

  for (const child of shadowRoot.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tagName = child.tagName.toLowerCase();
      if (tagName === 'style' || tagName === 'script' ||
          (tagName === 'link' && child.rel === 'stylesheet')) {
        continue;
      }
    }
    container.appendChild(child.cloneNode(true));
  }

  // Remove nested style/script elements
  container.querySelectorAll('style, script, link[rel="stylesheet"]').forEach(el => el.remove());

  return container.innerHTML;
}

// --- Email body extraction (returns both HTML and plain text) ---
function extractEmailBodyContent() {
  // PRIORITY 1: Superhuman renders email content in Shadow DOM inside SandboxedRender elements
  const sandboxedRenders = document.querySelectorAll('.SandboxedRender, [class*="SandboxedRender"]');
  const shadowContents = [];

  for (const sandbox of sandboxedRenders) {
    if (sandbox.shadowRoot) {
      const text = extractCleanTextFromShadow(sandbox.shadowRoot);
      const html = extractCleanHtmlFromShadow(sandbox.shadowRoot);
      if (text.length > 20) {
        shadowContents.push({ shadowRoot: sandbox.shadowRoot, text, html });
      }
    }
    const nestedShadows = sandbox.querySelectorAll('*');
    for (const nested of nestedShadows) {
      if (nested.shadowRoot) {
        const text = extractCleanTextFromShadow(nested.shadowRoot);
        const html = extractCleanHtmlFromShadow(nested.shadowRoot);
        if (text.length > 20) {
          shadowContents.push({ shadowRoot: nested.shadowRoot, text, html });
        }
      }
    }
  }

  // Find the focused/expanded message's shadow content (prioritize isFocus)
  const focusedPane = document.querySelector('.MessagePane-expanded.isFocus .SandboxedRender');
  if (focusedPane && focusedPane.shadowRoot) {
    const text = extractCleanTextFromShadow(focusedPane.shadowRoot);
    const html = extractCleanHtmlFromShadow(focusedPane.shadowRoot);
    if (text.length > 20) {
      return { text, html };
    }
  }

  // If we found shadow content, return the largest one (most complete email)
  if (shadowContents.length > 0) {
    shadowContents.sort((a, b) => b.text.length - a.text.length);
    return { text: shadowContents[0].text, html: shadowContents[0].html };
  }

  // PRIORITY 2: Superhuman also uses sh-color classes for email content
  const shColorContainers = document.querySelectorAll('.sh-color, [class*="sh-color"]');
  if (shColorContainers.length > 0) {
    let bestContainer = null;
    let bestLength = 0;

    for (const container of shColorContainers) {
      const text = container.textContent.trim();
      if (text.length < 20) continue;
      if (bestContainer && bestContainer.contains(container)) continue;

      let hasLargerParent = false;
      for (const other of shColorContainers) {
        if (other !== container && other.contains(container)) {
          const otherText = other.textContent.trim();
          if (Math.abs(otherText.length - text.length) < text.length * 0.1) {
            hasLargerParent = true;
            break;
          }
        }
      }
      if (hasLargerParent) continue;

      if (text.length > bestLength) {
        bestLength = text.length;
        bestContainer = container;
      }
    }

    if (bestContainer && bestLength > 20) {
      return { text: bestContainer.textContent.trim(), html: bestContainer.innerHTML };
    }
  }

  // PRIORITY 3: Try standard message body selectors
  const selectors = [
    '.MessageBody',
    '[class*="MessageBody-"]',
    '[class*="Message-body"]',
    '.EmailBody',
    '[class*="EmailBody-"]',
    '[class*="Message-content"]',
    '[class*="MessageContent"]',
    '[class*="ThreadMessage-body"]',
    '[class*="ThreadPane-message"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim()) {
      return { text: el.textContent.trim(), html: el.innerHTML };
    }
  }

  // PRIORITY 4: Look for email content in HTML tables (common in formatted emails)
  const tables = document.querySelectorAll('table tbody, table');
  for (const table of tables) {
    const text = table.textContent.trim();
    if (text.length > 100 && !text.includes('SEND ANYWAY') && !text.includes('@mention')) {
      return { text, html: table.outerHTML };
    }
  }

  // PRIORITY 5: Try message containers, filtering out UI elements
  const messageContainers = document.querySelectorAll(
    '[class*="Message"]:not([class*="MessageInput"]):not([class*="MessageCompose"])'
  );
  for (const container of messageContainers) {
    const text = container.textContent.trim();
    if (text.length > 50 &&
        !text.includes('@mention anyone') &&
        !text.includes('This comment will be visible') &&
        !text.includes('Hit') && !text.includes('to summarize')) {
      return { text, html: container.innerHTML };
    }
  }

  console.warn("Superhuman Power Tools: Could not find email body content");
  return null;
}

// --- Email body text extraction (wrapper for backwards compatibility) ---
function extractEmailBodyText() {
  const content = extractEmailBodyContent();
  return content ? content.text : null;
}

// --- Copy handler with visual feedback (copies both HTML and plain text) ---
async function handleCopyClick(btn) {
  const content = extractEmailBodyContent();
  if (!content) {
    btn.textContent = "No content";
    setTimeout(() => {
      btn.textContent = "Copy";
    }, 2000);
    return;
  }

  try {
    // Create ClipboardItem with both HTML and plain text formats
    // This mimics native Ctrl+C behavior where apps can paste formatted or plain text
    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([content.html], { type: 'text/html' }),
      'text/plain': new Blob([content.text], { type: 'text/plain' })
    });
    await navigator.clipboard.write([clipboardItem]);
    btn.textContent = "Copied!";
    btn.classList.add("shpt-copied");
    setTimeout(() => {
      btn.textContent = "Copy";
      btn.classList.remove("shpt-copied");
    }, 2000);
  } catch (err) {
    console.error("Superhuman Power Tools: Rich clipboard write failed, falling back to text", err);
    // Fallback to plain text if ClipboardItem isn't supported
    try {
      await navigator.clipboard.writeText(content.text);
      btn.textContent = "Copied!";
      btn.classList.add("shpt-copied");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("shpt-copied");
      }, 2000);
    } catch (fallbackErr) {
      console.error("Superhuman Power Tools: Clipboard write failed", fallbackErr);
      btn.textContent = "Failed";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 2000);
    }
  }
}

// ============================================================================
// FEATURE 5: AI Email Summarization
// ============================================================================

// Tab configuration
const SUMMARY_TABS = [
  { id: "tldr", label: "TL;DR", promptType: "tldr" },
  { id: "full", label: "Key Takeaways", promptType: "full" }
];

// Track current state
let currentTab = "tldr";
let currentEmailContent = null;
let tabContents = {}; // Cache results per tab
let tabStreaming = {}; // Track which tabs are currently streaming
let tabPartialContent = {}; // Track partial content during streaming
let currentUsageStats = null;
let sidebarCollapsed = false; // Track if sidebar is collapsed vs closed

// --- Cache key generation (simple hash of email content) ---
function generateCacheKey(content) {
  // Simple hash function for cache key
  let hash = 0;
  for (let i = 0; i < Math.min(content.length, 500); i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'summary_' + hash.toString(36);
}

// --- Save summary to persistent storage ---
async function saveSummaryToStorage(content, summaries) {
  try {
    const cacheKey = generateCacheKey(content);
    const cacheData = {
      emailContent: content.substring(0, 200), // Store snippet for verification
      tabContents: summaries,
      timestamp: Date.now()
    };
    await chrome.storage.local.set({ [cacheKey]: cacheData });
  } catch (e) {
    console.error("Failed to save summary to storage:", e);
  }
}

// --- Load summary from persistent storage ---
async function loadSummaryFromStorage(content) {
  try {
    const cacheKey = generateCacheKey(content);
    const result = await chrome.storage.local.get(cacheKey);
    const cached = result[cacheKey];

    if (cached && cached.tabContents) {
      // Check if cache is less than 1 hour old
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - cached.timestamp < oneHour) {
        return cached.tabContents;
      }
    }
    return null;
  } catch (e) {
    console.error("Failed to load summary from storage:", e);
    return null;
  }
}

// --- Copy markdown button handler ---
async function handleCopyMarkdown(btn) {
  const markdown = tabContents[currentTab];
  if (!markdown) {
    return;
  }

  try {
    await navigator.clipboard.writeText(markdown);
    btn.classList.add("shpt-copied");
    btn.innerHTML = "&#10003;"; // Checkmark
    setTimeout(() => {
      btn.classList.remove("shpt-copied");
      btn.innerHTML = "&#128203;"; // Clipboard icon
    }, 1500);
  } catch (err) {
    console.error("Failed to copy markdown:", err);
  }
}

// --- Sidebar management ---
function showSummarySidebar(content, isError = false) {
  // Remove existing sidebar if any
  closeSummarySidebar();

  const sidebar = document.createElement("div");
  sidebar.className = "shpt-sidebar";

  // Create tabs with close button
  const tabs = document.createElement("div");
  tabs.className = "shpt-tabs";

  for (const tab of SUMMARY_TABS) {
    const tabBtn = document.createElement("button");
    tabBtn.className = "shpt-tab" + (tab.id === currentTab ? " shpt-tab-active" : "");
    tabBtn.textContent = tab.label;
    tabBtn.dataset.tabId = tab.id;
    tabBtn.addEventListener("click", () => handleTabClick(tab.id));
    tabs.appendChild(tabBtn);
  }

  // Close button in tabs row
  const closeBtn = document.createElement("button");
  closeBtn.className = "shpt-tabs-close";
  closeBtn.innerHTML = "×";
  closeBtn.title = "Close";
  closeBtn.addEventListener("click", closeSummarySidebar);
  tabs.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "shpt-sidebar-body";

  if (isError) {
    body.innerHTML = `<div class="shpt-sidebar-error">${escapeHtml(content)}</div>`;
  } else {
    body.innerHTML = renderMarkdown(content);
  }

  // Footer with cost tracking
  const footer = document.createElement("div");
  footer.className = "shpt-sidebar-footer";
  footer.innerHTML = `<span>This call: <span class="shpt-cost-value" data-cost-this>-</span></span><span>Total: <span class="shpt-cost-value" data-cost-total>-</span></span>`;

  sidebar.appendChild(tabs);
  sidebar.appendChild(body);
  sidebar.appendChild(footer);
  document.body.appendChild(sidebar);

  // Load initial cost stats
  loadCostStats();

  // Trigger slide-in animation
  requestAnimationFrame(() => {
    sidebar.classList.add("shpt-sidebar-open");
  });

  // Close on Escape key
  document.addEventListener("keydown", handleEscapeKey);
}

function showLoadingSidebar() {
  closeSummarySidebar();

  const sidebar = document.createElement("div");
  sidebar.className = "shpt-sidebar";

  // Create tabs with close button
  const tabs = document.createElement("div");
  tabs.className = "shpt-tabs";

  for (const tab of SUMMARY_TABS) {
    const tabBtn = document.createElement("button");
    tabBtn.className = "shpt-tab" + (tab.id === currentTab ? " shpt-tab-active" : "");
    tabBtn.textContent = tab.label;
    tabBtn.dataset.tabId = tab.id;
    tabBtn.disabled = true; // Disabled during loading
    tabBtn.addEventListener("click", () => handleTabClick(tab.id));
    tabs.appendChild(tabBtn);
  }

  // Close button in tabs row
  const closeBtn = document.createElement("button");
  closeBtn.className = "shpt-tabs-close";
  closeBtn.innerHTML = "×";
  closeBtn.title = "Close";
  closeBtn.addEventListener("click", closeSummarySidebar);
  tabs.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "shpt-sidebar-body";
  body.innerHTML = `<div class="shpt-loading"><div class="shpt-spinner"></div><span>Analyzing...</span></div>`;

  // Footer with cost tracking
  const footer = document.createElement("div");
  footer.className = "shpt-sidebar-footer";
  footer.innerHTML = `<span>This call: <span class="shpt-cost-value" data-cost-this>-</span></span><span>Total: <span class="shpt-cost-value" data-cost-total>-</span></span>`;

  sidebar.appendChild(tabs);
  sidebar.appendChild(body);
  sidebar.appendChild(footer);
  document.body.appendChild(sidebar);

  // Load initial cost stats
  loadCostStats();

  // Trigger slide-in animation
  requestAnimationFrame(() => {
    sidebar.classList.add("shpt-sidebar-open");
  });

  // Close on Escape key
  document.addEventListener("keydown", handleEscapeKey);
}

// Load and display cost stats from storage
async function loadCostStats() {
  try {
    const result = await chrome.storage.local.get("usageStats");
    const stats = result.usageStats || { totalCost: 0 };
    updateCostDisplay(null, stats.totalCost);
  } catch (e) {
    console.error("Failed to load usage stats:", e);
  }
}

// Update cost display in footer (rounded to nearest penny)
function updateCostDisplay(thisCost, totalCost) {
  const thisEl = document.querySelector("[data-cost-this]");
  const totalEl = document.querySelector("[data-cost-total]");

  if (thisEl && thisCost !== null) {
    thisEl.textContent = "$" + thisCost.toFixed(2);
  }
  if (totalEl && totalCost !== null && totalCost !== undefined) {
    totalEl.textContent = "$" + totalCost.toFixed(2);
  }
}

// Handle tab click - switch tabs to show different content
function handleTabClick(tabId) {
  if (tabId === currentTab) return;

  currentTab = tabId;

  // Update tab UI
  document.querySelectorAll(".shpt-tab").forEach(tab => {
    tab.classList.toggle("shpt-tab-active", tab.dataset.tabId === tabId);
  });

  const body = document.querySelector(".shpt-sidebar-body");
  if (!body) return;

  // Show content for this tab
  if (tabContents[tabId]) {
    // Tab is complete - show cached content
    body.innerHTML = renderMarkdown(tabContents[tabId]);
  } else if (tabStreaming[tabId]) {
    // Tab is still streaming - render what we have so far
    delete streamingState[tabId]; // Reset DOM state for fresh render
    body.innerHTML = ''; // Clear for streaming

    // If we have partial content, render it immediately
    if (tabPartialContent[tabId]) {
      updateTabContent(tabId, tabPartialContent[tabId], true);
    } else {
      // No content yet - show loading spinner
      body.innerHTML = `<div class="shpt-loading"><div class="shpt-spinner"></div><span>Analyzing...</span></div>`;
    }
  } else if (currentEmailContent) {
    // Tab hasn't started yet (shouldn't happen with parallel loading, but just in case)
    body.innerHTML = `<div class="shpt-loading"><div class="shpt-spinner"></div><span>Analyzing...</span></div>`;
    startStreamingSummary(currentEmailContent, tabId);
  }
}

// Check if user is scrolled near the bottom (within 50px)
function isNearBottom(element) {
  const threshold = 50;
  return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

// Track streaming state per tab for smooth rendering
let streamingState = {};

// Detect if a line is a complete structural element (heading, list item, etc.)
function isCompleteBlock(text) {
  const trimmed = text.trim();
  // Headers
  if (/^#{1,3} .+$/.test(trimmed)) return true;
  // List items (including nested) - must have content after the bullet
  if (/^[\s]*[\*\-] .{3,}$/.test(trimmed)) return true;
  // Empty line (paragraph break marker)
  if (trimmed === '') return true;
  return false;
}

// Split content into renderable blocks (paragraphs, headers, list groups)
// A block is only complete when followed by a newline (next line exists)
function splitIntoRenderableBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let currentBlock = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isTopLevelListItem = /^[\*\-] /.test(line); // Not indented
    const isSubListItem = /^  +[\*\-] /.test(line); // Indented (sub-item)
    const isHeader = /^#{1,3} /.test(trimmed);
    const isEmpty = trimmed === '';
    const hasNextLine = i < lines.length - 1; // Is there another line after this?

    if (isHeader) {
      // Headers are their own block, but only complete if there's a next line
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      if (hasNextLine) {
        blocks.push(line);
      } else {
        currentBlock.push(line); // Keep as partial
      }
    } else if (isTopLevelListItem) {
      // Each top-level bullet point is its own block (for smooth streaming)
      // But first, flush any pending block
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      // Start new block with this list item
      currentBlock.push(line);
    } else if (isSubListItem) {
      // Sub-items attach to the current block (their parent list item)
      currentBlock.push(line);
    } else if (isEmpty) {
      // Empty line ends current block
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
    } else {
      // Regular text - could be continuation of previous or new paragraph
      // If we have a list item in currentBlock, this might be wrapped text
      // Otherwise treat as new paragraph content
      if (currentBlock.length > 0 && /^[\*\-] /.test(currentBlock[0])) {
        // Previous was a list item, this regular text ends the list block
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      currentBlock.push(line);
    }
  }

  // Return blocks and remaining partial
  const partial = currentBlock.join('\n');
  return { blocks, partial };
}

// Finalize streaming - render final partial without animation, then clean up
function finalizeStreamingContent(tabId) {
  const body = document.querySelector(".shpt-sidebar-body");
  if (!body) return;

  // Remove the blinking cursor element
  const partialEl = body.querySelector(".shpt-streaming-partial");
  if (partialEl) partialEl.remove();

  // Render any remaining content that wasn't rendered yet (without animation)
  const fullText = tabContents[tabId];
  if (fullText && streamingState[tabId]) {
    const { blocks, partial } = splitIntoRenderableBlocks(fullText);
    const state = streamingState[tabId];

    // Render remaining complete blocks without animation
    while (state.renderedBlocks < blocks.length) {
      const blockText = blocks[state.renderedBlocks];
      const blockDiv = document.createElement("div");
      blockDiv.className = "shpt-paragraph-final";
      blockDiv.innerHTML = renderMarkdown(blockText);
      body.appendChild(blockDiv);
      state.renderedBlocks++;
    }

    // Render the final partial without animation
    if (partial.trim()) {
      const blockDiv = document.createElement("div");
      blockDiv.className = "shpt-paragraph-final";
      blockDiv.innerHTML = renderMarkdown(partial);
      body.appendChild(blockDiv);
    }
  }

  // Clean up streaming state
  delete streamingState[tabId];
}

// Update sidebar content for a specific tab (used during streaming)
function updateTabContent(tabId, content, isStreaming = false) {
  // Only update the DOM if this is the currently visible tab
  if (tabId !== currentTab) return;

  const body = document.querySelector(".shpt-sidebar-body");
  if (!body) return;

  // Check if we should auto-scroll (only if user is near bottom)
  const shouldAutoScroll = isNearBottom(body);

  // Remove loading spinner if still present
  const loadingEl = body.querySelector(".shpt-loading");
  if (loadingEl) {
    loadingEl.remove();
  }

  if (!isStreaming) {
    // Final render - just clean up streaming artifacts, don't re-render everything
    // This prevents the "flash" at the end of streaming
    const partialEl = body.querySelector(".shpt-streaming-partial");
    if (partialEl) partialEl.remove();

    // If we have streaming state, render any remaining partial content
    if (streamingState[tabId]) {
      const { blocks, partial } = splitIntoRenderableBlocks(content);
      const state = streamingState[tabId];

      // Render any remaining blocks
      while (state.renderedBlocks < blocks.length) {
        const blockText = blocks[state.renderedBlocks];
        const blockDiv = document.createElement("div");
        blockDiv.className = "shpt-paragraph-new";
        blockDiv.innerHTML = renderMarkdown(blockText);
        body.appendChild(blockDiv);
        state.renderedBlocks++;
      }

      // Render final partial if any
      if (partial.trim()) {
        const blockDiv = document.createElement("div");
        blockDiv.className = "shpt-paragraph-new";
        blockDiv.innerHTML = renderMarkdown(partial);
        body.appendChild(blockDiv);
      }
    }

    delete streamingState[tabId];
  } else {
    // Streaming: use block-based rendering for smoother output
    if (!streamingState[tabId]) {
      streamingState[tabId] = { renderedBlocks: 0 };
      body.innerHTML = ''; // Clear for fresh streaming
    }

    const { blocks, partial } = splitIntoRenderableBlocks(content);
    const state = streamingState[tabId];

    // All blocks except the last are complete (partial is separate)
    const completeBlocks = blocks;

    // Append any new complete blocks with animation
    while (state.renderedBlocks < completeBlocks.length) {
      const blockText = completeBlocks[state.renderedBlocks];

      // Remove partial element if exists
      const partialEl = body.querySelector(".shpt-streaming-partial");
      if (partialEl) partialEl.remove();

      // Create new block with fade-in
      const blockDiv = document.createElement("div");
      blockDiv.className = "shpt-paragraph-new";
      blockDiv.innerHTML = renderMarkdown(blockText);
      body.appendChild(blockDiv);

      state.renderedBlocks++;
    }

    // Show a simple loading indicator instead of raw partial text
    // This prevents the jarring display of unrendered markdown
    let partialEl = body.querySelector(".shpt-streaming-partial");
    if (partial.trim()) {
      if (!partialEl) {
        partialEl = document.createElement("div");
        partialEl.className = "shpt-streaming-partial";
        body.appendChild(partialEl);
      }
      // Just show a blinking cursor, no raw text
      partialEl.innerHTML = '<span class="shpt-streaming-cursor"></span>';
    } else if (partialEl) {
      partialEl.remove();
    }
  }

  // Only auto-scroll if user was already near the bottom
  if (shouldAutoScroll) {
    body.scrollTop = body.scrollHeight;
  }
}

// Legacy function for compatibility
function updateSidebarContent(content, isStreaming = false) {
  updateTabContent(currentTab, content, isStreaming);
}

function closeSummarySidebar() {
  const sidebar = document.querySelector(".shpt-sidebar");
  if (sidebar) {
    sidebar.classList.remove("shpt-sidebar-open");
    setTimeout(() => sidebar.remove(), 200);
  }
  document.removeEventListener("keydown", handleEscapeKey);
  sidebarCollapsed = false;
}

// Collapse sidebar (hide but keep data)
function collapseSummarySidebar() {
  const sidebar = document.querySelector(".shpt-sidebar");
  if (sidebar) {
    sidebar.classList.remove("shpt-sidebar-open");
    setTimeout(() => sidebar.remove(), 200);
  }
  document.removeEventListener("keydown", handleEscapeKey);
  sidebarCollapsed = true; // Mark as collapsed, not closed
}

// Restore collapsed sidebar with cached content
function restoreSummarySidebar() {
  if (!currentEmailContent || Object.keys(tabContents).length === 0) {
    return false; // Nothing to restore
  }

  // Create sidebar with cached content
  const sidebar = document.createElement("div");
  sidebar.className = "shpt-sidebar";

  // Create tabs with close button
  const tabs = document.createElement("div");
  tabs.className = "shpt-tabs";

  for (const tab of SUMMARY_TABS) {
    const tabBtn = document.createElement("button");
    tabBtn.className = "shpt-tab" + (tab.id === currentTab ? " shpt-tab-active" : "");
    tabBtn.textContent = tab.label;
    tabBtn.dataset.tabId = tab.id;
    // Show loading indicator if tab is still streaming
    if (tabStreaming[tab.id]) {
      tabBtn.textContent = tab.label + "...";
    }
    tabBtn.addEventListener("click", () => handleTabClick(tab.id));
    tabs.appendChild(tabBtn);
  }

  // Close button in tabs row
  const closeBtn = document.createElement("button");
  closeBtn.className = "shpt-tabs-close";
  closeBtn.innerHTML = "×";
  closeBtn.title = "Close";
  closeBtn.addEventListener("click", closeSummarySidebar);
  tabs.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "shpt-sidebar-body";

  // Show cached content for current tab, or loading if still streaming
  if (tabContents[currentTab]) {
    body.innerHTML = renderMarkdown(tabContents[currentTab]);
  } else if (tabStreaming[currentTab]) {
    body.innerHTML = `<div class="shpt-loading"><div class="shpt-spinner"></div><span>Analyzing...</span></div>`;
  } else {
    body.innerHTML = `<div class="shpt-loading"><div class="shpt-spinner"></div><span>Loading...</span></div>`;
  }

  // Footer with cost tracking
  const footer = document.createElement("div");
  footer.className = "shpt-sidebar-footer";
  footer.innerHTML = `<span>This call: <span class="shpt-cost-value" data-cost-this>-</span></span><span>Total: <span class="shpt-cost-value" data-cost-total>-</span></span>`;
  sidebar.appendChild(tabs);
  sidebar.appendChild(body);
  sidebar.appendChild(footer);
  document.body.appendChild(sidebar);

  // Load cost stats
  loadCostStats();

  // Trigger slide-in animation
  requestAnimationFrame(() => {
    sidebar.classList.add("shpt-sidebar-open");
  });

  // Close on Escape key
  document.addEventListener("keydown", handleEscapeKey);
  sidebarCollapsed = false;

  return true;
}

function handleEscapeKey(e) {
  if (e.key === "Escape") collapseSummarySidebar(); // Collapse instead of close
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// --- Simple markdown renderer ---
function renderMarkdown(text) {
  // Escape HTML first
  let html = escapeHtml(text);

  // Highlight "Requires Response: Yes/No/Maybe" line
  html = html.replace(
    /\*\*Requires Response:\*\*\s*(Yes|No|Maybe)/gi,
    (match, value) => {
      const lower = value.toLowerCase();
      const cls = lower === 'yes' ? 'shpt-response-yes' :
                  lower === 'no' ? 'shpt-response-no' : 'shpt-response-maybe';
      return `<strong>Requires Response:</strong> <span class="${cls}">${value}</span>`;
    }
  );

  // Code blocks (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Inline code (`...`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // IMPORTANT: Process lists BEFORE bold/italic to avoid conflicts with * at line start
  // Handle nested lists: lines starting with 2+ spaces then * or - are sub-items
  // Mark indented items with a special class
  html = html.replace(/^  +[\*\-] (.+)$/gm, '<li class="shpt-subitem">$1</li>');
  // Then handle top-level list items
  html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> elements in <ul>, handling nested structure
  // First wrap sub-items in nested <ul>
  html = html.replace(/(<li>[\s\S]*?)(<li class="shpt-subitem">[\s\S]*?<\/li>)+/g, (match, mainItem) => {
    // Extract sub-items
    const subItemMatches = match.match(/<li class="shpt-subitem">[\s\S]*?<\/li>/g) || [];
    const subItems = subItemMatches.join('').replace(/ class="shpt-subitem"/g, '');
    // Get the main item without sub-items
    const mainOnly = mainItem.replace(/<li class="shpt-subitem">[\s\S]*?<\/li>/g, '');
    if (subItems) {
      // Insert nested <ul> before </li> of main item
      return mainOnly.replace(/<\/li>$/, '') + '<ul>' + subItems + '</ul></li>';
    }
    return match;
  });

  // Clean up any remaining shpt-subitem classes
  html = html.replace(/ class="shpt-subitem"/g, '');

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\n?<li>[\s\S]*?<\/li>)*/g, (match) => {
    return '<ul>' + match.replace(/\n/g, '') + '</ul>';
  });

  // Bold and italic (process bold first to avoid conflicts)
  // Only match * that are NOT at start of line (those are list items)
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: * not at line start, not part of ** or ***, and with content between
  html = html.replace(/(?<!^)(?<!\*)(?<!\n)\*([^*\n]+)\*(?!\*)/gm, '<em>$1</em>');

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs and fix nesting
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[123]>)/g, '$1');
  html = html.replace(/(<\/h[123]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');

  // Clean up stray newlines
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/<br><br>/g, '</p><p>');
  html = html.replace(/<ul><br>/g, '<ul>');
  html = html.replace(/<br><\/ul>/g, '</ul>');

  return html;
}

// --- Start streaming summary for a specific tab ---
function startStreamingSummary(emailContent, tabId) {
  const tab = SUMMARY_TABS.find(t => t.id === tabId);
  if (!tab) return;

  // Mark this tab as streaming
  tabStreaming[tabId] = true;

  // Update tab button to show loading state
  const tabBtn = document.querySelector(`.shpt-tab[data-tab-id="${tabId}"]`);
  if (tabBtn) {
    tabBtn.textContent = tab.label + "...";
  }

  try {
    const port = chrome.runtime.connect({ name: "summarize-stream" });
    let fullText = "";
    let updatePending = false;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 100; // Minimum ms between DOM updates

    // Throttled update function for smoother rendering
    function scheduleUpdate() {
      if (updatePending) return;

      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime;

      if (timeSinceLastUpdate >= UPDATE_INTERVAL) {
        // Update immediately
        lastUpdateTime = now;
        if (tabId === currentTab) {
          updateTabContent(tabId, fullText, true);
        }
      } else {
        // Schedule update for later
        updatePending = true;
        setTimeout(() => {
          updatePending = false;
          lastUpdateTime = Date.now();
          if (tabId === currentTab) {
            updateTabContent(tabId, fullText, true);
          }
        }, UPDATE_INTERVAL - timeSinceLastUpdate);
      }
    }

    port.onMessage.addListener((msg) => {
      if (msg.type === "chunk") {
        fullText += msg.text;
        tabPartialContent[tabId] = fullText; // Store for tab switching
        // Use throttled update for smoother rendering
        scheduleUpdate();
      } else if (msg.type === "done") {
        // Mark streaming complete
        tabStreaming[tabId] = false;
        delete tabPartialContent[tabId]; // Clean up partial tracking

        // Cache the result
        tabContents[tabId] = fullText;

        // Save to persistent storage when all tabs are done
        const allDone = SUMMARY_TABS.every(t => !tabStreaming[t.id] && tabContents[t.id]);
        if (allDone && currentEmailContent) {
          saveSummaryToStorage(currentEmailContent, tabContents);
        }

        // Update tab button to remove loading indicator
        const tabBtnDone = document.querySelector(`.shpt-tab[data-tab-id="${tabId}"]`);
        if (tabBtnDone) {
          tabBtnDone.textContent = tab.label;
        }

        // Just clean up streaming artifacts - don't re-render
        // The throttled updates already rendered all content
        if (tabId === currentTab) {
          finalizeStreamingContent(tabId);
        } else {
          delete streamingState[tabId];
        }

        // Update cost display
        if (msg.usage) {
          updateCostDisplay(msg.usage.cost, msg.usage.totalCost);
        }

        // Re-enable tabs
        document.querySelectorAll(".shpt-tab").forEach(tabEl => {
          tabEl.disabled = false;
        });

        // Re-enable summarize button
        const btn = document.querySelector(".shpt-summarize-btn");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Summarize";
        }
      } else if (msg.type === "error") {
        // Mark streaming complete
        tabStreaming[tabId] = false;

        // Update tab button to remove loading indicator
        const tabBtnErr = document.querySelector(`.shpt-tab[data-tab-id="${tabId}"]`);
        if (tabBtnErr) {
          tabBtnErr.textContent = tab.label;
        }

        // Only show error if this is the active tab
        if (tabId === currentTab) {
          const body = document.querySelector(".shpt-sidebar-body");
          if (body) {
            body.innerHTML = `<div class="shpt-sidebar-error">${escapeHtml(msg.error)}</div>`;
          }
        }

        // Re-enable summarize button
        const btn = document.querySelector(".shpt-summarize-btn");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Summarize";
        }
      }
    });

    port.onDisconnect.addListener(() => {
      // Mark streaming complete
      tabStreaming[tabId] = false;

      if (chrome.runtime.lastError && tabId === currentTab) {
        const body = document.querySelector(".shpt-sidebar-body");
        if (body) {
          body.innerHTML = `<div class="shpt-sidebar-error">Connection error: ${escapeHtml(chrome.runtime.lastError.message)}</div>`;
        }
      }

      // Update tab button
      const tabBtnDisc = document.querySelector(`.shpt-tab[data-tab-id="${tabId}"]`);
      if (tabBtnDisc) {
        tabBtnDisc.textContent = tab.label;
      }

      // Re-enable summarize button
      const btn = document.querySelector(".shpt-summarize-btn");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Summarize";
      }
    });

    port.postMessage({
      action: "summarizeEmailStreaming",
      body: emailContent,
      promptType: tab.promptType
    });
  } catch (err) {
    const body = document.querySelector(".shpt-sidebar-body");
    if (body) {
      body.innerHTML = `<div class="shpt-sidebar-error">Extension error: ${escapeHtml(err.message)}</div>`;
    }
  }
}

// --- Summarize handler with streaming ---
async function handleSummarizeClick(btn) {
  // Check if we can restore a collapsed sidebar
  if (sidebarCollapsed && currentEmailContent) {
    if (restoreSummarySidebar()) {
      return; // Successfully restored
    }
  }

  const content = extractEmailBodyText();
  if (!content) {
    showSummarySidebar("Could not find email content to summarize.", true);
    return;
  }

  // Check for cached summary in persistent storage
  const cachedSummaries = await loadSummaryFromStorage(content);
  if (cachedSummaries) {
    // Restore from cache
    currentEmailContent = content;
    tabContents = cachedSummaries;
    tabStreaming = {};
    currentTab = "tldr";
    sidebarCollapsed = false;

    // Show sidebar with cached content
    showSummarySidebar(tabContents[currentTab] || "", false);
    return;
  }

  // Reset state for new summarization
  currentEmailContent = content;
  tabContents = {};
  tabStreaming = {};
  tabPartialContent = {};
  streamingState = {};
  currentTab = "tldr"; // Default to TL;DR tab
  sidebarCollapsed = false;

  btn.disabled = true;
  btn.textContent = "...";
  showLoadingSidebar();

  // Start streaming for ALL tabs in parallel
  for (const tab of SUMMARY_TABS) {
    startStreamingSummary(content, tab.id);
  }
}

// --- Button injection ---
function injectButtons() {
  // Find anchor point near email header (subject line or similar)
  const anchorSelectors = [
    ".ThreadPane-subject.isSelectable",
    '[class*="ThreadPane-subject"]',
    '[class*="MessageHeader"]',
    '[class*="EmailHeader"]',
  ];

  let anchor = null;
  for (const selector of anchorSelectors) {
    anchor = document.querySelector(selector);
    if (anchor) break;
  }

  if (!anchor) {
    return; // No suitable anchor found
  }

  // Inject Summarize button if not present (inserted first so it appears second)
  if (!document.querySelector(".shpt-summarize-btn")) {
    const summarizeBtn = document.createElement("button");
    summarizeBtn.className = "shpt-summarize-btn";
    summarizeBtn.textContent = "Summarize";
    summarizeBtn.type = "button";
    // Prevent Superhuman's tooltip from appearing on hover
    summarizeBtn.addEventListener("mouseenter", (e) => e.stopPropagation(), true);
    summarizeBtn.addEventListener("mouseover", (e) => e.stopPropagation(), true);
    summarizeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleSummarizeClick(summarizeBtn);
    });
    // Insert before the subject anchor (on the left)
    anchor.parentNode.insertBefore(summarizeBtn, anchor);
  }

  // Inject Copy button if not present (inserted second so it appears first/leftmost)
  if (!document.querySelector(".shpt-copy-btn")) {
    const copyBtn = document.createElement("button");
    copyBtn.className = "shpt-copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.type = "button";
    // Prevent Superhuman's tooltip from appearing on hover
    copyBtn.addEventListener("mouseenter", (e) => e.stopPropagation(), true);
    copyBtn.addEventListener("mouseover", (e) => e.stopPropagation(), true);
    copyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleCopyClick(copyBtn);
    });
    // Insert before the summarize button (so Copy is leftmost)
    const summarizeBtn = document.querySelector(".shpt-summarize-btn");
    if (summarizeBtn) {
      anchor.parentNode.insertBefore(copyBtn, summarizeBtn);
    } else {
      anchor.parentNode.insertBefore(copyBtn, anchor);
    }
  }
}

// Keep old function name for backwards compatibility
function injectCopyButton() {
  injectButtons();
}

// --- MutationObserver to detect email view changes ---
let copyBtnObserverTimeout = null;

const copyBtnObserver = new MutationObserver(() => {
  // Debounce to avoid excessive calls
  if (copyBtnObserverTimeout) {
    clearTimeout(copyBtnObserverTimeout);
  }
  copyBtnObserverTimeout = setTimeout(() => {
    injectCopyButton();
  }, 100);
});

// Start observing once DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    copyBtnObserver.observe(document.body, { childList: true, subtree: true });
    injectCopyButton();
  });
} else {
  copyBtnObserver.observe(document.body, { childList: true, subtree: true });
  injectCopyButton();
}
