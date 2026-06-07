import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Sanitizes HTML content to prevent XSS attacks while allowing safe HTML elements
 * commonly used in D&D character descriptions.
 *
 * Allowed elements include:
 * - Text formatting: b, strong, i, em, u, s, small, sub, sup, mark, code, span
 * - Lists: ul, ol, li
 * - Tables: table, thead, tbody, tfoot, tr, th, td, caption, col, colgroup
 * - Block elements: p, div, blockquote, pre, hr, br
 * - Links: a
 * - Headings: h1, h2, h3, h4, h5, h6
 * - Details/Summary: details, summary
 */
const allowedTags = [
     // Text formatting
     'b', 'strong', 'i', 'em', 'u', 's', 'small', 'sub', 'sup', 'mark', 'code', 'span',
     // Lists
     'ul', 'ol', 'li',
     // Tables
     'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
     // Block elements
     'p', 'div', 'blockquote', 'pre', 'hr', 'br',
     // Links
     'a',
     // Headings
     'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
     // Details/Summary
     'details', 'summary',
];

/**
 * Sanitizes HTML content using DOMPurify with a permissive but safe configuration.
 *
 * @param {string} html - The HTML string to sanitize
 * @returns {string} The sanitized HTML string
 */
export function sanitizeHtml(html) {
    if (!html || typeof html !== 'string') {
        return '';
    }

    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: allowedTags,
        ALLOWED_ATTR: [
             // For links
             'href', 'title', 'target', 'rel',
             // For spans and other elements
             'class', 'style',
         ],
         // Allow data attributes
        ADD_ATTR: ['data-*'],
    });
}

/**
 * Converts markdown to safe HTML.
 * Parses markdown using `marked.parse()`, then sanitizes the result.
 *
 * @param {string} markdown - The markdown string to convert
 * @returns {string} The safe HTML string, or empty string for invalid input or on error
 */
export function renderMarkdown(markdown) {
    if (!markdown || typeof markdown !== 'string') {
        return '';
    }

    try {
        const html = marked.parse(markdown);
        return sanitizeHtml(html);
    } catch {
        return '';
    }
}

/**
 * Converts inline markdown to safe HTML, without block-level wrappers like <p>.
 * Uses `marked.parseInline()` for inline rendering (bold, italic, links, etc.).
 * Useful for rendering markdown inline with surrounding text (e.g., next to a name label).
 *
 * @param {string} markdown - The inline markdown string to convert
 * @returns {string} The safe HTML string, or empty string for invalid input or on error
 */
export function renderMarkdownInline(markdown) {
    if (!markdown || typeof markdown !== 'string') {
        return '';
    }

    try {
        const html = marked.parseInline(markdown);
        return sanitizeHtml(html);
    } catch {
        return '';
    }
}

