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
        it('renders nothing when text is empty', () => {
            const { container } = render(<MarkdownPreview text="" />);
            expect(container.querySelector('.markdown-preview')).not.toBeInTheDocument();
        });

        it('applies the markdown-preview class to the wrapper div', () => {
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
    });

    describe('sanitization', () => {
        it('strips <script> tags from raw HTML in markdown input', () => {
            render(
                <MarkdownPreview
                    text="<script>alert('xss')</script><b>Safe Content</b>"
                />
            );
            expect(screen.getByText('Safe Content')).toBeInTheDocument();
            expect(screen.queryByText("alert('xss')")).not.toBeInTheDocument();
        });
    });
});
