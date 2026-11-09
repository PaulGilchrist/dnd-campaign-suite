// @maintained-by-ai
// Lane: useTvPresentation UP-NEXT derivation (FT 2026-11-09 backlog fix).
// Law: the strip is sliced AFTER resolving the active row's position in the
// FULL tracker array (the Next-walk order of initiativeService
// .getNextCreatureName). While a Thief's-Reflexes `(Second Turn)` row is
// active, the secondTurn-filtered list has no matching entry — the old
// `idx < 0 ? -1 : idx` fallback showed first-of-list (a creature that had
// already acted) instead of the true next step past the row's seam.
// Also pinned: normal-turn output byte-identical to the legacy slice, the
// 4-entry cap, and the secondTurn/away exclusions.
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTvPresentation } from './useTvPresentation.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(() => null),
}));

// Tracker order mirrors the initiative-sorted combatSummary.creatures array.
// FT repro shape: EvasiveFighter rolled top (init 20), its synthetic
// second-turn twin sits LATE at initiative −10, and AasimarTest (init 9) is
// the row immediately after the ST row in walk order. AwayPaladin is parked
// at the back with away:true (holds no slot).
const BOARD = [
    { name: 'EvasiveFighter', type: 'player', initiative: '20' },
    { name: 'Bugbear', type: 'npc', initiative: '18' },
    { name: 'Goblin', type: 'npc', initiative: '15' },
    { name: 'Kobold 1', type: 'npc', initiative: '13' },
    { name: 'Kobold 2', type: 'npc', initiative: '12' },
    { name: 'EvasiveFighter (Second Turn)', type: 'player', initiative: '10', secondTurn: true, holderName: 'EvasiveFighter' },
    { name: 'AasimarTest', type: 'player', initiative: '9' },
    { name: 'FeyRanger', type: 'player', initiative: '7' },
    { name: 'AwayPaladin', type: 'player', initiative: '5', away: true },
];

const render = (activeCreatureName) => renderHook(() => useTvPresentation({
    campaignName: 'test-campaign',
    displayCreatures: BOARD,
    activeCreatureName,
    showToast: vi.fn(),
})).result.current.nextUpCreatures.map(c => c.name);

beforeEach(() => {
    localStorage.clear();
});

describe('useTvPresentation — up-next strip seam resolution', () => {
    it('ST row active: head is the true next step past the seam, not first-of-list', () => {
        const strip = render('EvasiveFighter (Second Turn)');
        // Legacy artifact showed EvasiveFighter (first-of-filtered-list, already
        // acted); the walk's next after the ST row's slot is AasimarTest.
        expect(strip[0]).toBe('AasimarTest');
        // The rest continues in walk order, skipping the away creature and
        // wrapping to the top of the round.
        expect(strip).toEqual(['AasimarTest', 'FeyRanger', 'EvasiveFighter', 'Bugbear']);
    });

    it('ST row active late-at-the-tail: strip wraps to the top of walk order', () => {
        const tailBoard = [
            { name: 'EvasiveFighter', type: 'player', initiative: '20' },
            { name: 'AasimarTest', type: 'player', initiative: '11' },
            { name: 'FeyRanger', type: 'player', initiative: '9' },
            { name: 'TailFighter', type: 'player', initiative: '5' },
            { name: 'TailFighter (Second Turn)', type: 'player', initiative: '-5', secondTurn: true, holderName: 'TailFighter' },
        ];
        const { result } = renderHook(() => useTvPresentation({
            campaignName: 'test-campaign',
            displayCreatures: tailBoard,
            activeCreatureName: 'TailFighter (Second Turn)',
            showToast: vi.fn(),
        }));
        // Next past the last slot wraps to the round's first creature.
        expect(result.current.nextUpCreatures.map(c => c.name))
            .toEqual(['EvasiveFighter', 'AasimarTest', 'FeyRanger', 'TailFighter']);
    });

    it('normal turn active: output unchanged from the legacy filtered-list slice', () => {
        // Present-list order: EF, Bugbear, Goblin, K1, K2, Aasimar, FeyRanger.
        // Mid-list anchor (Bugbear, idx 1): legacy slice = next 4 eligible.
        expect(render('Bugbear'))
            .toEqual(['Goblin', 'Kobold 1', 'Kobold 2', 'AasimarTest']);
        // Last-eligible anchor (FeyRanger): wraparound face — the away row and
        // the ST row are stepped over exactly like the walk does.
        expect(render('FeyRanger'))
            .toEqual(['EvasiveFighter', 'Bugbear', 'Goblin', 'Kobold 1']);
        // First anchor: never lists the active itself.
        expect(render('EvasiveFighter'))
            .toEqual(['Bugbear', 'Goblin', 'Kobold 1', 'Kobold 2']);
    });

    it('unknown active creature keeps the legacy first-of-list face', () => {
        expect(render('Nobody')).toEqual(['EvasiveFighter', 'Bugbear', 'Goblin', 'Kobold 1']);
        expect(render(null)).toEqual(['EvasiveFighter', 'Bugbear', 'Goblin', 'Kobold 1']);
    });

    it('cap is 4 and secondTurn/away rows never appear (even mid-strip)', () => {
        for (const active of ['EvasiveFighter', 'EvasiveFighter (Second Turn)']) {
            const strip = render(active);
            expect(strip).toHaveLength(4);
            expect(strip).not.toContain('EvasiveFighter (Second Turn)');
            expect(strip).not.toContain('AwayPaladin');
        }
    });

    it('tiny boards stay inert (fewer than 2 eligible rows ⇒ empty strip)', () => {
        const { result } = renderHook(() => useTvPresentation({
            campaignName: 'test-campaign',
            displayCreatures: [
                { name: 'Solo', type: 'player', initiative: '10' },
                { name: 'Solo (Second Turn)', type: 'player', initiative: '0', secondTurn: true, holderName: 'Solo' },
            ],
            activeCreatureName: 'Solo (Second Turn)',
            showToast: vi.fn(),
        }));
        expect(result.current.nextUpCreatures).toEqual([]);
    });
});
