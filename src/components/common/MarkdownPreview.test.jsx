// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MarkdownPreview from './MarkdownPreview.jsx';

describe('MarkdownPreview', () => {
    describe('null/empty rendering', () => {
        it('returns null for falsy text values: empty string, null, undefined, 0, false', () => {
            const falsyValues = ['', null, undefined, 0, false];

            for (const value of falsyValues) {
                const { container } = render(<MarkdownPreview text={value} />);
                expect(container.innerHTML).toBe('');
            }
        });
    });

    describe('markdown rendering', () => {
        it('renders bold text wrapped in <strong>', () => {
            render(<MarkdownPreview text="**bold**" />);
            expect(screen.getByText('bold')).toBeInTheDocument();
            expect(screen.getByText('bold').closest('strong')).toBeInTheDocument();
        });

        it('renders italic text using underscores', () => {
            render(<MarkdownPreview text="_italic_" />);
            expect(screen.getByText('italic')).toBeInTheDocument();
            expect(screen.getByText('italic').closest('em')).toBeInTheDocument();
        });

        it('renders italic text using asterisks', () => {
            render(<MarkdownPreview text="*italic*" />);
            expect(screen.getByText('italic')).toBeInTheDocument();
            expect(screen.getByText('italic').closest('em')).toBeInTheDocument();
        });

        it('renders inline code wrapped in <code>', () => {
            render(<MarkdownPreview text="`code snippet`" />);
            expect(screen.getByText('code snippet')).toBeInTheDocument();
            expect(screen.getByText('code snippet').closest('code')).toBeInTheDocument();
        });

        it('renders a level-1 heading', () => {
            render(<MarkdownPreview text="# Heading Level 1" />);
            const heading = screen.getByText('Heading Level 1');
            expect(heading).toBeInTheDocument();
            expect(heading.tagName).toBe('H1');
        });

        it('renders a level-3 heading', () => {
            render(<MarkdownPreview text="### Heading Level 3" />);
            const heading = screen.getByText('Heading Level 3');
            expect(heading).toBeInTheDocument();
            expect(heading.tagName).toBe('H3');
        });

        it('renders a link with href attribute preserved', () => {
            render(<MarkdownPreview text="[link text](https://example.com)" />);
            const link = screen.getByText('link text');
            expect(link).toBeInTheDocument();
            expect(link.tagName).toBe('A');
            expect(link).toHaveAttribute('href', 'https://example.com');
        });

        it('renders a link with title attribute', () => {
            render(<MarkdownPreview text={`[link text](https://example.com "Example")`} />);
            const link = screen.getByText('link text');
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute('title', 'Example');
        });

        it('renders a blockquote', () => {
            render(<MarkdownPreview text="> quoted text" />);
            expect(screen.getByText('quoted text')).toBeInTheDocument();
            const blockquote = document.querySelector('blockquote');
            expect(blockquote).toBeInTheDocument();
        });

        it('renders a horizontal rule', () => {
            render(<MarkdownPreview text="---" />);
            const hr = document.querySelector('hr');
            expect(hr).toBeInTheDocument();
        });

        it('wraps paragraph content in <p> tags', () => {
            render(<MarkdownPreview text="hello world" />);
            const paragraph = document.querySelector('p');
            expect(paragraph).toBeInTheDocument();
            expect(paragraph.textContent).toBe('hello world');
        });
    });

    describe('className handling', () => {
        it('returns null (no wrapper div) when text is empty', () => {
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

        it('applies multiple custom classes alongside the default', () => {
            render(<MarkdownPreview text="hello" className="class-a class-b" />);
            const div = document.querySelector('.markdown-preview');
            expect(div).toHaveClass('markdown-preview');
            expect(div).toHaveClass('class-a');
            expect(div).toHaveClass('class-b');
        });

        it('applies the default class when className is an empty string', () => {
            render(<MarkdownPreview text="hello" className="" />);
            const div = document.querySelector('.markdown-preview');
            expect(div).toBeInTheDocument();
            expect(div).toHaveClass('markdown-preview');
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

        it('strips javascript: URLs from link href attributes', () => {
            render(
                <MarkdownPreview
                    text="[click here](javascript:alert('xss'))"
                />
            );
            const link = screen.getByText('click here');
            expect(link).toBeInTheDocument();
            expect(link).not.toHaveAttribute('href', "javascript:alert('xss')");
        });

        it('strips inline event handlers like onclick from allowed tags', () => {
            render(
                <MarkdownPreview
                    text='<b onclick="alert(1)">Safe Content</b>'
                />
            );
            expect(screen.getByText('Safe Content')).toBeInTheDocument();
            const bold = document.querySelector('b');
            expect(bold).not.toHaveAttribute('onclick');
        });

        it('strips iframe tags from markdown input', () => {
            render(
                <MarkdownPreview
                    text='<iframe src="https://evil.com"></iframe><b>Safe Content</b>'
                />
            );
            expect(screen.getByText('Safe Content')).toBeInTheDocument();
            expect(document.querySelector('iframe')).not.toBeInTheDocument();
        });
    });
});
