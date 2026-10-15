// @maintained-by-ai: 2026-10-15
// MN-014: Precision Attack (trigger attack_roll_miss) was offered on HITS
// because the hit-branch query only gated weapon/melee TYPE, never hit/miss.
// These pins lock the two halves of the fix on the LIVE consumer lanes
// (attackRollRiders.js): the HIT chooser must exclude the miss-triggered rider,
// and the MISS chooser must carry effect/damageBonus so the consumer can route it.
//
// Ownership (this file = hit-exclude + miss-passthrough on the two live lanes):
//   - getAttackRiderOptions (HIT chooser, live)  → excludes Precision on a hit
//   - getAvailableAttackRiderManeuvers (shared)   → excludes Precision on a hit,
//                                                    offers it on a miss
//   - getAttackRiderOptionsByContext('miss')      → miss options carry effect/
//                                                    damageBonus for handleAttackRiderManeuverUse
//   - ByTrigger offer-gate (Sweeping/Menacing/Precision/Mystery hit & miss, and the
//     unknown-trigger default) lives in combatSuperiorityQueries.mn018.test.js — the
//     sole ByTrigger owner. save/die token passthrough lives in mn020.
//
// Trim notes (2026-10-15): removed the ByTrigger half of the miss-offer pin
// (getAvailableAttackRiderManeuversByTrigger offering Precision on a melee miss was
// triple-covered by mn018 'still offers Precision Attack on a miss') and dropped
// 'hit-context options exclude Precision Attack' — a third level of the same
// Precision-on-hit exclusion (already pinned at the live chooser + shared query)
// on a context the consumer never builds.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getAvailableAttackRiderManeuvers,
    getManeuversForRules,
} from './combatSuperiorityQueries.js';
import {
    getAttackRiderOptions,
    getAttackRiderOptionsByContext,
} from './dispatchers.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => [
        { name: 'Precision Attack', actionType: 'attack_rider', trigger: 'attack_roll_miss', effect: 'attack_roll_bonus', damageBonus: false, dieExpression: 'superiority_die' },
        { name: 'Menacing Attack', actionType: 'attack_rider', trigger: 'weapon_attack_hit', effect: 'frightened', saveType: 'WIS', damageBonus: true, dieExpression: 'superiority_die' },
        { name: 'Sweeping Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit', effect: 'secondary_damage', damageBonus: false, dieExpression: 'superiority_die' },
    ]),
}));

const CAMPAIGN = 'test-campaign';
const stats = () => ({ name: 'EvasiveFighter', rules: '2024' });

describe('MN-014 — Precision Attack trigger routing', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'BattleMasterManeuvers_selection') return ['Precision Attack', 'Menacing Attack', 'Sweeping Attack'];
            if (key === 'superiorityDice') return 4;
            return undefined;
        });
        await getManeuversForRules('2024');
    });

    const names = (list) => list.map(m => m.name);

    it('excludes Precision Attack from HIT rider options (pipeline chooser)', async () => {
        const hitOptions = await getAttackRiderOptions(stats(), CAMPAIGN, { weaponType: 'melee', hit: true });
        expect(names(hitOptions)).not.toContain('Precision Attack');
        expect(names(hitOptions)).toContain('Menacing Attack');
        expect(names(hitOptions)).toContain('Sweeping Attack');
    });

    it('excludes Precision Attack from hit maneuvers (shared query)', () => {
        const hit = getAvailableAttackRiderManeuvers(stats(), CAMPAIGN, { weaponType: 'melee', hit: true });
        expect(names(hit)).not.toContain('Precision Attack');
        expect(names(hit)).toEqual(expect.arrayContaining(['Menacing Attack', 'Sweeping Attack']));
    });

    it('still offers Precision Attack on a MISS (shared query)', () => {
        expect(names(getAvailableAttackRiderManeuvers(stats(), CAMPAIGN, { weaponType: 'melee', hit: false }))).toEqual(['Precision Attack']);
    });

    it('miss-context options carry effect/damageBonus for the consumer router', async () => {
        const options = await getAttackRiderOptionsByContext(stats(), CAMPAIGN, { weaponType: 'melee', hit: false }, 'miss');
        expect(options).toHaveLength(1);
        expect(options[0]).toEqual(expect.objectContaining({
            name: 'Precision Attack',
            effect: 'attack_roll_bonus',
            damageBonus: false,
            context: 'miss',
        }));
    });
});
