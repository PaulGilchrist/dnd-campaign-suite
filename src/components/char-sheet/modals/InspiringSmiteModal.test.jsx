// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react/pure';
import InspiringSmiteModal from './InspiringSmiteModal';

// ── Test fixtures ──

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const baseCreatureTargets = [
    { name: 'Ally1', type: 'player' },
    { name: 'Ally2', type: 'player' },
    { name: 'Self', type: 'player' },
];

const defaultProps = {
    creatureTargets: baseCreatureTargets,
    tempHp: 18,
    roll: '2d8 + 5',
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
};

function makeProps(overrides) {
    return { ...defaultProps, ...(overrides || {}) };
}

beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnSkip.mockClear();
});

// ── Tests ──

describe('InspiringSmiteModal', () => {
    // ── Rendering ──

    describe('initial render', () => {
        it('renders the modal with title, roll note, targets, and action buttons', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            expect(screen.getByText('Inspiring Smite')).toBeInTheDocument();
            expect(screen.getByText(/Rolled 2d8 \+ 5: 18 total temp HP/)).toBeInTheDocument();
            expect(screen.getByText('Ally1')).toBeInTheDocument();
            expect(screen.getByText('Ally2')).toBeInTheDocument();
            expect(screen.getByText('Self')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Inspire \(0\)/ })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        });

        it('renders pool bar with total, allocated, and remaining on initial render', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            expect(screen.getByText('Pool: 18 HP')).toBeInTheDocument();
            expect(screen.getByText('Allocated: 0 / 18')).toBeInTheDocument();
            expect(screen.getByText('Remaining: 18')).toBeInTheDocument();
        });

        it('reflects different tempHp values in pool bar', () => {
            render(<InspiringSmiteModal {...makeProps({ tempHp: 10 })} />);
            expect(screen.getByText('Pool: 10 HP')).toBeInTheDocument();
            expect(screen.getByText('Allocated: 0 / 10')).toBeInTheDocument();
            expect(screen.getByText('Remaining: 10')).toBeInTheDocument();
        });
    });

    // ── Pool bar ──

    describe('pool bar display', () => {
        it('hides remaining when fully allocated', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: '18' } });
            expect(screen.queryByText('Remaining:')).not.toBeInTheDocument();
        });
    });

    // ── Empty targets ──

    describe('empty targets', () => {
        it('shows "No targets available." when creatureTargets is empty', () => {
            render(<InspiringSmiteModal {...makeProps({ creatureTargets: [] })} />);
            expect(screen.getByText('No targets available.')).toBeInTheDocument();
        });

        it('disables confirm button when no targets available', () => {
            render(<InspiringSmiteModal {...makeProps({ creatureTargets: [] })} />);
            expect(screen.getByRole('button', { name: /Inspire \(0\)/ })).toBeDisabled();
        });
    });

    // ── Target selection ──

    describe('target selection', () => {
        it('disables confirm button when no targets selected', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: /Inspire \(0\)/ })).toBeDisabled();
        });

        it('enables confirm button when at least one target is selected', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            expect(screen.getByRole('button', { name: /Inspire \(1\)/ })).not.toBeDisabled();
        });

        it('allows selecting multiple targets', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkboxes = screen.getAllByRole('checkbox');
            fireEvent.click(checkboxes[0]);
            fireEvent.click(checkboxes[1]);
            expect(screen.getByRole('button', { name: /Inspire \(2\)/ })).not.toBeDisabled();
        });

        it('shows allocation controls when a target is selected', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            expect(screen.getByRole('spinbutton')).toBeInTheDocument();
        });

        it('deselecting a target hides its allocation controls', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            expect(screen.getByRole('spinbutton')).toBeInTheDocument();
            fireEvent.click(checkbox);
            expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
        });

        it('resets allocation to zero when re-selecting a target', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: '10' } });
            fireEvent.click(checkbox);
            fireEvent.click(checkbox);
            const reInput = screen.getByRole('spinbutton');
            expect(Number(reInput.value)).toBe(0);
        });
    });

    // ── Allocation ──

    describe('allocation', () => {
        it('caps allocation at total pool', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: '999' } });
            expect(Number(input.value)).toBe(18);
        });

        it('caps allocation at total pool across all targets', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkboxes = screen.getAllByRole('checkbox');
            fireEvent.click(checkboxes[0]);
            fireEvent.click(checkboxes[1]);
            const inputs = screen.getAllByRole('spinbutton');
            fireEvent.change(inputs[0], { target: { value: '10' } });
            fireEvent.change(inputs[1], { target: { value: '999' } });
            expect(Number(inputs[1].value)).toBe(18);
        });

        it('clamps negative input values to 0', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: '-5' } });
            expect(Number(input.value)).toBe(0);
        });

        it('handles non-numeric input as 0', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: 'abc' } });
            expect(Number(input.value)).toBe(0);
        });

        it('updates allocated/remaining display on allocation change', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: '7' } });
            expect(screen.getByText('Allocated: 7 / 18')).toBeInTheDocument();
            expect(screen.getByText('Remaining: 11')).toBeInTheDocument();
        });

        it('shows unallocated warning when some HP is left with allocations', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: '5' } });
            expect(screen.getByText(/13 HP unallocated — you may leave HP unused/)).toBeInTheDocument();
        });

        it('hides unallocated message when no allocations', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            expect(screen.queryByText(/HP unallocated/)).not.toBeInTheDocument();
        });

        it('hides unallocated message when fully allocated', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: '18' } });
            expect(screen.queryByText(/HP unallocated/)).not.toBeInTheDocument();
        });
    });

    // ── Confirm behavior ──

    describe('confirm behavior', () => {
        it('does not call onConfirm when no targets selected', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const confirmBtn = screen.getByRole('button', { name: /Inspire \(0\)/ });
            expect(confirmBtn).toBeDisabled();
        });

        it('does not call onConfirm when targets selected but all allocations are zero', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            fireEvent.click(screen.getByRole('button', { name: /Inspire \(1\)/ }));
            expect(mockOnConfirm).not.toHaveBeenCalled();
        });

        it('calls onConfirm with distribution object when targets have allocations', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkboxes = screen.getAllByRole('checkbox');
            fireEvent.click(checkboxes[0]);
            fireEvent.click(checkboxes[1]);
            const inputs = screen.getAllByRole('spinbutton');
            fireEvent.change(inputs[0], { target: { value: '10' } });
            fireEvent.change(inputs[1], { target: { value: '5' } });
            fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
            expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 10, Ally2: 5 });
        });

        it('skips targets with zero allocation in the distribution', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkboxes = screen.getAllByRole('checkbox');
            fireEvent.click(checkboxes[0]);
            fireEvent.click(checkboxes[1]);
            const inputs = screen.getAllByRole('spinbutton');
            fireEvent.change(inputs[0], { target: { value: '10' } });
            // Ally2 stays at 0
            fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
            expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 10 });
        });

        it('allows allocating the entire pool to a single target', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const checkbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(checkbox);
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: '18' } });
            fireEvent.click(screen.getByRole('button', { name: /Inspire \(1\)/ }));
            expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 18 });
        });
    });

    // ── Skip behavior ──

    describe('skip behavior', () => {
        it('calls onSkip when skip button is clicked', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
            expect(mockOnSkip).toHaveBeenCalledTimes(1);
        });

        it('does not call onSkip when overlay is clicked', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const overlay = document.querySelector('.sp-overlay');
            fireEvent.click(overlay);
            expect(mockOnSkip).not.toHaveBeenCalled();
            expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        });

        it('does not call onSkip when clicking inside the modal', () => {
            render(<InspiringSmiteModal {...makeProps()} />);
            const modal = document.querySelector('.sp-modal');
            fireEvent.click(modal);
            expect(mockOnSkip).not.toHaveBeenCalled();
        });
    });

    // ── Edge cases ──

    describe('edge cases', () => {
        it('handles tempHp of 0', () => {
            render(<InspiringSmiteModal {...makeProps({ tempHp: 0 })} />);
            expect(screen.getByText('Pool: 0 HP')).toBeInTheDocument();
            expect(screen.getByText('Allocated: 0 / 0')).toBeInTheDocument();
        });
    });
});
