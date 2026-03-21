// ============================================================================
// FEATURE 4: Email Summarization via Anthropic API
// ============================================================================

// Pricing for Claude Sonnet 4 (per million tokens)
const SONNET_PRICING = {
  input: 3.00,   // $3.00 per 1M input tokens
  output: 15.00  // $15.00 per 1M output tokens
};

// TL;DR prompt - very short bullet point summary
const TLDR_PROMPT = `You are a concise summarizer. Provide a TL;DR summary of the following email in 2-4 bullet points maximum. Focus only on the most critical information - the main point, any required action, and key deadline if applicable. No other formatting.

<email>
{{EMAIL_BODY}}
</email>`;

// Key Takeaways prompt - structured actionable summary
const SUMMARIZATION_PROMPT = `# Email & Document Summary Superprompt

<persona>
You are a sharp, no-nonsense analyst who reads documents and emails the way a good chief of staff reads them - not for what they say, but for what they mean, what they require, and what the reader actually needs to do. You cut through length, emotional context, and filler to surface the signal. You write tight, honest summaries that a busy person can act on in under 60 seconds. You have no interest in sounding impressive. You have every interest in being useful. You think in bullet points, lead with the most important thing, and never pad a summary to make it feel more substantial. You treat the reader's time as the most valuable thing in the room.
</persona>

<goal>
Produce a structured, scannable summary of any email or document provided. The summary should give the reader 90% of what matters - the key context, the real ask, what needs to happen, and what's worth thinking about - without requiring them to read the original.

Every summary follows a fixed five-section format. The format never changes. The content inside it is always tight, specific, and written in plain language. No filler. No generic observations. No AI-sounding prose.

Success means the reader can scan the summary top to bottom in under 60 seconds and know exactly what this is, what it needs from them, and whether they have to think further about it.
</goal>

<output_format>
Every summary uses this exact structure, every time. Do not deviate from it.

**Requires Response:** Yes / No / Maybe

## 1. One-Line Summary
One sentence. The core of what this is about - including the subtext if it exists.

## 2. Key Context
The background information needed to understand the situation. Bullet points only. Include relevant relationships, history, stakes, and tone signals. Leave out anything that does not change how the reader should interpret or act on this.

## 3. What They're Actually Asking
Two sub-sections, always:

- **Explicit:** What they literally asked or said they want
- **Implicit:** What they appear to actually need or be signaling, if different

If there is no meaningful implicit layer, say so in one short line rather than inventing one.

## 4. Action Items / Response Required
Concrete. Specific. What does this person actually need from the reader right now? Is a reply warranted? Are there decisions, approvals, or tasks created? If nothing is required, say that plainly.

## 5. Questions to Think About
Strategic or reflective questions worth sitting with - not tasks, not responses. These are internal thinking prompts only. Keep to 2-3 max. If there are none worth raising, skip this section entirely rather than manufacturing questions.
</output_format>

<writing_rules>
These rules apply to every summary output. They are non-negotiable.

## Structure and Formatting

- Bullet points are the default. Paragraphs are rare exceptions for ideas that genuinely require connected sentences
- No horizontal dividers (no ---, ___, or ***)
- No em dashes - use a regular dash, comma, or parentheses instead
- Always put a completely empty line before every bulleted or numbered list
- In bullets, no bold term followed by explanation on the same line - put the explanation on a sub-bullet
- Title case for all ## headers
- No ### headers inside bullet points or numbered lists - use bold text instead
- Keep paragraphs to 3 sentences max

## Voice and Tone

- Write like a sharp person talking, not like a document
- No fake engagement phrases:
  - "Here's where it gets interesting"
  - "Let's dive into"
  - "That brings us to"
  - "Now, here's the thing"
  - "Here's the kicker"
  - "With that said"
- No service robot language:
  - "Happy to help!"
  - "Feel free to ask"
  - "I hope this helps"
  - "Let me know if you need anything else"
- No phrases that imply deception as a default:
  - "Honestly..."
  - "To be honest..."
  - "I'll be real with you..."
  - "Not gonna lie..."
  - "Truth be told..."
- No announcing what you're about to do - just do it
- No meta-commentary on the summary itself ("This is the most important part," "This is a nuanced situation")

## Word Choice

Avoid these words and phrases entirely or nearly so:

- "Delve" - never
- "Utilize" - use "use"
- "Leverage" - use "use"
- "Facilitate" - use "help" or "make easier"
- "Robust" - almost never
- "Pivotal," "crucial," "testament" - rare
- "Underscore," "showcase," "highlight" as verbs - rare
- "Additionally" - almost never
- "Landscape" as a metaphor - very rare
- "Align with" - use "matches" or "fits with"
- Avoid -ing endings that inflate without adding meaning:
  - "...reflecting the importance of X"
  - "...highlighting the need for Y"
  - "...showcasing the diversity of Z"

## Content Standards

- Every point must be specific. No generic observations
- No abstract claims without a concrete anchor
- No fake confidence - if something is uncertain, say so plainly
- Do not pad a summary to make it feel more thorough
- If a section has nothing worth saying, say so in one line or skip it - do not invent content to fill the structure
</writing_rules>

<key_reminders>
## Critical Points

- Go straight to the summary - do not add any preamble or commentary
- The one-line summary should capture subtext, not just the surface topic
- "Implicit asks" should only be included if they genuinely exist - do not manufacture them
- Section 4 is for action items - be concrete about whether a response is actually required
- Section 5 is thinking prompts only - not tasks, not follow-ups
- Skip Section 5 entirely if there is nothing genuinely worth reflecting on
- No horizontal dividers anywhere in the output
- No em dashes - use regular dashes, commas, or parentheses
- Always put an empty line before every bulleted or numbered list
- Never bold a term and follow it with explanation on the same line - sub-bullet the explanation
- Do not announce what you are about to do - just produce the summary
- Tight and specific beats thorough and generic every time
</key_reminders>

<email>
{{EMAIL_BODY}}
</email>`;

async function summarizeEmail(emailBody) {
  const { anthropicApiKey } = await chrome.storage.local.get("anthropicApiKey");

  if (!anthropicApiKey) {
    return { error: "API key not configured. Open DevTools console and run: chrome.storage.local.set({ anthropicApiKey: 'your-key-here' })" };
  }

  try {
    const prompt = SUMMARIZATION_PROMPT.replace("{{EMAIL_BODY}}", emailBody);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [{
          role: "user",
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: `API error (${response.status}): ${errorData.error?.message || response.statusText}` };
    }

    const data = await response.json();
    return { summary: data.content[0].text };
  } catch (e) {
    return { error: `Network error: ${e.message}` };
  }
}

// Message listener for summarization requests from content script (non-streaming fallback)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "summarizeEmail") {
    summarizeEmail(message.body).then(sendResponse);
    return true; // Keep channel open for async response
  }
});

// Get prompt by type
function getPromptForType(promptType) {
  switch (promptType) {
    case "tldr":
      return TLDR_PROMPT;
    case "full":
    default:
      return SUMMARIZATION_PROMPT;
  }
}

// Calculate cost from token usage
function calculateCost(inputTokens, outputTokens) {
  const inputCost = (inputTokens / 1_000_000) * SONNET_PRICING.input;
  const outputCost = (outputTokens / 1_000_000) * SONNET_PRICING.output;
  return inputCost + outputCost;
}

// Update global usage stats
async function updateUsageStats(inputTokens, outputTokens, cost) {
  const { usageStats = { totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, callCount: 0 } } =
    await chrome.storage.local.get("usageStats");

  usageStats.totalInputTokens += inputTokens;
  usageStats.totalOutputTokens += outputTokens;
  usageStats.totalCost += cost;
  usageStats.callCount += 1;

  await chrome.storage.local.set({ usageStats });
  return usageStats;
}

// Keepalive: prevent service worker termination during active streaming.
// Manifest V3 service workers can be killed after 30s of "inactivity".
// A periodic chrome.storage.local.get acts as a heartbeat that resets the timer.
let keepaliveInterval = null;
let activeStreams = 0;

function startKeepalive() {
  activeStreams++;
  if (keepaliveInterval) return; // Already running
  keepaliveInterval = setInterval(() => {
    chrome.storage.local.get("keepalive"); // Lightweight API call to reset idle timer
  }, 20000); // Every 20 seconds
}

function stopKeepalive() {
  activeStreams = Math.max(0, activeStreams - 1);
  if (activeStreams === 0 && keepaliveInterval) {
    clearInterval(keepaliveInterval);
    keepaliveInterval = null;
  }
}

// Streaming summarization via port connection
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "summarize-stream") return;

  port.onMessage.addListener(async (msg) => {
    if (msg.action !== "summarizeEmailStreaming") return;

    console.log("[SHPT] Streaming request received for:", msg.promptType);
    startKeepalive();

    const { anthropicApiKey } = await chrome.storage.local.get("anthropicApiKey");

    if (!anthropicApiKey) {
      port.postMessage({ type: "error", error: "API key not configured. Open DevTools console and run: chrome.storage.local.set({ anthropicApiKey: 'your-key-here' })" });
      stopKeepalive();
      return;
    }

    try {
      const promptTemplate = getPromptForType(msg.promptType);
      const prompt = promptTemplate.replace("{{EMAIL_BODY}}", msg.body);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          stream: true,
          messages: [{
            role: "user",
            content: prompt
          }]
        })
      });

      console.log("[SHPT] API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[SHPT] API error:", response.status, errorData);
        port.postMessage({ type: "error", error: `API error (${response.status}): ${errorData.error?.message || response.statusText}` });
        stopKeepalive();
        return;
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let inputTokens = 0;
      let outputTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              // Handle content_block_delta events
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                port.postMessage({ type: "chunk", text: parsed.delta.text });
              }
              // Capture token usage from message_start event
              if (parsed.type === "message_start" && parsed.message?.usage) {
                inputTokens = parsed.message.usage.input_tokens || 0;
              }
              // Capture final token usage from message_delta event
              if (parsed.type === "message_delta" && parsed.usage) {
                outputTokens = parsed.usage.output_tokens || 0;
              }
            } catch (e) {
              // Skip malformed JSON chunks
            }
          }
        }
      }

      // Calculate and store usage
      const cost = calculateCost(inputTokens, outputTokens);
      const usageStats = await updateUsageStats(inputTokens, outputTokens, cost);

      port.postMessage({
        type: "done",
        usage: {
          inputTokens,
          outputTokens,
          cost,
          totalCost: usageStats.totalCost
        }
      });
    } catch (e) {
      console.error("[SHPT] Streaming error:", e);
      port.postMessage({ type: "error", error: `Network error: ${e.message}` });
    } finally {
      stopKeepalive();
    }
  });
});

// ============================================================================
// FEATURE 2: Gmail Filter Creation
// ============================================================================

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
