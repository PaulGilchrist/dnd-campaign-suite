import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitize.js';

describe('sanitizeHtml', () => {
  it('should return empty string for null input', () => {
    expect(sanitizeHtml(null)).toBe('');
  });

  it('should return empty string for undefined input', () => {
    expect(sanitizeHtml(undefined)).toBe('');
  });

  it('should return empty string for non-string input', () => {
    expect(sanitizeHtml(123)).toBe('');
  });

  it('should allow safe HTML tags', () => {
    const input = '<b>Bold</b><i>Italic</i><p>Paragraph</p>';
    const result = sanitizeHtml(input);

    expect(result).toContain('<b>Bold</b>');
    expect(result).toContain('<i>Italic</i>');
    expect(result).toContain('<p>Paragraph</p>');
  });

  it('should remove script tags', () => {
    const input = '<script>alert("xss")</script><p>Safe content</p>';
    const result = sanitizeHtml(input);

    expect(result).not.toContain('<script>');
    expect(result).toContain('Safe content');
  });

  it('should allow links with href', () => {
    const input = '<a href="https://example.com">Link</a>';
    const result = sanitizeHtml(input);

    expect(result).toContain('<a');
    expect(result).toContain('href="https://example.com"');
  });

  it('should allow table elements', () => {
    const input = '<table><tr><td>Cell</td></tr></table>';
    const result = sanitizeHtml(input);

    expect(result).toContain('<table>');
    expect(result).toContain('<td>Cell</td>');
  });

  it('should allow headings', () => {
    const input = '<h1>Heading 1</h1><h2>Heading 2</h2>';
    const result = sanitizeHtml(input);

    expect(result).toContain('<h1>Heading 1</h1>');
    expect(result).toContain('<h2>Heading 2</h2>');
  });

  it('should allow lists', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = sanitizeHtml(input);

    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Item 1</li>');
  });

  it('should allow details and summary tags', () => {
    const input = '<details><summary>Click me</summary>Content</details>';
    const result = sanitizeHtml(input);

    expect(result).toContain('<details>');
    expect(result).toContain('<summary>Click me</summary>');
  });

  it('should strip dangerous attributes but keep safe ones', () => {
    const input = '<span class="safe" onclick="alert()">Content</span>';
    const result = sanitizeHtml(input);

    expect(result).toContain('class="safe"');
    expect(result).not.toContain('onclick');
  });
});
