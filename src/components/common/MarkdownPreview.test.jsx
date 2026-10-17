// @maintained-by-ai
// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MarkdownPreview from './MarkdownPreview.jsx';

// Markdown-to-HTML conversion and sanitization are covered exhaustively at the
// service level in src/services/ui/sanitize.test.js. These tests verify the
// component's own contract: when it renders, what wrapper it produces, and
// that unsafe markup never reaches the DOM through its dangerouslySetInnerHTML.
describe('MarkdownPreview', () => {
    describe('visibility', () => {
        it.each([null, undefined, ''])('renders nothing when text is %p', (text) => {
            const { container } = render(<MarkdownPreview text={text} />);
            expect(container).toBeEmptyDOMElement();
        });

        it('renders the string "0" rather than treating it as falsy', () => {
            render(<MarkdownPreview text="0" />);
            expect(screen.getByText('0')).toBeInTheDocument();
        });

        it('renders an empty wrapper for whitespace-only text without crashing', () => {
            const { container } = render(<MarkdownPreview text={'   \n  '} />);
            const div = container.querySelector('.markdown-preview');
            expect(div).toBeInTheDocument();
            expect(div).toBeEmptyDOMElement();
        });

        it('renders an empty wrapper for a non-string truthy value without crashing', () => {
            const { container } = render(<MarkdownPreview text={123} />);
            const div = container.querySelector('.markdown-preview');
            expect(div).toBeInTheDocument();
            expect(div).toBeEmptyDOMElement();
        });
    });

    describe('markdown rendering', () => {
        it('converts emphasis markdown into semantic elements, not plain text', () => {
            render(<MarkdownPreview text="**bold text** and *italic text*" />);
            expect(screen.getByText('bold text').tagName).toBe('STRONG');
            expect(screen.getByText('italic text').tagName).toBe('EM');
        });

        it('renders block structure such as headings and lists', () => {
            render(<MarkdownPreview text={'## Tactics\n\n- first\n- second'} />);
            expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Tactics');
            const items = screen.getAllByRole('listitem');
            expect(items).toHaveLength(2);
            expect(items[0]).toHaveTextContent('first');
        });
    });

    describe('security', () => {
        it('keeps safe content while dropping scripts and javascript: links', () => {
            const { container } = render(
                <MarkdownPreview text={'Safe text\n\n[click](javascript:alert(1))\n\n<script>alert(2)</script>'} />
            );
            expect(screen.getByText('Safe text')).toBeInTheDocument();
            expect(container.querySelector('script')).toBeNull();
            expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
        });

        it('renders safe links with their href intact', () => {
            const { container } = render(<MarkdownPreview text="[docs](https://example.com)" />);
            expect(container.querySelector('a[href="https://example.com"]')).toBeInTheDocument();
        });
    });

    describe('className handling', () => {
        it('applies only the markdown-preview class by default', () => {
            const { container } = render(<MarkdownPreview text="hello" />);
            const div = container.querySelector('.markdown-preview');
            expect(Array.from(div.classList)).toEqual(['markdown-preview']);
        });

        it.each([
            ['custom-class', ['markdown-preview', 'custom-class']],
            ['', ['markdown-preview']],
            ['class-a class-b', ['markdown-preview', 'class-a', 'class-b']],
        ])('merges className %p onto the wrapper', (className, expectedClasses) => {
            const { container } = render(<MarkdownPreview text="hello" className={className} />);
            const div = container.querySelector('.markdown-preview');
            expect(Array.from(div.classList).sort()).toEqual([...expectedClasses].sort());
        });
    });
});
