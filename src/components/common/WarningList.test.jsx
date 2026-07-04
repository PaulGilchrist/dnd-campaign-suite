/* @improved-by-ai */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WarningList from './WarningList.jsx';

describe('WarningList', () => {
	it('renders nothing when warnings is null or empty', () => {
		const { container } = render(<WarningList warnings={null} />);
		expect(container.innerHTML).toBe('');

		const emptyContainer = render(<WarningList warnings={[]} />);
		expect(emptyContainer.container.innerHTML).toBe('');
	});

	it('renders warning items with messages and icons', () => {
		const warnings = [
			{ type: 'warning', message: 'Warning 1' },
			{ type: 'info', message: 'Info 2' },
			{ type: 'warning', message: 'Warning 3' },
		];
		render(<WarningList warnings={warnings} showIcons />);

		expect(screen.getByText(/Warning 1/)).toBeInTheDocument();
		expect(screen.getByText(/Info 2/)).toBeInTheDocument();
		expect(screen.getByText(/Warning 3/)).toBeInTheDocument();
	});
});
