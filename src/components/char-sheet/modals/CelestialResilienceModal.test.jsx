// @maintained-by-ai 2026-11-27
// CelestialResilienceModal — thin prop-binding wrapper over shared/CreatureSelectionModal.jsx.
//
// Lane split (verified against sibling headers 2026-11-27):
//   - shared/CreatureSelectionModal.test.jsx (component-seam lane) owns the picker
//     INTERNALS stronger than any re-pin here could: row toggle/highlight/Confirm
//     count, maxTargets cap semantics (disable + click-rejection + re-enable on
//     deselect), confirm selection-order + disabled/confirmDisabled inertness,
//     onSkip fired only from the Skip button (overlay/body clicks inert), and
//     overlay/distance lookup gating on campaignName/attackerName.
//   - CharSpecialActions.modalsInline.test.jsx owns the HOST-side dispatch and the
//     confirm-path addEntry/setTempHp writes through useCelestialResilienceHandlers.
//   - LongRestButton lanes own their direct CreatureSelectionModal mount (a separate
//     render site that interpolates maxTargets into its own description copy).
// This file owns ONLY the wrapper's open-props contract and callback bindings:
// hardcoded title/description/confirm copy + fa-shield-heart icons (typo regression
// pin, bug-shortrest-celestial-icon-typo), self/ally temp-HP note interpolation,
// creatureTargets/maxTargets/onConfirm/onSkip passthrough, and the fact that no
// campaignName/attackerName is threaded (map lookups must never fire here).
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

// Player rows resolve their HP affordance from character buckets (absent in this
// lane → no chip), so their checkbox name is the bare name. The npc row keeps the
// combatSummary pair it arrives with → a '(100% HP)' chip joins its accessible
// name (shared-lane HP law; pinned here only so the exact-matchers can match).
const TARGETS = [
    { name: 'Ally1', type: 'player', currentHp: 20, maxHp: 30 },
    { name: 'Ally2', type: 'player', currentHp: 15, maxHp: 25 },
    { name: 'Ally3', type: 'npc', currentHp: 50, maxHp: 50 },
];
const ALLY3 = 'Ally3(100% HP)';

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

const checkbox = (name) => screen.getByRole('checkbox', { name });
const confirmBtn = (count) => screen.getByRole('button', { name: `Grant Resilience (${count})` });

// ── Tests ──

describe('CelestialResilienceModal', () => {
    it('opens with the exact prop face: title, description, note, disabled confirm, Skip, target rows', () => {
        render(<CelestialResilienceModal {...makeProps()} />);
        expect(screen.getByText('Celestial Resilience')).toBeInTheDocument();
        expect(screen.getByText(
            'Choose up to 5 allies to gain temporary hit points from your Celestial Resilience.'
        )).toBeInTheDocument();
        expect(screen.getByText(
            'You gain 7 temporary hit points. Each selected ally gains 3 temporary hit points.'
        )).toBeInTheDocument();
        expect(confirmBtn(0)).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        // creatureTargets → targets binding: every candidate row renders.
        expect(checkbox('Ally1')).toBeInTheDocument();
        expect(checkbox('Ally2')).toBeInTheDocument();
        expect(checkbox(ALLY3)).toBeInTheDocument();
    });

    it('uses fa-shield-heart in header and confirm button (typo regression pin)', () => {
        const { container } = render(<CelestialResilienceModal {...makeProps()} />);
        expect(container.querySelector('.sp-header i.fa-solid.fa-shield-heart')).toBeInTheDocument();
        expect(confirmBtn(0).querySelector('i.fa-solid.fa-shield-heart')).toBeInTheDocument();
        expect(container.querySelector('.fa-shield-hart')).toBeNull();
    });

    it.each([
        ['distinct values guard self/ally template swap', 4, 9],
        ['zero temp HP values', 0, 0],
    ])('interpolates the note verbatim with %s', (_case, selfTempHp, allyTempHp) => {
        render(<CelestialResilienceModal {...makeProps({ selfTempHp, allyTempHp })} />);
        expect(screen.getByText(
            `You gain ${selfTempHp} temporary hit points. Each selected ally gains ${allyTempHp} temporary hit points.`
        )).toBeInTheDocument();
    });

    it('binds maxTargets and onConfirm: caps the third row, emits the selection once, never onSkip', () => {
        const props = makeProps({ maxTargets: 2 });
        render(<CelestialResilienceModal {...props} />);
        fireEvent.click(checkbox('Ally1'));
        fireEvent.click(checkbox('Ally2'));
        // maxTargets passthrough binding: at cap the unselected row is disabled.
        expect(checkbox(ALLY3)).toBeDisabled();
        fireEvent.click(confirmBtn(2));
        expect(props.onConfirm).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).toHaveBeenCalledWith(['Ally1', 'Ally2']);
        expect(props.onSkip).not.toHaveBeenCalled();
    });

    it('routes Skip to onSkip once even with a selection made, never onConfirm', () => {
        const props = makeProps();
        render(<CelestialResilienceModal {...props} />);
        fireEvent.click(checkbox('Ally1'));
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(props.onSkip).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).not.toHaveBeenCalled();
    });

    it('threads no campaignName/attackerName — campaign-gated map lookups never fire', () => {
        render(<CelestialResilienceModal {...makeProps()} />);
        expect(mockGetCurrentOverlayTarget).not.toHaveBeenCalled();
        expect(mockGetCreaturesInsideOverlay).not.toHaveBeenCalled();
        expect(mockGetTargetMapStatuses).not.toHaveBeenCalled();
    });
});
