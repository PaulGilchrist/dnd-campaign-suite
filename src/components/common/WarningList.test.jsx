// @maintained-by-ai
// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WarningList from './WarningList.jsx';

const WARNING_ICON = '\u26A0\uFE0F';
const INFO_ICON = '\u2139\uFE0F';

describe('WarningList', () => {
	it.each([
		['null', null],
		['undefined', undefined],
		['an empty array', []],
	])('renders nothing when warnings is %s', (_label, warnings) => {
		const { container } = render(<WarningList warnings={warnings} />);
		expect(container).toBeEmptyDOMElement();
	});

	it('renders one line per warning, in the given order', () => {
		const warnings = [
			{ type: 'warning', message: 'Too many feats selected' },
			{ type: 'info', message: 'Consider an Origin feat' },
		];
		const { container } = render(<WarningList warnings={warnings} />);

		expect(container.querySelector('.warning-container')).toBeInTheDocument();
		const items = container.querySelectorAll('.warning-message');
		expect(items).toHaveLength(2);
		expect([...items].map((el) => el.textContent.trim())).toEqual([
			'Too many feats selected',
			'Consider an Origin feat',
		]);
	});

	it('marks each line with its warning type so it can be styled', () => {
		const warnings = [
			{ type: 'warning', message: 'Warning 1' },
			{ type: 'info', message: 'Info 2' },
			{ type: 'error', message: 'Error 3' },
		];
		render(<WarningList warnings={warnings} />);

		expect(screen.getByText('Warning 1')).toHaveClass('warning-message', 'warning');
		expect(screen.getByText('Info 2')).toHaveClass('warning-message', 'info');
		expect(screen.getByText('Error 3')).toHaveClass('warning-message', 'error');
	});

	it('shows plain messages with no icons by default', () => {
		const warnings = [
			{ type: 'warning', message: 'Alert' },
			{ type: 'info', message: 'FYI' },
		];
		const { container } = render(<WarningList warnings={warnings} />);

		const items = container.querySelectorAll('.warning-message');
		expect([...items].map((el) => el.textContent.trim())).toEqual(['Alert', 'FYI']);
	});

	it.each([
		['warning', WARNING_ICON],
		['info', INFO_ICON],
	])('prepends the %s icon when showIcons is true', (type, icon) => {
		const { container } = render(
			<WarningList warnings={[{ type, message: 'Alert' }]} showIcons />
		);

		expect(container.querySelector('.warning-message').textContent.trim()).toBe(`${icon} Alert`);
	});

	it('renders a helpful message for types without an icon even when showIcons is true', () => {
		render(<WarningList warnings={[{ type: 'error', message: 'Danger' }]} showIcons />);

		const item = screen.getByText('Danger');
		expect(item).toHaveClass('warning-message');
		expect(item.textContent).not.toContain('undefined');
		expect(item.textContent).not.toContain(WARNING_ICON);
	});
});
