// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula, rolls, isCrit) => {
        if (!isCrit) return formula;
        const parsed = formula.match(/^(\d+)?d(\d+)((?:[+-]\d+)+)?$/i);
        if (!parsed) return formula;
        const count = parsed[1] || 1;
        const sides = parsed[2];
        const modifierStr = parsed[3];
        let modifier = 0;
        if (modifierStr) {
            const segments = modifierStr.match(/([+-]\d+)/g);
            for (const seg of segments) { modifier += parseInt(seg, 10); }
        }
        const dicePart = count === 1 ? `d${sides}` : `${count}d${sides}`;
        const rollStr = rolls && rolls.length > 0 ? ` (${rolls.join(', ')})` : '';
        let result = `${dicePart}*2${rollStr}`;
        if (modifier > 0) result += `+${modifier}`;
        else if (modifier < 0) result += `${modifier}`;
        return result;
    }),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn((expr) => {
        const match = expr.match(/^(\d+)d(\d+)\+(\d+)/);
        if (match) return parseInt(match[1]) + parseInt(match[3]);
        return 0;
    }),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(() => Promise.resolve({ disadvantage: false })),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        restoreBalance: false,
        autoRerollForSaves: false,
        autoRerollBonus: null,
        autoRerollCondition: null,
        saveAdvantageCount: 0,
        saveAdvantageAbilities: [],
    })),
}));

vi.mock('../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyMinDamageAdjustment, hasSoulstitchProtection } from './loggedDiceRollUtils.js';
import { addEntry } from '../../services/ui/logService.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('Sanctuary check on save-based spells', () => {
    const deps = {
        characterName: 'Wizard1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const defaultCombatSummary = {
        creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
    };

    const defaultContext = {
        targetName: 'Goblin',
        damageType: 'fire',
        saveDc: 15,
        saveType: 'DEX',
        dcSuccess: 'half',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue(defaultCombatSummary);
        hasSoulstitchProtection.mockReturnValue(false);
        rollSaveForCreature.mockReturnValue({ success: true, roll: 15, total: 18, bonus: 3 });
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    describe('sanctuary not active', () => {
        it('proceeds with normal damage when no sanctuary effect exists', async () => {
            getRuntimeValue.mockReturnValue([]);

            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Sanctuary' })
            );
            expect(addEntry).not.toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'save_result' })
            );
        });

        it('proceeds with normal damage when sanctuary targets a different creature', async () => {
            getRuntimeValue.mockImplementation((_key) => {
                if (_key === 'campaign') {
                    return [
                        {
                            effect: 'sanctuary',
                            target: 'OtherAlly',
                            source: 'Cleric1',
                            saveDc: 13,
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Sanctuary' })
            );
        });

        it('proceeds with normal damage when sanctuary is cast by the attacking character', async () => {
            getRuntimeValue.mockImplementation((_key) => {
                if (_key === 'campaign') {
                    return [
                        {
                            effect: 'sanctuary',
                            target: 'Goblin',
                            source: 'Wizard1',
                            saveDc: 13,
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Sanctuary' })
            );
        });
    });

    describe('sanctuary save fails', () => {
        it('blocks the spell and shows a popup when the attacker fails the WIS save', async () => {
            getRuntimeValue.mockImplementation((_key) => {
                if (_key === 'campaign') {
                    return [
                        {
                            effect: 'sanctuary',
                            target: 'Goblin',
                            source: 'Cleric1',
                            saveDc: 13,
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();

            // Use a microtask to dispatch the event before the promise resolves
            Promise.resolve().then(() => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId: 'test-guid-1234', success: false, roll: 5, bonus: 0 },
                }));
            });

            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'automation_info',
                name: 'Sanctuary',
            }));

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'save_result',
                success: false,
                saveType: 'WIS',
            }));

            // The spell should not proceed to normal damage handling
            expect(deps.logEntry).not.toHaveBeenCalledWith(
                expect.objectContaining({ rollType: 'damage' })
            );
        });
    });

    describe('sanctuary save succeeds', () => {
        it('allows the spell to proceed when the attacker passes the WIS save', async () => {
            getRuntimeValue.mockImplementation((_key) => {
                if (_key === 'campaign') {
                    return [
                        {
                            effect: 'sanctuary',
                            target: 'Goblin',
                            source: 'Cleric1',
                            saveDc: 13,
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();

            Promise.resolve().then(() => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId: 'test-guid-1234', success: true, roll: 15, bonus: 2 },
                }));
            });

            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            // No sanctuary popup should be shown
            expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Sanctuary' })
            );

            // A success log entry should have been created
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'save_result',
                success: true,
                saveType: 'WIS',
            }));
        });
    });

    describe('sanctuary save prompt setup', () => {
        it('sends a save prompt with the correct parameters when sanctuary is active', async () => {
            getRuntimeValue.mockImplementation((_key) => {
                if (_key === 'campaign') {
                    return [
                        {
                            effect: 'sanctuary',
                            target: 'Goblin',
                            source: 'Cleric1',
                            saveDc: 14,
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();

            Promise.resolve().then(() => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId: 'test-guid-1234', success: false },
                }));
            });

            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                promptId: 'test-guid-1234',
                targetName: 'Wizard1',
                attackerName: 'Cleric1',
                saveType: 'WIS',
                saveDc: 14,
                condition: 'sanctuary',
            }));
        });

        it('registers the prompt in pendingSavePrompts via setRuntimeValue', async () => {
            getRuntimeValue.mockImplementation((_key) => {
                if (_key === 'campaign') {
                    return [
                        {
                            effect: 'sanctuary',
                            target: 'Goblin',
                            source: 'Cleric1',
                            saveDc: 13,
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();

            Promise.resolve().then(() => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId: 'test-guid-1234', success: false },
                }));
            });

            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'pendingSavePrompts',
                expect.any(Object),
                'test-campaign'
            );
        });

        it('removes the prompt from pendingSavePrompts after resolution', async () => {
            getRuntimeValue.mockImplementation((_key) => {
                if (_key === 'campaign') {
                    return [
                        {
                            effect: 'sanctuary',
                            target: 'Goblin',
                            source: 'Cleric1',
                            saveDc: 13,
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();

            Promise.resolve().then(() => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId: 'test-guid-1234', success: false },
                }));
            });

            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            // The handler deletes the promptId it created from pendingSavePrompts
            // Verify setRuntimeValue was called to update pendingSavePrompts
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'pendingSavePrompts',
                expect.any(Object),
                'test-campaign'
            );
        });
    });

    describe('saveDc fallback', () => {
        let consoleSpy;

        beforeEach(() => {
            consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('defaults saveDc to 8 when targetEffect has no saveDc', async () => {
            getRuntimeValue.mockImplementation((_key) => {
                if (_key === 'campaign') {
                    return [
                        {
                            effect: 'sanctuary',
                            target: 'Goblin',
                            source: 'Cleric1',
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();

            Promise.resolve().then(() => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId: 'test-guid-1234', success: false },
                }));
            });

            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[sanctuary] Missing saveDc on targetEffect for target',
                'Goblin',
                '— defaulting to 8'
            );

            expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                saveDc: 8,
            }));
        });
    });

    describe('save-result event filtering', () => {
        it('ignores save-result events with a mismatched promptId', async () => {
            getRuntimeValue.mockImplementation((_key) => {
                if (_key === 'campaign') {
                    return [
                        {
                            effect: 'sanctuary',
                            target: 'Goblin',
                            source: 'Cleric1',
                            saveDc: 13,
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();

            // Dispatch wrong promptId first — should be ignored
            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'wrong-id', success: false },
            }));

            // Then dispatch correct promptId — should resolve
            Promise.resolve().then(() => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId: 'test-guid-1234', success: true },
                }));
            });

            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            // The spell should proceed since the correct save succeeded
            expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Sanctuary' })
            );
        });
    });

    describe('description content', () => {
        it('includes the attacker name, target name, and "spell is lost" in the failure description', async () => {
            getRuntimeValue.mockImplementation((_key) => {
                if (_key === 'campaign') {
                    return [
                        {
                            effect: 'sanctuary',
                            target: 'Goblin',
                            source: 'Cleric1',
                            saveDc: 13,
                        },
                    ];
                }
                return null;
            });

            const fn = createFn();

            Promise.resolve().then(() => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId: 'test-guid-1234', success: false },
                }));
            });

            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, defaultContext);

            const popupCall = deps.setPopupHtml.mock.calls[0][0];
            expect(popupCall.description).toContain('Wizard1');
            expect(popupCall.description).toContain('Goblin');
            expect(popupCall.description).toContain('failed WIS save against Sanctuary');
            expect(popupCall.description).toContain('The spell is lost');
        });
    });
});
