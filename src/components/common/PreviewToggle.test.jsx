import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PreviewToggle from './PreviewToggle.jsx';

describe('PreviewToggle', () => {
    describe('initial render', () => {
        it('renders a textarea with the initial value and default rows', () => {
            render(<PreviewToggle value="Hello world" onChange={() => {}} />);
            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveValue('Hello world');
            expect(textarea).toHaveAttribute('rows', '4');
        });

        it('renders the toggle button with Preview label and correct aria-label', () => {
            render(<PreviewToggle value="" onChange={() => {}} />);
            const button = screen.getByRole('button', { name: /preview/i });
            expect(button).toHaveTextContent('Preview');
            expect(button).toHaveAttribute('aria-label', 'Switch to preview mode');
        });

        it('renders a label element when provided and associates it via htmlFor', () => {
            render(
                <PreviewToggle
                    value=""
                    onChange={() => {}}
                    id="my-id"
                    label="Description"
                />
            );
            expect(screen.getByText('Description')).toBeInTheDocument();
            expect(document.querySelector('.preview-toggle-label')).toHaveAttribute('for', 'my-id');
        });

        it('renders textarea with placeholder', () => {
            render(
                <PreviewToggle
                    value=""
                    onChange={() => {}}
                    placeholder="Enter text..."
                />
            );
            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveAttribute('placeholder', 'Enter text...');
        });
    });

    describe('props passthrough', () => {
        it('passes the id prop to the textarea', () => {
            render(
                <PreviewToggle
                    value=""
                    onChange={() => {}}
                    id="my-textarea"
                />
            );
            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveAttribute('id', 'my-textarea');
        });

        it('applies custom rows to textarea', () => {
            render(
                <PreviewToggle
                    value=""
                    onChange={() => {}}
                    rows={8}
                />
            );
            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveAttribute('rows', '8');
        });

        it('applies custom minHeight to both textarea and preview', () => {
            render(<PreviewToggle value="text" onChange={() => {}} minHeight="200px" />);
            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveStyle({ minHeight: '200px' });

            const button = screen.getByRole('button', { name: /preview/i });
            fireEvent.click(button);

            const previewDiv = document.querySelector('.preview-toggle-preview');
            expect(previewDiv).toHaveStyle({ minHeight: '200px' });
        });

        it('applies custom className to the textarea', () => {
            render(<PreviewToggle value="" onChange={() => {}} className="custom-class" />);
            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveClass('custom-class');
        });
    });

    describe('toggle behavior', () => {
        it('toggles between edit and preview modes, updating button label and visibility', () => {
            render(<PreviewToggle value="**bold text**" onChange={() => {}} />);
            const button = screen.getByRole('button', { name: /preview/i });
            const textarea = screen.getByRole('textbox');
            const previewDiv = document.querySelector('.preview-toggle-preview');

            // Initial state: edit mode
            expect(textarea).not.toHaveClass('preview-toggle-textarea--hidden');
            expect(previewDiv).toHaveClass('preview-toggle-preview--hidden');
            expect(button).toHaveTextContent('Preview');
            expect(button).toHaveAttribute('aria-label', 'Switch to preview mode');

            // Toggle to preview
            fireEvent.click(button);
            expect(textarea).toHaveClass('preview-toggle-textarea--hidden');
            expect(previewDiv).not.toHaveClass('preview-toggle-preview--hidden');
            expect(button).toHaveTextContent('Edit');
            expect(button).toHaveAttribute('aria-label', 'Switch to edit mode');

            // Toggle back to edit
            fireEvent.click(button);
            expect(textarea).not.toHaveClass('preview-toggle-textarea--hidden');
            expect(previewDiv).toHaveClass('preview-toggle-preview--hidden');
            expect(button).toHaveTextContent('Preview');
            expect(button).toHaveAttribute('aria-label', 'Switch to preview mode');
        });
    });

    describe('markdown preview', () => {
        it('renders markdown as HTML in preview mode', () => {
            render(<PreviewToggle value="**bold text**" onChange={() => {}} />);
            const button = screen.getByRole('button', { name: /preview/i });
            fireEvent.click(button);

            const html = document.querySelector('.markdown-preview');
            expect(html).toHaveTextContent('bold text');
            expect(html.querySelector('strong')).toBeTruthy();
        });
    });

    describe('onChange', () => {
        it('calls onChange with the new value when textarea changes', () => {
            const handleChange = vi.fn();
            render(<PreviewToggle value="initial" onChange={handleChange} />);
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, { target: { value: 'updated' } });
            expect(handleChange).toHaveBeenCalledWith('updated');
        });
    });
});
