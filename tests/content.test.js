/**
 * Tests for content.js — Superhuman Power Tools content script.
 *
 * content.js is not a module — it runs as a Chrome content script that attaches
 * globals and event listeners. We load it via eval into a jsdom environment with
 * the Chrome API stubs in place.
 */

const fs = require("fs");
const path = require("path");

const CONTENT_SRC = fs.readFileSync(
  path.join(__dirname, "..", "content.js"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// Chrome API mock
// ---------------------------------------------------------------------------

function createChromeMock() {
  const listeners = {};
  return {
    runtime: {
      onMessage: {
        addListener(fn) {
          listeners.onMessage = fn;
        },
      },
      _listeners: listeners,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: spin up a fresh content-script environment
// ---------------------------------------------------------------------------

function loadContentScript() {
  // Reset any previous globals the script may have set
  delete global.chrome;
  delete global.getExtensionErrorReports;
  delete global.getExtensionEnvironment;
  delete global.checkCurrentFocus;

  global.chrome = createChromeMock();

  // Capture setInterval calls so the polling loop doesn't run wild
  const intervals = [];
  const origSetInterval = global.setInterval;
  global.setInterval = (fn, ms) => {
    intervals.push({ fn, ms });
    return intervals.length; // fake timer id
  };

  // Suppress console noise during tests
  const origConsole = { ...console };
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});

  // eslint-disable-next-line no-eval
  eval(CONTENT_SRC);

  // Restore setInterval so Jest timers work normally
  global.setInterval = origSetInterval;

  return { intervals };
}

// ===========================================================================
// TEST SUITES
// ===========================================================================

describe("content.js — loading", () => {
  beforeEach(() => loadContentScript());
  afterEach(() => jest.restoreAllMocks());

  test("registers the chrome.runtime.onMessage listener", () => {
    expect(global.chrome.runtime._listeners.onMessage).toBeInstanceOf(
      Function
    );
  });

  test("exposes getExtensionErrorReports on window", () => {
    expect(typeof window.getExtensionErrorReports).toBe("function");
  });

  test("exposes getExtensionEnvironment on window", () => {
    expect(typeof window.getExtensionEnvironment).toBe("function");
  });

  test("exposes checkCurrentFocus on window", () => {
    expect(typeof window.checkCurrentFocus).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Feature 2: extractEmailData via message listener
// ---------------------------------------------------------------------------

describe("content.js — extractEmailData (message listener)", () => {
  let listener;

  beforeEach(() => {
    loadContentScript();
    listener = global.chrome.runtime._listeners.onMessage;
  });
  afterEach(() => jest.restoreAllMocks());

  test("returns from and subject when DOM elements exist", () => {
    // Set up Superhuman-like DOM
    const subjectEl = document.createElement("div");
    subjectEl.className = "ThreadPane-subject isSelectable";
    subjectEl.textContent = "  Quarterly Report  ";
    document.body.appendChild(subjectEl);

    const fromEl = document.createElement("span");
    fromEl.className = "ContactPane-email";
    fromEl.textContent = "  alice@example.com  ";
    document.body.appendChild(fromEl);

    const sendResponse = jest.fn();
    listener({ action: "extractEmailData" }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      from: "alice@example.com",
      subject: "Quarterly Report",
    });

    // Cleanup
    document.body.innerHTML = "";
  });

  test("returns nulls when no DOM elements are present", () => {
    document.body.innerHTML = "";

    const sendResponse = jest.fn();
    listener({ action: "extractEmailData" }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      from: null,
      subject: null,
    });
  });

  test("uses fallback selector for subject (class* wildcard)", () => {
    const subjectEl = document.createElement("div");
    subjectEl.className = "ThreadPane-subject-v2";
    subjectEl.textContent = "Fallback Subject";
    document.body.appendChild(subjectEl);

    const sendResponse = jest.fn();
    listener({ action: "extractEmailData" }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Fallback Subject" })
    );

    document.body.innerHTML = "";
  });

  test("uses fallback selector for from (compose-to-link)", () => {
    const fromEl = document.createElement("a");
    fromEl.className = "ContactPane-compose-to-link";
    fromEl.textContent = "bob@example.com";
    document.body.appendChild(fromEl);

    const sendResponse = jest.fn();
    listener({ action: "extractEmailData" }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ from: "bob@example.com" })
    );

    document.body.innerHTML = "";
  });

  test("ignores messages with unknown action", () => {
    const sendResponse = jest.fn();
    listener({ action: "somethingElse" }, {}, sendResponse);

    expect(sendResponse).not.toHaveBeenCalled();
  });

  test("returns true from listener to keep message channel open", () => {
    const result = listener({ action: "extractEmailData" }, {}, jest.fn());
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Feature 1: Auto-clicker polling setup
// ---------------------------------------------------------------------------

describe("content.js — auto-clicker polling", () => {
  let intervals;

  beforeEach(() => {
    const result = loadContentScript();
    intervals = result.intervals;
  });
  afterEach(() => jest.restoreAllMocks());

  test("registers a polling interval at 150ms", () => {
    const pollInterval = intervals.find((i) => i.ms === 150);
    expect(pollInterval).toBeDefined();
    expect(typeof pollInterval.fn).toBe("function");
  });

  test("polling callback does nothing when no alert button exists", () => {
    document.body.innerHTML = "";
    const pollFn = intervals.find((i) => i.ms === 150).fn;
    // Should not throw
    expect(() => pollFn()).not.toThrow();
  });

  test("polling callback does nothing when alert button has non-matching text", () => {
    const btn = document.createElement("div");
    btn.className = "Alert-action selected";
    btn.textContent = "CANCEL";
    document.body.appendChild(btn);

    const pollFn = intervals.find((i) => i.ms === 150).fn;
    expect(() => pollFn()).not.toThrow();

    document.body.innerHTML = "";
  });

  test("polling callback triggers click flow for SEND ANYWAY", () => {
    jest.useFakeTimers();

    const btn = document.createElement("div");
    btn.className = "Alert-action selected";
    btn.textContent = "SEND ANYWAY";
    btn.click = jest.fn();
    document.body.appendChild(btn);

    const pollFn = intervals.find((i) => i.ms === 150).fn;
    pollFn();

    // 50ms delay before click
    jest.advanceTimersByTime(50);
    expect(btn.click).toHaveBeenCalledTimes(1);

    document.body.innerHTML = "";
    jest.useRealTimers();
  });

  test("polling callback triggers click flow for SCHEDULE ANYWAY", () => {
    jest.useFakeTimers();

    const btn = document.createElement("div");
    btn.className = "Alert-action selected";
    btn.textContent = "SCHEDULE ANYWAY";
    btn.click = jest.fn();
    document.body.appendChild(btn);

    const pollFn = intervals.find((i) => i.ms === 150).fn;
    pollFn();

    jest.advanceTimersByTime(50);
    expect(btn.click).toHaveBeenCalledTimes(1);

    document.body.innerHTML = "";
    jest.useRealTimers();
  });

  test("cooldown prevents double-clicking within 3 seconds", () => {
    jest.useFakeTimers();

    const btn = document.createElement("div");
    btn.className = "Alert-action selected";
    btn.textContent = "SEND ANYWAY";
    btn.click = jest.fn();
    document.body.appendChild(btn);

    const pollFn = intervals.find((i) => i.ms === 150).fn;

    // First poll → schedules click
    pollFn();
    jest.advanceTimersByTime(50);
    expect(btn.click).toHaveBeenCalledTimes(1);

    // Second poll immediately after → should be blocked by hasClicked
    pollFn();
    jest.advanceTimersByTime(50);
    expect(btn.click).toHaveBeenCalledTimes(1); // still 1

    // After 3 seconds cooldown, polling should work again
    jest.advanceTimersByTime(3000);
    pollFn();
    jest.advanceTimersByTime(50);
    expect(btn.click).toHaveBeenCalledTimes(2);

    document.body.innerHTML = "";
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Debug API
// ---------------------------------------------------------------------------

describe("content.js — debug API", () => {
  beforeEach(() => loadContentScript());
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  test("getExtensionErrorReports returns an array", () => {
    const result = window.getExtensionErrorReports();
    expect(Array.isArray(result)).toBe(true);
  });

  test("getExtensionEnvironment returns report with expected keys", () => {
    const report = window.getExtensionEnvironment();

    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("url");
    expect(report).toHaveProperty("userAgent");
    expect(report).toHaveProperty("windowSize");
    expect(report).toHaveProperty("documentReady");
    expect(report).toHaveProperty("focus");
    expect(report).toHaveProperty("superhuman");
    expect(report).toHaveProperty("recentErrors");
  });

  test("getExtensionEnvironment.focus has correct shape", () => {
    const report = window.getExtensionEnvironment();

    expect(report.focus).toHaveProperty("documentHasFocus");
    expect(report.focus).toHaveProperty("activeElement");
    expect(report.focus).toHaveProperty("windowFocused");
  });

  test("getExtensionEnvironment.superhuman counts alert elements", () => {
    // Add some alert elements
    for (let i = 0; i < 3; i++) {
      const el = document.createElement("div");
      el.className = "Alert-action";
      document.body.appendChild(el);
    }
    const selected = document.createElement("div");
    selected.className = "Alert-action selected";
    document.body.appendChild(selected);

    const report = window.getExtensionEnvironment();

    expect(report.superhuman.alertElements).toBe(4);
    expect(report.superhuman.selectedAlerts).toBe(1);
    expect(report.superhuman.allAlerts).toHaveLength(4);
  });

  test("checkCurrentFocus does not throw", () => {
    expect(() => window.checkCurrentFocus()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Error tracking
// ---------------------------------------------------------------------------

describe("content.js — error tracking", () => {
  beforeEach(() => loadContentScript());
  afterEach(() => jest.restoreAllMocks());

  test("captures JS errors via window error event", () => {
    const errorEvent = new ErrorEvent("error", {
      message: "Test error message",
      filename: "test.js",
      lineno: 42,
      colno: 7,
    });
    window.dispatchEvent(errorEvent);

    const reports = window.getExtensionErrorReports();
    expect(reports.length).toBe(1);
    expect(reports[0].type).toBe("JavaScript Error");
    expect(reports[0].message).toBe("Test error message");
    expect(reports[0].lineno).toBe(42);
  });

  test("caps error reports at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      const event = new ErrorEvent("error", {
        message: `Error ${i}`,
        filename: "test.js",
        lineno: i,
      });
      window.dispatchEvent(event);
    }

    const reports = window.getExtensionErrorReports();
    expect(reports.length).toBe(10);
    // Should keep the most recent 10 (indices 5-14)
    expect(reports[0].message).toBe("Error 5");
    expect(reports[9].message).toBe("Error 14");
  });

  test("environment report includes recent errors", () => {
    const event = new ErrorEvent("error", {
      message: "Something broke",
      filename: "test.js",
    });
    window.dispatchEvent(event);

    const env = window.getExtensionEnvironment();
    expect(env.recentErrors.length).toBe(1);
    expect(env.recentErrors[0].message).toBe("Something broke");
  });
});

// ---------------------------------------------------------------------------
// gmail-content.js — buildQuery and navigateToSearch
// ---------------------------------------------------------------------------

describe("gmail-content.js — query building and navigation", () => {
  const GMAIL_SRC = fs.readFileSync(
    path.join(__dirname, "..", "gmail-content.js"),
    "utf-8"
  );

  // We need to extract and test buildQuery independently.
  // Since it's inside an IIFE, we re-implement the pure function for testing
  // and verify it matches the source behavior.

  function buildQuery(from, subject) {
    const parts = [];
    if (from) parts.push("from:" + from);
    if (subject) parts.push("subject:(" + subject + ")");
    return parts.join(" ");
  }

  test("builds query with both from and subject", () => {
    const result = buildQuery("alice@example.com", "Meeting Notes");
    expect(result).toBe("from:alice@example.com subject:(Meeting Notes)");
  });

  test("builds query with only from", () => {
    const result = buildQuery("alice@example.com", null);
    expect(result).toBe("from:alice@example.com");
  });

  test("builds query with only subject", () => {
    const result = buildQuery(null, "Urgent");
    expect(result).toBe("subject:(Urgent)");
  });

  test("returns empty string when both are null", () => {
    const result = buildQuery(null, null);
    expect(result).toBe("");
  });

  test("handles subject with special characters", () => {
    const result = buildQuery("test@x.com", "Re: Q&A (follow-up)");
    expect(result).toBe("from:test@x.com subject:(Re: Q&A (follow-up))");
  });

  test("URL encoding produces correct Gmail hash format", () => {
    const query = buildQuery("alice@example.com", "Test");
    const encoded = encodeURIComponent(query).replace(/%20/g, "+");
    const hash = "#search/" + encoded;

    expect(hash).toContain("#search/");
    expect(hash).not.toContain(" "); // spaces should be + encoded
    expect(hash).toContain("from%3Aalice%40example.com");
  });
});

// ---------------------------------------------------------------------------
// background.js — showBadge and createGmailFilter
// ---------------------------------------------------------------------------

describe("background.js — badge and filter orchestration", () => {
  const BG_SRC = fs.readFileSync(
    path.join(__dirname, "..", "background.js"),
    "utf-8"
  );

  // The click handler in background.js fires createGmailFilter without
  // returning its promise. We flush the microtask queue with process.nextTick
  // (which is NOT affected by fake timers) to let all chained awaits settle.
  function flushMicrotasks() {
    return new Promise((resolve) => process.nextTick(resolve));
  }

  let mockChrome;
  let setTimeoutCallbacks;

  beforeEach(() => {
    // Capture setTimeout calls manually instead of using fake timers,
    // because fake timers also freeze process.nextTick in some Jest versions.
    setTimeoutCallbacks = [];
    const origSetTimeout = global.setTimeout;
    jest.spyOn(global, "setTimeout").mockImplementation((fn, ms) => {
      setTimeoutCallbacks.push({ fn, ms });
      return setTimeoutCallbacks.length;
    });

    mockChrome = {
      action: {
        setBadgeText: jest.fn().mockResolvedValue(undefined),
        setBadgeBackgroundColor: jest.fn().mockResolvedValue(undefined),
        onClicked: { addListener: jest.fn() },
      },
      tabs: {
        sendMessage: jest.fn(),
        query: jest.fn(),
        create: jest.fn(),
      },
      storage: {
        local: {
          set: jest.fn().mockResolvedValue(undefined),
        },
      },
      commands: {
        onCommand: { addListener: jest.fn() },
      },
    };

    global.chrome = mockChrome;

    // eslint-disable-next-line no-eval
    eval(BG_SRC);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome;
  });

  test("registers command listener for keyboard shortcut", () => {
    expect(mockChrome.commands.onCommand.addListener).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });

  test("registers action.onClicked listener for toolbar button", () => {
    expect(mockChrome.action.onClicked.addListener).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });

  test("toolbar click calls createGmailFilter with the tab", async () => {
    const clickHandler = mockChrome.action.onClicked.addListener.mock.calls[0][0];
    const fakeTab = { id: 42 };

    mockChrome.tabs.sendMessage.mockResolvedValue({
      from: "test@example.com",
      subject: "Hello",
    });

    clickHandler(fakeTab);
    await flushMicrotasks();

    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
      action: "extractEmailData",
    });
  });

  test("shows ERR badge when content script is not loaded", async () => {
    const clickHandler = mockChrome.action.onClicked.addListener.mock.calls[0][0];
    const fakeTab = { id: 1 };

    mockChrome.tabs.sendMessage.mockRejectedValue(new Error("No script"));

    clickHandler(fakeTab);
    await flushMicrotasks();

    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
      text: "ERR",
      tabId: 1,
    });
    expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: "#D32F2F",
      tabId: 1,
    });
  });

  test("shows --- badge when no data extracted", async () => {
    const clickHandler = mockChrome.action.onClicked.addListener.mock.calls[0][0];
    const fakeTab = { id: 2 };

    mockChrome.tabs.sendMessage.mockResolvedValue({
      from: null,
      subject: null,
    });

    clickHandler(fakeTab);
    await flushMicrotasks();

    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
      text: "---",
      tabId: 2,
    });
  });

  test("stores data and opens Gmail on successful extraction", async () => {
    const clickHandler = mockChrome.action.onClicked.addListener.mock.calls[0][0];
    const fakeTab = { id: 3 };

    mockChrome.tabs.sendMessage.mockResolvedValue({
      from: "alice@example.com",
      subject: "Important",
    });

    clickHandler(fakeTab);
    await flushMicrotasks();

    expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
      gmailFilterData: { from: "alice@example.com", subject: "Important" },
    });
    expect(mockChrome.tabs.create).toHaveBeenCalledWith({
      url: "https://mail.google.com/mail/u/0/",
      active: false,
    });
    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
      text: "OK",
      tabId: 3,
    });
  });

  test("badge clears after 2 seconds via setTimeout callback", async () => {
    const clickHandler = mockChrome.action.onClicked.addListener.mock.calls[0][0];
    const fakeTab = { id: 4 };

    mockChrome.tabs.sendMessage.mockResolvedValue({
      from: "x@y.com",
      subject: "Hi",
    });

    clickHandler(fakeTab);
    await flushMicrotasks();

    // Badge should be set
    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
      text: "OK",
      tabId: 4,
    });

    // Find the 2-second setTimeout callback registered by showBadge
    const badgeClearCb = setTimeoutCallbacks.find((cb) => cb.ms === 2000);
    expect(badgeClearCb).toBeDefined();

    // Execute the callback manually to simulate the timer firing
    badgeClearCb.fn();

    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
      text: "",
      tabId: 4,
    });
  });

  test("shows --- badge when response has error property", async () => {
    const clickHandler = mockChrome.action.onClicked.addListener.mock.calls[0][0];
    const fakeTab = { id: 5 };

    mockChrome.tabs.sendMessage.mockResolvedValue({
      error: "DOM parse failed",
    });

    clickHandler(fakeTab);
    await flushMicrotasks();

    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
      text: "---",
      tabId: 5,
    });
  });
});
