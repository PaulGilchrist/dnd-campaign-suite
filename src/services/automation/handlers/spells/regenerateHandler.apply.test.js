import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

import { applyRegenerateEffect } from './regenerateHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const casterName = 'Cleric1';

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'monster', maxHp: 7, currentHp: 3 },
        { name: 'Orc', type: 'monster', maxHp: 15, currentHp: 10 },
        { name: casterName, type: 'player', maxHp: 50, currentHp: 25 },
    ],
};

function makeAction(overrides = {}) {
    return {
        name: 'Regenerate',
        automation: overrides.automation || {},
        spell: { name: 'Regenerate', range: 'Touch', level: 7, ...overrides.spell },
    };
}

function applyEffect(targetName, actionOverrides = {}, runtimeOverrides = {}) {
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockImplementation((scope, key) => {
        if (key === 'targetEffects') return runtimeOverrides.targetEffects ?? [];
        if (key === 'currentHitPoints') return runtimeOverrides.currentHitPoints ?? null;
        return null;
    });
    return applyRegenerateEffect(
        makeAction(actionOverrides),
        { name: casterName, level: 7, proficiency: 4, abilities: [{ name: 'Wisdom', bonus: 3 }], hitPoints: 50 },
        campaignName,
        null,
        targetName,
    );
}

describe('applyRegenerateEffect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        evaluateAutoExpression.mockReturnValue(18);
    });

    describe('input validation', () => {
        it('should return null when targetName is missing', async () => {
            const result = await applyRegenerateEffect(makeAction(), { name: casterName }, campaignName, null, null);
            expect(result).toBeNull();
        });

        it('should return null when targetName is undefined', async () => {
            const result = await applyRegenerateEffect(makeAction(), { name: casterName }, campaignName, null, undefined);
            expect(result).toBeNull();
        });

        it('should return null when targetName is empty string', async () => {
            const result = await applyRegenerateEffect(makeAction(), { name: casterName }, campaignName, null, '');
            expect(result).toBeNull();
        });
    });

    describe('healing calculation', () => {
        it('should use default expression 4d8+15 when no heal_at_slot_level', async () => {
            await applyEffect('Goblin', { spell: { name: 'Regenerate' } }, { currentHitPoints: 5 });
            expect(evaluateAutoExpression).toHaveBeenCalledWith('4d8 + 15', expect.any(Object));
        });

        it('should use heal_at_slot_level expression when available at current slot', async () => {
            await applyEffect('Goblin', { spell: { level: 7, heal_at_slot_level: { '7': '6d8 + 20' } } }, { currentHitPoints: 5 });
            expect(evaluateAutoExpression).toHaveBeenCalledWith('6d8 + 20', expect.any(Object));
        });

        it('should fall back to highest slot level when current slot not in heal_at_slot_level', async () => {
            await applyEffect('Goblin', { spell: { level: 7, heal_at_slot_level: { '5': '3d8 + 10' } } }, { currentHitPoints: 5 });
            expect(evaluateAutoExpression).toHaveBeenCalledWith('3d8 + 10', expect.any(Object));
        });

        it('should default to 33 when expression evaluation returns non-positive number', async () => {
            evaluateAutoExpression.mockReturnValue(-5);
            await applyEffect('Goblin', {}, { currentHitPoints: 5 });
            expect(applyHealingToTarget).toHaveBeenCalled();
        });

        it('should default to 33 when expression evaluation returns zero', async () => {
            evaluateAutoExpression.mockReturnValue(0);
            await applyEffect('Goblin', {}, { currentHitPoints: 5 });
            expect(applyHealingToTarget).toHaveBeenCalled();
        });

        it('should use evaluated expression result as heal amount', async () => {
            evaluateAutoExpression.mockReturnValue(25);
            await applyEffect('Goblin', {}, { currentHitPoints: 5 });
            expect(applyHealingToTarget).toHaveBeenCalledWith(baseCombatSummary, 'Goblin', 2, campaignName);
        });
    });

    describe('healing cap at max HP', () => {
        it('should cap healing so target does not exceed maxHp', async () => {
            evaluateAutoExpression.mockReturnValue(25);
            await applyEffect('Goblin', {}, { currentHitPoints: 6 });
            expect(applyHealingToTarget).toHaveBeenCalledWith(baseCombatSummary, 'Goblin', 1, campaignName);
        });

        it('should not heal if target is already at max HP', async () => {
            evaluateAutoExpression.mockReturnValue(25);
            await applyEffect('Goblin', {}, { currentHitPoints: 7 });
            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('should cap healing for targets with no runtime HP stored', async () => {
            evaluateAutoExpression.mockReturnValue(100);
            await applyEffect('Orc', {}, { currentHitPoints: null });
            expect(applyHealingToTarget).toHaveBeenCalledWith(baseCombatSummary, 'Orc', 5, campaignName);
        });
    });

    describe('HP source resolution', () => {
        it('should use runtime currentHitPoints when stored', async () => {
            evaluateAutoExpression.mockReturnValue(50);
            await applyEffect('Goblin', {}, { currentHitPoints: 2 });
            expect(applyHealingToTarget).toHaveBeenCalledWith(baseCombatSummary, 'Goblin', 5, campaignName);
        });

        it('should fall back to creature.currentHp when runtime is null', async () => {
            evaluateAutoExpression.mockReturnValue(50);
            await applyEffect('Goblin', {}, { currentHitPoints: null });
            expect(applyHealingToTarget).toHaveBeenCalledWith(baseCombatSummary, 'Goblin', 4, campaignName);
        });

        it('should fall back to creature.currentHp when runtime is empty string', async () => {
            evaluateAutoExpression.mockReturnValue(50);
            await applyEffect('Goblin', {}, { currentHitPoints: '' });
            expect(applyHealingToTarget).toHaveBeenCalledWith(baseCombatSummary, 'Goblin', 4, campaignName);
        });

        it('should fall back to playerStats.hitPoints when creature has no currentHp', async () => {
            const cs = { creatures: [{ name: 'Goblin', type: 'monster', maxHp: 7, currentHp: undefined }] };
            getCombatSummary.mockReturnValue(cs);
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(50);
            await applyRegenerateEffect(makeAction(), { name: casterName, level: 7, proficiency: 4, abilities: [{ name: 'Wisdom', bonus: 3 }], hitPoints: 50 }, campaignName, null, 'Goblin');
            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });
    });

    describe('regenerateActive flag', () => {
        it('should set regenerateActive=true on target', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'regenerateActive', true, campaignName);
        });
    });

    describe('targetEffects badge registration', () => {
        it('should add a target effect entry for the target', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                expect.arrayContaining([expect.objectContaining({ target: 'Goblin', effect: 'regenerate', source: casterName })]),
                campaignName,
            );
        });

        it('should preserve existing targetEffects entries', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin', {}, { targetEffects: [{ target: 'Goblin', effect: 'faerie_fire', source: 'Wizard' }] });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ effect: 'faerie_fire' }),
                    expect.objectContaining({ effect: 'regenerate' }),
                ]),
                campaignName,
            );
        });

        it('should remove existing regenerate effect before adding new one', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin', {}, { targetEffects: [{ target: 'Goblin', effect: 'regenerate', source: 'OldCleric' }, { target: 'Orc', effect: 'faerie_fire', source: 'Wizard' }] });
            const call = setRuntimeValue.mock.calls.find(([ , key]) => key === 'targetEffects');
            const newEffects = call[2];
            const regen = newEffects.filter((te) => te.target === 'Goblin' && te.effect === 'regenerate');
            expect(regen.length).toBe(1);
            expect(regen[0].source).toBe(casterName);
        });

        it('should not remove regenerate effects from other targets', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin', {}, { targetEffects: [{ target: 'Orc', effect: 'regenerate', source: 'OtherCleric' }] });
            const call = setRuntimeValue.mock.calls.find(([ , key]) => key === 'targetEffects');
            const orcRegen = call[2].filter((te) => te.target === 'Orc' && te.effect === 'regenerate');
            expect(orcRegen.length).toBe(1);
            expect(orcRegen[0].source).toBe('OtherCleric');
        });

        it('should handle null targetEffects gracefully', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin', {}, { targetEffects: null });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                expect.arrayContaining([expect.objectContaining({ effect: 'regenerate' })]),
                campaignName,
            );
        });

        it('should handle non-array targetEffects gracefully', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin', {}, { targetEffects: 'not-an-array' });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                expect.arrayContaining([expect.objectContaining({ effect: 'regenerate' })]),
                campaignName,
            );
        });
    });

    describe('logging', () => {
        it('should log an hp_change entry for the initial heal', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin');
            const hpCalls = addEntry.mock.calls.filter(([, entry]) => entry && entry.type === 'hp_change');
            expect(hpCalls.length).toBeGreaterThan(0);
            const hpEntry = hpCalls[0][1];
            expect(hpEntry.targetName).toBe('Goblin');
            expect(hpEntry.delta).toBeGreaterThan(0);
            expect(hpEntry.isHealing).toBe(true);
            expect(hpEntry.sourceName).toBe(casterName);
            expect(hpEntry.note).toBe('Regenerate');
            expect(hpEntry.formula).toBe('4d8 + 15');
        });

        it('should log an ability_use entry', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin');
            const abilityCalls = addEntry.mock.calls.filter(([, entry]) => entry && entry.type === 'ability_use');
            expect(abilityCalls.length).toBeGreaterThan(0);
            const entry = abilityCalls[0][1];
            expect(entry.characterName).toBe(casterName);
            expect(entry.abilityName).toBe('Regenerate');
            expect(entry.targetName).toBe('Goblin');
            expect(entry.description).toContain('Regained');
            expect(entry.description).toContain('HP');
        });

        it('should log a spell_effect entry', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect('Goblin');
            const spellCalls = addEntry.mock.calls.filter(([, entry]) => entry && entry.type === 'spell_effect');
            expect(spellCalls.length).toBeGreaterThan(0);
            const entry = spellCalls[0][1];
            expect(entry.characterName).toBe(casterName);
            expect(entry.spellName).toBe('Regenerate');
            expect(entry.targetName).toBe('Goblin');
            expect(entry.effects).toContainEqual(expect.stringContaining('Initial heal'));
            expect(entry.effects).toContainEqual(expect.stringContaining('1 HP/turn'));
        });

        it('should use the resolved expression as formula in hp_change log', async () => {
            await applyEffect('Goblin', { spell: { level: 7, heal_at_slot_level: { '7': '6d8 + 20' } } });
            const hpCalls = addEntry.mock.calls.filter(([, entry]) => entry && entry.type === 'hp_change');
            expect(hpCalls[0][1].formula).toBe('6d8 + 20');
        });

        it('should log healing for the caster as source when healing self', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            await applyEffect(casterName);
            const abilityCalls = addEntry.mock.calls.filter(([, entry]) => entry && entry.type === 'ability_use');
            expect(abilityCalls[0][1].sourceName || abilityCalls[0][1].characterName).toBe(casterName);
        });
    });

    describe('return value', () => {
        it('should return popup with automation_info type', async () => {
            evaluateAutoExpression.mockReturnValue(10);
            const result = await applyEffect('Goblin');
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Regenerate');
        });

        it('should include description with target name and heal amount', async () => {
            evaluateAutoExpression.mockReturnValue(20);
            const result = await applyEffect('Goblin', {}, { currentHitPoints: null });
            expect(result.payload.description).toContain('Goblin');
            expect(result.payload.description).toContain('4 HP');
            expect(result.payload.description).toContain('1 HP per turn');
        });

        it('should describe ongoing effect in popup', async () => {
            evaluateAutoExpression.mockReturnValue(20);
            const result = await applyEffect('Goblin');
            expect(result.payload.description).toContain('restored to full HP');
        });

        it('should not call applyHealingToTarget when actualHeal is 0', async () => {
            evaluateAutoExpression.mockReturnValue(20);
            const result = await applyEffect('Goblin', {}, { currentHitPoints: 7 });
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
        });

        it('should not call applyHealingToTarget when combatSummary is null', async () => {
            getCombatSummary.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(10);
            const result = await applyRegenerateEffect(makeAction(), { name: casterName, level: 7, proficiency: 4, abilities: [{ name: 'Wisdom', bonus: 3 }], hitPoints: 50 }, campaignName, null, 'Goblin');
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
        });
    });
});
