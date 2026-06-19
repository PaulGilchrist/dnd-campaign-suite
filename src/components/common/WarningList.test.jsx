/* @improved-by-ai */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WarningList from './WarningList.jsx';



describe('WarningList', () => {
    describe('empty/null/undefined handling', () => {
        it('renders nothing when warnings is null, undefined, or empty', () => {
            const { container: c1 } = render(<WarningList warnings={null} />);
            expect(c1.innerHTML).toBe('');

            const { container: c2 } = render(<WarningList />);
            expect(c2.innerHTML).toBe('');

            const { container: c3 } = render(<WarningList warnings={[]} />);
            expect(c3.innerHTML).toBe('');
        });
    });

    it('renders a container div with warning class', () => {
        const warnings = [{ type: 'warning', message: 'Test warning' }];
        render(<WarningList warnings={warnings} />);

        const container = document.querySelector('.warning-container');
        expect(container).not.toBeNull();
    });

    it('renders warning items with correct type class for warning type', () => {
        const warnings = [{ type: 'warning', message: 'This is a warning' }];
        render(<WarningList warnings={warnings} />);

        const item = document.querySelector('.warning-message.warning');
        expect(item).toBeInTheDocument();
        expect(item.textContent).toContain('This is a warning');
    });

    it('renders warning items with correct type class for info type', () => {
        const warnings = [{ type: 'info', message: 'This is info' }];
        render(<WarningList warnings={warnings} />);

        const item = document.querySelector('.warning-message.info');
        expect(item).toBeInTheDocument();
        expect(item.textContent).toContain('This is info');
    });

    it('renders multiple warning items', () => {
        const warnings = [
            { type: 'warning', message: 'Warning 1' },
            { type: 'info', message: 'Info 2' },
            { type: 'warning', message: 'Warning 3' },
        ];
        render(<WarningList warnings={warnings} />);

        expect(screen.getByText('Warning 1')).toBeInTheDocument();
        expect(screen.getByText('Info 2')).toBeInTheDocument();
        expect(screen.getByText('Warning 3')).toBeInTheDocument();
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

    it('renders icons when showIcons is true', () => {
        const warnings = [
            { type: 'warning', message: 'Warning message' },
            { type: 'info', message: 'Info message' },
        ];
        render(<WarningList warnings={warnings} showIcons />);

        const warningItem = document.querySelector('.warning-message.warning');
        expect(warningItem.textContent).toContain('Warning message');
        expect(warningItem.textContent).toContain('\u26A0\uFE0F');

        const infoItem = document.querySelector('.warning-message.info');
        expect(infoItem.textContent).toContain('Info message');
        expect(infoItem.textContent).toContain('\u2139\uFE0F');
    });

    it('renders without icons when showIcons is false', () => {
        const warnings = [{ type: 'warning', message: 'Warning message' }];
        render(<WarningList warnings={warnings} showIcons={false} />);

        expect(screen.getByText('Warning message')).toBeInTheDocument();
        expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
    });

    it('defaults to not showing icons when showIcons is not provided', () => {
        const warnings = [{ type: 'warning', message: 'Warning message' }];
        render(<WarningList warnings={warnings} />);

        expect(screen.getByText('Warning message')).toBeInTheDocument();
        expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
    });

    it('renders icon for unknown type without icon character', () => {
        const warnings = [{ type: 'unknown', message: 'Unknown warning' }];
        render(<WarningList warnings={warnings} showIcons />);

        const item = document.querySelector('.warning-message.unknown');
        expect(item).toBeInTheDocument();
        expect(item.textContent).toContain('Unknown warning');
    });
});
