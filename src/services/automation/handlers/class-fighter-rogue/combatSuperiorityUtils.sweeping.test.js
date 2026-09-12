// MN-018: executeSweepingAttack must re-use the ORIGINAL attack roll vs the
// SECOND creature's AC, gate on 5 ft of the original target, apply REAL damage
// with the REAL damageType via applyDamageToTarget, and consume the pending stash.
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

const pending = {
    dieValue: 9,
    damageType: 'slashing',
    primaryTarget: 'Thug 1',
    targetName: 'Thug 1',
    originalTotal: 14,
    originalD20Roll: 7,
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

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        const call = applyDamageToTarget.mock.calls[0];
        expect(call[1]).toBe('Thug 2');
        expect(call[2]).toBe(9);
        expect(call[3]).toEqual(['slashing']);
        expect(call[6].attackerName).toBe('EvasiveFighter');
        expect(result.payload.description).toMatch(/hits Thug 2/);
        expect(result.payload.description).toMatch(/9 slashing/);
        expect(result.payload.name).toBe('Sweeping Attack');
        expect(result.payload.description).not.toMatch(/Sweeping Attack/);
    });

    it('MISSES (no damage) when the original attack total is below the second creature AC', async () => {
        armPending({ ...pending, originalTotal: 8, originalD20Roll: 1 });
        const result = await executeSweepingAttack({ automation: { secondaryTargetName: 'Thug 2' } }, stats(), CAMPAIGN, 'Thug 2');

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(result.payload.description).toMatch(/misses Thug 2/i);
        expect(result.payload.description).not.toMatch(/Sweeping Attack/);
    });

    it('refuses when not within 5 feet of the original target — no damage applied', async () => {
        armPending();
        isWithinRange.mockResolvedValue(false);
        const result = await executeSweepingAttack({ automation: { secondaryTargetName: 'Thug 2' } }, stats(), CAMPAIGN, 'Thug 2');

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(result.payload.description).toMatch(/not within 5 feet/i);
        expect(result.payload.description).not.toMatch(/Sweeping Attack/);
    });

    it('consumes pendingSweepingAttack (one-shot)', async () => {
        armPending();
        await executeSweepingAttack({ automation: { secondaryTargetName: 'Thug 2' } }, stats(), CAMPAIGN, 'Thug 2');

        const cleared = setRuntimeValue.mock.calls.find(c => c[1] === 'pendingSweepingAttack');
        expect(cleared[2]).toBeNull();
    });

    it('accurate ability_use log reflects hit/miss outcome', async () => {
        armPending({ ...pending, originalTotal: 8, originalD20Roll: 1 });
        await executeSweepingAttack({ automation: { secondaryTargetName: 'Thug 2' } }, stats(), CAMPAIGN, 'Thug 2');
        expect(addEntry).toHaveBeenCalled();
        expect(addEntry.mock.calls[0][1].description).toMatch(/misses Thug 2/i);
    });
});
