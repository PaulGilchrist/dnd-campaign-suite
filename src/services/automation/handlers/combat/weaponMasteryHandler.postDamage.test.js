// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyPostDamageMasteryEffects } from './weaponMasteryHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../../services/encounters/combatData.js';
import * as automationService from '../../../combat/automation/automationService.js';

// ── Mocks (hoisted) ──────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    collectWeaponMastery: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        size: 'Medium',
        abilities: [
            { name: 'Constitution', bonus: 2 },
            { name: 'Strength', bonus: 3 },
        ],
        ...overrides,
    };
}

function makeCombatSummary(overrides = {}) {
    return {
        lastAttack: { targetName: 'Goblin' },
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────

describe('applyPostDamageMasteryEffects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(combatData.getCurrentCombatRound).mockReturnValue(1);
    });

    it('should return early when combatSummary lastAttack.targetName is null', async () => {
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Vex',
            extraMasteries: [],
        });

        const result = await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            { lastAttack: { targetName: null } },
        );
        expect(result).toBeUndefined();
    });

    it('should return early when combatSummary.lastAttack is undefined', async () => {
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Vex',
            extraMasteries: [],
        });

        const result = await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            { lastAttack: undefined },
        );
        expect(result).toBeUndefined();
    });

    it('should return early when combatSummary is undefined', async () => {
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Vex',
            extraMasteries: [],
        });

        const result = await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            undefined,
        );
        expect(result).toBeUndefined();
    });

    it('should call collectWeaponMastery with the attack name and playerStats', async () => {
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Vex',
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        expect(automationService.collectWeaponMastery).toHaveBeenCalledWith('Longsword', expect.any(Object));
    });

    it('should apply base mastery when present', async () => {
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Vex',
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        expect(logService.addEntry).toHaveBeenCalledWith(
            'campaign',
            expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Vex',
            }),
        );
    });

    it('should apply extra masteries in addition to base mastery', async () => {
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Vex',
            extraMasteries: ['Push', 'Sap'],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        const calls = vi.mocked(logService.addEntry).mock.calls;
        const abilityNames = calls.map(c => c[1].abilityName);
        expect(abilityNames).toContain('Vex');
        expect(abilityNames).toContain('Push');
        expect(abilityNames).toContain('Sap');
    });

    it('should skip Graze mastery in applyPostDamageMasteryEffects', async () => {
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Graze',
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        const calls = vi.mocked(logService.addEntry).mock.calls;
        const abilityNames = calls.map(c => c[1].abilityName);
        expect(abilityNames).not.toContain('Graze');
    });

    it('should skip Topple mastery in applyPostDamageMasteryEffects', async () => {
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Topple',
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        const calls = vi.mocked(logService.addEntry).mock.calls;
        const abilityNames = calls.map(c => c[1].abilityName);
        expect(abilityNames).not.toContain('Topple');
    });

    it('should apply Nick mastery with a specific log description', async () => {
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Nick',
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        expect(logService.addEntry).toHaveBeenCalledWith(
            'campaign',
            expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Nick',
                description: expect.stringContaining('Nick'),
                targetName: 'Goblin',
            }),
        );
    });

    it('should mark once-per-turn masteries as applied via runtime value', async () => {
        vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue(undefined);
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Vex',
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            '_Vex_appliedTarget',
            'Goblin',
            'campaign',
        );
    });

    it('should skip applying a mastery if already applied to the same target', async () => {
        vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue('Goblin');
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Vex',
            extraMasteries: ['Push'],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        const setCalls = vi.mocked(useRuntimeState.setRuntimeValue).mock.calls;
        const targetEffectsCalls = setCalls.filter(c => c[1] === 'targetEffects');
        expect(targetEffectsCalls).toHaveLength(0);
    });

    it('should allow a mastery on a different target even if already applied to another', async () => {
        vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue('OtherCreature');
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Vex',
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            '_Vex_appliedTarget',
            'Goblin',
            'campaign',
        );
    });

    it('should not check already-applied for Nick and Slow', async () => {
        vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((key, prop) => {
            if (prop === 'targetEffects') return [];
            if (prop === '_Slow_appliedTarget') return 'Goblin';
            return undefined;
        });
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Slow',
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.any(Array),
            'campaign',
        );
    });

    it('should handle empty masteries list', async () => {
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: null,
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('should handle unknown mastery names gracefully (skip them)', async () => {
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'UnknownMastery',
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        const calls = vi.mocked(logService.addEntry).mock.calls;
        const abilityNames = calls.map(c => c[1].abilityName);
        expect(abilityNames).not.toContain('UnknownMastery');
    });

    it('should filter out null/undefined masteries from the combined list', async () => {
        vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue(undefined);
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Vex',
            extraMasteries: [null, undefined, 'Push'],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        const calls = vi.mocked(logService.addEntry).mock.calls;
        const abilityNames = calls.map(c => c[1].abilityName);
        expect(abilityNames).toContain('Vex');
        expect(abilityNames).toContain('Push');
    });

    it('should call applyMasteryEffect for each valid mastery', async () => {
        vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue(undefined);
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Sap',
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        expect(logService.addEntry).toHaveBeenCalledWith(
            'campaign',
            expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Sap',
                targetName: 'Goblin',
            }),
        );
    });

    it('should handle Slow not checking already-applied but still applying', async () => {
        vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue(undefined);
        vi.mocked(automationService.collectWeaponMastery).mockReturnValue({
            baseMastery: 'Slow',
            extraMasteries: [],
        });

        await applyPostDamageMasteryEffects(
            'Longsword',
            makePlayerStats(),
            'campaign',
            makeCombatSummary(),
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'speed_reduction',
                    source: 'Slow',
                }),
            ]),
            'campaign',
        );
    });
});
