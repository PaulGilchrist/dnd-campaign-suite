// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkHolyAuraDamage } from './holyAuraDamageService.js';
import { rollD20 } from '../../dice/diceRoller.js';
import { addEntry } from '../../ui/logService.js';
import { isHolyAuraActive, getHolyAuraTargets } from '../../automation/handlers/buffs/holyAuraHandler.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockReturnValue({ catch: (fn) => fn() }),
}));

vi.mock('../../automation/handlers/buffs/holyAuraHandler.js', () => ({
    isHolyAuraActive: vi.fn(),
    getHolyAuraTargets: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

// Re-import after mocking so the module's internal imports are mocked
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

describe('holyAuraDamageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    const campaignName = 'TestCampaign';

    function makeCombatSummary(attackerCreature, ...otherCreatures) {
        const baseCreature = { name: 'Paladin', type: 'Humanoid', template: [] };
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

    describe('guard conditions', () => {
        it('does nothing when attackerName is falsy', () => {
            checkHolyAuraDamage(
                { name: 'Goblin' },
                null,
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                5,
            );

            expect(isHolyAuraActive).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('does nothing when attackerName matches creature.name', () => {
            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Goblin',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                5,
            );

            expect(isHolyAuraActive).not.toHaveBeenCalled();
        });

        it('does nothing when wardDamage is 0', () => {
            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                0,
            );

            expect(isHolyAuraActive).not.toHaveBeenCalled();
        });

        it('does nothing when wardDamage is negative', () => {
            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                -1,
            );

            expect(isHolyAuraActive).not.toHaveBeenCalled();
        });
    });

    describe('Holy Aura activation check', () => {
        it('does nothing when Holy Aura is not active for the attacker', () => {
            isHolyAuraActive.mockReturnValue(false);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                5,
            );

            expect(isHolyAuraActive).toHaveBeenCalledWith('Warlock', campaignName);
            expect(getHolyAuraTargets).not.toHaveBeenCalled();
        });
    });

    describe('target protection check', () => {
        it('protects creature when target list is empty (all protected)', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                5,
            );

            expect(getHolyAuraTargets).toHaveBeenCalledWith('Warlock', campaignName);
        });

        it('protects creature when creature.name is in the target list', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue(['Goblin', 'Orc']);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                5,
            );

            expect(getHolyAuraTargets).toHaveBeenCalledWith('Warlock', campaignName);
        });

        it('does NOT protect creature when not in target list and list is non-empty', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue(['Orc', 'Demon']);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                5,
            );

            expect(getHolyAuraTargets).toHaveBeenCalledWith('Warlock', campaignName);
            expect(rollD20).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('attacker creature lookup', () => {
        it('does nothing when attacker is not found in combatSummary', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'UnknownAttacker',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                5,
            );

            expect(rollD20).not.toHaveBeenCalled();
        });
    });

    describe('Fiend/Undead detection', () => {
        function setupFiendUndeadMocks() {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return [];
                return null;
            });
            rollD20.mockReturnValue(5);
        }

        it('detects fiend by type (lowercase)', () => {
            setupFiendUndeadMocks();

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
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
                makeCombatSummary({ name: 'Warlock', type: 'Undead' }),
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
                makeCombatSummary({ name: 'Warlock', type: 'Humanoid', template: ['Fiend'] }),
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
                makeCombatSummary({ name: 'Warlock', type: 'Humanoid', template: ['Undead'] }),
                campaignName,
                5,
            );

            expect(rollD20).toHaveBeenCalled();
        });

        it('does NOT trigger for non-fiend/undead type', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return [];
                return null;
            });
            rollD20.mockReturnValue(5);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Humanoid' }),
                campaignName,
                5,
            );

            expect(rollD20).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does NOT trigger for non-fiend/undead template', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return [];
                return null;
            });
            rollD20.mockReturnValue(5);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Humanoid', template: ['Dragon'] }),
                campaignName,
                5,
            );

            expect(rollD20).not.toHaveBeenCalled();
        });

        it('handles missing type gracefully (treated as non-fiend/undead)', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue(['Goblin']);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return [];
                return null;
            });
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
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                5,
            );

            expect(rollD20).toHaveBeenCalled();
        });
    });

    describe('CON save resolution', () => {
        it('reads holyAuraSaveDc from runtime store', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return [];
                return null;
            });
            rollD20.mockReturnValue(10);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend', ability_score_modifiers: { CON: 3 } }),
                campaignName,
                5,
            );

            expect(getRuntimeValue).toHaveBeenCalledWith('Warlock', 'holyAuraSaveDc', campaignName);
        });

        it('does nothing when holyAuraSaveDc is falsy', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockReturnValue(null);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                5,
            );

            expect(rollD20).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('Blinded condition application', () => {
        const fiendWarlock = { name: 'Warlock', type: 'Fiend', ability_score_modifiers: { CON: 3 } };

        it('adds Blinded condition when save fails', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return [];
                return null;
            });
            rollD20.mockReturnValue(5);
            // saveTotal = 5 + 3 = 8 < 15

            checkHolyAuraDamage(
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

        it('logs a condition entry when Blinded is added', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return [];
                return null;
            });
            rollD20.mockReturnValue(5);

            checkHolyAuraDamage(
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

        it('does NOT add Blinded when save succeeds', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 10;
                if (prop === 'activeConditions') return [];
                return null;
            });
            rollD20.mockReturnValue(8);
            // saveTotal = 8 + 3 = 11 >= 10

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary(fiendWarlock),
                campaignName,
                5,
            );

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('does NOT add duplicate Blinded condition when already present', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return ['Blinded'];
                return null;
            });
            rollD20.mockReturnValue(5);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary(fiendWarlock),
                campaignName,
                5,
            );

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('uses CON modifier from ability_score_modifiers', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return [];
                return null;
            });
            rollD20.mockReturnValue(10);
            // saveTotal = 10 + 3 = 13 < 15

            checkHolyAuraDamage(
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

        it('uses 0 as CON bonus when ability_score_modifiers is missing', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return [];
                return null;
            });
            rollD20.mockReturnValue(14);
            // saveTotal = 14 + 0 = 14 < 15

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
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

        it('handles undefined ability_score_modifiers gracefully', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return [];
                return null;
            });
            rollD20.mockReturnValue(14);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend', ability_score_modifiers: undefined }),
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

        it('treats existing blinded condition case-insensitively', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return ['BLINDED', 'Frightened'];
                return null;
            });
            rollD20.mockReturnValue(5);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary(fiendWarlock),
                campaignName,
                5,
            );

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('adds blinded alongside existing non-blinded conditions', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return ['Frightened'];
                return null;
            });
            rollD20.mockReturnValue(5);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary(fiendWarlock),
                campaignName,
                5,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Warlock',
                'activeConditions',
                ['Frightened', 'blinded'],
                campaignName,
            );
        });
    });

    describe('wardDamage parameter', () => {
        it('does nothing when wardDamage is 0 even with all conditions met', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend' }),
                campaignName,
                0,
            );

            expect(isHolyAuraActive).not.toHaveBeenCalled();
        });

        it('triggers when wardDamage is positive', () => {
            isHolyAuraActive.mockReturnValue(true);
            getHolyAuraTargets.mockReturnValue([]);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'holyAuraSaveDc') return 15;
                if (prop === 'activeConditions') return [];
                return null;
            });
            rollD20.mockReturnValue(5);

            checkHolyAuraDamage(
                { name: 'Goblin' },
                'Warlock',
                makeCombatSummary({ name: 'Warlock', type: 'Fiend', ability_score_modifiers: { CON: 3 } }),
                campaignName,
                1,
            );

            expect(rollD20).toHaveBeenCalled();
        });
    });
});
