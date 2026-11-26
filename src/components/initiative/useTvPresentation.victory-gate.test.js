// @maintained-by-ai 2026-11-18
// Lane: useTvPresentation VICTORY-BANNER gating (backlog 2026-11-18).
// Law: trackerHasFoes counts REAL foes only — a bare "+NPC" placeholder row is
// bookkeeping, never a combatant, so it must not keep the gate truthy and
// silently kill a celebrated win (the pre-fix face: a real 6-kill Clear went
// banner-less while the placeholder held the board). Real foes keep gating
// honestly: an EB-joined monster, an index-less species-named NPC, or a
// renamed custom NPC on the board outranks the old result (a new fight beats
// the old banner). celebrated:false and the per-client dismissal pref keep
// their outrank faces unchanged.
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTvPresentation } from './useTvPresentation.js';

let lastCombatResult = null;

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn((_key, prop) => (prop === 'lastCombatResult' ? lastCombatResult : null)),
}));

const STAMP = { stamp: 7, rounds: 3, foes: 2, defeated: 2, survivors: 2, partySize: 2, wipe: false, celebrated: true, attackEvidence: '{"attackerName":"Alice"}' };

const player = { name: 'Alice', type: 'player', initiative: '18' };
const visibleWith = (displayCreatures) => renderHook(() => useTvPresentation({
    campaignName: 'test-campaign',
    displayCreatures,
    activeCreatureName: 'Alice',
    showToast: vi.fn(),
})).result.current.victoryVisible;

beforeEach(() => {
    localStorage.clear();
    lastCombatResult = STAMP;
});

describe('useTvPresentation — victory banner gate vs bare placeholders', () => {
    it('a bare +NPC placeholder on the board does NOT gate the celebrated banner', () => {
        // Real foes all wiped/removed at the Clear seam; only the bookkeeping
        // slot remains. Pre-fix: trackerHasFoes truthy ⇒ silent victory.
        expect(visibleWith([
            player,
            { name: 'NPC 1', type: 'npc', initiative: '', ac: 10, maxHp: 10, currentHp: 10 },
        ])).toBe(true);
    });

    it('real foes still outrank the old result (the gate keeps its job)', () => {
        // EB-joined monster (monsterIndex stamped).
        expect(visibleWith([player, { name: 'Goblin', type: 'npc', monsterIndex: 'goblin', currentHp: 7, maxHp: 7 }])).toBe(false);
        // Index-less species-named NPC — real, never-attacked foe included.
        expect(visibleWith([player, { name: 'Goblin', type: 'npc', currentHp: 7, maxHp: 7 }])).toBe(false);
        // Renamed custom NPC.
        expect(visibleWith([player, { name: 'Steve', type: 'npc', currentHp: 9, maxHp: 9 }])).toBe(false);
    });

    it('IMP-1 celebrated:false and the per-client dismissal pref still suppress', () => {
        lastCombatResult = { ...STAMP, celebrated: false };
        expect(visibleWith([player])).toBe(false);

        lastCombatResult = STAMP;
        localStorage.setItem('initiative-victory-dismissed', '7');
        expect(visibleWith([player])).toBe(false);
    });

    it('dismissVictory stamps the pref and hides the banner', () => {
        const { result } = renderHook(() => useTvPresentation({
            campaignName: 'test-campaign',
            displayCreatures: [player],
            activeCreatureName: 'Alice',
            showToast: vi.fn(),
        }));
        expect(result.current.victoryVisible).toBe(true);
        act(() => result.current.dismissVictory());
        expect(localStorage.getItem('initiative-victory-dismissed')).toBe('7');
        expect(result.current.victoryVisible).toBe(false);
    });
});
