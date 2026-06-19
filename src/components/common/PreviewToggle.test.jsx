/* @improved-by-ai */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PreviewToggle from './PreviewToggle.jsx';

describe('PreviewToggle', () => {
    it('renders a textarea initially', () => {
        render(<PreviewToggle value="" onChange={() => {}} />);
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders the toggle button with Preview label initially', () => {
        render(<PreviewToggle value="" onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent('Preview');
    });

    it('displays the initial value in the textarea', () => {
        render(<PreviewToggle value="Hello world" onChange={() => {}} />);
        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveValue('Hello world');
    });

    it('does not hide the textarea initially', () => {
        render(<PreviewToggle value="text" onChange={() => {}} />);
        const textarea = screen.getByRole('textbox');
        expect(textarea).not.toHaveClass('preview-toggle-textarea--hidden');
    });

    it('does not show the preview div initially', () => {
        render(<PreviewToggle value="**bold**" onChange={() => {}} />);
        const previewDiv = document.querySelector('.preview-toggle-preview');
        expect(previewDiv).toHaveClass('preview-toggle-preview--hidden');
    });

    it('toggles to preview mode when button is clicked', () => {
        render(<PreviewToggle value="**bold**" onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(button);

        expect(screen.getByRole('textbox')).toHaveClass('preview-toggle-textarea--hidden');
    });

    it('hides the textarea and shows preview when toggled', () => {
        render(<PreviewToggle value="**bold text**" onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(button);

        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveClass('preview-toggle-textarea--hidden');

        const previewDiv = document.querySelector('.preview-toggle-preview');
        expect(previewDiv).not.toHaveClass('preview-toggle-preview--hidden');
    });

    it('renders markdown as HTML in preview mode', () => {
        render(<PreviewToggle value="**bold text**" onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(button);

        expect(screen.getByRole('textbox')).toHaveClass('preview-toggle-textarea--hidden');
        const html = document.querySelector('.markdown-preview');
        expect(html).toHaveTextContent('bold text');
        expect(html.querySelector('strong')).toBeTruthy();
    });

    it('renders italic markdown in preview mode', () => {
        render(<PreviewToggle value="*italic text*" onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(button);

        const html = document.querySelector('.markdown-preview');
        expect(html).toHaveTextContent('italic text');
        expect(html.querySelector('em')).toBeTruthy();
    });

    it('toggles back to edit mode on second click', () => {
        render(<PreviewToggle value="text" onChange={() => {}} />);
        const toggleButton = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(toggleButton);

        const editButton = screen.getByRole('button', { name: /edit/i });
        fireEvent.click(editButton);

        expect(screen.getByRole('textbox')).not.toHaveClass('preview-toggle-textarea--hidden');
        const previewDiv = document.querySelector('.preview-toggle-preview');
        expect(previewDiv).toHaveClass('preview-toggle-preview--hidden');
    });

    it('changes toggle button label from Preview to Edit when toggled', () => {
        render(<PreviewToggle value="text" onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        expect(button).toHaveTextContent('Preview');

        fireEvent.click(button);
        expect(button).toHaveTextContent('Edit');
    });

    it('changes aria-label when toggling between modes', () => {
        render(<PreviewToggle value="text" onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        expect(button).toHaveAttribute('aria-label', 'Switch to preview mode');

        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-label', 'Switch to edit mode');
    });

    it('does not show preview when value is empty', () => {
        render(<PreviewToggle value="" onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(button);

        expect(document.querySelector('.markdown-preview')).not.toBeInTheDocument();
    });

    it('does not show preview when value is null', () => {
        render(<PreviewToggle value={null} onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(button);

        expect(document.querySelector('.markdown-preview')).not.toBeInTheDocument();
    });

    it('does not show preview when value is undefined', () => {
        render(<PreviewToggle value={undefined} onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(button);

        expect(document.querySelector('.markdown-preview')).not.toBeInTheDocument();
    });

    it('shows label when provided', () => {
        render(
            <PreviewToggle
                value=""
                onChange={() => {}}
                id="description"
                label="Description"
            />
        );
        expect(screen.getByText('Description')).toBeInTheDocument();
        const label = document.querySelector('.preview-toggle-label');
        expect(label).toBeInTheDocument();
    });

    it('does not show label element when label is not provided', () => {
        render(<PreviewToggle value="" onChange={() => {}} />);
        expect(document.querySelector('.preview-toggle-label')).toBeNull();
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

    it('applies custom minHeight to textarea', () => {
        render(
            <PreviewToggle value="" onChange={() => {}} minHeight="120px" />
        );
        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveStyle({ minHeight: '120px' });
    });

    it('applies custom minHeight to preview div', () => {
        render(
            <PreviewToggle value="text" onChange={() => {}} minHeight="200px" />
        );
        const button = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(button);

        const previewDiv = document.querySelector('.preview-toggle-preview');
        expect(previewDiv).toHaveStyle({ minHeight: '200px' });
    });

    it('does not apply minHeight style when not provided', () => {
        render(<PreviewToggle value="" onChange={() => {}} />);
        const textarea = screen.getByRole('textbox');
        expect(textarea.style.minHeight).toBe('');
    });

    it('applies custom className to textarea', () => {
        render(
            <PreviewToggle
                value=""
                onChange={() => {}}
                className="custom-area"
            />
        );
        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveClass('custom-area');
    });

    it('applies both custom className and base class to textarea', () => {
        render(
            <PreviewToggle
                value=""
                onChange={() => {}}
                className="custom-area"
            />
        );
        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveClass('preview-toggle-textarea');
        expect(textarea).toHaveClass('custom-area');
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

    it('uses default rows when not provided', () => {
        render(<PreviewToggle value="" onChange={() => {}} />);
        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveAttribute('rows', '4');
    });

    it('calls onChange when textarea value changes', () => {
        const handleChange = vi.fn();
        render(<PreviewToggle value="" onChange={handleChange} />);
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'new text' } });
        expect(handleChange).toHaveBeenCalledWith('new text');
    });

    it('calls onChange with updated value from initial content', () => {
        const handleChange = vi.fn();
        render(
            <PreviewToggle value="initial" onChange={handleChange} />
        );
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'updated' } });
        expect(handleChange).toHaveBeenCalledWith('updated');
    });

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

    it('wraps content in preview-toggle-wrapper div', () => {
        render(<PreviewToggle value="" onChange={() => {}} />);
        expect(document.querySelector('.preview-toggle-wrapper')).toBeInTheDocument();
    });

    it('wraps label and button in preview-toggle-header div', () => {
        render(
            <PreviewToggle
                value=""
                onChange={() => {}}
                label="Test"
            />
        );
        expect(document.querySelector('.preview-toggle-header')).toBeInTheDocument();
    });
});
