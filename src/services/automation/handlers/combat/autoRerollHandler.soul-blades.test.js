// CLA-320: manual Soul Blades Reactions row — RAW gates enforced:
// trigger is a missed own Psychic Blade attack, natural 1 refuses,
// already-homed misses refuse (double-dip guard), and the Psionic Energy
// die is expended ONLY when the boosted roll turns the miss into a hit.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle } from './autoRerollHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ creatures: [] })),
    loadCombatSummary: vi.fn(async () => null),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(() => null),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 12),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 9, rolls: [7, 2], modifier: 0 })),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 9 })),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => ({})),
}));

const playerName = 'AasimarTest';
const campaignName = 'test-campaign';

function makeAction() {
    return {
        name: 'Soul Blades',
        description: 'Homing Strikes.',
        automation: {
            type: 'auto_reroll',
            target: 'attack_roll',
            condition: 'psychic_blade_miss',
            trigger: 'psychic_blade_miss',
            bonusExpression: 'psionic_energy_die',
            resourceCost: 'psionic_energy',
        },
    };
}

function makePlayerStats() {
    return {
        name: playerName,
        level: 17,
        proficiency: 6,
        _trackedResources: { psionicEnergy: { max: 12 } },
    };
}

function makeLastAttack(overrides = {}) {
    return {
        rollType: 'attack',
        attackerName: playerName,
        hit: false,
        d20: 8,
        bonus: 8,
        targetAc: 18,
        effectiveAc: 18,
        attackName: 'Psychic Blade',
        isPsychicBlade: true,
        damageFormula: '8d8+2',
        damageType: 'psychic',
        targetName: 'Knight 1',
        ...overrides,
    };
}

function stubRandom(fraction) {
    Object.defineProperty(Math, 'random', { value: () => fraction, configurable: true, writable: true });
}

function seedRuntime(lastAttack, energy = 9) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'lastAttack') return lastAttack;
        if (name === playerName && key === 'psionicEnergy') return energy;
        return null;
    });
}

function energyWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[1] === 'psionicEnergy');
}

function lastAttackStamps() {
    return setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'lastAttack');
}

describe('autoRerollHandler — Soul Blades Homing Strikes manual row (CLA-320)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        evaluateAutoExpression.mockReturnValue(12);
        rollExpression.mockReturnValue({ total: 9, rolls: [7, 2], modifier: 0 });
        applyDamageToTarget.mockReturnValue({ finalDamage: 9 });
        getCombatContext.mockResolvedValue({ creatures: [] });
    });

    afterEach(() => {
        Object.defineProperty(Math, 'random', { value: Math.random, configurable: true, writable: true });
    });

    it('refuses when the last miss was not a Psychic Blade attack — pool intact', async () => {
        seedRuntime(makeLastAttack({ isPsychicBlade: false, attackName: 'Shortsword' }));
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('only works with Psychic Blade attacks');
        expect(energyWrites()).toHaveLength(0);
    });

    it('refuses a natural 1 — pool intact', async () => {
        seedRuntime(makeLastAttack({ d20: 1 }));
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('natural 1');
        expect(energyWrites()).toHaveLength(0);
    });

    it('refuses an already-homed miss (double-dip guard) — pool intact', async () => {
        seedRuntime(makeLastAttack({ homingStrikesAttempted: true }));
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('already resolved this attack');
        expect(energyWrites()).toHaveLength(0);
    });

    it('refuses when the last attack already hit — pool intact', async () => {
        seedRuntime(makeLastAttack({ hit: true }));
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('No recent missed attack');
        expect(energyWrites()).toHaveLength(0);
    });

    it('converts to hit: expends exactly 1 die, applies damage, stamps lastAttack', async () => {
        stubRandom(0.41); // d12 → 5; 8+8+5 = 21 ≥ 18
        seedRuntime(makeLastAttack());
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(energyWrites()).toEqual([[playerName, 'psionicEnergy', 8, campaignName]]);
        expect(rollExpression).toHaveBeenCalledWith('8d8+2');
        expect(applyDamageToTarget).toHaveBeenCalled();
        expect(result.payload.description).toContain('Miss turned into a hit');
        expect(lastAttackStamps().map(c => c[2])).toEqual([
            expect.objectContaining({ hit: true, homingStrikesAttempted: true, homingStrikesUsed: true, homingStrikesBonus: 5 }),
        ]);
        const logs = addEntry.mock.calls.map(c => c[1].description).join('\n');
        expect(logs).toContain('Miss turned into a hit — 1 Psionic Energy expended');
    });

    it('still-miss: expends NOTHING but stamps the resolved attempt', async () => {
        stubRandom(0); // d12 → 1; 8+8+1 = 17 < 18
        seedRuntime(makeLastAttack());
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('Still a miss');
        expect(energyWrites()).toHaveLength(0);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(lastAttackStamps().map(c => c[2])).toEqual([
            expect.objectContaining({ hit: false, homingStrikesAttempted: true, homingStrikesUsed: false }),
        ]);
        const logs = addEntry.mock.calls.map(c => c[1].description).join('\n');
        expect(logs).toContain('Psionic Energy die NOT expended');
        expect(logs).toContain('Psionic Energy: 9/12');
    });
});
