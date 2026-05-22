import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WarningList from './WarningList.jsx';

const warningIcon = '\u26A0\uFE0F';
const infoIcon = '\u2139\uFE0F';

describe('WarningList', () => {
    it('renders null when warnings is null', () => {
        const { container } = render(<WarningList warnings={null} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders null when warnings is undefined', () => {
        const { container } = render(<WarningList />);
        expect(container.innerHTML).toBe('');
    });

    it('renders null when warnings is empty array', () => {
        const { container } = render(<WarningList warnings={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders warning items with correct type class for warning type', () => {
        const warnings = [{ type: 'warning', message: 'This is a warning' }];
        render(<WarningList warnings={warnings} />);

        const items = document.querySelectorAll('.warning-message');
        expect(items).toHaveLength(1);
        expect(items[0]).toHaveClass('warning');
    });

    it('renders warning items with correct type class for info type', () => {
        const warnings = [{ type: 'info', message: 'This is info' }];
        render(<WarningList warnings={warnings} />);

        const items = document.querySelectorAll('.warning-message');
        expect(items).toHaveLength(1);
        expect(items[0]).toHaveClass('info');
    });

    it('renders multiple warning items', () => {
        const warnings = [
            { type: 'warning', message: 'Warning 1' },
            { type: 'info', message: 'Info 2' },
            { type: 'warning', message: 'Warning 3' },
        ];
        render(<WarningList warnings={warnings} />);

        const items = document.querySelectorAll('.warning-message');
        expect(items).toHaveLength(3);
    });

    it('renders warning messages text content', () => {
        const warnings = [
            { type: 'warning', message: 'Something is wrong' },
            { type: 'info', message: 'All good' },
        ];
        render(<WarningList warnings={warnings} />);

        expect(screen.getByText(/Something is wrong/)).toBeInTheDocument();
        expect(screen.getByText(/All good/)).toBeInTheDocument();
    });

    it('renders with icons when showIcons is true', () => {
        const warnings = [
            { type: 'warning', message: 'Warning message' },
            { type: 'info', message: 'Info message' },
        ];
        const { container } = render(
            <WarningList warnings={warnings} showIcons={true} />
        );

        expect(container.innerHTML).toContain(warningIcon);
        expect(container.innerHTML).toContain(infoIcon);
    });

    it('renders without icons when showIcons is false', () => {
        const warnings = [{ type: 'warning', message: 'Warning message' }];
        const { container } = render(
            <WarningList warnings={warnings} showIcons={false} />
        );

        expect(screen.getByText(/Warning message/)).toBeInTheDocument();
        expect(container.innerHTML).not.toContain(warningIcon);
    });

    it('defaults to not showing icons when showIcons is not provided', () => {
        const warnings = [{ type: 'warning', message: 'Warning message' }];
        const { container } = render(<WarningList warnings={warnings} />);

        expect(container.innerHTML).not.toContain(warningIcon);
    });
});
