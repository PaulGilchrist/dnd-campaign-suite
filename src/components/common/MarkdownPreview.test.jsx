import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MarkdownPreview from './MarkdownPreview.jsx';

describe('MarkdownPreview', () => {
    it('renders null when text is empty string', () => {
        const { container } = render(<MarkdownPreview text="" />);
        expect(container.innerHTML).toBe('');
    });

    it('renders null when text is null', () => {
        const { container } = render(<MarkdownPreview text={null} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders null when text is undefined', () => {
        const { container } = render(<MarkdownPreview />);
        expect(container.innerHTML).toBe('');
    });

    it('renders markdown text as HTML', () => {
        render(<MarkdownPreview text="**bold text**" />);
        expect(screen.getByText('bold text')).toBeInTheDocument();
    });

    it('renders inline code markdown', () => {
        render(<MarkdownPreview text="`code snippet`" />);
        expect(screen.getByText('code snippet')).toBeInTheDocument();
    });

    it('applies default className', () => {
        render(<MarkdownPreview text="hello" />);
        const div = document.querySelector('.markdown-preview');
        expect(div).toBeInTheDocument();
    });

    it('applies custom className prop alongside default', () => {
        render(<MarkdownPreview text="hello" className="custom-class" />);
        const div = document.querySelector('.markdown-preview');
        expect(div).toHaveClass('markdown-preview');
        expect(div).toHaveClass('custom-class');
    });

    it('sanitizes script tags from markdown input', () => {
        render(
            <MarkdownPreview
                text="<script>alert('xss')</script><b>Safe Content</b>"
            />
        );
        expect(screen.getByText('Safe Content')).toBeInTheDocument();
        expect(screen.queryByText("alert('xss')")).not.toBeInTheDocument();
    });
});
