// @maintained-by-ai 2026-11-27
/**
 * InspiringSmiteModal — single-file lane (jsx:1-190, the whole modal). No siblings: this is the
 * ONLY lane for this component. CharActionModals.async-confirm-handlers.test.jsx and
 * useCharActionsModalHandlers*.test.js MOCK it (they own the OPENING + the onConfirm(distribution)
 * CONSUMPTION seam); inspiringSmiteHandler.test.js / inspiringSmiteService.test.js own everything
 * DOWNSTREAM of the payload (temp-HP writes, latch, applyDamage math). Owned here is ONLY the
 * free-split ledger: selection, remaining-pool clamps, submit gate, and the exact distribution
 * payload this modal emits.
 *
 * CLUSTER AUDIT (run2#1979 handoff prediction — "expect clusters 2-3 if it imports
 * applyDamage/combatData"): NOT APPLICABLE. The component imports NOTHING rules-adjacent —
 * jsx:1-3 is react + CSS + useOverlayEntranceFocus (its own hook lane; not pinned here).
 * - setCombatSummaryCache phantom: N/A — no combatData import anywhere in the component or file.
 * - applyDamage mirror overrides: N/A — zero vi.mock in this file; the modal is a pure
 *   presentational ledger, all math is its own local clamp arithmetic pinned via observables.
 * - targetEffects register: N/A — the modal never touches it; rows are written by the handler lane.
 *
 * TRIMMED (2026-11-27 audit; 17 → 15, same-branch deletions with rationale):
 * - 'auto-caps a single target typing past the pool and submits the full pool' — DELETE: the
 *   99→18 clamp is the identical Math.min(max, Number(v)) arm already pinned by the 999→18 typed
 *   clamp, and the { Ally1: 18 } submit is the identical payload already pinned (exact-copy) by
 *   the full-pool-blocks-second test. Zero discriminating power left.
 * - 'resets allocation to zero when a target is reselected' + 'returns a deselected target's
 *   share to the pool' → CONSOLIDATED: both exercise the ONE toggleTarget delete/reset branch
 *   (jsx:28-37); merged into one render that witnesses both observables (freed ledger + fresh
 *   reselection starting at 0).
 * - tempHp=0 typed-'5'→0 arm — DELETE: same Math.min(max=0) branch as the 999→18 clamp; the kept
 *   zero-pool test retains only what is unique at that edge: the pool-bar copy and both
 *   remaining>0 hide-guards rendering absent.
 * - 'steps allocation with the +/- buttons' mid-progress 'Allocated: 1 / 2' line — DELETE: bar
 *   arithmetic is byte-pinned by the ledger-tracking test; step bounds remain.
 *
 * STRENGTHENED: checkbox selection is now by accessible name (implicit label wraps the name;
 * positional getAllByRole index kept only where order IS the contract — allocation inputs mirror
 * creatureTargets order); confirm payload pinned toHaveBeenCalledTimes(1) + full-args exact shape
 * (single arg, no second); the over-allocation defect-face log is now byte-exact full-line +
 * exact distribution object + times(1), plus a post-refusal ledger witness.
 */
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

// Implicit <label> wrapping makes each checkbox's accessible name the target name (#1935-class
// exact-copy query; positional index here was brittleness, not contract).
function selectTarget(name) {
    fireEvent.click(screen.getByRole('checkbox', { name }));
}

// Allocation inputs render one-per-selected-target in creatureTargets order.
function inputFor(index) {
    return screen.getAllByRole('spinbutton')[index];
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ── Tests ──

describe('InspiringSmiteModal mount and selection', () => {
    it('renders roll note, pool bar, named targets, and a disabled Inspire button until selection', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        expect(screen.getByText('Inspiring Smite')).toBeInTheDocument();
        expect(screen.getByText(/Rolled 2d8 \+ 5: 18 total temp HP/)).toBeInTheDocument();
        expect(screen.getByText('Pool: 18 HP')).toBeInTheDocument();
        expect(screen.getByText('Allocated: 0 / 18')).toBeInTheDocument();
        expect(screen.getByText('Remaining: 18')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Ally1' })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Ally2' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Self' })).toBeInTheDocument();
        expect(screen.queryByText(/HP unallocated/)).not.toBeInTheDocument();
        expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
        expect(screen.getByRole('button', { name: /Inspire \(0\)/ })).toBeDisabled();
    });

    it('selecting targets enables Inspire, checks the box, and toggles their allocation controls', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget('Ally1');
        expect(screen.getByRole('checkbox', { name: 'Ally1' })).toBeChecked();
        expect(screen.getByRole('button', { name: /Inspire \(1\)/ })).not.toBeDisabled();
        expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
        selectTarget('Ally2');
        expect(screen.getByRole('button', { name: /Inspire \(2\)/ })).not.toBeDisabled();
        expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
        selectTarget('Ally1');
        selectTarget('Ally2');
        expect(screen.getByRole('button', { name: /Inspire \(0\)/ })).toBeDisabled();
        expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    });

    it('shows "No targets available." and keeps Inspire disabled when creatureTargets is empty', () => {
        render(<InspiringSmiteModal {...makeProps({ creatureTargets: [] })} />);
        expect(screen.getByText('No targets available.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Inspire \(0\)/ })).toBeDisabled();
    });

    it('Skip closes the modal; clicking the overlay or modal body does not', () => {
        const { container } = render(<InspiringSmiteModal {...makeProps()} />);
        fireEvent.click(container.querySelector('.sp-overlay'));
        fireEvent.click(container.querySelector('.sp-modal'));
        expect(mockOnSkip).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });
});

describe('InspiringSmiteModal allocation ledger', () => {
    // Disk law (public/data/2024/classes.json, Oath of Glory "Inspiring Smite"):
    // "The total number of Temporary Hit Points equals 2d8 plus your Paladin
    // level, divided among the chosen creatures however you like." — the free
    // split must sum <= pool; there is no per-target cap above the pool itself.
    it('tracks allocation in the pool bar and unallocated warning, hiding both when fully allocated', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget('Ally1');
        const input = inputFor(0);
        fireEvent.change(input, { target: { value: '7' } });
        expect(screen.getByText('Allocated: 7 / 18')).toBeInTheDocument();
        expect(screen.getByText('Remaining: 11')).toBeInTheDocument();
        expect(screen.getByText(/11 HP unallocated — you may leave HP unused/)).toBeInTheDocument();
        fireEvent.change(input, { target: { value: '18' } });
        expect(screen.getByText('Allocated: 18 / 18')).toBeInTheDocument();
        expect(screen.queryByText(/Remaining:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/HP unallocated/)).not.toBeInTheDocument();
    });

    it('clamps typed allocation to the pool and collapses invalid input to zero', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget('Ally1');
        const input = inputFor(0);
        fireEvent.change(input, { target: { value: '999' } }); // Math.min(max, 999)
        expect(Number(input.value)).toBe(18);
        fireEvent.change(input, { target: { value: '-5' } }); // Math.max(0, -5)
        expect(Number(input.value)).toBe(0);
        fireEvent.change(input, { target: { value: 'abc' } }); // NaN || 0
        expect(Number(input.value)).toBe(0);
    });

    it('steps allocation with the +/- buttons, clamping at both bounds', () => {
        const { container } = render(<InspiringSmiteModal {...makeProps({ tempHp: 2 })} />);
        selectTarget('Ally1');
        const input = inputFor(0);
        const [minus, plus] = container.querySelectorAll('.inspiring-smite-allocation')[0]
            .querySelectorAll('.inspiring-smite-adjust-btn');
        fireEvent.click(minus);
        expect(Number(input.value)).toBe(0);
        fireEvent.click(plus);
        expect(Number(input.value)).toBe(1);
        fireEvent.click(plus);
        fireEvent.click(plus); // past the pool — stays clamped
        expect(Number(input.value)).toBe(2);
    });

    it('returns a deselected target\'s share to the pool and restarts it at zero on reselect', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget('Ally1');
        fireEvent.change(inputFor(0), { target: { value: '18' } });
        selectTarget('Ally1'); // deselect — share returns to the pool
        expect(screen.getByText('Allocated: 0 / 18')).toBeInTheDocument();
        expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
        selectTarget('Ally2');
        fireEvent.change(inputFor(0), { target: { value: '18' } }); // full pool was freed
        expect(Number(inputFor(0).value)).toBe(18);
        selectTarget('Ally1'); // reselect — fresh allocation, not the remembered 18
        expect(Number(inputFor(0).value)).toBe(0);
        expect(screen.getByText('Allocated: 18 / 18')).toBeInTheDocument();
    });

    it('clamps a second target to the remaining pool, not the full pool', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget('Ally1');
        selectTarget('Ally2');
        fireEvent.change(inputFor(0), { target: { value: '10' } });
        fireEvent.change(inputFor(1), { target: { value: '10' } }); // 10+10=20 > 18
        expect(Number(inputFor(0).value)).toBe(10);
        expect(Number(inputFor(1).value)).toBe(8); // pool minus Ally1's 10
        expect(screen.getByText('Allocated: 18 / 18')).toBeInTheDocument();
    });

    it('blocks a second target entirely when the first took the full pool', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget('Ally1');
        selectTarget('Ally2');
        fireEvent.change(inputFor(0), { target: { value: '18' } });
        fireEvent.change(inputFor(1), { target: { value: '10' } });
        expect(Number(inputFor(1).value)).toBe(0);
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
        // Pre-fix defect: submitted { Ally1: 18, Ally2: 10 } (sum 28 > 18).
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 18 });
    });

    it('frees pool on shrink so allocations can be redistributed', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget('Ally1');
        selectTarget('Ally2');
        fireEvent.change(inputFor(0), { target: { value: '12' } });
        fireEvent.change(inputFor(1), { target: { value: '6' } });
        fireEvent.change(inputFor(0), { target: { value: '4' } });
        fireEvent.change(inputFor(1), { target: { value: '14' } });
        expect(Number(inputFor(0).value)).toBe(4);
        expect(Number(inputFor(1).value)).toBe(14);
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
        expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 4, Ally2: 14 });
    });

    it('steps the + button only up to the remaining pool', () => {
        const { container } = render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget('Ally1');
        selectTarget('Ally2');
        fireEvent.change(inputFor(0), { target: { value: '17' } });
        const [, ally2Plus] = container.querySelectorAll('.inspiring-smite-allocation')[1]
            .querySelectorAll('.inspiring-smite-adjust-btn');
        fireEvent.click(ally2Plus);
        expect(Number(inputFor(1).value)).toBe(1);
        fireEvent.click(ally2Plus); // no remaining pool left to step into
        expect(Number(inputFor(1).value)).toBe(1);
    });

    it('renders an empty pool with both remaining-guards hidden when tempHp is 0', () => {
        render(<InspiringSmiteModal {...makeProps({ tempHp: 0 })} />);
        expect(screen.getByText('Pool: 0 HP')).toBeInTheDocument();
        expect(screen.getByText('Allocated: 0 / 0')).toBeInTheDocument();
        expect(screen.queryByText(/Remaining:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/HP unallocated/)).not.toBeInTheDocument();
    });
});

describe('InspiringSmiteModal confirm', () => {
    it('confirms exactly once, only with HP allocated, omitting zero-allocation targets', () => {
        render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget('Ally1');
        selectTarget('Ally2');
        // Enabled, but clicking with every allocation at 0 must be a no-op.
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
        expect(mockOnConfirm).not.toHaveBeenCalled();
        // Allocating to one target includes only that target in the payload.
        fireEvent.change(inputFor(0), { target: { value: '10' } });
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 10 });
    });

    it('refuses to submit a hand-crafted overspend and logs it byte-exactly', () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { rerender } = render(<InspiringSmiteModal {...makeProps()} />);
        selectTarget('Ally1');
        selectTarget('Ally2');
        fireEvent.change(inputFor(0), { target: { value: '10' } });
        fireEvent.change(inputFor(1), { target: { value: '8' } }); // lawful 18 / 18
        rerender(<InspiringSmiteModal {...makeProps({ tempHp: 12 })} />); // pool shrinks
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
        expect(mockOnConfirm).not.toHaveBeenCalled();
        // Integrity gate (jsx:80-86): whole-line pin of the refusal log + exact distribution.
        expect(errSpy).toHaveBeenCalledTimes(1);
        expect(errSpy).toHaveBeenCalledWith(
            '[InspiringSmiteModal:over-allocation] refusing submit: 18 HP allocated exceeds 12 HP pool',
            { Ally1: 10, Ally2: 8 }
        );
        expect(screen.getByText('Allocated: 18 / 12')).toBeInTheDocument(); // ledger still honest
        errSpy.mockRestore();
    });
});
