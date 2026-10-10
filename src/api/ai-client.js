// src/api/ai-client.js
// Universal AI Client for ShiftySearch
// Supports Google Gemini (Native API & AI Studio), OpenAI, Anthropic, OpenRouter, Groq, DeepSeek, and Custom endpoints.

export const PROVIDERS = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter (Работает БЕЗ VPN, Бесплатно)',
    defaultModel: 'google/gemini-2.0-flash-exp:free',
    models: [
      'google/gemini-2.0-flash-exp:free',
      'deepseek/deepseek-chat',
      'meta-llama/llama-3.3-70b-instruct:free',
      'perplexity/sonar',
      'openai/gpt-4o-mini'
    ],
    defaultUrl: 'https://openrouter.ai/api/v1/chat/completions',
    keyPlaceholder: 'sk-or-v1-...',
    keyHelpUrl: 'https://openrouter.ai/keys'
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini (Нужен VPN в РФ)',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    defaultUrl: '',
    keyPlaceholder: 'AIzaSy...',
    keyHelpUrl: 'https://aistudio.google.com/app/apikey'
  },
  groq: {
    id: 'groq',
    name: 'Groq (Llama 3.3, нужен VPN в РФ)',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultUrl: 'https://api.groq.com/openai/v1/chat/completions',
    keyPlaceholder: 'gsk_...',
    keyHelpUrl: 'https://console.groq.com/keys'
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'gpt-3.5-turbo'],
    defaultUrl: 'https://api.openai.com/v1/chat/completions',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys'
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    defaultUrl: 'https://api.anthropic.com/v1/messages',
    keyPlaceholder: 'sk-ant-...',
    keyHelpUrl: 'https://console.anthropic.com/settings/keys'
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultUrl: 'https://api.deepseek.com/chat/completions',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.deepseek.com/api_keys'
  },
  custom: {
    id: 'custom',
    name: 'Пользовательский (Ollama / Local / Proxy)',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'mistral', 'qwen2.5'],
    defaultUrl: 'http://localhost:11434/v1/chat/completions',
    keyPlaceholder: 'Не требуется (или ollama)',
    keyHelpUrl: ''
  }
};

export const DEFAULT_SYSTEM_PROMPT = `Ты — полезный, умный и быстрый AI-ассистент ShiftySearch, встроенный в браузер.
Отвечай структурированно, точно и красиво, используя Markdown.
Если пользователь задает вопрос о поиске информации, коде или фактах — дай четкий исчерпывающий ответ.

В САМОМ КОНЦЕ ответа ВСЕГДА добавь отдельный блок:
### 🔗 Полезные источники и ссылки
Включи от 2 до 5 релевантных кликабельных ссылок в формате:
- [Название сайта/документа](https://прямой-url) — краткое описание
Если точной ссылки нет, сформируй поисковую ссылку:
- [Поиск в Google](https://www.google.com/search?q=...) — поисковый запрос`;

/**
 * Universal Stream caller for LLM API
 */
export async function sendAiRequest({
  provider = 'gemini',
  apiKey = '',
  model = '',
  baseUrl = '',
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  messages = [],
  onChunk = () => {},
  onDone = () => {},
  onError = () => {},
  signal = null
}) {
  const providerConfig = PROVIDERS[provider] || PROVIDERS.gemini;
  const cleanKey = (apiKey || '').trim();
  const activeModel = (model && model.trim().length > 0) ? model.trim() : providerConfig.defaultModel;

  if (!cleanKey && provider !== 'custom') {
    const err = new Error(`Пожалуйста, укажите API-ключ для ${providerConfig.name} в настройках ShiftySearch.`);
    onError(err);
    return;
  }

  try {
    if (provider === 'gemini') {
      await callGeminiNativeStream({
        apiKey: cleanKey,
        model: activeModel,
        baseUrl,
        systemPrompt,
        messages,
        onChunk,
        onDone,
        onError,
        signal
      });
    } else if (provider === 'anthropic') {
      await callAnthropicStream({
        endpoint: (baseUrl && baseUrl.trim().length > 0) ? baseUrl.trim() : providerConfig.defaultUrl,
        apiKey: cleanKey,
        model: activeModel,
        systemPrompt,
        messages,
        onChunk,
        onDone,
        onError,
        signal
      });
    } else {
      // Standard OpenAI format (OpenAI, OpenRouter, Groq, DeepSeek, Custom/Ollama)
      await callOpenAiCompatibleStream({
        endpoint: (baseUrl && baseUrl.trim().length > 0) ? baseUrl.trim() : providerConfig.defaultUrl,
        apiKey: cleanKey,
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
    if (err.name === 'AbortError') {
      onDone();
      return;
    }
    let msg = err.message || 'Неизвестная ошибка';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      msg = 'Не удалось подключиться к серверу нейросети (NetworkError / Failed to fetch). Если вы в РФ — для прямого Gemini и Groq обязательно нужен VPN, либо выберите OpenRouter в настройках ShiftySearch (он работает без VPN).';
    }
    onError(new Error(msg));
  }
}

/**
 * Native Google Gemini API Streaming (Google AI Studio Keys AIzaSy...)
 */
async function callGeminiNativeStream({
  apiKey,
  model,
  baseUrl,
  systemPrompt,
  messages,
  onChunk,
  onDone,
  onError,
  signal
}) {
  const cleanKey = apiKey.trim();
  let activeModel = model.trim() || 'gemini-2.0-flash';
  // Remove any prefix if user typed 'models/gemini-...'
  activeModel = activeModel.replace(/^models\//, '');

  let endpoint = '';
  if (baseUrl && baseUrl.trim().length > 0 && !baseUrl.includes('openai/chat/completions')) {
    endpoint = baseUrl.trim();
    if (!endpoint.includes('key=')) {
      endpoint += (endpoint.includes('?') ? '&' : '?') + `key=${encodeURIComponent(cleanKey)}&alt=sse`;
    }
  } else {
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModel)}:streamGenerateContent?key=${encodeURIComponent(cleanKey)}&alt=sse`;
  }

  // Convert messages for Gemini: role must be 'user' or 'model'
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.7
    }
  };

  if (systemPrompt && systemPrompt.trim()) {
    payload.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': cleanKey
    },
    signal,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      if (Array.isArray(errJson) && errJson[0]?.error?.message) {
        errorDetail = errJson[0].error.message;
      } else if (errJson.error?.message) {
        errorDetail = errJson.error.message;
      } else {
        errorDetail = JSON.stringify(errJson);
      }
    } catch {
      errorDetail = await response.text();
    }

    if (response.status === 401 || errorDetail.includes('invalid authentication credentials') || errorDetail.includes('UNAUTHENTICATED')) {
      throw new Error('Ключ API не авторизован (Ошибка 401). Причины: 1) В РФ/СНГ прямой доступ к Gemini заблокирован Google (включите VPN или выберите OpenRouter в настройках). 2) В Google AI Studio (aistudio.google.com/app/apikey) обязательно создавайте ключ через кнопку «Create API key in new project».');
    }
    if (errorDetail.includes('API_KEY_INVALID') || errorDetail.includes('API key not valid')) {
      throw new Error('API-ключ Google Gemini недействителен. Убедитесь, что скопировали ключ полностью из Google AI Studio (aistudio.google.com/app/apikey).');
    }
    if (errorDetail.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Превышен лимит запросов Google Gemini. Подождите 1 минуту или выберите модель gemini-1.5-flash.');
    }
    if (response.status === 403 || errorDetail.includes('User location is not supported')) {
      throw new Error('Google Gemini недоступен в вашем регионе без VPN (Ошибка 403 / Location not supported). Включите VPN или выберите OpenRouter в настройках ShiftySearch (OpenRouter работает без VPN).');
    }

    throw new Error(`Ошибка Gemini API (${response.status}): ${errorDetail || response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (chunkText) {
            fullText += chunkText;
            onChunk(chunkText, fullText);
          }
        } catch {
          // Ignore partial JSON parse chunks
        }
      }
    }
  }

  onDone(fullText);
}

/**
 * OpenAI-compatible SSE Stream
 */
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
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/HantaTy201-lgtm/ShiftySearch';
    headers['X-Title'] = 'ShiftySearch Browser Extension';
  }

  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'omit',
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
    let errorDetail = '';
    try {
      const errJson = await response.json();
      if (Array.isArray(errJson) && errJson[0]?.error?.message) {
        errorDetail = errJson[0].error.message;
      } else if (errJson.error?.message) {
        errorDetail = errJson.error.message;
      } else {
        errorDetail = JSON.stringify(errJson);
      }
    } catch {
      errorDetail = await response.text();
    }
    if (response.status === 403 || (errorDetail && errorDetail.toLowerCase().includes('forbidden'))) {
      if (provider === 'groq') {
        throw new Error('Groq блокирует запросы без VPN (Ошибка 403 Forbidden). Включите VPN в браузере или переключитесь в настройках на OpenRouter (он работает без VPN и предоставляет бесплатные модели Gemini и Llama).');
      }
      throw new Error(`Доступ заблокирован сервером (Ошибка 403 Forbidden). Если вы находитесь в РФ/СНГ, включите VPN или выберите OpenRouter в настройках ShiftySearch.`);
    }

    if (response.status === 401) {
      throw new Error(`Неверный API-ключ (${response.status}): проверьте правильность ключа для ${provider}.`);
    }

    throw new Error(`Ошибка API (${response.status}): ${errorDetail || response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Ответ сервера пуст');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;

      if (trimmed === 'data: [DONE]') {
        onDone(fullText);
        return;
      }

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            onChunk(delta, fullText);
          }
        } catch {
          // Ignore partial JSON
        }
      }
    }
  }

  onDone(fullText);
}

/**
 * Anthropic Messages Stream
 */
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
    'Content-Type': 'application/json',
    'x-api-key': apiKey.trim(),
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  };

  const anthropicMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));

  const response = await fetch(endpoint, {
    method: 'POST',
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
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Ошибка Claude API (${response.status}): ${errorDetail || response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const jsonStr = trimmed.slice(6);
      try {
        const event = JSON.parse(jsonStr);
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const delta = event.delta.text || '';
          fullText += delta;
          onChunk(delta, fullText);
        } else if (event.type === 'message_stop') {
          onDone(fullText);
          return;
        }
      } catch {
        // Continue
      }
    }
  }

  onDone(fullText);
}
