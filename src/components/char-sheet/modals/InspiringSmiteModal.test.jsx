// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react/pure';
import InspiringSmiteModal from './InspiringSmiteModal';

// ── Test fixtures ──

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const defaultProps = {
    creatureTargets: [
        { name: 'Ally1', type: 'player' },
        { name: 'Ally2', type: 'player' },
        { name: 'Self', type: 'player' },
    ],
    tempHp: 18,
    roll: '2d8 + 5',
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
};

function makeProps(overrides) {
    return { ...defaultProps, ...(overrides || {}) };
}

function selectTarget(index) {
    fireEvent.click(screen.getAllByRole('checkbox')[index]);
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ── Tests ──

describe('InspiringSmiteModal', () => {
    it('renders roll note, pool bar, targets, and a disabled Inspire button until selection', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        expect(screen.getByText('Inspiring Smite')).toBeInTheDocument();
        expect(screen.getByText(/Rolled 2d8 \+ 5: 18 total temp HP/)).toBeInTheDocument();
        expect(screen.getByText('Pool: 18 HP')).toBeInTheDocument();
        expect(screen.getByText('Allocated: 0 / 18')).toBeInTheDocument();
        expect(screen.getByText('Remaining: 18')).toBeInTheDocument();
        expect(screen.getByText('Ally1')).toBeInTheDocument();
        expect(screen.getByText('Ally2')).toBeInTheDocument();
        expect(screen.getByText('Self')).toBeInTheDocument();
        expect(screen.queryByText(/HP unallocated/)).not.toBeInTheDocument();
        expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
        expect(screen.getByRole('button', { name: /Inspire \(0\)/ })).toBeDisabled();
    });

    it('selecting targets enables Inspire and toggles their allocation controls', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        expect(screen.getByRole('button', { name: /Inspire \(1\)/ })).not.toBeDisabled();
        expect(screen.getByRole('spinbutton')).toBeInTheDocument();
        selectTarget(1);
        expect(screen.getByRole('button', { name: /Inspire \(2\)/ })).not.toBeDisabled();
        expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
        selectTarget(0);
        selectTarget(1);
        expect(screen.getByRole('button', { name: /Inspire \(0\)/ })).toBeDisabled();
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('shows "No targets available." and keeps Inspire disabled when creatureTargets is empty', () => {
        render(<InspiringSmiteModal {...makeProps({ creatureTargets: [] })} />);
        expect(screen.getByText('No targets available.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Inspire \(0\)/ })).toBeDisabled();
    });

    it('tracks allocation in the pool bar and unallocated warning, hiding both when fully allocated', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        const input = screen.getByRole('spinbutton');
        fireEvent.change(input, { target: { value: '7' } });
        expect(screen.getByText('Allocated: 7 / 18')).toBeInTheDocument();
        expect(screen.getByText('Remaining: 11')).toBeInTheDocument();
        expect(screen.getByText(/11 HP unallocated — you may leave HP unused/)).toBeInTheDocument();
        fireEvent.change(input, { target: { value: '18' } });
        expect(screen.getByText('Allocated: 18 / 18')).toBeInTheDocument();
        expect(screen.queryByText(/Remaining:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/HP unallocated/)).not.toBeInTheDocument();
    });

    it('clamps typed allocation into the 0..pool range', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        const input = screen.getByRole('spinbutton');
        fireEvent.change(input, { target: { value: '999' } });
        expect(Number(input.value)).toBe(18);
        fireEvent.change(input, { target: { value: '-5' } });
        expect(Number(input.value)).toBe(0);
        fireEvent.change(input, { target: { value: 'abc' } });
        expect(Number(input.value)).toBe(0);
    });

    it('steps allocation with the +/- buttons, clamping at both bounds', () => {
        const { container } = render(<InspiringSmiteModal {...makeProps({ tempHp: 2 })} />);
        selectTarget(0);
        const input = screen.getByRole('spinbutton');
        const [minus, plus] = container.querySelectorAll('.inspiring-smite-adjust-btn');
        fireEvent.click(minus);
        expect(Number(input.value)).toBe(0);
        fireEvent.click(plus);
        expect(Number(input.value)).toBe(1);
        expect(screen.getByText('Allocated: 1 / 2')).toBeInTheDocument();
        fireEvent.click(plus);
        fireEvent.click(plus);
        expect(Number(input.value)).toBe(2);
        expect(screen.getByText('Allocated: 2 / 2')).toBeInTheDocument();
    });

    it('resets allocation to zero when a target is reselected', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
        selectTarget(0); // deselect
        selectTarget(0); // reselect
        expect(Number(screen.getByRole('spinbutton').value)).toBe(0);
    });

    it('confirms only when HP is allocated, and omits zero-allocation targets from the distribution', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        selectTarget(1);
        // Enabled, but clicking with every allocation at 0 must be a no-op.
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
        expect(mockOnConfirm).not.toHaveBeenCalled();
        // Allocating to one target includes only that target in the payload.
        fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '10' } });
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 10 });
    });

    it('Skip closes the modal; clicking the overlay or modal body does not', () => {
        const { container } = render(<InspiringSmiteModal {...makeProps()} />);
        fireEvent.click(container.querySelector('.sp-overlay'));
        fireEvent.click(container.querySelector('.sp-modal'));
        expect(mockOnSkip).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('renders an empty pool and locks allocation at zero when tempHp is 0', () => {
        render(<InspiringSmiteModal {...makeProps({ tempHp: 0 })} />);
        expect(screen.getByText('Pool: 0 HP')).toBeInTheDocument();
        expect(screen.getByText('Allocated: 0 / 0')).toBeInTheDocument();
        expect(screen.queryByText(/Remaining:/)).not.toBeInTheDocument();
        selectTarget(0);
        fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
        expect(Number(screen.getByRole('spinbutton').value)).toBe(0);
    });
});

// ── Remaining-pool clamp + confirm gate ──
// Disk law (public/data/2024/classes.json, Oath of Glory "Inspiring Smite"):
// "The total number of Temporary Hit Points equals 2d8 plus your Paladin
// level, divided among the chosen creatures however you like." — the free
// split must sum <= pool; there is no per-target cap above the pool itself.
describe('InspiringSmiteModal remaining-pool ledger', () => {
    it('clamps a second target to the remaining pool, not the full pool', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        selectTarget(1);
        const [ally1, ally2] = screen.getAllByRole('spinbutton');
        fireEvent.change(ally1, { target: { value: '10' } });
        fireEvent.change(ally2, { target: { value: '10' } }); // 10+10=20 > 18
        expect(Number(ally1.value)).toBe(10);
        expect(Number(ally2.value)).toBe(8); // pool minus Ally1's 10
        expect(screen.getByText('Allocated: 18 / 18')).toBeInTheDocument();
    });

    it('blocks a second target entirely when the first took the full pool', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        selectTarget(1);
        const [ally1, ally2] = screen.getAllByRole('spinbutton');
        fireEvent.change(ally1, { target: { value: '18' } });
        fireEvent.change(ally2, { target: { value: '10' } });
        expect(Number(ally2.value)).toBe(0);
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
        // Pre-fix defect: submitted { Ally1: 18, Ally2: 10 } (sum 28 > 18).
        expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 18 });
    });

    it('auto-caps a single target typing past the pool and submits the full pool', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        const input = screen.getByRole('spinbutton');
        fireEvent.change(input, { target: { value: '99' } });
        expect(Number(input.value)).toBe(18);
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(1\)/ }));
        expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 18 });
    });

    it('frees pool on shrink so allocations can be redistributed', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        selectTarget(1);
        const [ally1, ally2] = screen.getAllByRole('spinbutton');
        fireEvent.change(ally1, { target: { value: '12' } });
        fireEvent.change(ally2, { target: { value: '6' } });
        fireEvent.change(ally1, { target: { value: '4' } });
        fireEvent.change(ally2, { target: { value: '14' } });
        expect(Number(ally1.value)).toBe(4);
        expect(Number(ally2.value)).toBe(14);
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
        expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 4, Ally2: 14 });
    });

    it('returns a deselected target\'s share to the pool', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '18' } });
        selectTarget(0); // deselect — share returns to the pool
        expect(screen.getByText('Allocated: 0 / 18')).toBeInTheDocument();
        selectTarget(1);
        const input = screen.getAllByRole('spinbutton')[0];
        fireEvent.change(input, { target: { value: '18' } });
        expect(Number(input.value)).toBe(18);
    });

    it('steps the + button only up to the remaining pool', () => {
        const { container } = render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        selectTarget(1);
        const [ally1, ally2] = screen.getAllByRole('spinbutton');
        fireEvent.change(ally1, { target: { value: '17' } });
        const btns = container.querySelectorAll('.inspiring-smite-adjust-btn');
        const ally2Plus = btns[3]; // [ally1-, ally1+, ally2-, ally2+]
        fireEvent.click(ally2Plus);
        expect(Number(ally2.value)).toBe(1);
        fireEvent.click(ally2Plus); // no remaining pool left to step into
        expect(Number(ally2.value)).toBe(1);
    });

    it('refuses to submit a hand-crafted overspend and logs it', () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { rerender } = render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget(0);
        selectTarget(1);
        const [ally1, ally2] = screen.getAllByRole('spinbutton');
        fireEvent.change(ally1, { target: { value: '10' } });
        fireEvent.change(ally2, { target: { value: '8' } }); // lawful 18 / 18
        rerender(<InspiringSmiteModal {...makeProps({ tempHp: 12 })} />); // pool shrinks
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
        expect(mockOnConfirm).not.toHaveBeenCalled();
        expect(errSpy).toHaveBeenCalledWith(
            expect.stringContaining('over-allocation'),
            expect.anything()
        );
        errSpy.mockRestore();
    });
});
