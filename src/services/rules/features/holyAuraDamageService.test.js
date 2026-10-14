import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkHolyAuraDamage } from './holyAuraDamageService.js';
import { rollD20 } from '../../dice/diceRoller.js';
import { addEntry } from '../../ui/logService.js';
import { getHolyAuraTargets } from '../../automation/handlers/buffs/holyAuraHandler.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockReturnValue({ catch: (fn) => fn() }),
}));

vi.mock('../../automation/handlers/buffs/holyAuraHandler.js', () => ({
    handle: vi.fn(),
    getHolyAuraTargets: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
}));

// Re-import after mocking so the module's internal imports are mocked
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../encounters/combatData.js';

describe('holyAuraDamageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    const campaignName = 'TestCampaign';

    function makeCombatSummary(attackerCreature, ...otherCreatures) {
        const baseCreature = { name: 'Paladin', type: 'player', template: [] };
        const attacker = attackerCreature
            ? { ...attackerCreature, template: attackerCreature.template ?? [] }
            : null;
        return {
            creatures: [
                baseCreature,
                ...(attacker ? [attacker] : []),
                ...otherCreatures.map(c => ({ ...c, template: c.template ?? [] })),
            ],
        };
    }

    function setupTargetEffectsMocks(holyAuraTargets, saveDc, attackerConditions) {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'targetEffects') return holyAuraTargets;
            if (key === 'holyAuraSaveDc') return saveDc;
            if (key === 'activeConditions') return attackerConditions;
            return null;
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        loadCombatSummary.mockResolvedValue(null);
    });

    describe('guard conditions', () => {
        it('does nothing when attackerName is falsy', () => {
            checkHolyAuraDamage(
                { name: 'Goblin' },
                null,
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(getRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('does nothing when attackerName matches creature.name', () => {
            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Goblin',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(getRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects');
        });

        it('does nothing when wardDamage is 0', () => {
            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                0,
            );

            expect(getRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects');
        });

        it('does nothing when wardDamage is negative', () => {
            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                -1,
            );

            expect(getRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects');
        });
    });

    describe('Holy Aura activation check', () => {
        beforeEach(() => {
            loadCombatSummary.mockResolvedValue(makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }));
        });

        it('does nothing when no holy_aura targetEffects exist', () => {
            setupTargetEffectsMocks([], 15, []);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(getHolyAuraTargets).not.toHaveBeenCalled();
        });

        it('finds caster from targetEffects on the creature', () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(getHolyAuraTargets).toHaveBeenCalledWith('Paladin', campaignName);
        });
    });

    describe('target protection check', () => {
        it('protects creature when creature.name is in the target list', () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin', 'Orc']);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(getHolyAuraTargets).toHaveBeenCalledWith('Paladin', campaignName);
        });

        it('does NOT protect creature when not in target list', () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Orc', 'Demon']);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(getHolyAuraTargets).toHaveBeenCalledWith('Paladin', campaignName);
            expect(rollD20).not.toHaveBeenCalled();
        });

        it('does NOT protect creature when target list is empty', () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue([]);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(getHolyAuraTargets).toHaveBeenCalledWith('Paladin', campaignName);
            expect(rollD20).not.toHaveBeenCalled();
        });
    });

    describe('attacker creature lookup', () => {
        it('does nothing when attacker is not found in combatSummary', () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'UnknownAttacker',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(rollD20).not.toHaveBeenCalled();
        });
    });

    describe('Fiend/Undead detection', () => {
        function setupFiendUndeadMocks() {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            rollD20.mockReturnValue(5);
        }

        it('detects fiend by type (lowercase)', () => {
            setupFiendUndeadMocks();

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(rollD20).toHaveBeenCalled();
        });

        it('detects undead by type (lowercase)', () => {
            setupFiendUndeadMocks();

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Undead' }),
                campaignName,
                5,
            );

            expect(rollD20).toHaveBeenCalled();
        });

        it('detects fiend by template', () => {
            setupFiendUndeadMocks();

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Humanoid', template: ['Fiend'] }),
                campaignName,
                5,
            );

            expect(rollD20).toHaveBeenCalled();
        });

        it('detects undead by template', () => {
            setupFiendUndeadMocks();

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Humanoid', template: ['Undead'] }),
                campaignName,
                5,
            );

            expect(rollD20).toHaveBeenCalled();
        });

        it('does NOT trigger for non-fiend/undead type', () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(5);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Humanoid' }),
                campaignName,
                5,
            );

            expect(rollD20).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does NOT trigger for non-fiend/undead template', () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(5);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Humanoid', template: ['Dragon'] }),
                campaignName,
                5,
            );

            expect(rollD20).not.toHaveBeenCalled();
        });

        it('handles missing type gracefully (treated as non-fiend/undead)', () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(5);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock' }),
                campaignName,
                5,
            );

            expect(rollD20).not.toHaveBeenCalled();
        });

        it('handles missing template gracefully', () => {
            setupFiendUndeadMocks();

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(rollD20).toHaveBeenCalled();
        });
    });

    describe('CON save resolution', () => {
        it('reads holyAuraSaveDc from runtime store', () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(10);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend', ability_score_modifiers: { CON: 3 } }),
                campaignName,
                5,
            );

            expect(getRuntimeValue).toHaveBeenCalledWith('Paladin', 'holyAuraSaveDc', campaignName);
        });

        it('does nothing when holyAuraSaveDc is falsy', () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                null,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(rollD20).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('Blinded condition application', () => {
        const fiendWarlock = { name: 'Warlock', type: 'npc', monsterType: 'Fiend', ability_score_modifiers: { CON: 3 } };
        beforeEach(() => {
            loadCombatSummary.mockResolvedValue(makeCombatSummary(fiendWarlock));
        });

        it('adds Blinded condition when save fails', async () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(5);
            // saveTotal = 5 + 3 = 8 < 15

            await checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary(fiendWarlock),
                campaignName,
                5,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Warlock',
                'activeConditions',
                ['blinded'],
                campaignName,
            );
        });

        it('logs a condition entry when Blinded is added', async () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(5);

            await checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary(fiendWarlock),
                campaignName,
                5,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'condition',
                action: 'added',
                characterName: 'Warlock',
                condition: 'Blinded',
                reason: 'Holy Aura (Fiend/Undead melee hit)',
                timestamp: expect.any(Number),
            });
        });

        it('does NOT add Blinded when save succeeds', async () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(12);
            // saveTotal = 12 + 3 = 15 >= 15

            await checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary(fiendWarlock),
                campaignName,
                5,
            );

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'save_result',
                characterName: 'Warlock',
                roll: 12,
                modifier: 3,
                total: 15,
                success: true,
                description: 'Holy Aura CON save vs DC 15',
                timestamp: expect.any(Number),
            });
        });

        it('does NOT add duplicate Blinded condition when already present', async () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                ['blinded']
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(5);

            await checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary(fiendWarlock),
                campaignName,
                5,
            );

            // setRuntimeValue is called to update activeConditions (filtered + re-added) and activeConditionMeta
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Warlock',
                'activeConditions',
                ['blinded'],
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'save_result',
                characterName: 'Warlock',
                roll: 5,
                modifier: 3,
                total: 8,
                success: false,
                description: 'Holy Aura CON save vs DC 15',
                timestamp: expect.any(Number),
            });
        });

        it('uses CON modifier from ability_score_modifiers', async () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(10);
            // saveTotal = 10 + 3 = 13 < 15

            await checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ ...fiendWarlock, ability_score_modifiers: { CON: 3 } }),
                campaignName,
                5,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Warlock',
                'activeConditions',
                ['blinded'],
                campaignName,
            );
        });

        it('uses 0 as CON bonus when ability_score_modifiers is missing', async () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(14);
            // saveTotal = 14 + 0 = 14 < 15

            await checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                5,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Warlock',
                'activeConditions',
                ['blinded'],
                campaignName,
            );
        });

        it('handles undefined ability_score_modifiers gracefully', async () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(14);

            await checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend', ability_score_modifiers: undefined }),
                campaignName,
                5,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Warlock',
                'activeConditions',
                ['blinded'],
                campaignName,
            );
        });

        it('treats existing blinded condition case-insensitively', async () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                ['Blinded']
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(5);

            await checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary(fiendWarlock),
                campaignName,
                5,
            );

            // setRuntimeValue is called to update activeConditions (filtered case-insensitively + re-added) and activeConditionMeta
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Warlock',
                'activeConditions',
                ['blinded'],
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'save_result',
                characterName: 'Warlock',
                roll: 5,
                modifier: 3,
                total: 8,
                success: false,
                description: 'Holy Aura CON save vs DC 15',
                timestamp: expect.any(Number),
            });
        });

        it('adds blinded alongside existing non-blinded conditions', async () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(5);

            await checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary(fiendWarlock),
                campaignName,
                5,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Warlock',
                'activeConditions',
                ['blinded'],
                campaignName,
            );
        });
    });

    describe('wardDamage parameter', () => {
        it('does nothing when wardDamage is 0 even with all conditions met', () => {
            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend' }),
                campaignName,
                0,
            );

            expect(getRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects');
        });

        it('triggers when wardDamage is positive', () => {
            setupTargetEffectsMocks(
                [{ effect: 'holy_aura', target: 'Goblin', source: 'Paladin' }],
                15,
                []
            );
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            rollD20.mockReturnValue(5);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'npc', monsterType: 'Fiend', ability_score_modifiers: { CON: 3 } }),
                campaignName,
                1,
            );

            expect(rollD20).toHaveBeenCalled();
        });
    });
});
