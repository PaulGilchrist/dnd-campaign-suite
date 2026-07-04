// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MarkdownPreview from './MarkdownPreview.jsx';

describe('MarkdownPreview', () => {
    describe('null/empty rendering', () => {
        it('returns null for falsy text values', () => {
            const falsyValues = ['', null, undefined, 0, false];

            for (const value of falsyValues) {
                const { container } = render(<MarkdownPreview text={value} />);
                expect(container.innerHTML).toBe('');
            }
        });
    });

    describe('className handling', () => {
        it('merges custom className with the default markdown-preview class', () => {
            render(<MarkdownPreview text="hello" className="custom-class" />);
            const div = document.querySelector('.markdown-preview');
            expect(div).toHaveClass('markdown-preview');
            expect(div).toHaveClass('custom-class');
        });
    });

    describe('markdown rendering', () => {
        it('renders sanitized markdown content', () => {
            render(<MarkdownPreview text="**bold text**" />);
            expect(screen.getByText('bold text')).toBeInTheDocument();
        });
    });
});
