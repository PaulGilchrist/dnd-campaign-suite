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
    expect(result).toContain('<h2>H2</h2>');
    expect(result).toContain('<h3>H3</h3>');
    expect(result).toContain('<h4>H4</h4>');
    expect(result).toContain('<h5>H5</h5>');
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

  it('strips event handler attributes but keeps safe ones', () => {
    const result = sanitizeHtml('<span class="safe" onclick="alert()" onmouseover="steal()">Content</span>');

    expect(result).toContain('class="safe"');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onmouseover');
  });

  it('keeps style attributes but DOMPurify sanitizes them', () => {
    // DOMPurify allows style attribute; dangerous CSS is browser-dependent
    const result = sanitizeHtml('<span style="background: expression(alert(1))">XSS</span>');
    expect(result).toContain('<span');
    expect(result).toContain('XSS');
  });

  it('allows data attributes', () => {
    const result = sanitizeHtml('<span data-id="123" data-value="test">Content</span>');
    expect(result).toContain('data-id="123"');
    expect(result).toContain('data-value="test"');
  });

  it('strips tags not in the allowed list but preserves their text content', () => {
    // DOMPurify removes disallowed tags but keeps inner text
    const result = sanitizeHtml('<custom-tag>Custom</custom-tag><b>Bold</b><div>Div</div>');
    expect(result).not.toContain('<custom-tag>');
    expect(result).toContain('Custom');
    expect(result).toContain('<b>Bold</b>');
    expect(result).toContain('<div>Div</div>');
  });

  it('handles empty string input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('handles string with only whitespace', () => {
    const result = sanitizeHtml('   ');
    expect(result).toBe('   ');
  });

  it('handles self-closing tags', () => {
    const result = sanitizeHtml('<hr/><br/>');
    expect(result).toContain('<hr>');
    expect(result).toContain('<br>');
  });

  it('sanitizes nested dangerous content', () => {
    const input = '<div><p>Text<script>evil()</script></p></div>';
    const result = sanitizeHtml(input);

    expect(result).toContain('Text');
    expect(result).not.toContain('evil');
    expect(result).not.toContain('<script>');
  });
});

describe('renderMarkdown', () => {
  it('returns empty string for falsy or non-string input', () => {
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
    expect(renderMarkdown(123)).toBe('');
  });

  it('converts bold and italic markdown to HTML', () => {
    expect(renderMarkdown('**bold text**')).toContain('<strong>bold text</strong>');
    expect(renderMarkdown('*italic text*')).toContain('<em>italic text</em>');
  });

  it('converts unordered list to HTML', () => {
    const result = renderMarkdown('- Item 1\n- Item 2\n- Item 3');
    expect(result).toContain('<li>Item 1</li>');
    expect(result).toContain('<li>Item 2</li>');
    expect(result).toContain('<li>Item 3</li>');
  });

  it('converts ordered list to HTML', () => {
    const result = renderMarkdown('1. First\n2. Second');
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>First</li>');
    expect(result).toContain('<li>Second</li>');
  });

  it('converts headings to HTML', () => {
    const result = renderMarkdown('# Heading 1\n## Heading 2\n### Heading 3');
    expect(result).toContain('<h1>Heading 1</h1>');
    expect(result).toContain('<h2>Heading 2</h2>');
    expect(result).toContain('<h3>Heading 3</h3>');
  });

  it('converts tables to HTML', () => {
    const result = renderMarkdown('| H1 | H2 |\n|----|----|\n| C1 | C2 |');
    expect(result).toContain('<table>');
    expect(result).toContain('<th>H1</th>');
    expect(result).toContain('<th>H2</th>');
    expect(result).toContain('<td>C1</td>');
    expect(result).toContain('<td>C2</td>');
  });

  it('converts blockquotes to HTML', () => {
    const result = renderMarkdown('> This is a quote');
    expect(result).toContain('<blockquote');
    expect(result).toContain('This is a quote');
  });

  it('converts horizontal rules to HTML', () => {
    const result = renderMarkdown('---');
    expect(result).toContain('<hr');
  });

  it('converts inline code to HTML', () => {
    const result = renderMarkdown('Use `code` here');
    expect(result).toContain('<code>code</code>');
  });

  it('converts fenced code blocks to HTML', () => {
    const result = renderMarkdown('```\nconst x = 1;\n```');
    expect(result).toContain('<pre');
    expect(result).toContain('<code');
    expect(result).toContain('const x = 1;');
  });

  it('sanitizes dangerous URLs in markdown links', () => {
    const result = renderMarkdown('[click](javascript:alert("xss"))');
    expect(result).not.toContain('javascript:');
  });

  it('sanitizes HTML embedded in markdown', () => {
    const result = renderMarkdown('text <script>alert(1)</script> more');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('text');
    expect(result).toContain('more');
  });

  it('sanitizes event handlers in markdown-generated HTML', () => {
    const result = renderMarkdown('text <img onerror="alert(1)" src="x">');
    expect(result).not.toContain('onerror');
  });

  it('handles empty string input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('handles plain text with no markdown syntax', () => {
    const result = renderMarkdown('just plain text');
    expect(result).toContain('just plain text');
  });

  it('handles mixed safe and dangerous content', () => {
    const result = renderMarkdown('**bold** and *italic* with <script>evil</script>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('evil');
  });
});

describe('renderMarkdownInline', () => {
  it('returns empty string for falsy or non-string input', () => {
    expect(renderMarkdownInline(null)).toBe('');
    expect(renderMarkdownInline(undefined)).toBe('');
    expect(renderMarkdownInline(123)).toBe('');
  });

  it('converts bold inline markdown without wrapping in <p>', () => {
    const result = renderMarkdownInline('**bold text**');
    expect(result).toContain('<strong>bold text</strong>');
    expect(result).not.toContain('<p>');
  });

  it('converts italic inline markdown without <p>', () => {
    const result = renderMarkdownInline('*italic text*');
    expect(result).toContain('<em>italic text</em>');
    expect(result).not.toContain('<p>');
  });

  it('converts inline code without <p>', () => {
    const result = renderMarkdownInline('Use `code` here');
    expect(result).toContain('<code>code</code>');
    expect(result).not.toContain('<p>');
  });

  it('converts inline links without <p>', () => {
    const result = renderMarkdownInline('[link](https://example.com)');
    expect(result).toContain('<a');
    expect(result).toContain('href="https://example.com"');
    expect(result).not.toContain('<p>');
  });

  it('handles empty string without <p>', () => {
    const result = renderMarkdownInline('');
    expect(result).toBe('');
  });

  it('handles plain text without adding <p>', () => {
    const result = renderMarkdownInline('just plain text');
    expect(result).not.toContain('<p>');
    expect(result).toContain('just plain text');
  });

  it('handles multiple inline elements without <p>', () => {
    const result = renderMarkdownInline('**bold** and *italic* and `code`');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).toContain('<code>code</code>');
    expect(result).not.toContain('<p>');
  });

  it('sanitizes dangerous inline content', () => {
    const result = renderMarkdownInline('[click](javascript:alert(1)) and <script>x</script>');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('<script>');
  });
});
