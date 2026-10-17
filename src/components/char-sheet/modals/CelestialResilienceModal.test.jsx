// @maintained-by-ai
// CelestialResilienceModal — thin wrapper over shared/CreatureSelectionModal.jsx.
//
// Caller seams (deferred, NOT covered here):
//   - LongRestButton (and ShortRestModal / CharSpecialActionsModals inline lanes) own
//     modal open/props — celestialResilienceModal state, target loading, close wiring.
//   - Handler lanes (useCelestialResilienceHandlers in CharSpecialActions.jsx, covered
//     by CharActionModals.*.test.jsx) own the confirm write contract downstream:
//     per-target setTempHp POSTs and campaign-log entries.
// This file owns the modal's own rendering: hardcoded title/description/confirm copy,
// temp-HP note interpolation, checkbox selection, maxTargets gating, and the exact
// confirm/skip payloads emitted at THIS seam (array of selected name strings).
//
// Icon note: the `fa-shield-hart` → `fa-shield-heart` typo was fixed at the product
// level here (LongRestButton lane precedent); icons are pinned below. Remaining typo
// sites flagged elsewhere (NOT fixed here): ShortRestModal.jsx L897/L903 and
// CharSpecialActionsModals.jsx L382/L388 (separate inline Celestial lanes).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

// Map-overlay lookups are campaign-gated inside CreatureSelectionModal; this wrapper
// passes no campaignName, so the service must never fire. Mocked for isolation.
const mockGetCurrentOverlayTarget = vi.fn();
const mockGetCreaturesInsideOverlay = vi.fn();
const mockGetTargetMapStatuses = vi.fn();

vi.mock('../../../../services/maps/spellOverlayService.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getCurrentOverlayTarget: (...args) => mockGetCurrentOverlayTarget(...args),
        getCreaturesInsideOverlay: (...args) => mockGetCreaturesInsideOverlay(...args),
        getTargetMapStatuses: (...args) => mockGetTargetMapStatuses(...args),
    };
});

import CelestialResilienceModal from './CelestialResilienceModal.jsx';

// ── Fixtures ──

const TARGETS = [
    { name: 'Ally1', type: 'player', currentHp: 20, maxHp: 30 },
    { name: 'Ally2', type: 'player', currentHp: 15, maxHp: 25 },
    { name: 'Ally3', type: 'npc', currentHp: 50, maxHp: 50 },
];

// Fresh callbacks per call — tests assert on the props object they pass in.
function makeProps(overrides) {
    return {
        creatureTargets: TARGETS,
        allyTempHp: 3,
        selfTempHp: 7,
        maxTargets: 5,
        onConfirm: vi.fn(),
        onSkip: vi.fn(),
        ...(overrides || {}),
    };
}

// clearAllMocks would not strip mockResolvedValue — mockReset each module mock.
afterEach(() => {
    mockGetCurrentOverlayTarget.mockReset();
    mockGetCreaturesInsideOverlay.mockReset();
    mockGetTargetMapStatuses.mockReset();
});

const checkbox = (name) => screen.getByRole('checkbox', { name: new RegExp(name) });
const confirmBtn = () => screen.getByRole('button', { name: /Grant Resilience/ });

// ── Tests ──

describe('CelestialResilienceModal', () => {
    describe('hardcoded copy and icons', () => {
        it('renders title, description, and both action buttons', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(screen.getByText('Celestial Resilience')).toBeInTheDocument();
            expect(screen.getByText(
                'Choose up to 5 allies to gain temporary hit points from your Celestial Resilience.'
            )).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        });

        it('uses fa-shield-heart in header and confirm button (typo regression pin)', () => {
            const { container } = render(<CelestialResilienceModal {...makeProps()} />);
            expect(container.querySelector('.sp-header i.fa-solid.fa-shield-heart')).toBeInTheDocument();
            expect(confirmBtn().querySelector('i.fa-solid.fa-shield-heart')).toBeInTheDocument();
            expect(container.querySelector('.fa-shield-hart')).toBeNull();
        });

        it('renders all target names and never triggers campaign-gated map lookups', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(checkbox('Ally1')).toBeInTheDocument();
            expect(checkbox('Ally2')).toBeInTheDocument();
            expect(checkbox('Ally3')).toBeInTheDocument();
            expect(mockGetCurrentOverlayTarget).not.toHaveBeenCalled();
            expect(mockGetCreaturesInsideOverlay).not.toHaveBeenCalled();
            expect(mockGetTargetMapStatuses).not.toHaveBeenCalled();
        });
    });

    describe('note interpolation', () => {
        it.each([
            ['default self and ally values', 7, 3],
            ['custom self temp HP', 10, 3],
            ['custom ally temp HP', 7, 5],
            ['zero temp HP values', 0, 0],
            ['large temp HP values', 200, 100],
        ])('renders the full note verbatim with %s', (_case, selfTempHp, allyTempHp) => {
            render(<CelestialResilienceModal {...makeProps({ selfTempHp, allyTempHp })} />);
            expect(screen.getByText(
                `You gain ${selfTempHp} temporary hit points. Each selected ally gains ${allyTempHp} temporary hit points.`
            )).toBeInTheDocument();
        });
    });

    describe('selection gating', () => {
        it('disables confirm at zero selection and stays inert when clicked', () => {
            const props = makeProps();
            render(<CelestialResilienceModal {...props} />);
            const confirm = screen.getByRole('button', { name: 'Grant Resilience (0)' });
            expect(confirm).toBeDisabled();
            fireEvent.click(confirm);
            expect(props.onConfirm).not.toHaveBeenCalled();
        });

        it('ticks checkboxes and updates the confirm count as targets are selected', () => {
            const props = makeProps();
            render(<CelestialResilienceModal {...props} />);
            fireEvent.click(checkbox('Ally1'));
            fireEvent.click(checkbox('Ally2'));
            expect(checkbox('Ally1')).toBeChecked();
            expect(checkbox('Ally2')).toBeChecked();
            expect(checkbox('Ally3')).not.toBeChecked();
            expect(screen.getByRole('button', { name: 'Grant Resilience (2)' })).toBeEnabled();
        });

        it('caps selection at maxTargets — the next checkbox is disabled and clicks are ignored', () => {
            const props = makeProps({ maxTargets: 2 });
            render(<CelestialResilienceModal {...props} />);
            fireEvent.click(checkbox('Ally1'));
            fireEvent.click(checkbox('Ally2'));
            const third = checkbox('Ally3');
            expect(third).toBeDisabled();
            fireEvent.click(third);
            expect(third).not.toBeChecked();
            fireEvent.click(screen.getByRole('button', { name: 'Grant Resilience (2)' }));
            expect(props.onConfirm).toHaveBeenCalledTimes(1);
            expect(props.onConfirm).toHaveBeenCalledWith(['Ally1', 'Ally2']);
        });

        it('re-gates confirm to disabled after deselecting the only target', () => {
            const props = makeProps();
            render(<CelestialResilienceModal {...props} />);
            fireEvent.click(checkbox('Ally1'));
            expect(checkbox('Ally1')).toBeChecked();
            fireEvent.click(checkbox('Ally1'));
            expect(checkbox('Ally1')).not.toBeChecked();
            expect(screen.getByRole('button', { name: 'Grant Resilience (0)' })).toBeDisabled();
            fireEvent.click(confirmBtn());
            expect(props.onConfirm).not.toHaveBeenCalled();
        });
    });

    describe('confirm payload contract', () => {
        it('emits exactly one array of the selected name strings, in selection order', () => {
            const props = makeProps();
            render(<CelestialResilienceModal {...props} />);
            fireEvent.click(checkbox('Ally1'));
            fireEvent.click(checkbox('Ally3'));
            fireEvent.click(screen.getByRole('button', { name: 'Grant Resilience (2)' }));
            expect(props.onConfirm).toHaveBeenCalledTimes(1);
            expect(props.onConfirm).toHaveBeenCalledWith(['Ally1', 'Ally3']);
            expect(props.onSkip).not.toHaveBeenCalled();
        });

        it('reflects deselect-then-confirm with the remaining names only', () => {
            const props = makeProps();
            render(<CelestialResilienceModal {...props} />);
            fireEvent.click(checkbox('Ally1'));
            fireEvent.click(checkbox('Ally2'));
            fireEvent.click(checkbox('Ally1'));
            fireEvent.click(screen.getByRole('button', { name: 'Grant Resilience (1)' }));
            expect(props.onConfirm).toHaveBeenCalledTimes(1);
            expect(props.onConfirm).toHaveBeenCalledWith(['Ally2']);
        });
    });

    describe('cancel, skip, and overlay inertness', () => {
        it('Skip fires onSkip once with the click event only, never onConfirm', () => {
            const props = makeProps();
            render(<CelestialResilienceModal {...props} />);
            fireEvent.click(checkbox('Ally1'));
            fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
            expect(props.onSkip).toHaveBeenCalledTimes(1);
            expect(props.onSkip.mock.calls[0][0]).toMatchObject({ type: 'click' });
            expect(props.onConfirm).not.toHaveBeenCalled();
        });

        it('overlay background click is inert — neither callback fires', () => {
            const props = makeProps();
            const { container } = render(<CelestialResilienceModal {...props} />);
            fireEvent.click(container.querySelector('.sp-overlay'));
            expect(props.onConfirm).not.toHaveBeenCalled();
            expect(props.onSkip).not.toHaveBeenCalled();
        });
    });
});
