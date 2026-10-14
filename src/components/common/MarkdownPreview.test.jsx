import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MarkdownPreview from './MarkdownPreview.jsx';

describe('MarkdownPreview', () => {
    describe('null/empty rendering', () => {
        it('returns null for falsy text values', () => {
            const falsyValues = [null, undefined, ''];

            for (const value of falsyValues) {
                const { container } = render(<MarkdownPreview text={value} />);
                expect(container.innerHTML).toBe('');
            }
        });

        it('renders content for zero-length string only when truthy', () => {
            const { container } = render(<MarkdownPreview text="0" />);
            expect(container.innerHTML).not.toBe('');
        });
    });

    describe('className handling', () => {
        it('applies the default markdown-preview class when no custom className is provided', () => {
            render(<MarkdownPreview text="hello" />);
            const div = document.querySelector('.markdown-preview');
            expect(div).toBeInTheDocument();
        });

        it('merges custom className with the default markdown-preview class', () => {
            render(<MarkdownPreview text="hello" className="custom-class" />);
            const div = document.querySelector('.markdown-preview');
            expect(div).toHaveClass('markdown-preview');
            expect(div).toHaveClass('custom-class');
        });

        it('handles empty string as custom className', () => {
            render(<MarkdownPreview text="hello" className="" />);
            const div = document.querySelector('.markdown-preview');
            expect(div).toHaveClass('markdown-preview');
            expect(div.classList.length).toBe(1);
        });

        it('handles multiple space-separated custom classes', () => {
            render(<MarkdownPreview text="hello" className="class-a class-b" />);
            const div = document.querySelector('.markdown-preview');
            expect(div).toHaveClass('class-a');
            expect(div).toHaveClass('class-b');
        });
    });

    describe('markdown rendering', () => {
        it('renders sanitized markdown content', () => {
            render(<MarkdownPreview text="**bold text**" />);
            expect(screen.getByText('bold text')).toBeInTheDocument();
        });

        it('renders an empty div when text is a non-string truthy value', () => {
            const { container } = render(<MarkdownPreview text={123} />);
            const div = container.querySelector('.markdown-preview');
            expect(div).toBeInTheDocument();
            expect(div.innerHTML).toBe('');
        });
    });
});
