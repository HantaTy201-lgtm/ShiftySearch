// src/content/island.js
// ShiftySearch Floating Island Component (Minimalist Black & White + Custom Accent Colors)

import { renderMarkdown, extractLinks } from './markdown.js';
import { sendAiRequest, PROVIDERS, DEFAULT_SYSTEM_PROMPT } from '../api/ai-client.js';
import islandCss from './island.css';

(function initShiftySearch() {
  if (window.__SHIFTY_SEARCH_INITED__) return;
  window.__SHIFTY_SEARCH_INITED__ = true;

  // Preset accent colors
  const PRESET_COLORS = [
    { name: 'Монохром', hex: '#18181b' },
    { name: 'Синий', hex: '#2563eb' },
    { name: 'Изумрудный', hex: '#10b981' },
    { name: 'Фиолетовый', hex: '#8b5cf6' },
    { name: 'Оранжевый', hex: '#f97316' },
    { name: 'Розовый', hex: '#ec4899' },
    { name: 'Графит', hex: '#475569' }
  ];

  // Default configuration
  const DEFAULT_CONFIG = {
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
    currentSize: 'small', // 'small' | 'large'
    theme: 'dark',        // 'dark' | 'light'
    accentColor: '#2563eb',
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

  // Helper to determine readable text contrast for user-chosen accent color
  function getContrastColor(hex) {
    if (!hex) return '#ffffff';
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const r = parseInt(c.substr(0, 2), 16) || 0;
    const g = parseInt(c.substr(2, 2), 16) || 0;
    const b = parseInt(c.substr(4, 2), 16) || 0;
    // Perceived luminance formula
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#09090b' : '#ffffff';
  }

  // 1. Create Host Element and Shadow Root
  const hostEl = document.createElement('div');
  hostEl.id = 'shiftysearch-host';
  const shadowRoot = hostEl.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(hostEl);

  // 2. Apply CSS directly into Shadow DOM (CSP-proof)
  const styleEl = document.createElement('style');
  styleEl.textContent = islandCss;
  shadowRoot.appendChild(styleEl);

  // 3. Create Island DOM Structure
  const islandEl = document.createElement('div');
  islandEl.className = 'shifty-island size-small theme-dark hidden';
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
        <button class="shifty-btn-icon" id="shifty-btn-theme" title="Сменить тему (Светлая / Темная)">
          <svg id="shifty-icon-theme" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <!-- Rendered dynamically -->
          </svg>
        </button>
        <button class="shifty-btn-icon" id="shifty-btn-clear" title="Очистить диалог">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>
          </svg>
        </button>
        <button class="shifty-btn-icon" id="shifty-btn-resize" title="Изменить масштаб">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </button>
        <button class="shifty-btn-icon" id="shifty-btn-settings" title="Настройки">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
          </svg>
        </button>
        <button class="shifty-btn-icon shifty-btn-close" id="shifty-btn-close" title="Закрыть (Esc)">
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
        <p>Минималистичный AI-помощник с поиском источников и ссылок.</p>
        <div class="shifty-chips">
          <button class="shifty-chip" data-prompt="Найди лучшие статьи и источники по: ">🔍 Поиск и ссылки</button>
          <button class="shifty-chip" data-prompt="Кратко объясни суть: ">💡 Объясни суть</button>
          <button class="shifty-chip" data-prompt="Как написать код для: ">💻 Пример кода</button>
        </div>
      </div>
      <div id="shifty-messages-list"></div>
    </div>

    <!-- Footer / Input -->
    <div class="shifty-footer">
      <div class="shifty-input-wrapper">
        <textarea class="shifty-textarea" id="shifty-input" rows="1" placeholder="Задайте вопрос нейросети..."></textarea>
        <button class="shifty-send-btn" id="shifty-btn-send" title="Отправить (Enter)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
      <div class="shifty-footer-meta">
        <div class="shifty-shortcut-hint">
          <span>Масштаб: <span class="shifty-kbd" id="shifty-kbd-resize">Alt+Shift+Z</span></span>
          <span>Закрыть: <span class="shifty-kbd">Esc</span></span>
        </div>
        <span id="shifty-status-msg"></span>
      </div>
    </div>

    <!-- In-Island Quick Settings Modal -->
    <div class="shifty-modal hidden" id="shifty-modal">
      <div class="shifty-modal-header">
        <span class="shifty-modal-title">Настройки оформления и нейросети</span>
        <button class="shifty-btn-icon" id="shifty-modal-close">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="shifty-modal-body">
        <!-- Theme & Color settings -->
        <div class="shifty-field">
          <label class="shifty-label">Тема оформления</label>
          <select class="shifty-select" id="shifty-setting-theme">
            <option value="dark">Тёмная (Минималистичный чёрный)</option>
            <option value="light">Светлая (Минималистичный белый)</option>
          </select>
        </div>

        <div class="shifty-field">
          <label class="shifty-label">Цвет акцента (пользовательский цвет)</label>
          <div class="shifty-color-swatches" id="shifty-swatches-container"></div>
          <div class="shifty-input-row" style="margin-top: 6px;">
            <span style="font-size:12px; color:var(--shifty-text-muted);">Свой цвет:</span>
            <input type="color" class="shifty-color-custom" id="shifty-custom-color-picker" value="#2563eb">
            <input type="text" class="shifty-input" id="shifty-custom-color-hex" value="#2563eb" style="width: 90px; text-align: center; text-transform: uppercase;">
          </div>
        </div>

        <!-- AI Provider -->
        <div class="shifty-field">
          <label class="shifty-label">Нейросеть / Провайдер</label>
          <select class="shifty-select" id="shifty-setting-provider">
            <option value="gemini">Google Gemini (Gemini 2.0 Flash / 1.5)</option>
            <option value="openai">OpenAI (ChatGPT / GPT-4o / o3-mini)</option>
            <option value="openrouter">OpenRouter (Perplexity Sonar / DeepSeek / Все)</option>
            <option value="anthropic">Anthropic Claude (Claude 3.5 Sonnet / Haiku)</option>
            <option value="groq">Groq (Сверхбыстрый Llama 3.3)</option>
            <option value="deepseek">DeepSeek (DeepSeek V3 / R1)</option>
            <option value="custom">Свой endpoint (Ollama / Local / Прокси)</option>
          </select>
        </div>

        <div class="shifty-field">
          <label class="shifty-label">API-ключ</label>
          <div class="shifty-input-row">
            <input type="password" class="shifty-input" id="shifty-setting-apikey" placeholder="Вставьте ваш API-ключ..." style="flex:1;">
            <button class="shifty-btn-secondary" id="shifty-btn-toggle-key" type="button">Показать</button>
          </div>
          <small style="color: var(--shifty-text-muted); font-size: 11px;" id="shifty-key-help"></small>
        </div>

        <div class="shifty-field">
          <label class="shifty-label">Модель</label>
          <input type="text" class="shifty-input" id="shifty-setting-model" placeholder="gemini-2.0-flash">
        </div>

        <div class="shifty-field" id="shifty-field-endpoint" style="display:none;">
          <label class="shifty-label">Базовый URL (Endpoint)</label>
          <input type="text" class="shifty-input" id="shifty-setting-baseurl" placeholder="http://localhost:11434/v1/chat/completions">
        </div>

        <div class="shifty-field">
          <label class="shifty-label">Горячие клавиши (In-page Hotkeys)</label>
          <div class="shifty-input-row" style="margin-bottom: 6px;">
            <span style="font-size:12px; color:var(--shifty-text-muted); width: 130px;">Открыть островок:</span>
            <input type="text" class="shifty-input" id="shifty-setting-key-toggle" readonly style="flex:1; text-align:center;">
            <button class="shifty-btn-secondary" id="shifty-record-key-toggle">Запись</button>
          </div>
          <div class="shifty-input-row">
            <span style="font-size:12px; color:var(--shifty-text-muted); width: 130px;">Сменить масштаб:</span>
            <input type="text" class="shifty-input" id="shifty-setting-key-resize" readonly style="flex:1; text-align:center;">
            <button class="shifty-btn-secondary" id="shifty-record-key-resize">Запись</button>
          </div>
        </div>

        <div class="shifty-field">
          <label class="shifty-label">Размеры островка (Ширина × Высота px)</label>
          <div class="shifty-input-row">
            <span style="font-size:12px; color:var(--shifty-text-muted); width: 60px;">Мини:</span>
            <input type="number" class="shifty-input" id="shifty-setting-small-w" min="300" max="800" style="flex:1;">
            <input type="number" class="shifty-input" id="shifty-setting-small-h" min="200" max="900" style="flex:1;">
          </div>
          <div class="shifty-input-row" style="margin-top: 6px;">
            <span style="font-size:12px; color:var(--shifty-text-muted); width: 60px;">Большой:</span>
            <input type="number" class="shifty-input" id="shifty-setting-large-w" min="400" max="1400" style="flex:1;">
            <input type="number" class="shifty-input" id="shifty-setting-large-h" min="300" max="1200" style="flex:1;">
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="shifty-btn-primary" id="shifty-btn-save-settings" style="flex: 1;">Сохранить настройки</button>
          <button class="shifty-btn-secondary" id="shifty-btn-open-options">Все опции ↗</button>
        </div>
      </div>
    </div>

    <!-- Corner resize handle -->
    <div class="shifty-resize-handle" id="shifty-resize-handle"></div>
  `;

  shadowRoot.appendChild(islandEl);

  // References
  const headerEl = shadowRoot.getElementById('shifty-header');
  const inputEl = shadowRoot.getElementById('shifty-input');
  const btnSend = shadowRoot.getElementById('shifty-btn-send');
  const btnClose = shadowRoot.getElementById('shifty-btn-close');
  const btnResize = shadowRoot.getElementById('shifty-btn-resize');
  const btnClear = shadowRoot.getElementById('shifty-btn-clear');
  const btnSettings = shadowRoot.getElementById('shifty-btn-settings');
  const btnTheme = shadowRoot.getElementById('shifty-btn-theme');
  const iconTheme = shadowRoot.getElementById('shifty-icon-theme');
  const bodyEl = shadowRoot.getElementById('shifty-body');
  const welcomeEl = shadowRoot.getElementById('shifty-welcome');
  const messagesListEl = shadowRoot.getElementById('shifty-messages-list');
  const modelBadgeEl = shadowRoot.getElementById('shifty-model-badge');
  const modalEl = shadowRoot.getElementById('shifty-modal');
  const modalCloseBtn = shadowRoot.getElementById('shifty-modal-close');
  const resizeHandle = shadowRoot.getElementById('shifty-resize-handle');
  const kbdResizeEl = shadowRoot.getElementById('shifty-kbd-resize');

  // Settings elements
  const selectTheme = shadowRoot.getElementById('shifty-setting-theme');
  const swatchesContainer = shadowRoot.getElementById('shifty-swatches-container');
  const customColorPicker = shadowRoot.getElementById('shifty-custom-color-picker');
  const customColorHex = shadowRoot.getElementById('shifty-custom-color-hex');
  const selectProvider = shadowRoot.getElementById('shifty-setting-provider');
  const inputApiKey = shadowRoot.getElementById('shifty-setting-apikey');
  const inputModel = shadowRoot.getElementById('shifty-setting-model');
  const inputBaseUrl = shadowRoot.getElementById('shifty-setting-baseurl');
  const fieldEndpoint = shadowRoot.getElementById('shifty-field-endpoint');
  const btnToggleKey = shadowRoot.getElementById('shifty-btn-toggle-key');
  const keyHelpEl = shadowRoot.getElementById('shifty-key-help');
  const inputKeyToggle = shadowRoot.getElementById('shifty-setting-key-toggle');
  const inputKeyResize = shadowRoot.getElementById('shifty-setting-key-resize');
  const btnRecordToggle = shadowRoot.getElementById('shifty-record-key-toggle');
  const btnRecordResize = shadowRoot.getElementById('shifty-record-key-resize');
  const inputSmallW = shadowRoot.getElementById('shifty-setting-small-w');
  const inputSmallH = shadowRoot.getElementById('shifty-setting-small-h');
  const inputLargeW = shadowRoot.getElementById('shifty-setting-large-w');
  const inputLargeH = shadowRoot.getElementById('shifty-setting-large-h');
  const btnSaveSettings = shadowRoot.getElementById('shifty-btn-save-settings');
  const btnOpenOptions = shadowRoot.getElementById('shifty-btn-open-options');

  // Build Color Swatches
  function initSwatches() {
    swatchesContainer.innerHTML = '';
    PRESET_COLORS.forEach(c => {
      const chip = document.createElement('div');
      chip.className = `shifty-color-chip ${config.accentColor.toLowerCase() === c.hex.toLowerCase() ? 'active' : ''}`;
      chip.style.backgroundColor = c.hex;
      chip.title = c.name;
      chip.addEventListener('click', () => {
        applyAccentColor(c.hex);
      });
      swatchesContainer.appendChild(chip);
    });
  }

  function applyAccentColor(hex) {
    config.accentColor = hex;
    customColorPicker.value = hex;
    customColorHex.value = hex.toUpperCase();
    islandEl.style.setProperty('--shifty-accent', hex);
    islandEl.style.setProperty('--shifty-accent-contrast', getContrastColor(hex));
    initSwatches();
  }

  customColorPicker.addEventListener('input', (e) => {
    applyAccentColor(e.target.value);
  });

  customColorHex.addEventListener('change', (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      applyAccentColor(val);
    }
  });

  // Apply Theme & Sizing styles
  function applyThemeAndStyles() {
    // Theme class
    islandEl.classList.remove('theme-dark', 'theme-light');
    islandEl.classList.add(config.theme === 'light' ? 'theme-light' : 'theme-dark');

    // Accent colors
    islandEl.style.setProperty('--shifty-accent', config.accentColor);
    islandEl.style.setProperty('--shifty-accent-contrast', getContrastColor(config.accentColor));

    // Theme icon in header: Sun if dark (to switch to light), Moon if light (to switch to dark)
    if (config.theme === 'light') {
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

    // Sizes
    islandEl.style.setProperty('--island-small-w', `${config.smallWidth}px`);
    islandEl.style.setProperty('--island-small-h', `${config.smallHeight}px`);
    islandEl.style.setProperty('--island-large-w', `${config.largeWidth}px`);
    islandEl.style.setProperty('--island-large-h', `${config.largeHeight}px`);

    if (config.currentSize === 'large') {
      islandEl.classList.remove('size-small');
      islandEl.classList.add('size-large');
    } else {
      islandEl.classList.remove('size-large');
      islandEl.classList.add('size-small');
    }

    if (kbdResizeEl) {
      kbdResizeEl.textContent = config.hotkeyResize;
    }
  }

  // Load stored settings
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
    modelBadgeEl.textContent = `${prov.name.split(' ')[0]} · ${modelName}`;
  }

  function restorePosition() {
    if (config.position && typeof config.position.top === 'number' && typeof config.position.left === 'number') {
      islandEl.style.top = `${Math.max(10, Math.min(window.innerHeight - 100, config.position.top))}px`;
      islandEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 100, config.position.left))}px`;
      islandEl.style.right = 'auto';
      islandEl.style.bottom = 'auto';
    } else {
      islandEl.style.top = '24px';
      islandEl.style.right = '24px';
      islandEl.style.left = 'auto';
      islandEl.style.bottom = 'auto';
    }
  }

  function savePosition(top, left) {
    config.position = { top, left };
    chrome.storage.local.set({ position: config.position });
  }

  // Toggle Visibility
  function toggleIsland(open) {
    if (typeof open === 'boolean') {
      isOpen = open;
    } else {
      isOpen = !isOpen;
    }

    if (isOpen) {
      islandEl.classList.remove('hidden');
      setTimeout(() => {
        inputEl.focus();
      }, 50);
    } else {
      islandEl.classList.add('hidden');
      modalEl.classList.add('hidden');
    }
  }

  // Toggle Theme (1-click from header)
  function toggleTheme() {
    config.theme = config.theme === 'light' ? 'dark' : 'light';
    chrome.storage.local.set({ theme: config.theme }, () => {
      applyThemeAndStyles();
      if (selectTheme) selectTheme.value = config.theme;
    });
  }

  // Toggle Size
  function toggleSize() {
    if (config.currentSize === 'small') {
      config.currentSize = 'large';
      islandEl.classList.remove('size-small');
      islandEl.classList.add('size-large');
    } else {
      config.currentSize = 'small';
      islandEl.classList.remove('size-large');
      islandEl.classList.add('size-small');
    }
    chrome.storage.local.set({ currentSize: config.currentSize });
  }

  // Draggable
  headerEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('.shifty-btn-icon')) return;

    isDragging = true;
    const rect = islandEl.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;

    islandEl.style.left = `${rect.left}px`;
    islandEl.style.top = `${rect.top}px`;
    islandEl.style.right = 'auto';
    islandEl.style.bottom = 'auto';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const rect = islandEl.getBoundingClientRect();
      savePosition(rect.top, rect.left);
    }
  }

  // Corner resize
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = islandEl.offsetWidth;
    const startH = islandEl.offsetHeight;

    function onResizeMove(moveEvent) {
      if (!isResizing) return;
      const newW = Math.max(300, startW + (moveEvent.clientX - startX));
      const newH = Math.max(260, startH + (moveEvent.clientY - startY));

      if (config.currentSize === 'small') {
        config.smallWidth = newW;
        config.smallHeight = newH;
        islandEl.style.setProperty('--island-small-w', `${newW}px`);
        islandEl.style.setProperty('--island-small-h', `${newH}px`);
      } else {
        config.largeWidth = newW;
        config.largeHeight = newH;
        islandEl.style.setProperty('--island-large-w', `${newW}px`);
        islandEl.style.setProperty('--island-large-h', `${newH}px`);
      }
    }

    function onResizeEnd() {
      if (isResizing) {
        isResizing = false;
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeEnd);
        chrome.storage.local.set({
          smallWidth: config.smallWidth,
          smallHeight: config.smallHeight,
          largeWidth: config.largeWidth,
          largeHeight: config.largeHeight
        });
      }
    }

    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
    e.preventDefault();
  });

  // Hotkey helper
  function matchesHotkey(e, hotkeyStr) {
    if (!hotkeyStr) return false;
    const parts = hotkeyStr.toLowerCase().split('+').map(p => p.trim());
    const alt = parts.includes('alt');
    const ctrl = parts.includes('ctrl') || parts.includes('control');
    const shift = parts.includes('shift');
    const meta = parts.includes('cmd') || parts.includes('command') || parts.includes('meta');

    if (e.altKey !== alt) return false;
    if (e.ctrlKey !== ctrl) return false;
    if (e.shiftKey !== shift) return false;
    if (e.metaKey !== meta) return false;

    const keyPart = parts.find(p => !['alt', 'ctrl', 'control', 'shift', 'cmd', 'command', 'meta'].includes(p));
    if (!keyPart) return true;

    if (keyPart === 'space' && e.code === 'Space') return true;
    return e.key.toLowerCase() === keyPart.toLowerCase() || e.code.toLowerCase() === keyPart.toLowerCase();
  }

  window.addEventListener('keydown', (e) => {
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

    if (isOpen && e.key === 'Escape') {
      if (!modalEl.classList.contains('hidden')) {
        modalEl.classList.add('hidden');
      } else {
        toggleIsland(false);
      }
      return;
    }
  }, true);

  // Auto-resize textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = `${Math.min(110, inputEl.scrollHeight)}px`;
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  });

  let currentStreamPort = null;

  btnSend.addEventListener('click', () => {
    if (currentStreamPort) {
      currentStreamPort.disconnect();
      currentStreamPort = null;
      setSendButtonState(false);
    } else if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
      setSendButtonState(false);
    } else {
      handleSubmit();
    }
  });

  btnClose.addEventListener('click', () => toggleIsland(false));
  btnResize.addEventListener('click', toggleSize);
  btnTheme.addEventListener('click', toggleTheme);
  btnClear.addEventListener('click', clearChat);
  btnSettings.addEventListener('click', openSettingsModal);

  shadowRoot.querySelectorAll('.shifty-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      inputEl.value = prompt;
      inputEl.focus();
      inputEl.style.height = 'auto';
      inputEl.style.height = `${Math.min(110, inputEl.scrollHeight)}px`;
    });
  });

  function clearChat() {
    if (currentStreamPort) {
      currentStreamPort.disconnect();
      currentStreamPort = null;
    }
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    chatHistory = [];
    messagesListEl.innerHTML = '';
    welcomeEl.style.display = 'flex';
    setSendButtonState(false);
  }

  function setSendButtonState(isLoading) {
    if (isLoading) {
      btnSend.classList.add('stop');
      btnSend.title = 'Остановить генерацию';
      btnSend.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
      `;
    } else {
      btnSend.classList.remove('stop');
      btnSend.title = 'Отправить (Enter)';
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

    if (!config.apiKey && config.provider !== 'custom') {
      openSettingsModal();
      alert('Пожалуйста, укажите API-ключ для выбранной нейросети в настройках!');
      return;
    }

    welcomeEl.style.display = 'none';
    inputEl.value = '';
    inputEl.style.height = 'auto';

    appendUserMessage(text);
    chatHistory.push({ role: 'user', content: text });

    const { assistantMsgEl, contentEl, linksContainerEl } = createAssistantMessageElement();
    messagesListEl.appendChild(assistantMsgEl);
    contentEl.classList.add('shifty-typing');
    bodyEl.scrollTop = bodyEl.scrollHeight;

    setSendButtonState(true);
    let fullAnswer = '';

    // First, try background bridge (100% bypasses page CSP and CORS)
    let streamPort = null;
    try {
      streamPort = chrome.runtime.connect({ name: 'shifty-stream' });
    } catch (e) {
      streamPort = null;
    }

    if (streamPort) {
      currentStreamPort = streamPort;

      streamPort.onMessage.addListener((msg) => {
        if (msg.type === 'chunk') {
          fullAnswer = msg.accumulated;
          contentEl.innerHTML = renderMarkdown(msg.accumulated);
          renderLinksBox(msg.accumulated, linksContainerEl);
          bodyEl.scrollTop = bodyEl.scrollHeight;
        } else if (msg.type === 'done') {
          const textToSave = msg.finalText || fullAnswer;
          contentEl.classList.remove('shifty-typing');
          contentEl.innerHTML = renderMarkdown(textToSave);
          renderLinksBox(textToSave, linksContainerEl);
          chatHistory.push({ role: 'assistant', content: textToSave });
          currentStreamPort = null;
          setSendButtonState(false);
          attachCodeCopyListeners(contentEl);
        } else if (msg.type === 'error') {
          contentEl.classList.remove('shifty-typing');
          contentEl.innerHTML = `<span style="color:#ef4444;">⚠️ ${msg.error}</span>`;
          currentStreamPort = null;
          setSendButtonState(false);
        }
      });

      streamPort.onDisconnect.addListener(() => {
        if (currentStreamPort) {
          currentStreamPort = null;
          contentEl.classList.remove('shifty-typing');
          setSendButtonState(false);
        }
      });

      streamPort.postMessage({
        action: 'send',
        payload: {
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
          messages: chatHistory
        }
      });
      return;
    }

    // Direct fallback if port is unavailable
    currentAbortController = new AbortController();

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
        contentEl.classList.remove('shifty-typing');
        contentEl.innerHTML = renderMarkdown(textToSave);
        renderLinksBox(textToSave, linksContainerEl);
        chatHistory.push({ role: 'assistant', content: textToSave });
        currentAbortController = null;
        setSendButtonState(false);
        attachCodeCopyListeners(contentEl);
      },
      onError: (err) => {
        contentEl.classList.remove('shifty-typing');
        contentEl.innerHTML = `<span style="color:#ef4444;">⚠️ ${err.message || 'Ошибка запроса к нейросети'}</span>`;
        currentAbortController = null;
        setSendButtonState(false);
      }
    });
  }

  function appendUserMessage(text) {
    const msgEl = document.createElement('div');
    msgEl.className = 'shifty-message';
    msgEl.innerHTML = `<div class="shifty-msg-user">${escapeHtml(text)}</div>`;
    messagesListEl.appendChild(msgEl);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function createAssistantMessageElement() {
    const msgEl = document.createElement('div');
    msgEl.className = 'shifty-message';

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'shifty-msg-assistant';

    const contentEl = document.createElement('div');
    contentEl.className = 'shifty-msg-content';

    const linksContainerEl = document.createElement('div');
    linksContainerEl.className = 'shifty-links-section';
    linksContainerEl.style.display = 'none';

    bubbleEl.appendChild(contentEl);
    bubbleEl.appendChild(linksContainerEl);
    msgEl.appendChild(bubbleEl);

    return { assistantMsgEl: msgEl, contentEl, linksContainerEl };
  }

  function renderLinksBox(text, containerEl) {
    const links = extractLinks(text);
    if (!links || links.length === 0) {
      containerEl.style.display = 'none';
      return;
    }

    containerEl.style.display = 'block';
    containerEl.innerHTML = `
      <div class="shifty-links-header">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span>Источники и ссылки (${links.length})</span>
      </div>
      <div class="shifty-links-list">
        ${links.map(l => `
          <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="shifty-link-card" title="${l.url}">
            <span class="shifty-link-title">🔗 ${escapeHtml(l.title)}</span>
            <span class="shifty-link-url">${formatUrlHost(l.url)}</span>
          </a>
        `).join('')}
      </div>
    `;
  }

  function attachCodeCopyListeners(containerEl) {
    containerEl.querySelectorAll('.shifty-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rawCode = decodeURIComponent(btn.getAttribute('data-code') || '');
        navigator.clipboard.writeText(rawCode).then(() => {
          btn.textContent = 'Скопировано';
          setTimeout(() => { btn.textContent = 'Копировать'; }, 2000);
        });
      });
    });
  }

  function formatUrlHost(url) {
    try {
      const u = new URL(url);
      return u.hostname;
    } catch {
      return '';
    }
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Settings Modal Handlers
  function openSettingsModal() {
    selectTheme.value = config.theme;
    customColorPicker.value = config.accentColor;
    customColorHex.value = config.accentColor.toUpperCase();
    selectProvider.value = config.provider;
    inputApiKey.value = config.apiKey || '';
    inputModel.value = config.model || '';
    inputBaseUrl.value = config.baseUrl || '';
    inputKeyToggle.value = config.hotkeyToggle;
    inputKeyResize.value = config.hotkeyResize;
    inputSmallW.value = config.smallWidth;
    inputSmallH.value = config.smallHeight;
    inputLargeW.value = config.largeWidth;
    inputLargeH.value = config.largeHeight;

    initSwatches();
    updateProviderFields();
    modalEl.classList.remove('hidden');
  }

  selectTheme.addEventListener('change', () => {
    config.theme = selectTheme.value;
    applyThemeAndStyles();
  });

  function updateProviderFields() {
    const provId = selectProvider.value;
    const prov = PROVIDERS[provId] || PROVIDERS.gemini;
    fieldEndpoint.style.display = (provId === 'custom') ? 'flex' : 'none';
    if (!inputModel.value || Object.values(PROVIDERS).some(p => p.models.includes(inputModel.value))) {
      inputModel.value = prov.defaultModel;
    }
    inputApiKey.placeholder = prov.keyPlaceholder || 'API-ключ...';
    if (prov.keyHelpUrl) {
      keyHelpEl.innerHTML = `<a href="${prov.keyHelpUrl}" target="_blank" style="color:var(--shifty-accent); text-decoration:underline;">Получить ключ для ${prov.name} ↗</a>`;
    } else {
      keyHelpEl.textContent = '';
    }
  }

  selectProvider.addEventListener('change', updateProviderFields);

  btnToggleKey.addEventListener('click', () => {
    if (inputApiKey.type === 'password') {
      inputApiKey.type = 'text';
      btnToggleKey.textContent = 'Скрыть';
    } else {
      inputApiKey.type = 'password';
      btnToggleKey.textContent = 'Показать';
    }
  });

  modalCloseBtn.addEventListener('click', () => {
    modalEl.classList.add('hidden');
  });

  function setupRecorder(button, inputField, targetKey) {
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

        const combo = parts.join('+');
        inputField.value = combo;
        button.textContent = 'Запись';
        recording = false;
        window.removeEventListener('keydown', handler, true);
      }

      window.addEventListener('keydown', handler, true);
    });
  }

  setupRecorder(btnRecordToggle, inputKeyToggle, 'hotkeyToggle');
  setupRecorder(btnRecordResize, inputKeyResize, 'hotkeyResize');

  btnSaveSettings.addEventListener('click', () => {
    config.theme = selectTheme.value;
    config.accentColor = customColorPicker.value;
    config.provider = selectProvider.value;
    config.apiKey = inputApiKey.value.trim();
    config.model = inputModel.value.trim();
    config.baseUrl = inputBaseUrl.value.trim();
    config.hotkeyToggle = inputKeyToggle.value.trim() || 'Alt+Shift+S';
    config.hotkeyResize = inputKeyResize.value.trim() || 'Alt+Shift+Z';
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
      modalEl.classList.add('hidden');
    });
  });

  btnOpenOptions.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openOptions' });
  });

  // Background messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggle-island') {
      toggleIsland();
      sendResponse({ status: 'ok' });
    } else if (message.action === 'toggle-size') {
      toggleSize();
      sendResponse({ status: 'ok' });
    } else if (message.action === 'ask-selection') {
      const selectedText = message.text || '';
      toggleIsland(true);
      if (selectedText) {
        const query = `Объясни и найди источники: "${selectedText}"`;
        inputEl.value = query;
        if (config.autoSendSelection) {
          handleSubmit(query);
        } else {
          inputEl.focus();
        }
      }
      sendResponse({ status: 'ok' });
    }
  });

  loadConfig();
})();
