// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { sanitizeHtml, renderMarkdown, renderMarkdownInline } from './sanitize.js';

describe('sanitizeHtml', () => {
  it('returns empty string for falsy or non-string input', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml(123)).toBe('');
    expect(sanitizeHtml({})).toBe('');
    expect(sanitizeHtml([])).toBe('');
  });

  it('passes through safe formatting tags', () => {
    const input = '<b>Bold</b><i>Italic</i><u>Underline</u><s>Strikethrough</s><em>Emphasis</em><strong>Strong</strong>';
    const result = sanitizeHtml(input);

    expect(result).toContain('<b>Bold</b>');
    expect(result).toContain('<i>Italic</i>');
    expect(result).toContain('<u>Underline</u>');
    expect(result).toContain('<s>Strikethrough</s>');
  });

  it('removes script tags and their content', () => {
    const input = '<script>alert("xss")</script><p>Safe content</p>';
    const result = sanitizeHtml(input);

    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('Safe content');
  });

  it('removes noscript and iframe tags', () => {
    const input = '<noscript><p>Hidden</p></noscript><iframe src="evil"></iframe><p>Visible</p>';
    const result = sanitizeHtml(input);

    expect(result).not.toContain('<noscript>');
    expect(result).not.toContain('<iframe');
    expect(result).toContain('Visible');
  });

  it('allows links with safe href values', () => {
    const result = sanitizeHtml('<a href="https://example.com">Link</a>');
    expect(result).toContain('<a');
    expect(result).toContain('href="https://example.com"');
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

  it('allows table elements with proper structure', () => {
    const input = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
    const result = sanitizeHtml(input);

    expect(result).toContain('<table>');
    expect(result).toContain('<thead>');
    expect(result).toContain('<th>Header</th>');
    expect(result).toContain('<td>Cell</td>');
  });

  it('allows all heading levels', () => {
    const input = '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>';
    const result = sanitizeHtml(input);

    expect(result).toContain('<h1>H1</h1>');
    expect(result).toContain('<h6>H6</h6>');
  });

  it('allows ordered and unordered lists', () => {
    const ulResult = sanitizeHtml('<ul><li>Item 1</li><li>Item 2</li></ul>');
    expect(ulResult).toContain('<ul>');
    expect(ulResult).toContain('<li>Item 1</li>');

    const olResult = sanitizeHtml('<ol><li>First</li><li>Second</li></ol>');
    expect(olResult).toContain('<ol>');
    expect(olResult).toContain('<li>First</li>');
  });

  it('allows details and summary tags', () => {
    const input = '<details><summary>Click me</summary>Content</details>';
    const result = sanitizeHtml(input);

    expect(result).toContain('<details>');
    expect(result).toContain('<summary>Click me</summary>');
    expect(result).toContain('Content');
  });

  it('handles empty string input', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});

describe('renderMarkdown', () => {
  it('returns empty string for falsy or non-string input', () => {
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
    expect(renderMarkdown(123)).toBe('');
  });

  it('converts bold and italic markdown to sanitized HTML', () => {
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

  it('handles empty string input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});

describe('renderMarkdownInline', () => {
  it('returns empty string for falsy or non-string input', () => {
    expect(renderMarkdownInline(null)).toBe('');
    expect(renderMarkdownInline(undefined)).toBe('');
    expect(renderMarkdownInline(123)).toBe('');
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

  it('handles empty string input', () => {
    expect(renderMarkdownInline('')).toBe('');
  });
});
