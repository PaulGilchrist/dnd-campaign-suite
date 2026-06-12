import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import HpBar from './HpBar.jsx';

describe('HpBar', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    describe('rendering structure', () => {
        it('should render hp-bar-container div', () => {
            const { container } = render(<HpBar current={10} max={20} />);
            expect(container.querySelector('.hp-bar-container')).toBeInTheDocument();
        });

        it('should render hp-bar-fill div inside container', () => {
            const { container } = render(<HpBar current={10} max={20} />);
            expect(container.querySelector('.hp-bar-fill')).toBeInTheDocument();
        });
    });

    describe('percentage calculation', () => {
        it('should calculate 50% for half HP', () => {
            const { container } = render(<HpBar current={10} max={20} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ width: '50%' });
        });

        it('should calculate 100% when current equals max', () => {
            const { container } = render(<HpBar current={20} max={20} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ width: '100%' });
        });

        it('should calculate 0% when current is 0', () => {
            const { container } = render(<HpBar current={0} max={20} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ width: '0%' });
        });

        it('should calculate percentage correctly for arbitrary values', () => {
            const { container } = render(<HpBar current={7} max={20} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ width: '35%' });
        });

        it('should clamp percentage to 100% when current exceeds max', () => {
            const { container } = render(<HpBar current={30} max={20} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ width: '100%' });
        });

        it('should clamp percentage to 0% when current is negative', () => {
            const { container } = render(<HpBar current={-5} max={20} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ width: '0%' });
        });
    });

    describe('color thresholds', () => {
        it('should use green when percentage is above 50%', () => {
            const { container } = render(<HpBar current={51} max={100} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ backgroundColor: '#2ecc71' });
        });

        it('should use green when percentage is exactly 100%', () => {
            const { container } = render(<HpBar current={20} max={20} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ backgroundColor: '#2ecc71' });
        });

        it('should use yellow when percentage is above 25% and at or below 50%', () => {
            const { container } = render(<HpBar current={26} max={100} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ backgroundColor: '#f1c40f' });
        });

        it('should use yellow when percentage is exactly 50%', () => {
            const { container } = render(<HpBar current={50} max={100} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ backgroundColor: '#f1c40f' });
        });

        it('should use yellow when percentage is above 25% and below 50%', () => {
            const { container } = render(<HpBar current={26} max={100} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ backgroundColor: '#f1c40f' });
        });

        it('should use red when percentage is at or below 25%', () => {
            const { container } = render(<HpBar current={25} max={100} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ backgroundColor: '#e74c3c' });
        });

        it('should use red when percentage is 0%', () => {
            const { container } = render(<HpBar current={0} max={20} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ backgroundColor: '#e74c3c' });
        });

        it('should use red when percentage is very low', () => {
            const { container } = render(<HpBar current={1} max={100} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ backgroundColor: '#e74c3c' });
        });
    });

    describe('edge cases', () => {
        it('should handle max of 0 by defaulting to 0%', () => {
            const { container } = render(<HpBar current={10} max={0} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ width: '0%' });
        });

        it('should handle negative max by defaulting to 0%', () => {
            const { container } = render(<HpBar current={10} max={-5} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ width: '0%' });
        });

        it('should handle zero current and zero max', () => {
            const { container } = render(<HpBar current={0} max={0} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ width: '0%' });
        });

        it('should handle very large numbers', () => {
            const { container } = render(<HpBar current={999999} max={1000000} />);
            const fill = container.querySelector('.hp-bar-fill');
            expect(fill).toHaveStyle({ width: '99.9999%' });
        });

        it('should handle negative current with negative max', () => {
            const { container } = render(<HpBar current={-10} max={-20} />);
            const fill = container.querySelector('.hp-bar-fill');
            // max > 0 is false, so pct defaults to 0
            expect(fill).toHaveStyle({ width: '0%' });
        });
    });
});
