// src/options/options.js
import { PROVIDERS, DEFAULT_SYSTEM_PROMPT, sendAiRequest } from '../api/ai-client.js';

const PRESET_COLORS = [
  { name: 'Монохром', hex: '#18181b' },
  { name: 'Синий', hex: '#2563eb' },
  { name: 'Изумрудный', hex: '#10b981' },
  { name: 'Фиолетовый', hex: '#8b5cf6' },
  { name: 'Оранжевый', hex: '#f97316' },
  { name: 'Розовый', hex: '#ec4899' },
  { name: 'Графит', hex: '#475569' }
];

document.addEventListener('DOMContentLoaded', () => {
  const themeSelect = document.getElementById('theme-select');
  const swatchesContainer = document.getElementById('options-color-swatches');
  const customColorInput = document.getElementById('options-custom-color');
  const customColorHexInput = document.getElementById('options-custom-color-hex');
  const optionsLogo = document.getElementById('options-logo');

  const providerSelect = document.getElementById('provider-select');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnToggleKey = document.getElementById('btn-toggle-key-visibility');
  const btnTestKey = document.getElementById('btn-test-key');
  const testKeyResult = document.getElementById('test-key-result');
  const keyHelpLink = document.getElementById('key-help-link');
  const modelInput = document.getElementById('model-input');
  const modelPresetsContainer = document.getElementById('model-presets');
  const baseUrlInput = document.getElementById('base-url-input');
  const endpointGroup = document.getElementById('endpoint-group');
  const hotkeyToggleInput = document.getElementById('hotkey-toggle-input');
  const btnRecordToggle = document.getElementById('btn-record-toggle');
  const hotkeyResizeInput = document.getElementById('hotkey-resize-input');
  const btnRecordResize = document.getElementById('btn-record-resize');
  const dimSmallW = document.getElementById('dim-small-w');
  const dimSmallH = document.getElementById('dim-small-h');
  const dimLargeW = document.getElementById('dim-large-w');
  const dimLargeH = document.getElementById('dim-large-h');
  const checkAutoSend = document.getElementById('check-auto-send');
  const systemPromptInput = document.getElementById('system-prompt-input');
  const btnResetPrompt = document.getElementById('btn-reset-prompt');
  const btnSaveAll = document.getElementById('btn-save-all');
  const saveStatusMsg = document.getElementById('save-status-msg');

  const DEFAULTS = {
    theme: 'dark',
    accentColor: '#2563eb',
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-1.5-flash',
    baseUrl: '',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    hotkeyToggle: 'Alt+Shift+S',
    hotkeyResize: 'Alt+Shift+Z',
    smallWidth: 400,
    smallHeight: 480,
    largeWidth: 740,
    largeHeight: 640,
    autoSendSelection: true
  };

  let activeAccent = '#2563eb';

  function getContrastColor(hex) {
    if (!hex) return '#ffffff';
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const r = parseInt(c.substr(0, 2), 16) || 0;
    const g = parseInt(c.substr(2, 2), 16) || 0;
    const b = parseInt(c.substr(4, 2), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#09090b' : '#ffffff';
  }

  function applyThemeLive(theme, accent) {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');

    activeAccent = accent;
    document.documentElement.style.setProperty('--accent-color', accent);
    document.documentElement.style.setProperty('--accent-contrast', getContrastColor(accent));

    if (customColorInput) customColorInput.value = accent;
    if (customColorHexInput) customColorHexInput.value = accent.toUpperCase();

    renderSwatches();
  }

  function renderSwatches() {
    swatchesContainer.innerHTML = '';
    PRESET_COLORS.forEach(c => {
      const el = document.createElement('div');
      el.className = `shifty-swatch ${activeAccent.toLowerCase() === c.hex.toLowerCase() ? 'active' : ''}`;
      el.style.backgroundColor = c.hex;
      el.title = c.name;
      el.addEventListener('click', () => {
        applyThemeLive(themeSelect.value, c.hex);
      });
      swatchesContainer.appendChild(el);
    });
  }

  themeSelect.addEventListener('change', () => {
    applyThemeLive(themeSelect.value, activeAccent);
  });

  customColorInput.addEventListener('input', (e) => {
    applyThemeLive(themeSelect.value, e.target.value);
  });

  customColorHexInput.addEventListener('change', (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      applyThemeLive(themeSelect.value, val);
    }
  });

  // 1. Load saved preferences
  chrome.storage.local.get(DEFAULTS, (data) => {
    themeSelect.value = data.theme || 'dark';
    activeAccent = data.accentColor || '#2563eb';
    applyThemeLive(themeSelect.value, activeAccent);

    providerSelect.value = data.provider || 'gemini';
    apiKeyInput.value = data.apiKey || '';
    modelInput.value = data.model || 'gemini-2.0-flash';
    baseUrlInput.value = data.baseUrl || '';
    hotkeyToggleInput.value = data.hotkeyToggle || 'Alt+Shift+S';
    hotkeyResizeInput.value = data.hotkeyResize || 'Alt+Shift+Z';
    dimSmallW.value = data.smallWidth || 400;
    dimSmallH.value = data.smallHeight || 480;
    dimLargeW.value = data.largeWidth || 740;
    dimLargeH.value = data.largeHeight || 640;
    checkAutoSend.checked = data.autoSendSelection !== false;
    systemPromptInput.value = data.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    updateProviderUI();
  });

  // 2. Provider change handler
  function updateProviderUI() {
    const provId = providerSelect.value;
    const prov = PROVIDERS[provId] || PROVIDERS.gemini;

    if (provId === 'custom') {
      endpointGroup.style.display = 'flex';
      if (!baseUrlInput.value) baseUrlInput.value = prov.defaultUrl;
    } else {
      endpointGroup.style.display = 'none';
    }

    apiKeyInput.placeholder = prov.keyPlaceholder;
    if (prov.keyHelpUrl) {
      keyHelpLink.innerHTML = `<a href="${prov.keyHelpUrl}" target="_blank" style="color:var(--accent-color); text-decoration:underline;">Получить ключ для ${prov.name} ↗</a>`;
    } else {
      keyHelpLink.innerHTML = '';
    }

    modelPresetsContainer.innerHTML = '';
    prov.models.forEach(m => {
      const chip = document.createElement('span');
      chip.className = 'shifty-preset-chip';
      chip.textContent = m;
      chip.addEventListener('click', () => {
        modelInput.value = m;
      });
      modelPresetsContainer.appendChild(chip);
    });

    if (!modelInput.value || Object.values(PROVIDERS).some(p => p.models.includes(modelInput.value))) {
      modelInput.value = prov.defaultModel;
    }
  }

  providerSelect.addEventListener('change', updateProviderUI);

  // 3. Toggle password visibility
  btnToggleKey.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      btnToggleKey.textContent = 'Скрыть';
    } else {
      apiKeyInput.type = 'password';
      btnToggleKey.textContent = 'Показать';
    }
  });

  // 4. Test API Key
  btnTestKey.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    const provider = providerSelect.value;
    if (!key && provider !== 'custom') {
      testKeyResult.innerHTML = '<span style="color:#ef4444;">Введите ключ!</span>';
      return;
    }

    testKeyResult.innerHTML = '<span style="color:var(--text-muted);">Проверка...</span>';

    try {
      await sendAiRequest({
        provider,
        apiKey: key,
        model: modelInput.value.trim(),
        baseUrl: baseUrlInput.value.trim(),
        systemPrompt: 'Respond with "OK"',
        messages: [{ role: 'user', content: 'Ping' }],
        onDone: () => {
          testKeyResult.innerHTML = '<span style="color:#10b981;">✅ Ключ работает!</span>';
        },
        onError: (err) => {
          testKeyResult.innerHTML = `<span style="color:#ef4444;">❌ Ошибка: ${err.message}</span>`;
        }
      });
    } catch (e) {
      testKeyResult.innerHTML = `<span style="color:#ef4444;">❌ Ошибка: ${e.message}</span>`;
    }
  });

  // 5. Hotkey Recorders
  function setupKeyRecorder(button, inputField) {
    let recording = false;
    button.addEventListener('click', () => {
      if (recording) return;
      recording = true;
      button.textContent = 'Нажмите клавиши...';
      inputField.value = 'Слушаю...';

      function handler(e) {
        e.preventDefault();
        e.stopPropagation();

        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

        const parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Cmd');

        const keyName = (e.code === 'Space') ? 'Space' : e.key.toUpperCase();
        parts.push(keyName);

        inputField.value = parts.join('+');
        button.textContent = 'Записать';
        recording = false;
        window.removeEventListener('keydown', handler, true);
      }

      window.addEventListener('keydown', handler, true);
    });
  }

  setupKeyRecorder(btnRecordToggle, hotkeyToggleInput);
  setupKeyRecorder(btnRecordResize, hotkeyResizeInput);

  // 6. Reset System Prompt
  btnResetPrompt.addEventListener('click', () => {
    if (confirm('Восстановить стандартный системный промпт?')) {
      systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
    }
  });

  // 7. Save All Options
  btnSaveAll.addEventListener('click', () => {
    const newConfig = {
      theme: themeSelect.value,
      accentColor: activeAccent,
      provider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim(),
      baseUrl: baseUrlInput.value.trim(),
      hotkeyToggle: hotkeyToggleInput.value.trim() || 'Alt+Shift+S',
      hotkeyResize: hotkeyResizeInput.value.trim() || 'Alt+Shift+Z',
      smallWidth: parseInt(dimSmallW.value, 10) || 400,
      smallHeight: parseInt(dimSmallH.value, 10) || 480,
      largeWidth: parseInt(dimLargeW.value, 10) || 740,
      largeHeight: parseInt(dimLargeH.value, 10) || 640,
      autoSendSelection: checkAutoSend.checked,
      systemPrompt: systemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT
    };

    chrome.storage.local.set(newConfig, () => {
      saveStatusMsg.className = 'shifty-save-msg success';
      saveStatusMsg.textContent = '✨ Настройки сохранены!';
      setTimeout(() => {
        saveStatusMsg.textContent = '';
      }, 3000);
    });
  });
});
