// @maintained-by-ai
// MN-018: executeSweepingAttack must re-use the ORIGINAL attack roll vs the
// SECOND creature's AC, gate on 5 ft of the original target, apply REAL damage
// with the REAL damageType via applyDamageToTarget, and consume the pending stash.
// CANONICAL owner of the hit/miss/5ft-gate/pending-clear branches here. Guard
// popups (no-pending, invalid secondary target), finalDamage precedence, and
// secondary_damage targetEffects registration are owned by
// combatSuperiorityChoices.test.js; the parallel executeManeuver.js runSweepingAttack
// arm-lane lives in executeManeuver.mn018.test.js. Fully mocked, deterministic,
// turn-based.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSweepingAttack } from './combatSuperiorityUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Thug 2', ac: 11 }] }),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => ({ finalDamage: 9, newHp: 23 })),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

const CAMPAIGN = 'test-campaign';

const stats = () => ({ name: 'EvasiveFighter', rules: '2024' });

// originalTotal (14) intentionally does NOT equal originalD20Roll + attackBonus
// (3 + 7 = 10, below AC 11): pins that the ORIGINAL TOTAL takes precedence over
// re-deriving the roll from its components.
const pending = {
    dieValue: 9,
    damageType: 'slashing',
    primaryTarget: 'Thug 1',
    targetName: 'Thug 1',
    originalTotal: 14,
    originalD20Roll: 3,
    attackBonus: 7,
    secondaryTargets: [{ name: 'Thug 2', type: 'monster', ac: 11 }],
};

function armPending(p = pending) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'pendingSweepingAttack') return p;
        if (key === 'characters') return [];
        if (key === 'targetEffects') return [];
        return undefined;
    });
}

describe('executeSweepingAttack — MN-018 original-roll vs AC + real damage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isWithinRange.mockResolvedValue(true);
    });

    it('HITS when the original attack total beats the second creature AC, applies die damage with real type', async () => {
        armPending();
        const result = await executeSweepingAttack({ automation: { secondaryTargetName: 'Thug 2' } }, stats(), CAMPAIGN, 'Thug 2');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        const call = applyDamageToTarget.mock.calls[0];
        expect(call[1]).toBe('Thug 2');
        expect(call[2]).toBe(9);
        expect(call[3]).toEqual(['slashing']);
        expect(call[4].attackerName).toBe('EvasiveFighter');
        expect(result.payload.name).toBe('Sweeping Attack');
        expect(result.payload.description).toBe('Original attack roll 14 vs AC 11 hits Thug 2, which takes 9 slashing damage (same type as the original attack).');
        expect(result.payload.description).not.toMatch(/Sweeping Attack/);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'ability_use',
            characterName: 'EvasiveFighter',
            abilityName: 'Sweeping Attack',
            description: 'Sweeping Attack: original attack roll 14 vs AC 11 hits Thug 2 — 9 slashing damage (same type as the attack on Thug 1).',
        });
    });

    it('MISSES (no damage) when the original attack total is below the second creature AC', async () => {
        // originalTotal 0 exercises the originalD20Roll + attackBonus fallback (1 + 7 = 8).
        armPending({ ...pending, originalTotal: 0, originalD20Roll: 1 });
        const result = await executeSweepingAttack({ automation: { secondaryTargetName: 'Thug 2' } }, stats(), CAMPAIGN, 'Thug 2');

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(result.payload.name).toBe('Sweeping Attack');
        expect(result.payload.description).toBe('Original attack roll 8 vs AC 11 — misses Thug 2. No damage.');
        expect(result.payload.description).not.toMatch(/Sweeping Attack/);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'ability_use',
            characterName: 'EvasiveFighter',
            abilityName: 'Sweeping Attack',
            description: 'Sweeping Attack: original attack roll 8 vs AC 11 misses Thug 2 — no damage.',
        });
    });

    it('refuses when not within 5 feet of the original target — no damage applied', async () => {
        armPending();
        isWithinRange.mockResolvedValue(false);
        const result = await executeSweepingAttack({ automation: { secondaryTargetName: 'Thug 2' } }, stats(), CAMPAIGN, 'Thug 2');

        expect(isWithinRange).toHaveBeenCalledWith('Thug 1', 'Thug 2', 5);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(result.payload.name).toBe('Sweeping Attack');
        expect(result.payload.description).toBe('Thug 2 is not within 5 feet of Thug 1 — no creature is swept.');
        expect(result.payload.description).not.toMatch(/Sweeping Attack/);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'ability_use',
            characterName: 'EvasiveFighter',
            abilityName: 'Sweeping Attack',
            description: 'Sweeping Attack: Thug 2 is not within 5 feet of Thug 1 — no damage.',
        });
    });

    it('consumes pendingSweepingAttack (one-shot)', async () => {
        armPending();
        await executeSweepingAttack({ automation: { secondaryTargetName: 'Thug 2' } }, stats(), CAMPAIGN, 'Thug 2');

        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'pendingSweepingAttack', null, CAMPAIGN);
    });
});
