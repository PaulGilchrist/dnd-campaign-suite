import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
    it('should return empty string for null input', () => {
        expect(sanitizeHtml(null)).toBe('');
     });

    it('should return empty string for undefined input', () => {
        expect(sanitizeHtml(undefined)).toBe('');
     });

    it('should return empty string for non-string input', () => {
        expect(sanitizeHtml(123)).toBe('');
        expect(sanitizeHtml({})).toBe('');
        expect(sanitizeHtml([])).toBe('');
     });

    it('should return empty string for empty string', () => {
        expect(sanitizeHtml('')).toBe('');
     });

    it('should allow bold text', () => {
        const result = sanitizeHtml('<b>Bold text</b>');
        expect(result).toContain('<b>');
        expect(result).toContain('Bold text');
     });

    it('should allow strong text', () => {
        const result = sanitizeHtml('<strong>Strong text</strong>');
        expect(result).toContain('<strong>');
        expect(result).toContain('Strong text');
     });

    it('should allow italic text', () => {
        const result = sanitizeHtml('<i>Italic text</i>');
        expect(result).toContain('<i>');
        expect(result).toContain('Italic text');
     });

    it('should allow emphasis text', () => {
        const result = sanitizeHtml('<em>Emphasis text</em>');
        expect(result).toContain('<em>');
        expect(result).toContain('Emphasis text');
     });

    it('should allow underlined text', () => {
        const result = sanitizeHtml('<u>Underlined text</u>');
        expect(result).toContain('<u>');
        expect(result).toContain('Underlined text');
     });

    it('should allow links with href', () => {
        const result = sanitizeHtml('<a href="https://example.com">Link</a>');
        expect(result).toContain('<a');
        expect(result).toContain('href="https://example.com"');
        expect(result).toContain('Link');
     });

    it('should allow paragraphs', () => {
        const result = sanitizeHtml('<p>Paragraph text</p>');
        expect(result).toContain('<p>');
        expect(result).toContain('Paragraph text');
     });

    it('should allow headings', () => {
        const result = sanitizeHtml('<h1>Heading</h1>');
        expect(result).toContain('<h1>');
        expect(result).toContain('Heading');
     });

    it('should allow lists', () => {
        const result = sanitizeHtml('<ul><li>Item 1</li><li>Item 2</li></ul>');
        expect(result).toContain('<ul>');
        expect(result).toContain('<li>');
        expect(result).toContain('Item 1');
        expect(result).toContain('Item 2');
     });

    it('should allow ordered lists', () => {
        const result = sanitizeHtml('<ol><li>First</li><li>Second</li></ol>');
        expect(result).toContain('<ol>');
        expect(result).toContain('<li>');
     });

    it('should allow line breaks', () => {
        const result = sanitizeHtml('Line 1<br>Line 2');
        expect(result).toContain('<br>');
     });

    it('should allow blockquotes', () => {
        const result = sanitizeHtml('<blockquote>Quote</blockquote>');
        expect(result).toContain('<blockquote>');
        expect(result).toContain('Quote');
     });

    it('should allow code blocks', () => {
        const result = sanitizeHtml('<code>Code</code>');
        expect(result).toContain('<code>');
        expect(result).toContain('Code');
     });

    it('should allow span elements', () => {
        const result = sanitizeHtml('<span>Span text</span>');
        expect(result).toContain('<span>');
        expect(result).toContain('Span text');
     });

    it('should allow tables', () => {
        const result = sanitizeHtml('<table><tr><td>Cell</td></tr></table>');
        expect(result).toContain('<table>');
        expect(result).toContain('<tr>');
        expect(result).toContain('<td>');
        expect(result).toContain('Cell');
     });

    it('should allow details/summary elements', () => {
        const result = sanitizeHtml('<details><summary>Summary</summary>Content</details>');
        expect(result).toContain('<details>');
        expect(result).toContain('<summary>');
        expect(result).toContain('Summary');
        expect(result).toContain('Content');
     });

    it('should strip script tags', () => {
        const result = sanitizeHtml('<script>alert("XSS")</script>');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert');
     });

    it('should strip event handlers', () => {
        const result = sanitizeHtml('<div onclick="alert(1)">Click me</div>');
        expect(result).not.toContain('onclick');
        expect(result).toContain('Click me');
     });

    it('should strip style tags', () => {
        const result = sanitizeHtml('<style>body { display: none; }</style>');
        expect(result).not.toContain('<style>');
     });

    it('should strip iframe tags', () => {
        const result = sanitizeHtml('<iframe src="https://evil.com"></iframe>');
        expect(result).not.toContain('<iframe>');
     });

    it('should strip onerror attributes', () => {
        const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
        expect(result).not.toContain('onerror');
     });

    it('should allow class attributes on span', () => {
        const result = sanitizeHtml('<span class="highlight">Text</span>');
        expect(result).toContain('class="highlight"');
     });

    it('should allow style attributes on span', () => {
        const result = sanitizeHtml('<span style="color: red;">Text</span>');
        expect(result).toContain('style="');
     });

    it('should allow data attributes', () => {
        const result = sanitizeHtml('<span data-custom="value">Text</span>');
        expect(result).toContain('data-custom="value"');
     });

    it('should handle plain text without HTML', () => {
        const result = sanitizeHtml('Plain text without HTML');
        expect(result).toBe('Plain text without HTML');
     });

    it('should handle nested allowed elements', () => {
        const result = sanitizeHtml('<p><strong>Bold</strong> and <em>italic</em></p>');
        expect(result).toContain('<p>');
        expect(result).toContain('<strong>');
        expect(result).toContain('<em>');
     });

    it('should handle mark element', () => {
        const result = sanitizeHtml('<mark>Highlighted</mark>');
        expect(result).toContain('<mark>');
        expect(result).toContain('Highlighted');
     });

    it('should handle sub and sup elements', () => {
        const result = sanitizeHtml('H<sub>2</sub>O and E=mc<sup>2</sup>');
        expect(result).toContain('<sub>');
        expect(result).toContain('<sup>');
     });

    it('should handle small element', () => {
        const result = sanitizeHtml('<small>Small text</small>');
        expect(result).toContain('<small>');
     });

    it('should handle strikethrough element', () => {
        const result = sanitizeHtml('<s>Strikethrough</s>');
        expect(result).toContain('<s>');
     });

    it('should handle pre element', () => {
        const result = sanitizeHtml('<pre>Preformatted text</pre>');
        expect(result).toContain('<pre>');
     });

    it('should handle hr element', () => {
        const result = sanitizeHtml('<hr>');
        expect(result).toContain('<hr');
     });

    it('should handle table thead, tbody, tfoot', () => {
        const result = sanitizeHtml('<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Body</td></tr></tbody></table>');
        expect(result).toContain('<thead>');
        expect(result).toContain('<tbody>');
        expect(result).toContain('<th>');
        expect(result).toContain('Header');
        expect(result).toContain('Body');
     });

    it('should handle h2-h6 headings', () => {
        const result = sanitizeHtml('<h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>');
        expect(result).toContain('<h2>');
        expect(result).toContain('<h3>');
        expect(result).toContain('<h4>');
        expect(result).toContain('<h5>');
        expect(result).toContain('<h6>');
     });

    it('should handle link title and rel attributes', () => {
        const result = sanitizeHtml('<a href="https://example.com" title="Example" rel="noopener">Link</a>');
        expect(result).toContain('title="Example"');
        expect(result).toContain('rel="noopener"');
     });

    it('should handle link target attribute', () => {
        const result = sanitizeHtml('<a href="https://example.com" target="_blank">Link</a>');
        expect(result).toContain('target="_blank"');
     });
});
