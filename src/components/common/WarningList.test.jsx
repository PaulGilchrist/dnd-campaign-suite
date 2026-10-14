import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WarningList from './WarningList.jsx';

describe('WarningList', () => {
	it('returns null when warnings is null or empty', () => {
		const { container: c1 } = render(<WarningList warnings={null} />);
		expect(c1.querySelector('.warning-container')).toBeNull();

		const { container: c2 } = render(<WarningList warnings={[]} />);
		expect(c2.querySelector('.warning-container')).toBeNull();
	});

	it('renders each warning message with the correct CSS class', () => {
		const warnings = [
			{ type: 'warning', message: 'Warning 1' },
			{ type: 'info', message: 'Info 2' },
		];
		const { container } = render(<WarningList warnings={warnings} />);

		expect(screen.getByText('Warning 1')).toBeInTheDocument();
		expect(screen.getByText('Info 2')).toBeInTheDocument();
		expect(container.querySelector('.warning-message.warning')).toBeInTheDocument();
		expect(container.querySelector('.warning-message.info')).toBeInTheDocument();
	});

	it('renders plain text without icon prefix when showIcons is false', () => {
		const warnings = [{ type: 'warning', message: 'Alert' }];
		render(<WarningList warnings={warnings} />);
		expect(screen.getByText('Alert')).toBeInTheDocument();
	});

	it.each([
		['warning', '\u26A0\uFE0F'],
		['info', '\u2139\uFE0F'],
	])('prepends the %s icon emoji when showIcons is true', (type, emoji) => {
		const warnings = [{ type, message: 'Alert' }];
		const { container } = render(<WarningList warnings={warnings} showIcons />);
		const el = container.querySelector('.warning-message');
		expect(el.textContent).toContain(emoji);
	});
});
