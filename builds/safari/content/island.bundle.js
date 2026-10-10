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
  var island_default = `/* src/content/island.css - Scoped styling for ShiftySearch Shadow DOM */

:host {
  all: initial;
  position: fixed;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #f1f5f9;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Island Container */
.shifty-island {
  position: fixed;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  box-shadow: 
    0 24px 60px -12px rgba(0, 0, 0, 0.65),
    0 8px 24px -4px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 1px 1px rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.24s cubic-bezier(0.16, 1, 0.3, 1), 
              height 0.24s cubic-bezier(0.16, 1, 0.3, 1), 
              opacity 0.2s ease, 
              transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: center center;
  user-select: none;
}

.shifty-island.hidden {
  opacity: 0;
  pointer-events: none;
  transform: scale(0.94) translateY(8px);
}

/* Sizing presets */
.shifty-island.size-small {
  width: var(--island-small-w, 400px);
  height: var(--island-small-h, 460px);
}

.shifty-island.size-large {
  width: var(--island-large-w, 740px);
  height: var(--island-large-h, 640px);
}

/* Header */
.shifty-header {
  padding: 10px 14px;
  background: rgba(30, 41, 59, 0.55);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1, #a855f7, #ec4899);
  color: white;
}

.shifty-title {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: -0.01em;
  background: linear-gradient(120deg, #f8fafc, #cbd5e1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.shifty-model-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.2);
  border: 1px solid rgba(129, 140, 248, 0.3);
  color: #c7d2fe;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shifty-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.shifty-btn-icon {
  background: transparent;
  border: none;
  color: #94a3b8;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.shifty-btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
}

.shifty-btn-icon:active {
  transform: scale(0.92);
}

.shifty-btn-close:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

/* Chat Body */
.shifty-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  user-select: text;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.shifty-body::-webkit-scrollbar {
  width: 6px;
}
.shifty-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

/* Welcome View */
.shifty-welcome {
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 20px 10px;
}

.shifty-welcome-glow {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed, #db2777);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 32px rgba(124, 58, 237, 0.4);
}

.shifty-welcome h2 {
  font-size: 17px;
  font-weight: 700;
  color: #f8fafc;
}

.shifty-welcome p {
  font-size: 13px;
  color: #94a3b8;
  max-width: 320px;
  line-height: 1.4;
}

.shifty-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
}

.shifty-chip {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.15s ease;
}

.shifty-chip:hover {
  background: rgba(99, 102, 241, 0.25);
  border-color: rgba(129, 140, 248, 0.4);
  color: #fff;
  transform: translateY(-1px);
}

/* Message Styles */
.shifty-message {
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: fadeIn 0.2s ease forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.shifty-msg-user {
  align-self: flex-end;
  max-width: 85%;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #ffffff;
  padding: 10px 14px;
  border-radius: 16px 16px 4px 16px;
  font-size: 13.5px;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
  word-break: break-word;
}

.shifty-msg-assistant {
  align-self: flex-start;
  width: 100%;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 14px 16px;
  border-radius: 16px 16px 16px 4px;
  font-size: 13.5px;
  color: #f1f5f9;
  line-height: 1.6;
  word-break: break-word;
}

/* Links & Sources Box */
.shifty-links-section {
  margin-top: 12px;
  padding: 12px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 12px;
}

.shifty-links-header {
  font-size: 12px;
  font-weight: 600;
  color: #38bdf8;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.shifty-links-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shifty-link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  text-decoration: none;
  color: #cbd5e1;
  transition: all 0.15s ease;
}

.shifty-link-card:hover {
  background: rgba(56, 189, 248, 0.15);
  border-color: rgba(56, 189, 248, 0.35);
  color: #ffffff;
  transform: translateX(2px);
}

.shifty-link-title {
  font-size: 12.5px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shifty-link-url {
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}

/* Markdown elements */
.shifty-p {
  margin-bottom: 10px;
}
.shifty-p:last-child {
  margin-bottom: 0;
}
.shifty-h1, .shifty-h2, .shifty-h3 {
  color: #f8fafc;
  font-weight: 700;
  margin: 12px 0 6px 0;
}
.shifty-h1 { font-size: 16px; }
.shifty-h2 { font-size: 15px; }
.shifty-h3 { font-size: 14px; color: #a5b4fc; }

.shifty-ul {
  padding-left: 20px;
  margin-bottom: 10px;
}
.shifty-li {
  margin-bottom: 4px;
}
.shifty-quote {
  border-left: 3px solid #6366f1;
  padding-left: 10px;
  color: #94a3b8;
  margin: 8px 0;
  font-style: italic;
}
.shifty-link {
  color: #38bdf8;
  text-decoration: underline;
  text-underline-offset: 3px;
  word-break: break-all;
}
.shifty-link:hover {
  color: #7dd3fc;
}
.shifty-ext-icon {
  display: inline-block;
  vertical-align: middle;
  margin-left: 2px;
}

/* Code block */
.shifty-code-block {
  background: #090d16;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  margin: 10px 0;
  overflow: hidden;
}
.shifty-code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: #94a3b8;
}
.shifty-code-block pre {
  padding: 10px;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px;
  color: #e2e8f0;
}
.shifty-inline-code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: #f472b6;
}
.shifty-copy-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #cbd5e1;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.shifty-copy-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* Typing cursor animation */
.shifty-typing::after {
  content: '\u258B';
  display: inline-block;
  color: #818cf8;
  margin-left: 2px;
  animation: blink 0.8s infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Footer / Input area */
.shifty-footer {
  padding: 12px 14px;
  background: rgba(30, 41, 59, 0.7);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.shifty-input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 8px 10px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.shifty-input-wrapper:focus-within {
  border-color: #818cf8;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
}

.shifty-textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f8fafc;
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.4;
  resize: none;
  max-height: 120px;
  min-height: 22px;
  padding: 2px 0;
}

.shifty-textarea::placeholder {
  color: #64748b;
}

.shifty-send-btn {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.shifty-send-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
}

.shifty-send-btn:active {
  transform: scale(0.95);
}

.shifty-send-btn.stop {
  background: #ef4444;
}

.shifty-footer-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #64748b;
  padding: 0 2px;
}

.shifty-shortcut-hint {
  display: flex;
  gap: 8px;
}

.shifty-kbd {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  font-size: 10.5px;
}

/* Quick Settings Modal inside Island */
.shifty-modal {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.95);
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
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.shifty-modal-title {
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
}

.shifty-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.shifty-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shifty-label {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
}

.shifty-input, .shifty-select {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 8px 12px;
  color: #f8fafc;
  font-size: 13px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s ease;
}

.shifty-input:focus, .shifty-select:focus {
  border-color: #818cf8;
}

.shifty-input-row {
  display: flex;
  gap: 8px;
}

.shifty-btn-primary {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border: none;
  color: white;
  padding: 9px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.shifty-btn-primary:hover {
  filter: brightness(1.1);
}

.shifty-btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.shifty-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* Resize corner handle */
.shifty-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  border-bottom-right-radius: 20px;
  background: linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.25) 50%);
}
`;

  // src/content/island.js
  (function initShiftySearch() {
    if (window.__SHIFTY_SEARCH_INITED__) return;
    window.__SHIFTY_SEARCH_INITED__ = true;
    const DEFAULT_CONFIG = {
      provider: "gemini",
      apiKey: "",
      model: "gemini-2.0-flash",
      baseUrl: "",
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      hotkeyToggle: "Alt+Shift+S",
      hotkeyResize: "Alt+Shift+Z",
      smallWidth: 420,
      smallHeight: 480,
      largeWidth: 760,
      largeHeight: 640,
      currentSize: "small",
      // 'small' | 'large'
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
    const hostEl = document.createElement("div");
    hostEl.id = "shiftysearch-host";
    const shadowRoot = hostEl.attachShadow({ mode: "open" });
    document.documentElement.appendChild(hostEl);
    const styleEl = document.createElement("style");
    styleEl.textContent = island_default;
    shadowRoot.appendChild(styleEl);
    const islandEl = document.createElement("div");
    islandEl.className = "shifty-island size-small hidden";
    islandEl.innerHTML = `
    <!-- Header -->
    <div class="shifty-header" id="shifty-header">
      <div class="shifty-brand">
        <div class="shifty-logo-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14"/>
          </svg>
        </div>
        <span class="shifty-title">ShiftySearch</span>
        <span class="shifty-model-badge" id="shifty-model-badge">Gemini</span>
      </div>
      <div class="shifty-header-actions">
        <button class="shifty-btn-icon" id="shifty-btn-clear" title="\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u0434\u0438\u0430\u043B\u043E\u0433 (\u041D\u043E\u0432\u044B\u0439 \u043F\u043E\u0438\u0441\u043A)">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>
          </svg>
        </button>
        <button class="shifty-btn-icon" id="shifty-btn-resize" title="\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 (\u0425\u043E\u0442\u043A\u0435\u0439)">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </button>
        <button class="shifty-btn-icon" id="shifty-btn-settings" title="\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
          </svg>
        </button>
        <button class="shifty-btn-icon shifty-btn-close" id="shifty-btn-close" title="\u0417\u0430\u043A\u0440\u044B\u0442\u044C (Esc)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Body / Chat area -->
    <div class="shifty-body" id="shifty-body">
      <div class="shifty-welcome" id="shifty-welcome">
        <div class="shifty-welcome-glow">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h2>ShiftySearch AI</h2>
        <p>\u041C\u0433\u043D\u043E\u0432\u0435\u043D\u043D\u044B\u0435 \u043E\u0442\u0432\u0435\u0442\u044B \u043B\u044E\u0431\u043E\u0439 \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u0438 \u0441 \u0441\u0441\u044B\u043B\u043A\u0430\u043C\u0438 \u0438 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430\u043C\u0438.</p>
        <div class="shifty-chips">
          <button class="shifty-chip" data-prompt="\u041D\u0430\u0439\u0434\u0438 \u043B\u0443\u0447\u0448\u0438\u0435 \u0441\u0442\u0430\u0442\u044C\u0438 \u0438 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u043F\u043E: ">\u{1F50D} \u041F\u043E\u0438\u0441\u043A \u0438 \u0441\u0441\u044B\u043B\u043A\u0438</button>
          <button class="shifty-chip" data-prompt="\u041A\u0440\u0430\u0442\u043A\u043E \u043E\u0431\u044A\u044F\u0441\u043D\u0438 \u0441\u0443\u0442\u044C \u043F\u0440\u043E\u0441\u0442\u044B\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438: ">\u{1F4A1} \u041E\u0431\u044A\u044F\u0441\u043D\u0438 \u043F\u0440\u043E\u0441\u0442\u044B\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438</button>
          <button class="shifty-chip" data-prompt="\u041A\u0430\u043A \u0440\u0435\u0448\u0438\u0442\u044C \u044D\u0442\u0443 \u0437\u0430\u0434\u0430\u0447\u0443 \u0432 \u043A\u043E\u0434\u0435: ">\u{1F4BB} \u041D\u0430\u043F\u0438\u0448\u0438 \u043F\u0440\u0438\u043C\u0435\u0440 \u043A\u043E\u0434\u0430</button>
        </div>
      </div>
      <div id="shifty-messages-list"></div>
    </div>

    <!-- Footer / Input -->
    <div class="shifty-footer">
      <div class="shifty-input-wrapper">
        <textarea class="shifty-textarea" id="shifty-input" rows="1" placeholder="\u0417\u0430\u0434\u0430\u0439\u0442\u0435 \u0432\u043E\u043F\u0440\u043E\u0441 \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u0438... (Shift+Enter \u0434\u043B\u044F \u043D\u043E\u0432\u043E\u0439 \u0441\u0442\u0440\u043E\u043A\u0438)"></textarea>
        <button class="shifty-send-btn" id="shifty-btn-send" title="\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C (Enter)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
      <div class="shifty-footer-meta">
        <div class="shifty-shortcut-hint">
          <span>\u0420\u0430\u0437\u043C\u0435\u0440: <span class="shifty-kbd" id="shifty-kbd-resize">Alt+Shift+Z</span></span>
          <span>\u0417\u0430\u043A\u0440\u044B\u0442\u044C: <span class="shifty-kbd">Esc</span></span>
        </div>
        <span id="shifty-status-msg"></span>
      </div>
    </div>

    <!-- In-Island Quick Settings Modal -->
    <div class="shifty-modal hidden" id="shifty-modal">
      <div class="shifty-modal-header">
        <span class="shifty-modal-title">\u2699\uFE0F \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 ShiftySearch</span>
        <button class="shifty-btn-icon" id="shifty-modal-close">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="shifty-modal-body">
        <div class="shifty-field">
          <label class="shifty-label">\u041D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u044C / \u041F\u0440\u043E\u0432\u0430\u0439\u0434\u0435\u0440</label>
          <select class="shifty-select" id="shifty-setting-provider">
            <option value="gemini">Google Gemini (Gemini 2.0 Flash / 1.5)</option>
            <option value="openai">OpenAI (ChatGPT / GPT-4o / o3-mini)</option>
            <option value="openrouter">OpenRouter (Perplexity Sonar / DeepSeek / \u0412\u0441\u0435 \u043C\u043E\u0434\u0435\u043B\u0438)</option>
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
          <small style="color: #94a3b8; font-size: 11px;" id="shifty-key-help"></small>
        </div>

        <div class="shifty-field">
          <label class="shifty-label">\u041C\u043E\u0434\u0435\u043B\u044C</label>
          <input type="text" class="shifty-input" id="shifty-setting-model" placeholder="\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: gemini-2.0-flash">
        </div>

        <div class="shifty-field" id="shifty-field-endpoint" style="display:none;">
          <label class="shifty-label">\u0411\u0430\u0437\u043E\u0432\u044B\u0439 URL (API Endpoint)</label>
          <input type="text" class="shifty-input" id="shifty-setting-baseurl" placeholder="http://localhost:11434/v1/chat/completions">
        </div>

        <div class="shifty-field">
          <label class="shifty-label">\u0413\u043E\u0440\u044F\u0447\u0438\u0435 \u043A\u043B\u0430\u0432\u0438\u0448\u0438 (In-page Hotkeys)</label>
          <div class="shifty-input-row" style="margin-bottom: 6px;">
            <span style="font-size:12px; color:#94a3b8; width: 140px; align-self:center;">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u0441\u0442\u0440\u043E\u0432\u043E\u043A:</span>
            <input type="text" class="shifty-input" id="shifty-setting-key-toggle" readonly style="flex:1; text-align:center;">
            <button class="shifty-btn-secondary" id="shifty-record-key-toggle">\u0417\u0430\u043F\u0438\u0441\u044C</button>
          </div>
          <div class="shifty-input-row">
            <span style="font-size:12px; color:#94a3b8; width: 140px; align-self:center;">\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u043C\u0430\u0441\u0448\u0442\u0430\u0431:</span>
            <input type="text" class="shifty-input" id="shifty-setting-key-resize" readonly style="flex:1; text-align:center;">
            <button class="shifty-btn-secondary" id="shifty-record-key-resize">\u0417\u0430\u043F\u0438\u0441\u044C</button>
          </div>
        </div>

        <div class="shifty-field">
          <label class="shifty-label">\u0420\u0430\u0437\u043C\u0435\u0440\u044B \u043E\u0441\u0442\u0440\u043E\u0432\u043A\u0430 (\u0428\u0438\u0440\u0438\u043D\u0430 \xD7 \u0412\u044B\u0441\u043E\u0442\u0430 px)</label>
          <div class="shifty-input-row">
            <span style="font-size:12px; color:#94a3b8; width: 70px; align-self:center;">\u041C\u0438\u043D\u0438:</span>
            <input type="number" class="shifty-input" id="shifty-setting-small-w" min="300" max="800" style="flex:1;">
            <input type="number" class="shifty-input" id="shifty-setting-small-h" min="200" max="900" style="flex:1;">
          </div>
          <div class="shifty-input-row" style="margin-top: 6px;">
            <span style="font-size:12px; color:#94a3b8; width: 70px; align-self:center;">\u0411\u043E\u043B\u044C\u0448\u043E\u0439:</span>
            <input type="number" class="shifty-input" id="shifty-setting-large-w" min="400" max="1400" style="flex:1;">
            <input type="number" class="shifty-input" id="shifty-setting-large-h" min="300" max="1200" style="flex:1;">
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="shifty-btn-primary" id="shifty-btn-save-settings" style="flex: 1;">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</button>
          <button class="shifty-btn-secondary" id="shifty-btn-open-options">\u041F\u043E\u043B\u043D\u044B\u0435 \u043E\u043F\u0446\u0438\u0438 \u2197</button>
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
    const bodyEl = shadowRoot.getElementById("shifty-body");
    const welcomeEl = shadowRoot.getElementById("shifty-welcome");
    const messagesListEl = shadowRoot.getElementById("shifty-messages-list");
    const modelBadgeEl = shadowRoot.getElementById("shifty-model-badge");
    const modalEl = shadowRoot.getElementById("shifty-modal");
    const modalCloseBtn = shadowRoot.getElementById("shifty-modal-close");
    const resizeHandle = shadowRoot.getElementById("shifty-resize-handle");
    const kbdResizeEl = shadowRoot.getElementById("shifty-kbd-resize");
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
    function loadConfig() {
      chrome.storage.local.get(DEFAULT_CONFIG, (stored) => {
        config = { ...DEFAULT_CONFIG, ...stored };
        applyConfigToStyles();
        updateModelBadge();
        restorePosition();
      });
    }
    function applyConfigToStyles() {
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
        const newW = Math.max(320, startW + (moveEvent.clientX - startX));
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
      inputEl.style.height = `${Math.min(120, inputEl.scrollHeight)}px`;
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
    btnClear.addEventListener("click", clearChat);
    btnSettings.addEventListener("click", openSettingsModal);
    shadowRoot.querySelectorAll(".shifty-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const prompt = chip.getAttribute("data-prompt");
        inputEl.value = prompt;
        inputEl.focus();
        inputEl.style.height = "auto";
        inputEl.style.height = `${Math.min(120, inputEl.scrollHeight)}px`;
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
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
      `;
      } else {
        btnSend.classList.remove("stop");
        btnSend.title = "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C (Enter)";
        btnSend.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
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
        alert("\u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0432\u0432\u0435\u0434\u0438\u0442\u0435 API-\u043A\u043B\u044E\u0447 \u0434\u043B\u044F \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u0438 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445!");
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
          contentEl.innerHTML = `<span style="color:#f87171;">\u26A0\uFE0F ${err.message || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043A \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u0438"}</span>`;
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
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span>\u041D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0435 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u0438 \u0441\u0441\u044B\u043B\u043A\u0438 (${links.length})</span>
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
            btn.textContent = "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E!";
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
      updateProviderFields();
      modalEl.classList.remove("hidden");
    }
    function updateProviderFields() {
      const provId = selectProvider.value;
      const prov = PROVIDERS[provId] || PROVIDERS.gemini;
      fieldEndpoint.style.display = provId === "custom" ? "flex" : "none";
      if (!inputModel.value || Object.values(PROVIDERS).some((p) => p.models.includes(inputModel.value))) {
        inputModel.value = prov.defaultModel;
      }
      inputApiKey.placeholder = prov.keyPlaceholder || "API-\u043A\u043B\u044E\u0447...";
      if (prov.keyHelpUrl) {
        keyHelpEl.innerHTML = `<a href="${prov.keyHelpUrl}" target="_blank" style="color:#818cf8; text-decoration:underline;">\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C API-\u043A\u043B\u044E\u0447 \u0434\u043B\u044F ${prov.name} \u2197</a>`;
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
      config.provider = selectProvider.value;
      config.apiKey = inputApiKey.value.trim();
      config.model = inputModel.value.trim();
      config.baseUrl = inputBaseUrl.value.trim();
      config.hotkeyToggle = inputKeyToggle.value.trim() || "Alt+Shift+S";
      config.hotkeyResize = inputKeyResize.value.trim() || "Alt+Shift+Z";
      config.smallWidth = parseInt(inputSmallW.value, 10) || 420;
      config.smallHeight = parseInt(inputSmallH.value, 10) || 480;
      config.largeWidth = parseInt(inputLargeW.value, 10) || 760;
      config.largeHeight = parseInt(inputLargeH.value, 10) || 640;
      chrome.storage.local.set({
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
        applyConfigToStyles();
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
