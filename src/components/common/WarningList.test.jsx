/* @cleaned-by-ai */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WarningList from './WarningList.jsx';

describe('WarningList', () => {
	it('renders nothing when warnings is null or empty', () => {
		const { container } = render(<WarningList warnings={[]} />);
		expect(container.innerHTML).toBe('');
	});

	it('renders warning messages', () => {
		const warnings = [
			{ type: 'warning', message: 'Warning 1' },
			{ type: 'info', message: 'Info 2' },
		];
		render(<WarningList warnings={warnings} />);

		expect(screen.getByText(/Warning 1/)).toBeInTheDocument();
		expect(screen.getByText(/Info 2/)).toBeInTheDocument();
	});

	it('renders icons when showIcons is true', () => {
		const warnings = [{ type: 'warning', message: 'Alert' }];
		render(<WarningList warnings={warnings} showIcons />);

		expect(screen.getByText('\u26A0\uFE0F Alert')).toBeInTheDocument();
	});

	it('renders without icons by default', () => {
		const warnings = [{ type: 'info', message: 'Notice' }];
		render(<WarningList warnings={warnings} />);

		expect(screen.getByText('Notice')).toBeInTheDocument();
		expect(screen.queryByText('\u2139\uFE0F Notice')).not.toBeInTheDocument();
	});
});
