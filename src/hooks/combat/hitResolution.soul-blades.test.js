// @improved-by-ai
// CLA-320 Homing Strikes (Soulknife Soul Blades lv9) resolution gates:
// miss→hit conversion spends the die and flips hit; natural 1 never converts;
// still-miss spends nothing and stamps the attempt.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { resolveHit } from './hitResolution.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        DEBUG_FORCE_CRIT: false,
        getName: (n) => n || 'Unknown',
        guid: () => 'test-guid',
    },
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    hasAttackerTriggeredMajesty: vi.fn(() => false),
    markAttackerTriggeredMajesty: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    dispatchUnbreakableMajestySave: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(() => false),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../services/combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(() => 12),
}));

function stubRandom(fraction) {
    Object.defineProperty(Math, 'random', { value: () => fraction, configurable: true, writable: true });
}

const characterName = 'AasimarTest';
const campaignName = 'test-campaign';

function makeContext() {
    return {
        rollType: 'attack',
        attackerName: characterName,
        targetName: 'Knight 1',
        effectiveBonus: 8,
        bonus: 8,
        isPsychicBlade: true,
        isWeaponAttack: true,
        playerStats: {
            name: characterName,
            level: 17,
            class: { name: 'Rogue', major: { name: 'Soulknife' } },
            _trackedResources: { psionicEnergy: { max: 12 } },
        },
    };
}

const target = { name: 'Knight 1', ac: 18, type: 'monster' };

function callResolveHit(effectiveD20Roll) {
    return resolveHit({ characterName: characterName, campaignName: campaignName, context: makeContext(), bonus: 8, effectiveD20Roll: effectiveD20Roll, target: target, combatSummary: null, characters: [], logEntry: vi.fn() });
}

describe('resolveHit — Homing Strikes (CLA-320 Soul Blades)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === characterName && key === 'psionicEnergy') return 12;
            return null;
        });
    });

    afterEach(() => {
        Object.defineProperty(Math, 'random', { value: Math.random, configurable: true, writable: true });
    });

    it('converts a miss into a hit, expends 1 Psionic Energy, and reports the homing bonus', async () => {
        stubRandom(0.41); // d12 → 5; 8 + 8 + 5 = 21 ≥ AC 18
        const result = await callResolveHit(8);

        expect(result.hit).toBe(true);
        expect(result.homingStrikesUsed).toBe(true);
        expect(result.homingStrikesAttempted).toBe(true);
        expect(result.homingStrikesBonus).toBe(5);
        expect(setRuntimeValue).toHaveBeenCalledWith(characterName, 'psionicEnergy', 11, campaignName);
        const logs = addEntry.mock.calls.map(c => c[1].description).join('\n');
        expect(logs).toContain('turn a miss into a hit');
        expect(logs).toContain('Psionic Energy: 11/12');
    });

    it('compares the boosted total against effective AC (cover folded in)', async () => {
        stubRandom(0.41); // d12 → 5; total 21 vs effective AC 20
        const context = makeContext();
        context.coverAcBonus = 2;
        const result = await resolveHit({ characterName: characterName, campaignName: campaignName, context: context, bonus: 8, effectiveD20Roll: 8, target: { name: 'Knight 1', ac: 18 }, combatSummary: null, characters: [], logEntry: vi.fn() });

        expect(result.hit).toBe(true);
        expect(result.homingStrikesUsed).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledWith(characterName, 'psionicEnergy', 11, campaignName);
    });

    it('still-miss expends NO die but stamps the attempt', async () => {
        stubRandom(0); // d12 → 1; 8 + 8 + 1 = 17 < AC 18
        const result = await callResolveHit(8);

        expect(result.hit).toBe(false);
        expect(result.homingStrikesUsed).toBe(false);
        expect(result.homingStrikesAttempted).toBe(true);
        const energyWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'psionicEnergy');
        expect(energyWrites).toHaveLength(0);
        const logs = addEntry.mock.calls.map(c => c[1].description).join('\n');
        expect(logs).toContain('the attack still missed (total: 17 vs AC: 18)');
    });

    it('natural 1 never converts — no die rolled, no energy spent', async () => {
        const randomSpy = vi.spyOn(Math, 'random');
        const result = await callResolveHit(1);

        expect(result.hit).toBe(false);
        expect(result.homingStrikesUsed).toBe(false);
        expect(result.homingStrikesAttempted).toBe(false);
        expect(randomSpy).not.toHaveBeenCalled();
        const energyWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'psionicEnergy');
        expect(energyWrites).toHaveLength(0);
        const logs = addEntry.mock.calls.map(c => c[1].description).join('\n');
        expect(logs).toContain('natural 1');
        expect(logs).toContain('Homing Strikes was not attempted');
    });

    it('rolls the table die size (d12 at lv17), not a hardcoded fallback', async () => {
        stubRandom(0.99); // d12 → 12
        const result = await callResolveHit(8);
        expect(result.homingStrikesBonus).toBe(12);
    });
});
