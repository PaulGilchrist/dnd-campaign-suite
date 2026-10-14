// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PreviewToggle from './PreviewToggle.jsx';

// jsdom does not apply imported CSS, so display:none visibility cannot be
// asserted with toBeVisible(). The --hidden modifier classes below are this
// component's visibility contract with PreviewToggle.css; they are asserted
// only through these helpers so the class names live in exactly one place.
function expectEditMode() {
    expect(screen.getByRole('textbox')).not.toHaveClass('preview-toggle-textarea--hidden');
    expect(document.querySelector('.preview-toggle-preview')).toHaveClass('preview-toggle-preview--hidden');
    const button = screen.getByRole('button', { name: 'Switch to preview mode' });
    expect(button).toHaveTextContent('Preview');
}

function expectPreviewMode() {
    expect(screen.getByRole('textbox')).toHaveClass('preview-toggle-textarea--hidden');
    expect(document.querySelector('.preview-toggle-preview')).not.toHaveClass('preview-toggle-preview--hidden');
    const button = screen.getByRole('button', { name: 'Switch to edit mode' });
    expect(button).toHaveTextContent('Edit');
}

function toggleButton() {
    return screen.getByRole('button', { name: /switch to (preview|edit) mode/i });
}

describe('PreviewToggle', () => {
    describe('default (edit) mode', () => {
        it('starts in edit mode with the current value in a textarea, defaulting to 4 rows', () => {
            render(<PreviewToggle value="Hello world" onChange={() => {}} />);
            expect(screen.getByRole('textbox')).toHaveValue('Hello world');
            expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4');
            expectEditMode();
        });

        it('never submits an enclosing form when the toggle is clicked', () => {
            const handleSubmit = vi.fn();
            render(
                <form onSubmit={handleSubmit}>
                    <PreviewToggle value="" onChange={() => {}} />
                </form>
            );
            fireEvent.click(toggleButton());
            expect(handleSubmit).not.toHaveBeenCalled();
        });

        it('renders no label element when label is omitted', () => {
            const { container } = render(<PreviewToggle value="" onChange={() => {}} />);
            expect(container.querySelector('label')).toBeNull();
        });

        it('associates the label with the textarea when provided', () => {
            render(<PreviewToggle value="" onChange={() => {}} id="my-id" label="Description" />);
            // getByLabelText verifies the label<->textarea pairing without
            // depending on the label's class name or the for attribute directly.
            expect(screen.getByLabelText('Description')).toBe(screen.getByRole('textbox'));
        });

        it('shows the placeholder in the textarea', () => {
            render(<PreviewToggle value="" onChange={() => {}} placeholder="Enter text..." />);
            expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Enter text...');
        });
    });

    describe('toggling between modes', () => {
        it('switches to preview mode and back, updating button text and aria-label each time', () => {
            render(<PreviewToggle value="**bold text**" onChange={() => {}} />);

            expectEditMode();

            fireEvent.click(toggleButton());
            expectPreviewMode();

            fireEvent.click(toggleButton());
            expectEditMode();
        });

        it('does not call onChange when the mode is toggled', () => {
            const handleChange = vi.fn();
            render(<PreviewToggle value="untouched" onChange={handleChange} />);
            fireEvent.click(toggleButton());
            fireEvent.click(toggleButton());
            expect(handleChange).not.toHaveBeenCalled();
        });
    });

    describe('preview content', () => {
        // Markdown-to-HTML conversion and sanitization are covered in
        // MarkdownPreview.test.jsx and sanitize.test.js — these tests verify
        // only that the toggle wires the *current* value into the preview.
        it('shows the markdown value rendered as HTML in preview mode', () => {
            render(<PreviewToggle value="**bold text**" onChange={() => {}} />);
            fireEvent.click(toggleButton());

            const preview = document.querySelector('.preview-toggle-preview');
            expect(preview).toHaveTextContent('bold text');
            // Rendered, not literal: emphasis becomes a semantic element and
            // the markdown syntax characters are gone.
            expect(preview.querySelector('strong')).toHaveTextContent('bold text');
            expect(preview.textContent).not.toContain('**');
        });

        it('previews the latest value after the user edits in edit mode', () => {
            // Controlled-component flow: onChange -> parent state -> rerender.
            const handleChange = vi.fn();
            const view = render(<PreviewToggle value="first" onChange={handleChange} />);
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'second' } });
            view.rerender(<PreviewToggle value="second" onChange={handleChange} />);

            fireEvent.click(toggleButton());
            const preview = document.querySelector('.markdown-preview');
            expect(preview).toHaveTextContent('second');
            expect(preview).not.toHaveTextContent('first');
        });

        it('renders an empty preview when the value is empty', () => {
            render(<PreviewToggle value="" onChange={() => {}} />);
            fireEvent.click(toggleButton());

            const preview = document.querySelector('.preview-toggle-preview');
            expect(preview).not.toHaveClass('preview-toggle-preview--hidden');
            expect(preview).toBeEmptyDOMElement();
        });
    });

    describe('change handling', () => {
        it('calls onChange with the new value when the textarea is edited', () => {
            const handleChange = vi.fn();
            render(<PreviewToggle value="initial" onChange={handleChange} />);
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'updated' } });
            expect(handleChange).toHaveBeenCalledWith('updated');
        });
    });

    describe('attribute passthrough', () => {
        it('applies custom rows to the textarea', () => {
            render(<PreviewToggle value="" onChange={() => {}} rows={8} />);
            expect(screen.getByRole('textbox')).toHaveAttribute('rows', '8');
        });

        it('keeps the base textarea class and appends a custom className', () => {
            render(<PreviewToggle value="" onChange={() => {}} className="custom-class" />);
            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveClass('preview-toggle-textarea', 'custom-class');
        });

        it('applies minHeight to the textarea only when provided', () => {
            const { rerender } = render(<PreviewToggle value="" onChange={() => {}} />);
            expect(screen.getByRole('textbox')).not.toHaveAttribute('style');

            rerender(<PreviewToggle value="" onChange={() => {}} minHeight="200px" />);
            expect(screen.getByRole('textbox')).toHaveStyle({ minHeight: '200px' });
        });

        it('applies minHeight to the preview so both panes stay the same height', () => {
            render(<PreviewToggle value="text" onChange={() => {}} minHeight="200px" />);
            fireEvent.click(toggleButton());
            expect(document.querySelector('.preview-toggle-preview')).toHaveStyle({ minHeight: '200px' });
        });
    });
});
