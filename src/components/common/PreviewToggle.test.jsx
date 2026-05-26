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

    it('toggles to preview mode when button is clicked', () => {
        render(<PreviewToggle value="**bold**" onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(button);

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('renders markdown preview when toggled to preview mode', () => {
        render(<PreviewToggle value="**bold text**" onChange={() => {}} />);
        const button = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(button);

        expect(screen.getByText('bold text')).toBeInTheDocument();
    });

    it('toggles back to edit mode on second click', () => {
        render(<PreviewToggle value="text" onChange={() => {}} />);
        const toggleButton = screen.getByRole('button', { name: /preview/i });
        fireEvent.click(toggleButton);

        const editButton = screen.getByRole('button', { name: /edit/i });
        fireEvent.click(editButton);

        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows label when provided', () => {
        render(
            <PreviewToggle
                value=""
                onChange={() => {}}
                id="desc"
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

    it('calls onChange when textarea value changes', () => {
        const handleChange = vi.fn();
        render(<PreviewToggle value="" onChange={handleChange} />);
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'new text' } });
        expect(handleChange).toHaveBeenCalledWith('new text');
    });

    it('calls onChange with updated value', () => {
        const handleChange = vi.fn();
        render(
            <PreviewToggle value="initial" onChange={handleChange} />
        );
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'updated' } });
        expect(handleChange).toHaveBeenCalledWith('updated');
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
});
