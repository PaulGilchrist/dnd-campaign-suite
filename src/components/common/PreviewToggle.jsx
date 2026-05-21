import { useState } from 'react';
import MarkdownPreview from './MarkdownPreview.jsx';
import './PreviewToggle.css';

/**
 * A textarea with a preview toggle for markdown editing.
 * 
 * Props:
 *   value (string) - The markdown text
 *   onChange (function) - Called with the new value on edit
 *   id (string) - HTML id for the textarea
 *   className (string) - Additional CSS class for the textarea
 *   placeholder (string) - Placeholder text
 *   label (string) - Optional label text displayed above
 *   rows (number) - Number of rows for the textarea (default 4)
 *   minHeight (string) - CSS min-height for textarea (e.g. '80px')
 */
function PreviewToggle({ value, onChange, id, className = '', placeholder = '', label = '', rows = 4, minHeight }) {
    const [previewing, setPreviewing] = useState(false);

    const toggleLabel = previewing ? 'Edit' : 'Preview';

    return (
        <div className="preview-toggle-wrapper">
            <div className="preview-toggle-header">
                {label && <label className="preview-toggle-label" htmlFor={id}>{label}</label>}
                <button
                    type="button"
                    className="preview-toggle-button"
                    onClick={() => setPreviewing(prev => !prev)}
                    aria-label={previewing ? 'Switch to edit mode' : 'Switch to preview mode'}
                >
                    {toggleLabel}
                </button>
            </div>
            {previewing ? (
                <div className="preview-toggle-preview" style={minHeight ? { minHeight } : undefined}>
                    <MarkdownPreview text={value} />
                </div>
            ) : (
                <textarea
                    id={id}
                    className={`preview-toggle-textarea ${className}`.trim()}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={rows}
                    style={minHeight ? { minHeight } : undefined}
                />
            )}
        </div>
    );
}

export default PreviewToggle;
