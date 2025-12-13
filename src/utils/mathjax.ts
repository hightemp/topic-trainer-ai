import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Convert LaTeX math expressions to HTML using KaTeX
 * Supports both inline ($...$) and display ($$...$$) math
 */
export function renderMath(text: string): string {
  if (!text) return '';
  
  let result = text;
  
  // Process display math ($$...$$) first
  result = result.replace(/\$\$([^$]+)\$\$/g, (match, latex) => {
    try {
      const html = katex.renderToString(latex.trim(), {
        displayMode: true,
        throwOnError: false,
        output: 'html',
      });
      return `<div class="math-display">${html}</div>`;
    } catch (err) {
      console.error('KaTeX display error:', err);
      return `<div class="math-error">$$${latex}$$</div>`;
    }
  });
  
  // Process inline math ($...$)
  result = result.replace(/\$([^$]+)\$/g, (match, latex) => {
    try {
      const html = katex.renderToString(latex.trim(), {
        displayMode: false,
        throwOnError: false,
        output: 'html',
      });
      return `<span class="math-inline">${html}</span>`;
    } catch (err) {
      console.error('KaTeX inline error:', err);
      return `<span class="math-error">$${latex}$</span>`;
    }
  });
  
  return result;
}
