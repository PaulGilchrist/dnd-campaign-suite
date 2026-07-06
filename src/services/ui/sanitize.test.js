// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { sanitizeHtml, renderMarkdown, renderMarkdownInline } from './sanitize.js';

describe('sanitizeHtml', () => {
  it('returns empty string for invalid input', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml(123)).toBe('');
    expect(sanitizeHtml({})).toBe('');
    expect(sanitizeHtml([])).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });

  it('strips javascript: and data: URLs from links', () => {
    const jsResult = sanitizeHtml('<a href="javascript:alert(1)">XSS</a>');
    expect(jsResult).not.toContain('javascript:');

    const dataResult = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">XSS</a>');
    expect(dataResult).not.toContain('data:text/html');
  });

  it('strips event handler attributes but keeps safe ones', () => {
    const result = sanitizeHtml('<span class="safe" onclick="alert()" onmouseover="steal()">Content</span>');

    expect(result).toContain('class="safe"');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onmouseover');
  });

  it('allows data attributes', () => {
    const result = sanitizeHtml('<span data-id="123" data-value="test">Content</span>');
    expect(result).toContain('data-id="123"');
    expect(result).toContain('data-value="test"');
  });

  it('allows safe links', () => {
    const result = sanitizeHtml('<a href="https://example.com">Link</a>');
    expect(result).toContain('<a');
    expect(result).toContain('href="https://example.com"');
  });
});

describe('renderMarkdown', () => {
  it('returns empty string for invalid input', () => {
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
    expect(renderMarkdown(123)).toBe('');
    expect(renderMarkdown('')).toBe('');
  });

  it('converts markdown to sanitized HTML', () => {
    expect(renderMarkdown('**bold text**')).toContain('<strong>bold text</strong>');
    expect(renderMarkdown('*italic text*')).toContain('<em>italic text</em>');
  });

  it('converts markdown lists to HTML', () => {
    const ulResult = renderMarkdown('- Item 1\n- Item 2\n- Item 3');
    expect(ulResult).toContain('<ul>');
    expect(ulResult).toContain('<li>Item 1</li>');

    const olResult = renderMarkdown('1. First\n2. Second');
    expect(olResult).toContain('<ol>');
    expect(olResult).toContain('<li>First</li>');
  });

  it('converts headings to HTML', () => {
    const result = renderMarkdown('# Heading 1\n## Heading 2\n### Heading 3');
    expect(result).toContain('<h1>Heading 1</h1>');
    expect(result).toContain('<h3>Heading 3</h3>');
  });

  it('converts tables to HTML', () => {
    const result = renderMarkdown('| H1 | H2 |\n|----|----|\n| C1 | C2 |');
    expect(result).toContain('<table>');
    expect(result).toContain('<th>H1</th>');
    expect(result).toContain('<td>C1</td>');
  });

  it('converts blockquotes and horizontal rules to HTML', () => {
    const result = renderMarkdown('> This is a quote');
    expect(result).toContain('<blockquote');
    expect(result).toContain('This is a quote');

    const hrResult = renderMarkdown('---');
    expect(hrResult).toContain('<hr');
  });

  it('converts inline and fenced code to HTML', () => {
    const result = renderMarkdown('Use `code` here');
    expect(result).toContain('<code>code</code>');

    const fencedResult = renderMarkdown('```\nconst x = 1;\n```');
    expect(fencedResult).toContain('<pre');
    expect(fencedResult).toContain('<code');
    expect(fencedResult).toContain('const x = 1;');
  });

  it('sanitizes dangerous URLs in markdown links', () => {
    const result = renderMarkdown('[click](javascript:alert("xss"))');
    expect(result).not.toContain('javascript:');
  });
});

describe('renderMarkdownInline', () => {
  it('returns empty string for invalid input', () => {
    expect(renderMarkdownInline(null)).toBe('');
    expect(renderMarkdownInline(undefined)).toBe('');
    expect(renderMarkdownInline(123)).toBe('');
    expect(renderMarkdownInline('')).toBe('');
  });

  it('converts inline markdown without wrapping in <p>', () => {
    const result = renderMarkdownInline('**bold text** and *italic* and `code`');
    expect(result).toContain('<strong>bold text</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).toContain('<code>code</code>');
    expect(result).not.toContain('<p>');
  });

  it('converts inline links without <p>', () => {
    const result = renderMarkdownInline('[link](https://example.com)');
    expect(result).toContain('<a');
    expect(result).toContain('href="https://example.com"');
    expect(result).not.toContain('<p>');
  });
});
