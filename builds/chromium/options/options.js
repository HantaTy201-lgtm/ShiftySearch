(() => {
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

  // src/options/options.js
  document.addEventListener("DOMContentLoaded", () => {
    const providerSelect = document.getElementById("provider-select");
    const apiKeyInput = document.getElementById("api-key-input");
    const btnToggleKey = document.getElementById("btn-toggle-key-visibility");
    const btnTestKey = document.getElementById("btn-test-key");
    const testKeyResult = document.getElementById("test-key-result");
    const keyHelpLink = document.getElementById("key-help-link");
    const modelInput = document.getElementById("model-input");
    const modelPresetsContainer = document.getElementById("model-presets");
    const baseUrlInput = document.getElementById("base-url-input");
    const endpointGroup = document.getElementById("endpoint-group");
    const hotkeyToggleInput = document.getElementById("hotkey-toggle-input");
    const btnRecordToggle = document.getElementById("btn-record-toggle");
    const hotkeyResizeInput = document.getElementById("hotkey-resize-input");
    const btnRecordResize = document.getElementById("btn-record-resize");
    const dimSmallW = document.getElementById("dim-small-w");
    const dimSmallH = document.getElementById("dim-small-h");
    const dimLargeW = document.getElementById("dim-large-w");
    const dimLargeH = document.getElementById("dim-large-h");
    const checkAutoSend = document.getElementById("check-auto-send");
    const systemPromptInput = document.getElementById("system-prompt-input");
    const btnResetPrompt = document.getElementById("btn-reset-prompt");
    const btnSaveAll = document.getElementById("btn-save-all");
    const saveStatusMsg = document.getElementById("save-status-msg");
    const DEFAULTS = {
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
      autoSendSelection: true
    };
    chrome.storage.local.get(DEFAULTS, (data) => {
      providerSelect.value = data.provider || "gemini";
      apiKeyInput.value = data.apiKey || "";
      modelInput.value = data.model || "gemini-2.0-flash";
      baseUrlInput.value = data.baseUrl || "";
      hotkeyToggleInput.value = data.hotkeyToggle || "Alt+Shift+S";
      hotkeyResizeInput.value = data.hotkeyResize || "Alt+Shift+Z";
      dimSmallW.value = data.smallWidth || 420;
      dimSmallH.value = data.smallHeight || 480;
      dimLargeW.value = data.largeWidth || 760;
      dimLargeH.value = data.largeHeight || 640;
      checkAutoSend.checked = data.autoSendSelection !== false;
      systemPromptInput.value = data.systemPrompt || DEFAULT_SYSTEM_PROMPT;
      updateProviderUI();
    });
    function updateProviderUI() {
      const provId = providerSelect.value;
      const prov = PROVIDERS[provId] || PROVIDERS.gemini;
      if (provId === "custom") {
        endpointGroup.style.display = "flex";
        if (!baseUrlInput.value) baseUrlInput.value = prov.defaultUrl;
      } else {
        endpointGroup.style.display = "none";
      }
      apiKeyInput.placeholder = prov.keyPlaceholder;
      if (prov.keyHelpUrl) {
        keyHelpLink.innerHTML = `<a href="${prov.keyHelpUrl}" target="_blank" style="color:#818cf8; text-decoration:underline;">\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043A\u043B\u044E\u0447 \u0434\u043B\u044F ${prov.name} \u2197</a>`;
      } else {
        keyHelpLink.innerHTML = "";
      }
      modelPresetsContainer.innerHTML = "";
      prov.models.forEach((m) => {
        const chip = document.createElement("span");
        chip.className = "shifty-preset-chip";
        chip.textContent = m;
        chip.addEventListener("click", () => {
          modelInput.value = m;
        });
        modelPresetsContainer.appendChild(chip);
      });
      if (!modelInput.value || Object.values(PROVIDERS).some((p) => p.models.includes(modelInput.value))) {
        modelInput.value = prov.defaultModel;
      }
    }
    providerSelect.addEventListener("change", updateProviderUI);
    btnToggleKey.addEventListener("click", () => {
      if (apiKeyInput.type === "password") {
        apiKeyInput.type = "text";
        btnToggleKey.textContent = "\u0421\u043A\u0440\u044B\u0442\u044C";
      } else {
        apiKeyInput.type = "password";
        btnToggleKey.textContent = "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C";
      }
    });
    btnTestKey.addEventListener("click", async () => {
      const key = apiKeyInput.value.trim();
      const provider = providerSelect.value;
      if (!key && provider !== "custom") {
        testKeyResult.innerHTML = '<span style="color:#ef4444;">\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043A\u043B\u044E\u0447!</span>';
        return;
      }
      testKeyResult.innerHTML = '<span style="color:#94a3b8;">\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430...</span>';
      try {
        await sendAiRequest({
          provider,
          apiKey: key,
          model: modelInput.value.trim(),
          baseUrl: baseUrlInput.value.trim(),
          systemPrompt: 'Respond with "OK"',
          messages: [{ role: "user", content: "Ping" }],
          onDone: () => {
            testKeyResult.innerHTML = '<span style="color:#10b981;">\u2705 \u041A\u043B\u044E\u0447 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043E\u0442\u043B\u0438\u0447\u043D\u043E!</span>';
          },
          onError: (err) => {
            testKeyResult.innerHTML = `<span style="color:#ef4444;">\u274C \u041E\u0448\u0438\u0431\u043A\u0430: ${err.message}</span>`;
          }
        });
      } catch (e) {
        testKeyResult.innerHTML = `<span style="color:#ef4444;">\u274C \u041E\u0448\u0438\u0431\u043A\u0430: ${e.message}</span>`;
      }
    });
    function setupKeyRecorder(button, inputField) {
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
          inputField.value = parts.join("+");
          button.textContent = "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C";
          recording = false;
          window.removeEventListener("keydown", handler, true);
        }
        window.addEventListener("keydown", handler, true);
      });
    }
    setupKeyRecorder(btnRecordToggle, hotkeyToggleInput);
    setupKeyRecorder(btnRecordResize, hotkeyResizeInput);
    btnResetPrompt.addEventListener("click", () => {
      if (confirm("\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439 \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0439 \u043F\u0440\u043E\u043C\u043F\u0442?")) {
        systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
      }
    });
    btnSaveAll.addEventListener("click", () => {
      const newConfig = {
        provider: providerSelect.value,
        apiKey: apiKeyInput.value.trim(),
        model: modelInput.value.trim(),
        baseUrl: baseUrlInput.value.trim(),
        hotkeyToggle: hotkeyToggleInput.value.trim() || "Alt+Shift+S",
        hotkeyResize: hotkeyResizeInput.value.trim() || "Alt+Shift+Z",
        smallWidth: parseInt(dimSmallW.value, 10) || 420,
        smallHeight: parseInt(dimSmallH.value, 10) || 480,
        largeWidth: parseInt(dimLargeW.value, 10) || 760,
        largeHeight: parseInt(dimLargeH.value, 10) || 640,
        autoSendSelection: checkAutoSend.checked,
        systemPrompt: systemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT
      };
      chrome.storage.local.set(newConfig, () => {
        saveStatusMsg.className = "shifty-save-msg success";
        saveStatusMsg.textContent = "\u2728 \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B!";
        setTimeout(() => {
          saveStatusMsg.textContent = "";
        }, 3500);
      });
    });
  });
})();
