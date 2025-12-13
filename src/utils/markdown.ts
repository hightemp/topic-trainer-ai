import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

// Create custom renderer with syntax highlighting
const renderer = new marked.Renderer();

renderer.code = function({ text, lang }: { text: string; lang?: string }) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const highlighted = hljs.highlight(text, { language: lang }).value;
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
    } catch (err) {
      console.error('Highlight error:', err);
    }
  }
  
  // Auto-detect language if not specified
  try {
    const result = hljs.highlightAuto(text);
    const detectedLang = result.language || 'plaintext';
    return `<pre><code class="hljs language-${detectedLang}">${result.value}</code></pre>`;
  } catch (err) {
    console.error('Auto-highlight error:', err);
    return `<pre><code>${text}</code></pre>`;
  }
};

// Configure marked
marked.setOptions({
  renderer,
  breaks: true,
  gfm: true,
});

export function renderMarkdown(text: string): string {
  if (!text) return '';
  return marked(text) as string;
}

export function renderMarkdownInline(text: string): string {
  if (!text) return '';
  // For inline rendering, remove paragraph tags
  const html = marked(text) as string;
  return html.replace(/^<p>|<\/p>$/g, '');
}
