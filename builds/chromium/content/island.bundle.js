(() => {
  // src/content/markdown.js
  function renderMarkdown(text) {
    if (!text) return "";
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang ? lang.trim() : "text";
      return `<div class="shifty-code-block">
      <div class="shifty-code-header">
        <span class="shifty-code-lang">${language}</span>
        <button class="shifty-copy-btn" data-code="${encodeURIComponent(code)}">\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C</button>
      </div>
      <pre><code>${code}</code></pre>
    </div>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code class="shifty-inline-code">$1</code>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="shifty-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="shifty-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="shifty-h1">$1</h1>');
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    html = html.replace(/^>(.*$)/gim, '<blockquote class="shifty-quote">$1</blockquote>');
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="shifty-li">$1</li>');
    html = html.replace(/(<li class="shifty-li">[\s\S]*?<\/li>)/g, '<ul class="shifty-ul">$1</ul>');
    html = html.replace(/<\/ul>\s*<ul class="shifty-ul">/g, "");
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, label, url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="shifty-link">${label} <svg class="shifty-ext-icon" viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3m-2 16H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7Z"/></svg></a>`;
    });
    html = html.replace(/(^|[^"=])(https?:\/\/[^\s<]+)/g, (match, prefix, url) => {
      return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer" class="shifty-link">${url}</a>`;
    });
    const paragraphs = html.split(/\n{2,}/);
    html = paragraphs.map((p) => {
      p = p.trim();
      if (!p) return "";
      if (p.startsWith("<h1") || p.startsWith("<h2") || p.startsWith("<h3") || p.startsWith("<div") || p.startsWith("<ul") || p.startsWith("<blockquote")) {
        return p;
      }
      return `<p class="shifty-p">${p.replace(/\n/g, "<br/>")}</p>`;
    }).join("");
    return html;
  }
  function extractLinks(text) {
    if (!text) return [];
    const links = [];
    const seen = /* @__PURE__ */ new Set();
    const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let match;
    while ((match = mdRegex.exec(text)) !== null) {
      const title = match[1].trim();
      const url = match[2].trim();
      if (!seen.has(url)) {
        seen.add(url);
        links.push({ title, url });
      }
    }
    const rawRegex = /(https?:\/\/[^\s<>)"]+)/g;
    while ((match = rawRegex.exec(text)) !== null) {
      const url = match[1].trim();
      if (!seen.has(url)) {
        seen.add(url);
        try {
          const parsed = new URL(url);
          links.push({ title: parsed.hostname + parsed.pathname, url });
        } catch {
          links.push({ title: url, url });
        }
      }
    }
    return links;
  }

  // src/api/ai-client.js
  var PROVIDERS = {
    openai: {
      id: "openai",
      name: "OpenAI (ChatGPT)",
      defaultModel: "gpt-4o-mini",
      models: ["gpt-4o-mini", "gpt-4o", "o3-mini", "gpt-3.5-turbo"],
      defaultUrl: "https://api.openai.com/v1/chat/completions",
      keyPlaceholder: "sk-...",
      keyHelpUrl: "https://platform.openai.com/api-keys"
    },
    gemini: {
      id: "gemini",
      name: "Google Gemini",
      defaultModel: "gemini-2.0-flash",
      models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
      defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      keyPlaceholder: "AIzaSy...",
      keyHelpUrl: "https://aistudio.google.com/app/apikey"
    },
    anthropic: {
      id: "anthropic",
      name: "Anthropic Claude",
      defaultModel: "claude-3-5-haiku-20241022",
      models: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
      defaultUrl: "https://api.anthropic.com/v1/messages",
      keyPlaceholder: "sk-ant-...",
      keyHelpUrl: "https://console.anthropic.com/settings/keys"
    },
    openrouter: {
      id: "openrouter",
      name: "OpenRouter (All Models + Perplexity)",
      defaultModel: "perplexity/sonar",
      models: [
        "perplexity/sonar",
        "deepseek/deepseek-chat",
        "deepseek/deepseek-r1",
        "meta-llama/llama-3.3-70b-instruct",
        "google/gemini-2.0-flash-exp:free",
        "openai/gpt-4o-mini"
      ],
      defaultUrl: "https://openrouter.ai/api/v1/chat/completions",
      keyPlaceholder: "sk-or-v1-...",
      keyHelpUrl: "https://openrouter.ai/keys"
    },
    groq: {
      id: "groq",
      name: "Groq (Ultra-fast)",
      defaultModel: "llama-3.3-70b-versatile",
      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
      defaultUrl: "https://api.groq.com/openai/v1/chat/completions",
      keyPlaceholder: "gsk_...",
      keyHelpUrl: "https://console.groq.com/keys"
    },
    deepseek: {
      id: "deepseek",
      name: "DeepSeek",
      defaultModel: "deepseek-chat",
      models: ["deepseek-chat", "deepseek-reasoner"],
      defaultUrl: "https://api.deepseek.com/chat/completions",
      keyPlaceholder: "sk-...",
      keyHelpUrl: "https://platform.deepseek.com/api_keys"
    },
    custom: {
      id: "custom",
      name: "Custom (Ollama / Local / Proxy)",
      defaultModel: "llama3.2",
      models: ["llama3.2", "mistral", "qwen2.5"],
      defaultUrl: "http://localhost:11434/v1/chat/completions",
      keyPlaceholder: "Optional key (or ollama)",
      keyHelpUrl: ""
    }
  };
  var DEFAULT_SYSTEM_PROMPT = `\u0422\u044B \u2014 \u043F\u043E\u043B\u0435\u0437\u043D\u044B\u0439, \u0443\u043C\u043D\u044B\u0439 \u0438 \u0431\u044B\u0441\u0442\u0440\u044B\u0439 AI-\u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043D\u0442 ShiftySearch, \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0439 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440.
\u041E\u0442\u0432\u0435\u0447\u0430\u0439 \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E, \u0442\u043E\u0447\u043D\u043E \u0438 \u043A\u0440\u0430\u0441\u0438\u0432\u043E, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044F Markdown.
\u0415\u0441\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0437\u0430\u0434\u0430\u0435\u0442 \u0432\u043E\u043F\u0440\u043E\u0441 \u043E \u043F\u043E\u0438\u0441\u043A\u0435 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u0438, \u043A\u043E\u0434\u0435 \u0438\u043B\u0438 \u0444\u0430\u043A\u0442\u0430\u0445 \u2014 \u0434\u0430\u0439 \u0447\u0435\u0442\u043A\u0438\u0439 \u0438\u0441\u0447\u0435\u0440\u043F\u044B\u0432\u0430\u044E\u0449\u0438\u0439 \u043E\u0442\u0432\u0435\u0442.

\u0412 \u0421\u0410\u041C\u041E\u041C \u041A\u041E\u041D\u0426\u0415 \u043E\u0442\u0432\u0435\u0442\u0430 \u0412\u0421\u0415\u0413\u0414\u0410 \u0434\u043E\u0431\u0430\u0432\u044C \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0431\u043B\u043E\u043A:
### \u{1F517} \u041F\u043E\u043B\u0435\u0437\u043D\u044B\u0435 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u0438 \u0441\u0441\u044B\u043B\u043A\u0438
\u0412\u043A\u043B\u044E\u0447\u0438 \u043E\u0442 2 \u0434\u043E 5 \u0440\u0435\u043B\u0435\u0432\u0430\u043D\u0442\u043D\u044B\u0445 \u043A\u043B\u0438\u043A\u0430\u0431\u0435\u043B\u044C\u043D\u044B\u0445 \u0441\u0441\u044B\u043B\u043E\u043A \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435:
- [\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0441\u0430\u0439\u0442\u0430/\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430](https://\u043F\u0440\u044F\u043C\u043E\u0439-url) \u2014 \u043A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435
\u0415\u0441\u043B\u0438 \u0442\u043E\u0447\u043D\u043E\u0439 \u0441\u0441\u044B\u043B\u043A\u0438 \u043D\u0435\u0442, \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u0443\u0439 \u043F\u043E\u0438\u0441\u043A\u043E\u0432\u0443\u044E \u0441\u0441\u044B\u043B\u043A\u0443:
- [\u041F\u043E\u0438\u0441\u043A \u0432 Google](https://www.google.com/search?q=...) \u2014 \u043F\u043E\u0438\u0441\u043A\u043E\u0432\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441`;
  async function sendAiRequest({
    provider = "openai",
    apiKey = "",
    model = "",
    baseUrl = "",
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    messages = [],
    onChunk = () => {
    },
    onDone = () => {
    },
    onError = () => {
    },
    signal = null
  }) {
    const providerConfig = PROVIDERS[provider] || PROVIDERS.openai;
    const endpoint = baseUrl && baseUrl.trim().length > 0 ? baseUrl.trim() : providerConfig.defaultUrl;
    const activeModel = model && model.trim().length > 0 ? model.trim() : providerConfig.defaultModel;
    if (!apiKey && provider !== "custom") {
      const err = new Error(`\u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0443\u043A\u0430\u0436\u0438\u0442\u0435 API-\u043A\u043B\u044E\u0447 \u0434\u043B\u044F ${providerConfig.name} \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 ShiftySearch.`);
      onError(err);
      return;
    }
    try {
      if (provider === "anthropic") {
        await callAnthropicStream({
          endpoint,
          apiKey,
          model: activeModel,
          systemPrompt,
          messages,
          onChunk,
          onDone,
          onError,
          signal
        });
      } else {
        await callOpenAiCompatibleStream({
          endpoint,
          apiKey,
          model: activeModel,
          systemPrompt,
          messages,
          provider,
          onChunk,
          onDone,
          onError,
          signal
        });
      }
    } catch (err) {
      if (err.name === "AbortError") {
        onDone();
        return;
      }
      onError(err);
    }
  }
  async function callOpenAiCompatibleStream({
    endpoint,
    apiKey,
    model,
    systemPrompt,
    messages,
    provider,
    onChunk,
    onDone,
    onError,
    signal
  }) {
    const headers = {
      "Content-Type": "application/json"
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey.trim()}`;
    }
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = "https://github.com/HantaTy201-lgtm/ShiftySearch";
      headers["X-Title"] = "ShiftySearch Browser Extension";
    }
    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model,
        messages: fullMessages,
        stream: true,
        temperature: 0.7
      })
    });
    if (!response.ok) {
      let errorDetail = "";
      try {
        const errJson = await response.json();
        errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
      } catch {
        errorDetail = await response.text();
      }
      throw new Error(`\u041E\u0448\u0438\u0431\u043A\u0430 API (${response.status}): ${errorDetail || response.statusText}`);
    }
    if (!response.body) {
      throw new Error("\u041E\u0442\u0432\u0435\u0442 \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 (Body is empty)");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullText = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;
        if (trimmed === "data: [DONE]") {
          onDone(fullText);
          return;
        }
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              fullText += delta;
              onChunk(delta, fullText);
            }
          } catch {
          }
        }
      }
    }
    onDone(fullText);
  }
  async function callAnthropicStream({
    endpoint,
    apiKey,
    model,
    systemPrompt,
    messages,
    onChunk,
    onDone,
    onError,
    signal
  }) {
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey.trim(),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    };
    const anthropicMessages = messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content
    }));
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: anthropicMessages,
        max_tokens: 4096,
        stream: true
      })
    });
    if (!response.ok) {
      let errorDetail = "";
      try {
        const errJson = await response.json();
        errorDetail = errJson.error?.message || JSON.stringify(errJson);
      } catch {
        errorDetail = await response.text();
      }
      throw new Error(`\u041E\u0448\u0438\u0431\u043A\u0430 Claude API (${response.status}): ${errorDetail || response.statusText}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullText = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6);
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            const delta = event.delta.text || "";
            fullText += delta;
            onChunk(delta, fullText);
          } else if (event.type === "message_stop") {
            onDone(fullText);
            return;
          }
        } catch {
        }
      }
    }
    onDone(fullText);
  }

  // src/content/island.css
  var island_default = `/* src/content/island.css - Minimalist & Customizable Theme for ShiftySearch */

:host {
  all: initial;
  position: fixed;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 13.5px;
  line-height: 1.5;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* =========================================
   THEME VARIABLES
   ========================================= */

/* Dark Theme (Default Minimalist Dark) */
.shifty-island.theme-dark {
  --shifty-bg: rgba(18, 18, 20, 0.94);
  --shifty-header-bg: rgba(26, 26, 30, 0.7);
  --shifty-border: rgba(255, 255, 255, 0.1);
  --shifty-text: #f4f4f5;
  --shifty-text-muted: #a1a1aa;
  --shifty-card-bg: rgba(255, 255, 255, 0.04);
  --shifty-card-border: rgba(255, 255, 255, 0.07);
  --shifty-input-bg: rgba(28, 28, 32, 0.85);
  --shifty-input-border: rgba(255, 255, 255, 0.12);
  --shifty-code-bg: #0d0d0f;
  --shifty-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

/* Light Theme (Clean Minimalist White) */
.shifty-island.theme-light {
  --shifty-bg: rgba(255, 255, 255, 0.96);
  --shifty-header-bg: rgba(244, 244, 245, 0.85);
  --shifty-border: rgba(0, 0, 0, 0.09);
  --shifty-text: #18181b;
  --shifty-text-muted: #71717a;
  --shifty-card-bg: rgba(0, 0, 0, 0.03);
  --shifty-card-border: rgba(0, 0, 0, 0.06);
  --shifty-input-bg: rgba(244, 244, 245, 0.9);
  --shifty-input-border: rgba(0, 0, 0, 0.12);
  --shifty-code-bg: #f4f4f5;
  --shifty-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.07);
}

/* =========================================
   ISLAND CONTAINER
   ========================================= */

.shifty-island {
  position: fixed;
  background: var(--shifty-bg);
  color: var(--shifty-text);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid var(--shifty-border);
  border-radius: 16px;
  box-shadow: var(--shifty-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.22s cubic-bezier(0.16, 1, 0.3, 1), 
              height 0.22s cubic-bezier(0.16, 1, 0.3, 1), 
              opacity 0.18s ease, 
              background-color 0.2s ease,
              color 0.2s ease,
              transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: center center;
  user-select: none;
}

.shifty-island.hidden {
  opacity: 0;
  pointer-events: none;
  transform: scale(0.96) translateY(6px);
}

/* Sizing presets */
.shifty-island.size-small {
  width: var(--island-small-w, 400px);
  height: var(--island-small-h, 480px);
}

.shifty-island.size-large {
  width: var(--island-large-w, 740px);
  height: var(--island-large-h, 640px);
}

/* =========================================
   HEADER
   ========================================= */

.shifty-header {
  padding: 8px 12px;
  background: var(--shifty-header-bg);
  border-bottom: 1px solid var(--shifty-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: grab;
  flex-shrink: 0;
}

.shifty-header:active {
  cursor: grabbing;
}

.shifty-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.shifty-logo-icon {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--shifty-accent, #18181b);
  color: var(--shifty-accent-contrast, #ffffff);
  transition: background-color 0.2s ease;
}

.shifty-title {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: -0.01em;
  color: var(--shifty-text);
}

.shifty-model-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--shifty-card-bg);
  border: 1px solid var(--shifty-card-border);
  color: var(--shifty-text-muted);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shifty-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.shifty-btn-icon {
  background: transparent;
  border: none;
  color: var(--shifty-text-muted);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.shifty-btn-icon:hover {
  background: var(--shifty-card-bg);
  color: var(--shifty-text);
}

.shifty-btn-icon:active {
  transform: scale(0.92);
}

.shifty-btn-close:hover {
  color: #ef4444;
}

/* =========================================
   BODY / CHAT
   ========================================= */

.shifty-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  user-select: text;
  scrollbar-width: thin;
  scrollbar-color: var(--shifty-card-border) transparent;
}

.shifty-body::-webkit-scrollbar {
  width: 5px;
}
.shifty-body::-webkit-scrollbar-thumb {
  background: var(--shifty-card-border);
  border-radius: 3px;
}

/* Welcome View */
.shifty-welcome {
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 16px 10px;
}

.shifty-welcome-dot {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--shifty-accent, #18181b);
  color: var(--shifty-accent-contrast, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
}

.shifty-welcome h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--shifty-text);
  letter-spacing: -0.01em;
}

.shifty-welcome p {
  font-size: 12.5px;
  color: var(--shifty-text-muted);
  max-width: 300px;
  line-height: 1.4;
}

.shifty-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 4px;
}

.shifty-chip {
  background: var(--shifty-card-bg);
  border: 1px solid var(--shifty-card-border);
  padding: 5px 11px;
  border-radius: 14px;
  font-size: 11.5px;
  color: var(--shifty-text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.shifty-chip:hover {
  border-color: var(--shifty-accent, #000);
  background: var(--shifty-card-border);
  transform: translateY(-1px);
}

/* Messages */
.shifty-message {
  display: flex;
  flex-direction: column;
  gap: 4px;
  animation: fadeIn 0.15s ease forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.shifty-msg-user {
  align-self: flex-end;
  max-width: 85%;
  background: var(--shifty-accent, #18181b);
  color: var(--shifty-accent-contrast, #ffffff);
  padding: 8px 13px;
  border-radius: 14px 14px 4px 14px;
  font-size: 13px;
  word-break: break-word;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.shifty-msg-assistant {
  align-self: flex-start;
  width: 100%;
  background: var(--shifty-card-bg);
  border: 1px solid var(--shifty-card-border);
  padding: 12px 14px;
  border-radius: 14px 14px 14px 4px;
  font-size: 13px;
  color: var(--shifty-text);
  line-height: 1.55;
  word-break: break-word;
}

/* Links & Sources Box */
.shifty-links-section {
  margin-top: 10px;
  padding: 10px;
  background: var(--shifty-input-bg);
  border: 1px solid var(--shifty-card-border);
  border-radius: 10px;
}

.shifty-links-header {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--shifty-accent, var(--shifty-text));
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.shifty-links-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.shifty-link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 9px;
  background: var(--shifty-card-bg);
  border: 1px solid var(--shifty-card-border);
  border-radius: 6px;
  text-decoration: none;
  color: var(--shifty-text);
  transition: all 0.15s ease;
}

.shifty-link-card:hover {
  border-color: var(--shifty-accent, var(--shifty-text));
  transform: translateX(2px);
}

.shifty-link-title {
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shifty-link-url {
  font-size: 11px;
  color: var(--shifty-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 130px;
}

/* Markdown typography */
.shifty-p {
  margin-bottom: 8px;
}
.shifty-p:last-child {
  margin-bottom: 0;
}
.shifty-h1, .shifty-h2, .shifty-h3 {
  color: var(--shifty-text);
  font-weight: 600;
  margin: 10px 0 4px 0;
}
.shifty-h1 { font-size: 15px; }
.shifty-h2 { font-size: 14px; }
.shifty-h3 { font-size: 13px; }

.shifty-ul {
  padding-left: 18px;
  margin-bottom: 8px;
}
.shifty-li {
  margin-bottom: 3px;
}
.shifty-quote {
  border-left: 2px solid var(--shifty-accent, #71717a);
  padding-left: 8px;
  color: var(--shifty-text-muted);
  margin: 6px 0;
  font-style: italic;
}
.shifty-link {
  color: var(--shifty-accent, #3b82f6);
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
}
.shifty-ext-icon {
  display: inline-block;
  vertical-align: middle;
  margin-left: 2px;
}

/* Code Block */
.shifty-code-block {
  background: var(--shifty-code-bg);
  border: 1px solid var(--shifty-card-border);
  border-radius: 8px;
  margin: 8px 0;
  overflow: hidden;
}
.shifty-code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 8px;
  background: var(--shifty-card-bg);
  border-bottom: 1px solid var(--shifty-card-border);
  font-size: 10.5px;
  color: var(--shifty-text-muted);
}
.shifty-code-block pre {
  padding: 8px;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: var(--shifty-text);
}
.shifty-inline-code {
  background: var(--shifty-card-border);
  padding: 1px 4px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
  color: var(--shifty-text);
}
.shifty-copy-btn {
  background: var(--shifty-card-border);
  border: none;
  color: var(--shifty-text);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.shifty-copy-btn:hover {
  background: var(--shifty-text);
  color: var(--shifty-bg);
}

/* Typing cursor */
.shifty-typing::after {
  content: '\u258B';
  display: inline-block;
  color: var(--shifty-accent, var(--shifty-text));
  margin-left: 2px;
  animation: blink 0.8s infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* =========================================
   FOOTER / INPUT
   ========================================= */

.shifty-footer {
  padding: 10px 12px;
  background: var(--shifty-header-bg);
  border-top: 1px solid var(--shifty-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.shifty-input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  background: var(--shifty-input-bg);
  border: 1px solid var(--shifty-input-border);
  border-radius: 12px;
  padding: 6px 8px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.shifty-input-wrapper:focus-within {
  border-color: var(--shifty-accent, var(--shifty-text));
  box-shadow: 0 0 0 1px var(--shifty-accent, var(--shifty-text));
}

.shifty-textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--shifty-text);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
  resize: none;
  max-height: 110px;
  min-height: 20px;
  padding: 2px 0;
}

.shifty-textarea::placeholder {
  color: var(--shifty-text-muted);
}

.shifty-send-btn {
  background: var(--shifty-accent, #18181b);
  color: var(--shifty-accent-contrast, #ffffff);
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.shifty-send-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.shifty-send-btn:active {
  transform: scale(0.95);
}

.shifty-send-btn.stop {
  background: #ef4444 !important;
  color: #ffffff !important;
}

.shifty-footer-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--shifty-text-muted);
  padding: 0 2px;
}

.shifty-shortcut-hint {
  display: flex;
  gap: 8px;
}

.shifty-kbd {
  background: var(--shifty-card-bg);
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid var(--shifty-card-border);
  color: var(--shifty-text);
  font-size: 10px;
}

/* =========================================
   SETTINGS MODAL INSIDE ISLAND
   ========================================= */

.shifty-modal {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--shifty-bg);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  z-index: 50;
  animation: fadeIn 0.15s ease forwards;
}

.shifty-modal.hidden {
  display: none;
}

.shifty-modal-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--shifty-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.shifty-modal-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--shifty-text);
}

.shifty-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: thin;
}

.shifty-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.shifty-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--shifty-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.shifty-input, .shifty-select {
  background: var(--shifty-input-bg);
  border: 1px solid var(--shifty-input-border);
  border-radius: 8px;
  padding: 7px 10px;
  color: var(--shifty-text);
  font-size: 12.5px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s ease;
}

.shifty-input:focus, .shifty-select:focus {
  border-color: var(--shifty-accent, var(--shifty-text));
}

.shifty-input-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* Color Picker & Theme controls */
.shifty-color-swatches {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.shifty-color-chip {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.15s ease, border-color 0.15s ease;
  position: relative;
}

.shifty-color-chip:hover {
  transform: scale(1.15);
}

.shifty-color-chip.active {
  border-color: var(--shifty-text);
}

.shifty-color-custom {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.shifty-color-custom::-webkit-color-swatch {
  border-radius: 6px;
  border: 1px solid var(--shifty-input-border);
}

.shifty-btn-primary {
  background: var(--shifty-accent, #18181b);
  color: var(--shifty-accent-contrast, #ffffff);
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.shifty-btn-primary:hover {
  opacity: 0.9;
}

.shifty-btn-secondary {
  background: var(--shifty-card-bg);
  border: 1px solid var(--shifty-card-border);
  color: var(--shifty-text);
  padding: 7px 11px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.shifty-btn-secondary:hover {
  background: var(--shifty-card-border);
}

/* Resize corner handle */
.shifty-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
  border-bottom-right-radius: 16px;
  background: linear-gradient(135deg, transparent 50%, var(--shifty-text-muted) 50%);
  opacity: 0.4;
}

.shifty-resize-handle:hover {
  opacity: 0.8;
}
`;

  // src/content/island.js
  (function initShiftySearch() {
    if (window.__SHIFTY_SEARCH_INITED__) return;
    window.__SHIFTY_SEARCH_INITED__ = true;
    const PRESET_COLORS = [
      { name: "\u041C\u043E\u043D\u043E\u0445\u0440\u043E\u043C", hex: "#18181b" },
      { name: "\u0421\u0438\u043D\u0438\u0439", hex: "#2563eb" },
      { name: "\u0418\u0437\u0443\u043C\u0440\u0443\u0434\u043D\u044B\u0439", hex: "#10b981" },
      { name: "\u0424\u0438\u043E\u043B\u0435\u0442\u043E\u0432\u044B\u0439", hex: "#8b5cf6" },
      { name: "\u041E\u0440\u0430\u043D\u0436\u0435\u0432\u044B\u0439", hex: "#f97316" },
      { name: "\u0420\u043E\u0437\u043E\u0432\u044B\u0439", hex: "#ec4899" },
      { name: "\u0413\u0440\u0430\u0444\u0438\u0442", hex: "#475569" }
    ];
    const DEFAULT_CONFIG = {
      provider: "gemini",
      apiKey: "",
      model: "gemini-2.0-flash",
      baseUrl: "",
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      hotkeyToggle: "Alt+Shift+S",
      hotkeyResize: "Alt+Shift+Z",
      smallWidth: 400,
      smallHeight: 480,
      largeWidth: 740,
      largeHeight: 640,
      currentSize: "small",
      // 'small' | 'large'
      theme: "dark",
      // 'dark' | 'light'
      accentColor: "#2563eb",
      autoSendSelection: true,
      position: { right: 24, top: 24 }
    };
    let config = { ...DEFAULT_CONFIG };
    let isOpen = false;
    let isDragging = false;
    let isResizing = false;
    let dragOffset = { x: 0, y: 0 };
    let currentAbortController = null;
    let chatHistory = [];
    function getContrastColor(hex) {
      if (!hex) return "#ffffff";
      let c = hex.replace("#", "");
      if (c.length === 3) c = c.split("").map((x) => x + x).join("");
      const r = parseInt(c.substr(0, 2), 16) || 0;
      const g = parseInt(c.substr(2, 2), 16) || 0;
      const b = parseInt(c.substr(4, 2), 16) || 0;
      const yiq = (r * 299 + g * 587 + b * 114) / 1e3;
      return yiq >= 150 ? "#09090b" : "#ffffff";
    }
    const hostEl = document.createElement("div");
    hostEl.id = "shiftysearch-host";
    const shadowRoot = hostEl.attachShadow({ mode: "open" });
    document.documentElement.appendChild(hostEl);
    const styleEl = document.createElement("style");
    styleEl.textContent = island_default;
    shadowRoot.appendChild(styleEl);
    const islandEl = document.createElement("div");
    islandEl.className = "shifty-island size-small theme-dark hidden";
    islandEl.innerHTML = `
    <!-- Header -->
    <div class="shifty-header" id="shifty-header">
      <div class="shifty-brand">
        <div class="shifty-logo-icon" id="shifty-logo-icon">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14"/>
          </svg>
        </div>
        <span class="shifty-title">ShiftySearch</span>
        <span class="shifty-model-badge" id="shifty-model-badge">Gemini</span>
      </div>
      <div class="shifty-header-actions">
        <button class="shifty-btn-icon" id="shifty-btn-theme" title="\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u0442\u0435\u043C\u0443 (\u0421\u0432\u0435\u0442\u043B\u0430\u044F / \u0422\u0435\u043C\u043D\u0430\u044F)">
          <svg id="shifty-icon-theme" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <!-- Rendered dynamically -->
          </svg>
        </button>
        <button class="shifty-btn-icon" id="shifty-btn-clear" title="\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u0434\u0438\u0430\u043B\u043E\u0433">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>
          </svg>
        </button>
        <button class="shifty-btn-icon" id="shifty-btn-resize" title="\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043C\u0430\u0441\u0448\u0442\u0430\u0431">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </button>
        <button class="shifty-btn-icon" id="shifty-btn-settings" title="\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
          </svg>
        </button>
        <button class="shifty-btn-icon shifty-btn-close" id="shifty-btn-close" title="\u0417\u0430\u043A\u0440\u044B\u0442\u044C (Esc)">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Body / Chat -->
    <div class="shifty-body" id="shifty-body">
      <div class="shifty-welcome" id="shifty-welcome">
        <div class="shifty-welcome-dot">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14"/>
          </svg>
        </div>
        <h2>ShiftySearch</h2>
        <p>\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u044B\u0439 AI-\u043F\u043E\u043C\u043E\u0449\u043D\u0438\u043A \u0441 \u043F\u043E\u0438\u0441\u043A\u043E\u043C \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u043E\u0432 \u0438 \u0441\u0441\u044B\u043B\u043E\u043A.</p>
        <div class="shifty-chips">
          <button class="shifty-chip" data-prompt="\u041D\u0430\u0439\u0434\u0438 \u043B\u0443\u0447\u0448\u0438\u0435 \u0441\u0442\u0430\u0442\u044C\u0438 \u0438 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u043F\u043E: ">\u{1F50D} \u041F\u043E\u0438\u0441\u043A \u0438 \u0441\u0441\u044B\u043B\u043A\u0438</button>
          <button class="shifty-chip" data-prompt="\u041A\u0440\u0430\u0442\u043A\u043E \u043E\u0431\u044A\u044F\u0441\u043D\u0438 \u0441\u0443\u0442\u044C: ">\u{1F4A1} \u041E\u0431\u044A\u044F\u0441\u043D\u0438 \u0441\u0443\u0442\u044C</button>
          <button class="shifty-chip" data-prompt="\u041A\u0430\u043A \u043D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u043A\u043E\u0434 \u0434\u043B\u044F: ">\u{1F4BB} \u041F\u0440\u0438\u043C\u0435\u0440 \u043A\u043E\u0434\u0430</button>
        </div>
      </div>
      <div id="shifty-messages-list"></div>
    </div>

    <!-- Footer / Input -->
    <div class="shifty-footer">
      <div class="shifty-input-wrapper">
        <textarea class="shifty-textarea" id="shifty-input" rows="1" placeholder="\u0417\u0430\u0434\u0430\u0439\u0442\u0435 \u0432\u043E\u043F\u0440\u043E\u0441 \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u0438..."></textarea>
        <button class="shifty-send-btn" id="shifty-btn-send" title="\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C (Enter)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
      <div class="shifty-footer-meta">
        <div class="shifty-shortcut-hint">
          <span>\u041C\u0430\u0441\u0448\u0442\u0430\u0431: <span class="shifty-kbd" id="shifty-kbd-resize">Alt+Shift+Z</span></span>
          <span>\u0417\u0430\u043A\u0440\u044B\u0442\u044C: <span class="shifty-kbd">Esc</span></span>
        </div>
        <span id="shifty-status-msg"></span>
      </div>
    </div>

    <!-- In-Island Quick Settings Modal -->
    <div class="shifty-modal hidden" id="shifty-modal">
      <div class="shifty-modal-header">
        <span class="shifty-modal-title">\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u0438 \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u0438</span>
        <button class="shifty-btn-icon" id="shifty-modal-close">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="shifty-modal-body">
        <!-- Theme & Color settings -->
        <div class="shifty-field">
          <label class="shifty-label">\u0422\u0435\u043C\u0430 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F</label>
          <select class="shifty-select" id="shifty-setting-theme">
            <option value="dark">\u0422\u0451\u043C\u043D\u0430\u044F (\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u044B\u0439 \u0447\u0451\u0440\u043D\u044B\u0439)</option>
            <option value="light">\u0421\u0432\u0435\u0442\u043B\u0430\u044F (\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u044B\u0439 \u0431\u0435\u043B\u044B\u0439)</option>
          </select>
        </div>

        <div class="shifty-field">
          <label class="shifty-label">\u0426\u0432\u0435\u0442 \u0430\u043A\u0446\u0435\u043D\u0442\u0430 (\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u0438\u0439 \u0446\u0432\u0435\u0442)</label>
          <div class="shifty-color-swatches" id="shifty-swatches-container"></div>
          <div class="shifty-input-row" style="margin-top: 6px;">
            <span style="font-size:12px; color:var(--shifty-text-muted);">\u0421\u0432\u043E\u0439 \u0446\u0432\u0435\u0442:</span>
            <input type="color" class="shifty-color-custom" id="shifty-custom-color-picker" value="#2563eb">
            <input type="text" class="shifty-input" id="shifty-custom-color-hex" value="#2563eb" style="width: 90px; text-align: center; text-transform: uppercase;">
          </div>
        </div>

        <!-- AI Provider -->
        <div class="shifty-field">
          <label class="shifty-label">\u041D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u044C / \u041F\u0440\u043E\u0432\u0430\u0439\u0434\u0435\u0440</label>
          <select class="shifty-select" id="shifty-setting-provider">
            <option value="gemini">Google Gemini (Gemini 2.0 Flash / 1.5)</option>
            <option value="openai">OpenAI (ChatGPT / GPT-4o / o3-mini)</option>
            <option value="openrouter">OpenRouter (Perplexity Sonar / DeepSeek / \u0412\u0441\u0435)</option>
            <option value="anthropic">Anthropic Claude (Claude 3.5 Sonnet / Haiku)</option>
            <option value="groq">Groq (\u0421\u0432\u0435\u0440\u0445\u0431\u044B\u0441\u0442\u0440\u044B\u0439 Llama 3.3)</option>
            <option value="deepseek">DeepSeek (DeepSeek V3 / R1)</option>
            <option value="custom">\u0421\u0432\u043E\u0439 endpoint (Ollama / Local / \u041F\u0440\u043E\u043A\u0441\u0438)</option>
          </select>
        </div>

        <div class="shifty-field">
          <label class="shifty-label">API-\u043A\u043B\u044E\u0447</label>
          <div class="shifty-input-row">
            <input type="password" class="shifty-input" id="shifty-setting-apikey" placeholder="\u0412\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0432\u0430\u0448 API-\u043A\u043B\u044E\u0447..." style="flex:1;">
            <button class="shifty-btn-secondary" id="shifty-btn-toggle-key" type="button">\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C</button>
          </div>
          <small style="color: var(--shifty-text-muted); font-size: 11px;" id="shifty-key-help"></small>
        </div>

        <div class="shifty-field">
          <label class="shifty-label">\u041C\u043E\u0434\u0435\u043B\u044C</label>
          <input type="text" class="shifty-input" id="shifty-setting-model" placeholder="gemini-2.0-flash">
        </div>

        <div class="shifty-field" id="shifty-field-endpoint" style="display:none;">
          <label class="shifty-label">\u0411\u0430\u0437\u043E\u0432\u044B\u0439 URL (Endpoint)</label>
          <input type="text" class="shifty-input" id="shifty-setting-baseurl" placeholder="http://localhost:11434/v1/chat/completions">
        </div>

        <div class="shifty-field">
          <label class="shifty-label">\u0413\u043E\u0440\u044F\u0447\u0438\u0435 \u043A\u043B\u0430\u0432\u0438\u0448\u0438 (In-page Hotkeys)</label>
          <div class="shifty-input-row" style="margin-bottom: 6px;">
            <span style="font-size:12px; color:var(--shifty-text-muted); width: 130px;">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u0441\u0442\u0440\u043E\u0432\u043E\u043A:</span>
            <input type="text" class="shifty-input" id="shifty-setting-key-toggle" readonly style="flex:1; text-align:center;">
            <button class="shifty-btn-secondary" id="shifty-record-key-toggle">\u0417\u0430\u043F\u0438\u0441\u044C</button>
          </div>
          <div class="shifty-input-row">
            <span style="font-size:12px; color:var(--shifty-text-muted); width: 130px;">\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u043C\u0430\u0441\u0448\u0442\u0430\u0431:</span>
            <input type="text" class="shifty-input" id="shifty-setting-key-resize" readonly style="flex:1; text-align:center;">
            <button class="shifty-btn-secondary" id="shifty-record-key-resize">\u0417\u0430\u043F\u0438\u0441\u044C</button>
          </div>
        </div>

        <div class="shifty-field">
          <label class="shifty-label">\u0420\u0430\u0437\u043C\u0435\u0440\u044B \u043E\u0441\u0442\u0440\u043E\u0432\u043A\u0430 (\u0428\u0438\u0440\u0438\u043D\u0430 \xD7 \u0412\u044B\u0441\u043E\u0442\u0430 px)</label>
          <div class="shifty-input-row">
            <span style="font-size:12px; color:var(--shifty-text-muted); width: 60px;">\u041C\u0438\u043D\u0438:</span>
            <input type="number" class="shifty-input" id="shifty-setting-small-w" min="300" max="800" style="flex:1;">
            <input type="number" class="shifty-input" id="shifty-setting-small-h" min="200" max="900" style="flex:1;">
          </div>
          <div class="shifty-input-row" style="margin-top: 6px;">
            <span style="font-size:12px; color:var(--shifty-text-muted); width: 60px;">\u0411\u043E\u043B\u044C\u0448\u043E\u0439:</span>
            <input type="number" class="shifty-input" id="shifty-setting-large-w" min="400" max="1400" style="flex:1;">
            <input type="number" class="shifty-input" id="shifty-setting-large-h" min="300" max="1200" style="flex:1;">
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="shifty-btn-primary" id="shifty-btn-save-settings" style="flex: 1;">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</button>
          <button class="shifty-btn-secondary" id="shifty-btn-open-options">\u0412\u0441\u0435 \u043E\u043F\u0446\u0438\u0438 \u2197</button>
        </div>
      </div>
    </div>

    <!-- Corner resize handle -->
    <div class="shifty-resize-handle" id="shifty-resize-handle"></div>
  `;
    shadowRoot.appendChild(islandEl);
    const headerEl = shadowRoot.getElementById("shifty-header");
    const inputEl = shadowRoot.getElementById("shifty-input");
    const btnSend = shadowRoot.getElementById("shifty-btn-send");
    const btnClose = shadowRoot.getElementById("shifty-btn-close");
    const btnResize = shadowRoot.getElementById("shifty-btn-resize");
    const btnClear = shadowRoot.getElementById("shifty-btn-clear");
    const btnSettings = shadowRoot.getElementById("shifty-btn-settings");
    const btnTheme = shadowRoot.getElementById("shifty-btn-theme");
    const iconTheme = shadowRoot.getElementById("shifty-icon-theme");
    const bodyEl = shadowRoot.getElementById("shifty-body");
    const welcomeEl = shadowRoot.getElementById("shifty-welcome");
    const messagesListEl = shadowRoot.getElementById("shifty-messages-list");
    const modelBadgeEl = shadowRoot.getElementById("shifty-model-badge");
    const modalEl = shadowRoot.getElementById("shifty-modal");
    const modalCloseBtn = shadowRoot.getElementById("shifty-modal-close");
    const resizeHandle = shadowRoot.getElementById("shifty-resize-handle");
    const kbdResizeEl = shadowRoot.getElementById("shifty-kbd-resize");
    const selectTheme = shadowRoot.getElementById("shifty-setting-theme");
    const swatchesContainer = shadowRoot.getElementById("shifty-swatches-container");
    const customColorPicker = shadowRoot.getElementById("shifty-custom-color-picker");
    const customColorHex = shadowRoot.getElementById("shifty-custom-color-hex");
    const selectProvider = shadowRoot.getElementById("shifty-setting-provider");
    const inputApiKey = shadowRoot.getElementById("shifty-setting-apikey");
    const inputModel = shadowRoot.getElementById("shifty-setting-model");
    const inputBaseUrl = shadowRoot.getElementById("shifty-setting-baseurl");
    const fieldEndpoint = shadowRoot.getElementById("shifty-field-endpoint");
    const btnToggleKey = shadowRoot.getElementById("shifty-btn-toggle-key");
    const keyHelpEl = shadowRoot.getElementById("shifty-key-help");
    const inputKeyToggle = shadowRoot.getElementById("shifty-setting-key-toggle");
    const inputKeyResize = shadowRoot.getElementById("shifty-setting-key-resize");
    const btnRecordToggle = shadowRoot.getElementById("shifty-record-key-toggle");
    const btnRecordResize = shadowRoot.getElementById("shifty-record-key-resize");
    const inputSmallW = shadowRoot.getElementById("shifty-setting-small-w");
    const inputSmallH = shadowRoot.getElementById("shifty-setting-small-h");
    const inputLargeW = shadowRoot.getElementById("shifty-setting-large-w");
    const inputLargeH = shadowRoot.getElementById("shifty-setting-large-h");
    const btnSaveSettings = shadowRoot.getElementById("shifty-btn-save-settings");
    const btnOpenOptions = shadowRoot.getElementById("shifty-btn-open-options");
    function initSwatches() {
      swatchesContainer.innerHTML = "";
      PRESET_COLORS.forEach((c) => {
        const chip = document.createElement("div");
        chip.className = `shifty-color-chip ${config.accentColor.toLowerCase() === c.hex.toLowerCase() ? "active" : ""}`;
        chip.style.backgroundColor = c.hex;
        chip.title = c.name;
        chip.addEventListener("click", () => {
          applyAccentColor(c.hex);
        });
        swatchesContainer.appendChild(chip);
      });
    }
    function applyAccentColor(hex) {
      config.accentColor = hex;
      customColorPicker.value = hex;
      customColorHex.value = hex.toUpperCase();
      islandEl.style.setProperty("--shifty-accent", hex);
      islandEl.style.setProperty("--shifty-accent-contrast", getContrastColor(hex));
      initSwatches();
    }
    customColorPicker.addEventListener("input", (e) => {
      applyAccentColor(e.target.value);
    });
    customColorHex.addEventListener("change", (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith("#")) val = "#" + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        applyAccentColor(val);
      }
    });
    function applyThemeAndStyles() {
      islandEl.classList.remove("theme-dark", "theme-light");
      islandEl.classList.add(config.theme === "light" ? "theme-light" : "theme-dark");
      islandEl.style.setProperty("--shifty-accent", config.accentColor);
      islandEl.style.setProperty("--shifty-accent-contrast", getContrastColor(config.accentColor));
      if (config.theme === "light") {
        iconTheme.innerHTML = `
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      `;
      } else {
        iconTheme.innerHTML = `
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      `;
      }
      islandEl.style.setProperty("--island-small-w", `${config.smallWidth}px`);
      islandEl.style.setProperty("--island-small-h", `${config.smallHeight}px`);
      islandEl.style.setProperty("--island-large-w", `${config.largeWidth}px`);
      islandEl.style.setProperty("--island-large-h", `${config.largeHeight}px`);
      if (config.currentSize === "large") {
        islandEl.classList.remove("size-small");
        islandEl.classList.add("size-large");
      } else {
        islandEl.classList.remove("size-large");
        islandEl.classList.add("size-small");
      }
      if (kbdResizeEl) {
        kbdResizeEl.textContent = config.hotkeyResize;
      }
    }
    function loadConfig() {
      chrome.storage.local.get(DEFAULT_CONFIG, (stored) => {
        config = { ...DEFAULT_CONFIG, ...stored };
        applyThemeAndStyles();
        initSwatches();
        updateModelBadge();
        restorePosition();
      });
    }
    function updateModelBadge() {
      const prov = PROVIDERS[config.provider] || PROVIDERS.gemini;
      const modelName = config.model || prov.defaultModel;
      modelBadgeEl.textContent = `${prov.name.split(" ")[0]} \xB7 ${modelName}`;
    }
    function restorePosition() {
      if (config.position && typeof config.position.top === "number" && typeof config.position.left === "number") {
        islandEl.style.top = `${Math.max(10, Math.min(window.innerHeight - 100, config.position.top))}px`;
        islandEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 100, config.position.left))}px`;
        islandEl.style.right = "auto";
        islandEl.style.bottom = "auto";
      } else {
        islandEl.style.top = "24px";
        islandEl.style.right = "24px";
        islandEl.style.left = "auto";
        islandEl.style.bottom = "auto";
      }
    }
    function savePosition(top, left) {
      config.position = { top, left };
      chrome.storage.local.set({ position: config.position });
    }
    function toggleIsland(open) {
      if (typeof open === "boolean") {
        isOpen = open;
      } else {
        isOpen = !isOpen;
      }
      if (isOpen) {
        islandEl.classList.remove("hidden");
        setTimeout(() => {
          inputEl.focus();
        }, 50);
      } else {
        islandEl.classList.add("hidden");
        modalEl.classList.add("hidden");
      }
    }
    function toggleTheme() {
      config.theme = config.theme === "light" ? "dark" : "light";
      chrome.storage.local.set({ theme: config.theme }, () => {
        applyThemeAndStyles();
        if (selectTheme) selectTheme.value = config.theme;
      });
    }
    function toggleSize() {
      if (config.currentSize === "small") {
        config.currentSize = "large";
        islandEl.classList.remove("size-small");
        islandEl.classList.add("size-large");
      } else {
        config.currentSize = "small";
        islandEl.classList.remove("size-large");
        islandEl.classList.add("size-small");
      }
      chrome.storage.local.set({ currentSize: config.currentSize });
    }
    headerEl.addEventListener("mousedown", (e) => {
      if (e.target.closest(".shifty-btn-icon")) return;
      isDragging = true;
      const rect = islandEl.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      islandEl.style.left = `${rect.left}px`;
      islandEl.style.top = `${rect.top}px`;
      islandEl.style.right = "auto";
      islandEl.style.bottom = "auto";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    });
    function onMouseMove(e) {
      if (!isDragging) return;
      let newLeft = e.clientX - dragOffset.x;
      let newTop = e.clientY - dragOffset.y;
      const islandW = islandEl.offsetWidth;
      const islandH = islandEl.offsetHeight;
      newLeft = Math.max(8, Math.min(window.innerWidth - islandW - 8, newLeft));
      newTop = Math.max(8, Math.min(window.innerHeight - islandH - 8, newTop));
      islandEl.style.left = `${newLeft}px`;
      islandEl.style.top = `${newTop}px`;
    }
    function onMouseUp(e) {
      if (isDragging) {
        isDragging = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        const rect = islandEl.getBoundingClientRect();
        savePosition(rect.top, rect.left);
      }
    }
    resizeHandle.addEventListener("mousedown", (e) => {
      isResizing = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = islandEl.offsetWidth;
      const startH = islandEl.offsetHeight;
      function onResizeMove(moveEvent) {
        if (!isResizing) return;
        const newW = Math.max(300, startW + (moveEvent.clientX - startX));
        const newH = Math.max(260, startH + (moveEvent.clientY - startY));
        if (config.currentSize === "small") {
          config.smallWidth = newW;
          config.smallHeight = newH;
          islandEl.style.setProperty("--island-small-w", `${newW}px`);
          islandEl.style.setProperty("--island-small-h", `${newH}px`);
        } else {
          config.largeWidth = newW;
          config.largeHeight = newH;
          islandEl.style.setProperty("--island-large-w", `${newW}px`);
          islandEl.style.setProperty("--island-large-h", `${newH}px`);
        }
      }
      function onResizeEnd() {
        if (isResizing) {
          isResizing = false;
          document.removeEventListener("mousemove", onResizeMove);
          document.removeEventListener("mouseup", onResizeEnd);
          chrome.storage.local.set({
            smallWidth: config.smallWidth,
            smallHeight: config.smallHeight,
            largeWidth: config.largeWidth,
            largeHeight: config.largeHeight
          });
        }
      }
      document.addEventListener("mousemove", onResizeMove);
      document.addEventListener("mouseup", onResizeEnd);
      e.preventDefault();
    });
    function matchesHotkey(e, hotkeyStr) {
      if (!hotkeyStr) return false;
      const parts = hotkeyStr.toLowerCase().split("+").map((p) => p.trim());
      const alt = parts.includes("alt");
      const ctrl = parts.includes("ctrl") || parts.includes("control");
      const shift = parts.includes("shift");
      const meta = parts.includes("cmd") || parts.includes("command") || parts.includes("meta");
      if (e.altKey !== alt) return false;
      if (e.ctrlKey !== ctrl) return false;
      if (e.shiftKey !== shift) return false;
      if (e.metaKey !== meta) return false;
      const keyPart = parts.find((p) => !["alt", "ctrl", "control", "shift", "cmd", "command", "meta"].includes(p));
      if (!keyPart) return true;
      if (keyPart === "space" && e.code === "Space") return true;
      return e.key.toLowerCase() === keyPart.toLowerCase() || e.code.toLowerCase() === keyPart.toLowerCase();
    }
    window.addEventListener("keydown", (e) => {
      if (matchesHotkey(e, config.hotkeyToggle)) {
        e.preventDefault();
        toggleIsland();
        return;
      }
      if (isOpen && matchesHotkey(e, config.hotkeyResize)) {
        e.preventDefault();
        toggleSize();
        return;
      }
      if (isOpen && e.key === "Escape") {
        if (!modalEl.classList.contains("hidden")) {
          modalEl.classList.add("hidden");
        } else {
          toggleIsland(false);
        }
        return;
      }
    }, true);
    inputEl.addEventListener("input", () => {
      inputEl.style.height = "auto";
      inputEl.style.height = `${Math.min(110, inputEl.scrollHeight)}px`;
    });
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    });
    btnSend.addEventListener("click", () => {
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
        setSendButtonState(false);
      } else {
        handleSubmit();
      }
    });
    btnClose.addEventListener("click", () => toggleIsland(false));
    btnResize.addEventListener("click", toggleSize);
    btnTheme.addEventListener("click", toggleTheme);
    btnClear.addEventListener("click", clearChat);
    btnSettings.addEventListener("click", openSettingsModal);
    shadowRoot.querySelectorAll(".shifty-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const prompt = chip.getAttribute("data-prompt");
        inputEl.value = prompt;
        inputEl.focus();
        inputEl.style.height = "auto";
        inputEl.style.height = `${Math.min(110, inputEl.scrollHeight)}px`;
      });
    });
    function clearChat() {
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      chatHistory = [];
      messagesListEl.innerHTML = "";
      welcomeEl.style.display = "flex";
      setSendButtonState(false);
    }
    function setSendButtonState(isLoading) {
      if (isLoading) {
        btnSend.classList.add("stop");
        btnSend.title = "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u044E";
        btnSend.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
      `;
      } else {
        btnSend.classList.remove("stop");
        btnSend.title = "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C (Enter)";
        btnSend.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      `;
      }
    }
    async function handleSubmit(overridePrompt) {
      const text = (overridePrompt || inputEl.value).trim();
      if (!text) return;
      if (!config.apiKey && config.provider !== "custom") {
        openSettingsModal();
        alert("\u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0443\u043A\u0430\u0436\u0438\u0442\u0435 API-\u043A\u043B\u044E\u0447 \u0434\u043B\u044F \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u0438 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445!");
        return;
      }
      welcomeEl.style.display = "none";
      inputEl.value = "";
      inputEl.style.height = "auto";
      appendUserMessage(text);
      chatHistory.push({ role: "user", content: text });
      const { assistantMsgEl, contentEl, linksContainerEl } = createAssistantMessageElement();
      messagesListEl.appendChild(assistantMsgEl);
      contentEl.classList.add("shifty-typing");
      bodyEl.scrollTop = bodyEl.scrollHeight;
      currentAbortController = new AbortController();
      setSendButtonState(true);
      let fullAnswer = "";
      await sendAiRequest({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        messages: chatHistory,
        signal: currentAbortController.signal,
        onChunk: (chunk, accumulated) => {
          fullAnswer = accumulated;
          contentEl.innerHTML = renderMarkdown(accumulated);
          renderLinksBox(accumulated, linksContainerEl);
          bodyEl.scrollTop = bodyEl.scrollHeight;
        },
        onDone: (finalText) => {
          const textToSave = finalText || fullAnswer;
          contentEl.classList.remove("shifty-typing");
          contentEl.innerHTML = renderMarkdown(textToSave);
          renderLinksBox(textToSave, linksContainerEl);
          chatHistory.push({ role: "assistant", content: textToSave });
          currentAbortController = null;
          setSendButtonState(false);
          attachCodeCopyListeners(contentEl);
        },
        onError: (err) => {
          contentEl.classList.remove("shifty-typing");
          contentEl.innerHTML = `<span style="color:#ef4444;">\u26A0\uFE0F ${err.message || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043A \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u0438"}</span>`;
          currentAbortController = null;
          setSendButtonState(false);
        }
      });
    }
    function appendUserMessage(text) {
      const msgEl = document.createElement("div");
      msgEl.className = "shifty-message";
      msgEl.innerHTML = `<div class="shifty-msg-user">${escapeHtml(text)}</div>`;
      messagesListEl.appendChild(msgEl);
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }
    function createAssistantMessageElement() {
      const msgEl = document.createElement("div");
      msgEl.className = "shifty-message";
      const bubbleEl = document.createElement("div");
      bubbleEl.className = "shifty-msg-assistant";
      const contentEl = document.createElement("div");
      contentEl.className = "shifty-msg-content";
      const linksContainerEl = document.createElement("div");
      linksContainerEl.className = "shifty-links-section";
      linksContainerEl.style.display = "none";
      bubbleEl.appendChild(contentEl);
      bubbleEl.appendChild(linksContainerEl);
      msgEl.appendChild(bubbleEl);
      return { assistantMsgEl: msgEl, contentEl, linksContainerEl };
    }
    function renderLinksBox(text, containerEl) {
      const links = extractLinks(text);
      if (!links || links.length === 0) {
        containerEl.style.display = "none";
        return;
      }
      containerEl.style.display = "block";
      containerEl.innerHTML = `
      <div class="shifty-links-header">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span>\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u0438 \u0441\u0441\u044B\u043B\u043A\u0438 (${links.length})</span>
      </div>
      <div class="shifty-links-list">
        ${links.map((l) => `
          <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="shifty-link-card" title="${l.url}">
            <span class="shifty-link-title">\u{1F517} ${escapeHtml(l.title)}</span>
            <span class="shifty-link-url">${formatUrlHost(l.url)}</span>
          </a>
        `).join("")}
      </div>
    `;
    }
    function attachCodeCopyListeners(containerEl) {
      containerEl.querySelectorAll(".shifty-copy-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const rawCode = decodeURIComponent(btn.getAttribute("data-code") || "");
          navigator.clipboard.writeText(rawCode).then(() => {
            btn.textContent = "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E";
            setTimeout(() => {
              btn.textContent = "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C";
            }, 2e3);
          });
        });
      });
    }
    function formatUrlHost(url) {
      try {
        const u = new URL(url);
        return u.hostname;
      } catch {
        return "";
      }
    }
    function escapeHtml(str) {
      return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function openSettingsModal() {
      selectTheme.value = config.theme;
      customColorPicker.value = config.accentColor;
      customColorHex.value = config.accentColor.toUpperCase();
      selectProvider.value = config.provider;
      inputApiKey.value = config.apiKey || "";
      inputModel.value = config.model || "";
      inputBaseUrl.value = config.baseUrl || "";
      inputKeyToggle.value = config.hotkeyToggle;
      inputKeyResize.value = config.hotkeyResize;
      inputSmallW.value = config.smallWidth;
      inputSmallH.value = config.smallHeight;
      inputLargeW.value = config.largeWidth;
      inputLargeH.value = config.largeHeight;
      initSwatches();
      updateProviderFields();
      modalEl.classList.remove("hidden");
    }
    selectTheme.addEventListener("change", () => {
      config.theme = selectTheme.value;
      applyThemeAndStyles();
    });
    function updateProviderFields() {
      const provId = selectProvider.value;
      const prov = PROVIDERS[provId] || PROVIDERS.gemini;
      fieldEndpoint.style.display = provId === "custom" ? "flex" : "none";
      if (!inputModel.value || Object.values(PROVIDERS).some((p) => p.models.includes(inputModel.value))) {
        inputModel.value = prov.defaultModel;
      }
      inputApiKey.placeholder = prov.keyPlaceholder || "API-\u043A\u043B\u044E\u0447...";
      if (prov.keyHelpUrl) {
        keyHelpEl.innerHTML = `<a href="${prov.keyHelpUrl}" target="_blank" style="color:var(--shifty-accent); text-decoration:underline;">\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043A\u043B\u044E\u0447 \u0434\u043B\u044F ${prov.name} \u2197</a>`;
      } else {
        keyHelpEl.textContent = "";
      }
    }
    selectProvider.addEventListener("change", updateProviderFields);
    btnToggleKey.addEventListener("click", () => {
      if (inputApiKey.type === "password") {
        inputApiKey.type = "text";
        btnToggleKey.textContent = "\u0421\u043A\u0440\u044B\u0442\u044C";
      } else {
        inputApiKey.type = "password";
        btnToggleKey.textContent = "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C";
      }
    });
    modalCloseBtn.addEventListener("click", () => {
      modalEl.classList.add("hidden");
    });
    function setupRecorder(button, inputField, targetKey) {
      let recording = false;
      button.addEventListener("click", () => {
        if (recording) return;
        recording = true;
        button.textContent = "\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u043A\u043B\u0430\u0432\u0438\u0448\u0438...";
        inputField.value = "\u0421\u043B\u0443\u0448\u0430\u044E...";
        function handler(e) {
          e.preventDefault();
          e.stopPropagation();
          if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
          const parts = [];
          if (e.ctrlKey) parts.push("Ctrl");
          if (e.altKey) parts.push("Alt");
          if (e.shiftKey) parts.push("Shift");
          if (e.metaKey) parts.push("Cmd");
          const keyName = e.code === "Space" ? "Space" : e.key.toUpperCase();
          parts.push(keyName);
          const combo = parts.join("+");
          inputField.value = combo;
          button.textContent = "\u0417\u0430\u043F\u0438\u0441\u044C";
          recording = false;
          window.removeEventListener("keydown", handler, true);
        }
        window.addEventListener("keydown", handler, true);
      });
    }
    setupRecorder(btnRecordToggle, inputKeyToggle, "hotkeyToggle");
    setupRecorder(btnRecordResize, inputKeyResize, "hotkeyResize");
    btnSaveSettings.addEventListener("click", () => {
      config.theme = selectTheme.value;
      config.accentColor = customColorPicker.value;
      config.provider = selectProvider.value;
      config.apiKey = inputApiKey.value.trim();
      config.model = inputModel.value.trim();
      config.baseUrl = inputBaseUrl.value.trim();
      config.hotkeyToggle = inputKeyToggle.value.trim() || "Alt+Shift+S";
      config.hotkeyResize = inputKeyResize.value.trim() || "Alt+Shift+Z";
      config.smallWidth = parseInt(inputSmallW.value, 10) || 400;
      config.smallHeight = parseInt(inputSmallH.value, 10) || 480;
      config.largeWidth = parseInt(inputLargeW.value, 10) || 740;
      config.largeHeight = parseInt(inputLargeH.value, 10) || 640;
      chrome.storage.local.set({
        theme: config.theme,
        accentColor: config.accentColor,
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        hotkeyToggle: config.hotkeyToggle,
        hotkeyResize: config.hotkeyResize,
        smallWidth: config.smallWidth,
        smallHeight: config.smallHeight,
        largeWidth: config.largeWidth,
        largeHeight: config.largeHeight
      }, () => {
        applyThemeAndStyles();
        updateModelBadge();
        modalEl.classList.add("hidden");
      });
    });
    btnOpenOptions.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "openOptions" });
    });
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "toggle-island") {
        toggleIsland();
        sendResponse({ status: "ok" });
      } else if (message.action === "toggle-size") {
        toggleSize();
        sendResponse({ status: "ok" });
      } else if (message.action === "ask-selection") {
        const selectedText = message.text || "";
        toggleIsland(true);
        if (selectedText) {
          const query = `\u041E\u0431\u044A\u044F\u0441\u043D\u0438 \u0438 \u043D\u0430\u0439\u0434\u0438 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438: "${selectedText}"`;
          inputEl.value = query;
          if (config.autoSendSelection) {
            handleSubmit(query);
          } else {
            inputEl.focus();
          }
        }
        sendResponse({ status: "ok" });
      }
    });
    loadConfig();
  })();
})();
