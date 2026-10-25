// @maintained-by-ai
// Regression lock — RAW sign of the §8.3 zones half-cover lane (bug-zones-half-cover-ac-sign-inverted).
// Half cover RAISES the target's AC by +2 (PHB 2024 ch.9; the app's items/walls
// lanes already model cover as a positive coverAcBonus: +2/+5 folded ADDITIVELY
// in DiceRollResult.computed.js). A prior producer shipped HALF_COVER_AC = -2,
// which made interposed targets EASIER to hit (live: AC 10 resolved as 8).
// This file pins the sign end-to-end at both seams: the stamping producer
// (coverService) and the additive reader (targetAcComputation.computeTargetAc).
// Deeper channel/geometry contracts stay owned by coverService.test.js and
// targetAcComputation.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../encounters/combatData.js', () => ({ getCurrentCombatRound: () => 1 }));
vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));

import { HALF_COVER_AC, stampCoverShot, adjudicateCoverShot, COVER_SHOT_KEY } from './coverService.js';
import { computeTargetAc } from '../../hooks/combat/targetAcComputation.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../ui/logService.js';

const CAMPAIGN = 'test-campaign';
const from = { gridX: 0, gridY: 0 };
const to = { gridX: 6, gridY: 0 };
const blocker = { name: 'Goblin', gridX: 3, gridY: 0 };

describe('§8.3 half-cover RAW sign (+2, never −2)', () => {
    const store = {};

    beforeEach(() => {
        vi.clearAllMocks();
        for (const k of Object.keys(store)) delete store[k];
        getRuntimeValue.mockImplementation((name, key) => (store[`${name}.${key}`] ?? null));
    });

    it('HALF_COVER_AC is a POSITIVE defense bonus', () => {
        expect(HALF_COVER_AC).toBe(2);
    });

    it('stamp carries the +2 (never a negative) onto _cover_shot', () => {
        const stamp = stampCoverShot({ campaignName: CAMPAIGN, attackerName: 'Hero', targetName: 'Guard', blocker, round: 1 });
        expect(stamp.ac).toBe(2);
        expect(stamp.ac).toBeGreaterThan(0);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', COVER_SHOT_KEY, stamp, CAMPAIGN);
    });

    it('computeTargetAc RAISES the covered target AC by +2 (AC 10 ⇒ 12, not 8)', () => {
        store['campaign._cover_shot'] = { attackerName: 'Hero', targetName: 'Guard', ac: HALF_COVER_AC, blocker: 'Goblin', cell: '3,0', round: 1 };
        const ctx = { rollType: 'attack', attackerName: 'Hero' };
        const target = { name: 'Guard', type: 'npc', ac: 10 };
        expect(computeTargetAc(ctx, target, [], CAMPAIGN)).toBe(12);
    });

    it('adjudicateCoverShot logs the RAW-honest "(+2 AC)" description', () => {
        getRuntimeValue.mockImplementation((name, key) =>
            (name === 'campaign' && key === 'enforcement' ? { mode: 'on', zones: true } : null));
        const stamp = adjudicateCoverShot({
            campaignName: CAMPAIGN,
            attackerName: 'Hero',
            targetName: 'Guard',
            from,
            to,
            players: [blocker],
        });
        expect(stamp).toEqual({ attackerName: 'Hero', targetName: 'Guard', ac: 2, blocker: 'Goblin', cell: '3,0', round: 1 });
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'enforcement_cover',
            description: 'Half cover (+2 AC): Goblin interposes at (3,0) between Hero and Guard (enforcement: zones).',
        }));
        expect(addEntry.mock.calls[0][1].description).not.toMatch(/−2 AC|-2 AC/);
    });
});
