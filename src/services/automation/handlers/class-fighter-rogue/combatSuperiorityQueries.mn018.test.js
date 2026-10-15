// @maintained-by-ai: 2026-10-15
// MN-018: HIT-triggered attack-rider riders must NOT be offered on a MISS,
// the miss-triggered rider must STILL be offered on a miss, and the per-trigger
// filter must never default-true for unknown triggers.
//
// Ownership: this file is the SOLE ByTrigger offer-gate owner
// (getAvailableAttackRiderManeuversByTrigger, the lane handleAttackRiderPrompt
// consumes). mn014 pins the shared-query/live-chooser lanes
// (getAvailableAttackRiderManeuvers / getAttackRiderOptions) and points its
// miss-offer trim at 'still offers Precision Attack on a miss' below — keep
// that name. combatSuperiorityHandlerQuery.test.js pins the early-return gates
// and the ranged-miss variant; mn020 pins die/save token passthrough;
// combatSuperiorityUtils.sweeping.test.js owns executeSweepingAttack itself.
//
// Trim notes (2026-10-15): collapsed six per-maneuver contains/not-contain
// tests — 'offers Sweeping on a MELEE HIT', 'does NOT offer Sweeping on a
// MELEE MISS', 'does NOT offer weapon_attack_hit riders on a miss', 'offers
// weapon_attack_hit riders on a hit', 'still offers Precision Attack on a
// miss', 'does NOT default-offer an unrecognized trigger' — into two exact-set
// tables. The hit table and miss table each assert the COMPLETE offered set, so
// every former pin is enforced more strictly by containment (two pairs even
// shared identical inputs). Added a pin for the no-attackInfo enumeration branch
// (offer gate inactive without context) — untested anywhere before.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getAvailableAttackRiderManeuversByTrigger,
    getManeuversForRules,
} from './combatSuperiorityQueries.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => [
        { name: 'Sweeping Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit', effect: 'secondary_damage', damageBonus: false, dieExpression: 'superiority_die' },
        { name: 'Menacing Attack', actionType: 'attack_rider', trigger: 'weapon_attack_hit', effect: 'frightened', saveType: 'WIS', damageBonus: true, dieExpression: 'superiority_die' },
        { name: 'Precision Attack', actionType: 'attack_rider', trigger: 'attack_roll_miss', effect: 'attack_roll_bonus', dieExpression: 'superiority_die' },
        { name: 'Mystery Rider', actionType: 'attack_rider', trigger: 'some_unknown_trigger', effect: 'x' },
    ]),
}));

const CAMPAIGN = 'test-campaign';

const stats = () => ({ name: 'EvasiveFighter', rules: '2024' });

describe('getAvailableAttackRiderManeuversByTrigger — MN-018 offer gate', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'BattleMasterManeuvers_selection') return ['Sweeping Attack', 'Menacing Attack', 'Precision Attack', 'Mystery Rider'];
            if (key === 'superiorityDice') return 4;
            return undefined;
        });
        await getManeuversForRules('2024');
    });

    const namesFor = (attackInfo) =>
        getAvailableAttackRiderManeuversByTrigger(stats(), CAMPAIGN, attackInfo).map(m => m.name);

    // Exact HIT table: Sweeping (melee_weapon_attack_hit) and Menacing
    // (weapon_attack_hit) offer on a melee hit; Precision (attack_roll_miss)
    // and Mystery Rider (unrecognized trigger → matcher defaults FALSE, the
    // MN-018 fail-open fix) must be absent.
    it('offers exactly the hit-triggered riders on a MELEE HIT', () => {
        expect(namesFor({ weaponType: 'melee', hit: true })).toEqual(['Sweeping Attack', 'Menacing Attack']);
    });

    // Exact MISS table — sole miss-offer owner (mn014's trim points here):
    // Precision Attack (attack_roll_miss) still offers on a miss; both
    // HIT-triggered riders fail closed, and Mystery Rider is never offered.
    it('still offers Precision Attack on a miss', () => {
        expect(namesFor({ weaponType: 'melee', hit: false })).toEqual(['Precision Attack']);
    });

    it('enumerates every known attack_rider when no attack context is given (trigger gate inactive)', () => {
        expect(namesFor(undefined)).toEqual(['Sweeping Attack', 'Menacing Attack', 'Precision Attack', 'Mystery Rider']);
    });
});
