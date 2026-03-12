// Superhuman Power Tools — Content Script
// Runs on mail.superhuman.com
// Feature 1: Auto-clicks "SEND ANYWAY" / "SCHEDULE ANYWAY" popups
// Feature 2: Extracts email data for Gmail filter creation

console.log("Superhuman Power Tools loaded!");

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
