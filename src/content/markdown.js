// src/content/markdown.js
// Lightweight, safe, zero-dependency Markdown & Link parser for ShiftySearch

export function renderMarkdown(text) {
  if (!text) return '';

  // 1. Sanitize HTML entities first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Code blocks ```lang\ncode\n```
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang ? lang.trim() : 'text';
    return `<div class="shifty-code-block">
      <div class="shifty-code-header">
        <span class="shifty-code-lang">${language}</span>
        <button class="shifty-copy-btn" data-code="${encodeURIComponent(code)}">Копировать</button>
      </div>
      <pre><code>${code}</code></pre>
    </div>`;
  });

  // 3. Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code class="shifty-inline-code">$1</code>');

  // 4. Headings (###, ##, #)
  html = html.replace(/^### (.*$)/gim, '<h3 class="shifty-h3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="shifty-h2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="shifty-h1">$1</h1>');

  // 5. Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 6. Blockquotes
  html = html.replace(/^>(.*$)/gim, '<blockquote class="shifty-quote">$1</blockquote>');

  // 7. Unordered Lists (- item, * item)
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="shifty-li">$1</li>');
  html = html.replace(/(<li class="shifty-li">[\s\S]*?<\/li>)/g, '<ul class="shifty-ul">$1</ul>');
  // Clean adjacent lists
  html = html.replace(/<\/ul>\s*<ul class="shifty-ul">/g, '');

  // 8. Markdown Links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="shifty-link">${label} <svg class="shifty-ext-icon" viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3m-2 16H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7Z"/></svg></a>`;
  });

  // 9. Plain URLs (not inside attributes)
  html = html.replace(/(^|[^"=])(https?:\/\/[^\s<]+)/g, (match, prefix, url) => {
    return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer" class="shifty-link">${url}</a>`;
  });

  // 10. Paragraph breaks (double newlines)
  const paragraphs = html.split(/\n{2,}/);
  html = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h1') || p.startsWith('<h2') || p.startsWith('<h3') ||
        p.startsWith('<div') || p.startsWith('<ul') || p.startsWith('<blockquote')) {
      return p;
    }
    return `<p class="shifty-p">${p.replace(/\n/g, '<br/>')}</p>`;
  }).join('');

  return html;
}

/**
 * Extracts all URLs from markdown text to display a separate "Found Links" section
 */
export function extractLinks(text) {
  if (!text) return [];
  const links = [];
  const seen = new Set();

  // 1. Extract markdown links [text](url)
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

  // 2. Extract raw URLs
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
