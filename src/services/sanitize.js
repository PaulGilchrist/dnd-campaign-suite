import DOMPurify from 'dompurify';

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

export default sanitizeHtml;