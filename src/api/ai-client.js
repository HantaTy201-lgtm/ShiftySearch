// src/api/ai-client.js
// Universal AI Client for ShiftySearch
// Supports OpenAI, Anthropic, Gemini, OpenRouter, Groq, DeepSeek, and Custom OpenAI-compatible endpoints.

export const PROVIDERS = {
  openai: {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'gpt-3.5-turbo'],
    defaultUrl: 'https://api.openai.com/v1/chat/completions',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys'
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyPlaceholder: 'AIzaSy...',
    keyHelpUrl: 'https://aistudio.google.com/app/apikey'
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
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter (All Models + Perplexity)',
    defaultModel: 'perplexity/sonar',
    models: [
      'perplexity/sonar',
      'deepseek/deepseek-chat',
      'deepseek/deepseek-r1',
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.0-flash-exp:free',
      'openai/gpt-4o-mini'
    ],
    defaultUrl: 'https://openrouter.ai/api/v1/chat/completions',
    keyPlaceholder: 'sk-or-v1-...',
    keyHelpUrl: 'https://openrouter.ai/keys'
  },
  groq: {
    id: 'groq',
    name: 'Groq (Ultra-fast)',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultUrl: 'https://api.groq.com/openai/v1/chat/completions',
    keyPlaceholder: 'gsk_...',
    keyHelpUrl: 'https://console.groq.com/keys'
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
    name: 'Custom (Ollama / Local / Proxy)',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'mistral', 'qwen2.5'],
    defaultUrl: 'http://localhost:11434/v1/chat/completions',
    keyPlaceholder: 'Optional key (or ollama)',
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
  provider = 'openai',
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
  const providerConfig = PROVIDERS[provider] || PROVIDERS.openai;
  const endpoint = (baseUrl && baseUrl.trim().length > 0) ? baseUrl.trim() : providerConfig.defaultUrl;
  const activeModel = (model && model.trim().length > 0) ? model.trim() : providerConfig.defaultModel;

  if (!apiKey && provider !== 'custom') {
    const err = new Error(`Пожалуйста, укажите API-ключ для ${providerConfig.name} в настройках ShiftySearch.`);
    onError(err);
    return;
  }

  try {
    if (provider === 'anthropic') {
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
      // Standard OpenAI format (Works for OpenAI, Gemini OpenAI API, OpenRouter, Groq, DeepSeek, Ollama/Custom)
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
    if (err.name === 'AbortError') {
      onDone();
      return;
    }
    onError(err);
  }
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

  // Prepend system prompt
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
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
      errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Ошибка API (${response.status}): ${errorDetail || response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Ответ сервера не содержит данных (Body is empty)');
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
      if (!trimmed || trimmed.startsWith(':')) continue; // SSE comment or ping

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
          // Incomplete chunk or raw string, ignore parse errors
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

  // Convert messages for Anthropic (alternating user/assistant)
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
        // Continue parsing
      }
    }
  }

  onDone(fullText);
}
