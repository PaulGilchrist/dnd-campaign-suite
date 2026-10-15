// @maintained-by-ai: 2026-10-14
// CLA-320 hitResolution seam (hitResolution.js runHomingStrikes/attemptHomingStrike):
// Soulknife lv9 Soul Blades "Homing Strikes" — on a Psychic Blade miss, roll the
// psionic die and add it; hit vs EFFECTIVE AC spends 1 Psionic Energy; natural 1
// never converts; still-miss and zero-energy spend nothing. Data gate: 2024
// classes.json Rogue→Soul Blades level 9, lv17 energy_die_type 12 (d12 — validated
// here through the REAL automationExpressions.getPsionicEnergyDieSize, unmocked).
// Producer/UI seams covered elsewhere: autoRerollHandler.soul-blades.test.js,
// DiceRollResult.homing.test.jsx, attackPostProcessing.js evidence stamps.
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
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
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

// NOTE: automationExpressions is NOT mocked — the psionic die size must come from
// the real level table (lv17 → d12, matching 2024 classes.json energy data).

const characterName = 'AasimarTest';
const campaignName = 'test-campaign';
const AC = 18;
const BONUS = 8;

function makeContext(overrides) {
    return {
        rollType: 'attack',
        attackerName: characterName,
        targetName: 'Knight 1',
        effectiveBonus: BONUS,
        bonus: BONUS,
        isPsychicBlade: true,
        isWeaponAttack: true,
        playerStats: {
            name: characterName,
            level: 17,
            class: { name: 'Rogue', major: { name: 'Soulknife' } },
            _trackedResources: { psionicEnergy: { max: 12 } },
        },
        ...overrides,
    };
}

function callResolveHit(effectiveD20Roll, contextOverrides) {
    return resolveHit({
        characterName,
        campaignName,
        context: makeContext(contextOverrides),
        bonus: BONUS,
        effectiveD20Roll,
        target: { name: 'Knight 1', ac: AC, type: 'monster' },
        combatSummary: null,
        characters: [],
        logEntry: vi.fn(),
    });
}

const energyWrites = () => setRuntimeValue.mock.calls.filter(c => c[1] === 'psionicEnergy');
const logText = () => addEntry.mock.calls.map(c => c[1].description).join('\n');

describe('resolveHit — Homing Strikes (CLA-320 Soul Blades)', () => {
    let randomSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        randomSpy = vi.spyOn(Math, 'random');
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === characterName && key === 'psionicEnergy') return 12;
            return null;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('converts a miss into a hit, expends 1 Psionic Energy, and reports the homing bonus', async () => {
        randomSpy.mockReturnValue(0.41); // d12 → 5; 8 + 8 + 5 = 21 ≥ AC 18
        const result = await callResolveHit(8);

        expect(result.hit).toBe(true);
        expect(result.homingStrikesAttempted).toBe(true);
        expect(result.homingStrikesUsed).toBe(true);
        expect(result.homingStrikesBonus).toBe(5);
        expect(setRuntimeValue).toHaveBeenCalledWith(characterName, 'psionicEnergy', 11, campaignName);
        expect(logText()).toContain('turn a miss into a hit');
        expect(logText()).toContain('Psionic Energy: 11/12');
    });

    it('compares the boosted total against effective AC, not base AC (cover folded in)', async () => {
        // Half-cover lifts AC 18 → effective 20. Total 19 would convert if the
        // resolver wrongly compared against base AC 18 — it must still miss and
        // spend nothing.
        randomSpy.mockReturnValue(0.2); // d12 → 3; 8 + 8 + 3 = 19 < effective AC 20
        const result = await callResolveHit(8, { coverAcBonus: 2 });

        expect(result.effectiveAc).toBe(20);
        expect(result.hit).toBe(false);
        expect(result.homingStrikesAttempted).toBe(true);
        expect(result.homingStrikesUsed).toBe(false);
        expect(energyWrites()).toHaveLength(0);
        expect(logText()).toContain('still missed (total: 19 vs AC: 20)');
    });

    it('still-miss expends NO die but stamps the attempt', async () => {
        randomSpy.mockReturnValue(0); // d12 → 1; 8 + 8 + 1 = 17 < AC 18
        const result = await callResolveHit(8);

        expect(result.hit).toBe(false);
        expect(result.homingStrikesAttempted).toBe(true);
        expect(result.homingStrikesUsed).toBe(false);
        expect(energyWrites()).toHaveLength(0);
        expect(logText()).toContain('the attack still missed (total: 17 vs AC: 18)');
    });

    it('natural 1 never converts — no die rolled, no energy spent', async () => {
        const result = await callResolveHit(1);

        expect(result.hit).toBe(false);
        expect(result.homingStrikesAttempted).toBe(false);
        expect(result.homingStrikesUsed).toBe(false);
        expect(randomSpy).not.toHaveBeenCalled();
        expect(energyWrites()).toHaveLength(0);
        expect(logText()).toContain('natural 1');
        expect(logText()).toContain('Homing Strikes was not attempted');
    });

    it('rolls the real lv17 psionic die size (d12), not a hardcoded fallback', async () => {
        randomSpy.mockReturnValue(0.99); // d12 → 12
        const result = await callResolveHit(8);
        expect(result.homingStrikesBonus).toBe(12);
    });

    it('spends nothing and stays a miss when the psionic pool is empty (even if the die would convert)', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === characterName && key === 'psionicEnergy') return 0;
            return null;
        });
        randomSpy.mockReturnValue(0.99); // d12 → 12; 8 + 8 + 12 = 28 ≥ AC 18
        const result = await callResolveHit(8);

        expect(result.hit).toBe(false);
        expect(result.homingStrikesUsed).toBe(false);
        expect(energyWrites()).toHaveLength(0);
    });
});
