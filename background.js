async function createGmailFilter(tab) {
  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, {
      action: "extractEmailData",
    });
  } catch (e) {
    // Content script not loaded — likely not on Superhuman or page not ready
    await showBadge("ERR", "#D32F2F", tab.id);
    return;
  }

  if (response.error || (!response.from && !response.subject)) {
    await showBadge("---", "#F57C00", tab.id);
    return;
  }

  // Store filter data for the Gmail content script to type into the search box
  await chrome.storage.local.set({
    gmailFilterData: { from: response.from, subject: response.subject },
  });

  chrome.tabs.create({ url: "https://mail.google.com/mail/u/0/", active: false });
  await showBadge("OK", "#388E3C", tab.id);
}

async function showBadge(text, color, tabId) {
  await chrome.action.setBadgeText({ text, tabId });
  await chrome.action.setBadgeBackgroundColor({ color, tabId });
  // Clear after 2 seconds
  setTimeout(() => chrome.action.setBadgeText({ text: "", tabId }), 2000);
}

// Keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "create-filter") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) createGmailFilter(tab);
  }
});

// Toolbar icon click
chrome.action.onClicked.addListener((tab) => {
  createGmailFilter(tab);
});
