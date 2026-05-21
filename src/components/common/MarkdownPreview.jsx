import { renderMarkdown } from '../../services/sanitize.js';

/**
 * Renders markdown text as sanitized HTML.
 * @param {string} text - The markdown string to render
 */
function MarkdownPreview({ text, className = '' }) {
    if (!text) return null;

    const html = renderMarkdown(text);

    return (
        <div
            className={`markdown-preview ${className}`.trim()}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

export default MarkdownPreview;
