// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
    DEBUG_FORCE_CRIT: false,
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    findCreatureByName: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
    clearHuntersMarkConcentration: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
    hasAttackerTriggeredMajesty: vi.fn(),
    markAttackerTriggeredMajesty: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
  getSlowAcPenalty: () => 0,
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    getWardingBondAcBonus: vi.fn(() => 0),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./attackBlockers.js', () => ({
    checkAttackBlockers: vi.fn(() => false),
}));

vi.mock('./sanctuarySave.js', () => ({
    handleSanctuarySave: vi.fn(() => true),
}));

vi.mock('./battleMaster.js', () => ({
    getKnownManeuvers: vi.fn(() => []),
    getSuperiorityDice: vi.fn(() => 0),
}));

vi.mock('../../services/automation/handlers/spells/forcecageHandler.js', () => ({
    isForcecageBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/mazeHandler.js', () => ({
    isMazeBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/banishmentHandler.js', () => ({
    isBanishmentBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/imprisonmentHandler.js', () => ({
    isImprisonmentBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/prismaticSprayHandler.js', () => ({
    isPrismaticSprayBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/sanctuaryHandler.js', () => ({
    endSanctuary: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/automation/common/damageRollback.js', () => ({
    addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/compelledDuelHandler.js', () => ({
    checkCompelledDuelAttackExpiry: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getManeuversForRules: vi.fn(),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(),
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

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker, findCreatureByName } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    isUnbreakableMajestyActive,
    getUnbreakableMajestySaveDc,
    hasAttackerTriggeredMajesty,
    markAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';
import {
    dispatchUnbreakableMajestySave,
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import { addEntry } from '../../services/ui/logService.js';

const defaultCharacterName = 'TestFighter';
const defaultCampaignName = 'test-campaign';
const defaultCharacters = [{ name: 'Goblin', computedStats: { armorClass: 12 } }];

describe('createLogAndShow (useLoggedDiceRollAttack)', () => {
    let deps;
    let fn;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = {
            characterName: defaultCharacterName,
            campaignName: defaultCampaignName,
            characters: [...defaultCharacters],
            setPopupHtml: vi.fn(),
            logEntry: vi.fn(),
        };
        fn = createLogAndShow(deps);

        rollD20.mockReturnValue(15);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        findCreatureByName.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
    });

    describe('basic attack roll', () => {
        it('rolls two d20s and logs the result', async () => {
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(rollD20).toHaveBeenCalledTimes(2);
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'roll',
                rollType: 'attack',
                name: 'Longsword',
                characterName: defaultCharacterName,
            }));
        });

        it('sets popupHtml with d20 type', async () => {
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'd20',
                rollType: 'attack',
                name: 'Longsword',
            }));
        });
    });

    describe('hit/miss determination', () => {
        it('marks hit when effectiveD20 + bonus >= effectiveAc', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 17 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: true,
            }));
        });

        it('marks miss when effectiveD20 + bonus < effectiveAc', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 22 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: false,
            }));
        });

        it('leaves hit undefined when no target is resolved', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            await fn('Longsword', 5, 'attack', {});
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: undefined,
            }));
        });
    });

    describe('d20Floor10', () => {
        it('floors r1 to 10 when context.d20Floor10 and r1 <= 9', async () => {
            rollD20.mockReturnValueOnce(5);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', d20Floor10: true });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                rolls: [5, 15],
            }));
        });
    });

    describe('cover and defensive bonuses', () => {
        it('adds coverAcBonus to effectiveAc', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 15 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', coverAcBonus: 2 });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                coverAcBonus: 2,
            }));
        });

        it('does not include gloriousDefenseBonus in effectiveAc (handled retroactively by handler)', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', gloriousDefenseBonus: 2 });
            expect(deps.setPopupHtml).not.toHaveBeenCalledWith(expect.objectContaining({
                gloriousDefenseBonus: expect.any(Number),
            }));
        });

        it('adds defensiveDuelistBonus to effectiveAc', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', defensiveDuelistBonus: 3 });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                defensiveDuelistBonus: 3,
            }));
        });
    });

    describe('shield and shield of faith AC bonuses', () => {
        it('calls shield AC bonus helper when target is present', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            getShieldAcBonus.mockReturnValue(5);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(getShieldAcBonus).toHaveBeenCalledWith('Goblin', defaultCampaignName);
        });

        it('calls shield of faith AC bonus helper when target is present', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            getShieldOfFaithAcBonus.mockReturnValue(2);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(getShieldOfFaithAcBonus).toHaveBeenCalledWith('Goblin', defaultCampaignName);
        });
    });

    describe('auto miss', () => {
        it('marks hit as false when isAutoMiss is true', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isAutoMiss: true });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: false,
                isAutoMiss: true,
            }));
        });
    });

    describe('auto crit', () => {
        it('marks isCrit when context.isAutoCrit and hit', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isAutoCrit: true });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isCrit: true,
                isAutoCrit: true,
            }));
        });
    });

    describe('natural 20', () => {
        it('sets isNatural20 when r1 === 20', async () => {
            rollD20.mockReturnValueOnce(20);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isNatural20: true,
            }));
        });
    });

    describe('critical range', () => {
        it('marks isCrit when effectiveD20 falls in criticalRange', async () => {
            rollD20.mockReturnValueOnce(19);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', criticalRange: '19-20' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isCrit: true,
            }));
        });

        it('does not mark isCrit when effectiveD20 is outside criticalRange', async () => {
            rollD20.mockReturnValueOnce(18);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', criticalRange: '19-20' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isCrit: false,
            }));
        });

        it('marks isCrit when effectiveD20 falls in criticalRange even if attack would miss', async () => {
            rollD20.mockReturnValueOnce(19);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 30 });
            await fn('Longsword', 0, 'attack', { targetName: 'Goblin', criticalRange: '19-20' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isCrit: true,
            }));
        });
    });

    describe('target resolution', () => {
        it('resolves player target AC from characters array', async () => {
            const allyCreature = { name: 'Ally', type: 'player', armorClass: 16 };
            findCreatureByName.mockReturnValue(allyCreature);
            getTargetFromAttacker.mockReturnValue(allyCreature);
            deps.characters = [{ name: 'Ally', computedStats: { armorClass: 16 } }];
            fn = createLogAndShow(deps);
            await fn('Longsword', 5, 'attack', { targetName: 'Ally' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                targetAc: 16,
            }));
        });

        it('throws when player target has no armorClass', async () => {
            const allyCreature = { name: 'Ally', type: 'player' };
            findCreatureByName.mockReturnValue(allyCreature);
            getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });
            deps.characters = [{ name: 'Ally' }];
            await expect(fn('Longsword', 5, 'attack', { targetName: 'Ally' })).rejects.toThrow('has no AC defined');
        });

        it('uses target.ac for non-player targets', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                targetAc: 12,
            }));
        });
    });

    describe('auto damage', () => {
        it('includes autoDamage in popupHtml when autoDamageFormula is provided', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            await fn('Fireball', 0, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '8d6',
                autoDamageName: 'Fireball',
                damageType: 'fire',
            });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                autoDamage: expect.objectContaining({
                    formula: '8d6',
                    damageType: 'fire',
                }),
            }));
        });
    });

    describe('initiative roll type', () => {
        it('logs and displays initiative roll', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            await fn('Initiative', 3, 'initiative', {});
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'initiative',
                name: 'Initiative',
            }));
        });

        it('resets tandemFootworkBonus to 0 if > 0', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === defaultCharacterName && prop === 'tandemFootworkBonus') return 5;
                return null;
            });
            await fn('Initiative', 3, 'initiative', {});
            expect(setRuntimeValue).toHaveBeenCalledWith(defaultCharacterName, 'tandemFootworkBonus', 0, defaultCampaignName);
        });

        it('clears expiration effects on initiative roll', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            const { clearAllExpirationEffects } = await import('../../services/rules/effects/expirations.js');
            clearAllExpirationEffects.mockReturnValue(undefined);
            await fn('Initiative', 3, 'initiative', {});
            expect(clearAllExpirationEffects).toHaveBeenCalledWith(defaultCharacterName, defaultCampaignName);
        });

        it('does not crash when context is undefined (MN-001 regression)', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            await expect(fn('Initiative', 3, 'initiative')).resolves.toBeUndefined();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'initiative',
            }));
        });

        it('does not crash when context is null (MN-001 regression)', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            await expect(fn('Initiative', 3, 'initiative', null)).resolves.toBeUndefined();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'initiative',
            }));
        });
    });

    describe('save roll type', () => {
        it('logs save result with saveDc and saveType when provided', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            await fn('Constitution', 3, 'save', { saveType: 'CON', saveDc: 15 });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'save',
                saveType: 'CON',
                saveDc: 15,
            }));
        });
    });

    describe('unbreakable majesty on hit', () => {
        it('checks majesty, marks attacker, and dispatches save when hit and target has majesty active', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Mage', ac: 10 });
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getUnbreakableMajestySaveDc.mockReturnValue(15);
            const origSetTimeout = globalThis.setTimeout;
            globalThis.setTimeout = (cb) => { cb(); return 0; };
            await fn('Longsword', 5, 'attack', { targetName: 'Mage' });
            globalThis.setTimeout = origSetTimeout;
            expect(isUnbreakableMajestyActive).toHaveBeenCalledWith('Mage', defaultCampaignName);
            expect(markAttackerTriggeredMajesty).toHaveBeenCalledWith('Mage', defaultCharacterName, defaultCampaignName);
            expect(dispatchUnbreakableMajestySave).toHaveBeenCalled();
        });
    });

    describe('indomitable might', () => {
        it('logs Indomitable Might when strCheckReplace applies on ability check', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            rollD20.mockReturnValueOnce(3).mockReturnValueOnce(8);
            await fn('Athletics', 1, 'check', { strCheckReplace: true, strScore: 18 });
            expect(addEntry).toHaveBeenCalledWith(defaultCampaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: defaultCharacterName,
                abilityName: 'Indomitable Might',
                description: expect.stringContaining('Indomitable Might'),
            }));
        });

        it('logs Indomitable Might when strSaveReplace applies on saving throw', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            rollD20.mockReturnValueOnce(2).mockReturnValueOnce(5);
            await fn('Constitution', 2, 'save', { strSaveReplace: true, strScore: 16 });
            expect(addEntry).toHaveBeenCalledWith(defaultCampaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: defaultCharacterName,
                abilityName: 'Indomitable Might',
                description: expect.stringContaining('Indomitable Might'),
            }));
        });

        it('does not log Indomitable Might when total is higher than strScore', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            rollD20.mockReturnValueOnce(18).mockReturnValueOnce(20);
            await fn('Athletics', 5, 'check', { strCheckReplace: true, strScore: 14 });
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('does not log Indomitable Might when strCheckReplace is not set', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            rollD20.mockReturnValueOnce(3).mockReturnValueOnce(8);
            await fn('Athletics', 1, 'check', {});
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('compelled duel / taunting step target gating', () => {
        function mockTargetEffects(effects) {
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'campaign' && prop === 'targetEffects') return effects;
                return null;
            });
        }

        it('imposes disadvantage when attacking a creature other than the source', async () => {
            mockTargetEffects([{ target: defaultCharacterName, effect: 'compelled_duel', source: 'Elarielle' }]);
            rollD20.mockReturnValueOnce(9).mockReturnValueOnce(3);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                mode: 'disadvantage',
                rolls: [9, 3],
                total: 3,
            }));
        });

        it('does not impose disadvantage when attacking the source', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Elarielle', ac: 12 });
            mockTargetEffects([{ target: defaultCharacterName, effect: 'compelled_duel', source: 'Elarielle' }]);
            await fn('Longsword', 5, 'attack', { targetName: 'Elarielle' });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                mode: 'normal',
            }));
        });

        it('cancels an existing advantage when attacking a creature other than the source', async () => {
            mockTargetEffects([{ target: defaultCharacterName, effect: 'compelled_duel', source: 'Elarielle' }]);
            rollD20.mockReturnValueOnce(9).mockReturnValueOnce(3);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', forcedMode: 'advantage' });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                mode: 'normal',
                total: 9,
            }));
        });

        it('imposes disadvantage from taunting step on attacks against other creatures', async () => {
            mockTargetEffects([{ target: defaultCharacterName, effect: 'taunting_step', source: 'Elarielle' }]);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                mode: 'disadvantage',
            }));
        });

        it('does not gate when the effect is on a different creature', async () => {
            mockTargetEffects([{ target: 'SomebodyElse', effect: 'compelled_duel', source: 'Elarielle' }]);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                mode: 'normal',
            }));
        });
    });
});
