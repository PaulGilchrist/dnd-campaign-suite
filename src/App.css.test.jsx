import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// @cleaned-by-ai
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractMediaQueries(css) {
  const cleanCss = stripComments(css);
  const regex = /@media\s*([^{]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  const results = [];
  let match;
  while ((match = regex.exec(cleanCss)) !== null) {
    results.push({ media: match[1].trim(), body: match[2].trim() });
  }
  return results;
}

describe('App.css', () => {
  let css;

  beforeAll(() => {
    css = readFileSync(join(__dirname, 'App.css'), 'utf-8');
  });

  describe('Responsive media queries', () => {
    let mediaQueries;

    beforeAll(() => {
      mediaQueries = extractMediaQueries(css);
    });

    it('should have a max-width: 600px breakpoint with responsive adjustments', () => {
      const breakpoint = mediaQueries.find((mq) => mq.media.includes('max-width: 600px'));
      expect(breakpoint).toBeDefined();
      expect(breakpoint.body).toBeTruthy();
    });

    it('should have a print media query for modal printing', () => {
      const printBreakpoint = mediaQueries.find((mq) => mq.media.includes('print'));
      expect(printBreakpoint).toBeDefined();
      expect(printBreakpoint.body).toBeTruthy();
    });
  });
});
