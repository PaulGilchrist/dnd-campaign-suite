// @maintained-by-ai: 2026-10-14
// BASE lane: core attack orchestration through createLogAndShow — roll → hit/miss
// boundary → target resolution → damage/auto-damage transport → log + popup
// essentials, plus roll-type tails (initiative/save), Indomitable Might logging,
// and Compelled Duel / Taunting Step source gating (targetResolution.js).
// Feature lanes are owned by siblings: blockers/sanctuary (blocked-attacks),
// majesty trigger (target-effects-majesty*), graze, potent-cantrip, veer,
// shield/shield-of-faith/cover AC forwarding (shield-of-faith), warding-bond.
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
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(),
    hasAttackerTriggeredMajesty: vi.fn(() => false),
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
    getBaitAndSwitchAcBonus: vi.fn(() => 0),
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    getSlowAcPenalty: vi.fn(() => 0),
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(() => 0),
    getShieldOfFaithAcBonus: vi.fn(() => 0),
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

vi.mock('../../services/automation/handlers/spells/sanctuaryHandler.js', () => ({
    endSanctuary: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
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

import { rollD20 } from '../../services/dice/diceRoller.js';
import { getTargetFromAttacker, findCreatureByName } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { clearAllExpirationEffects } from '../../services/rules/effects/expirations.js';
import { addEntry } from '../../services/ui/logService.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';

const defaultCharacterName = 'TestFighter';
const defaultCampaignName = 'test-campaign';

describe('createLogAndShow (useLoggedDiceRollAttack) — base attack lane', () => {
    let deps;
    let fn;

    const popupOf = (callIndex = 0) => deps.setPopupHtml.mock.calls[callIndex][0];

    beforeEach(() => {
        vi.clearAllMocks();
        deps = {
            characterName: defaultCharacterName,
            campaignName: defaultCampaignName,
            characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
            setPopupHtml: vi.fn(),
            logEntry: vi.fn(),
        };
        fn = createLogAndShow(deps);

        // mockClear does not restore per-test mockReturnValue overrides —
        // re-arm the no-buff baseline every time.
        rollD20.mockReturnValue(15);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        findCreatureByName.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
        getRuntimeValue.mockReturnValue(null);
    });

    describe('core roll → log → popup', () => {
        it('rolls two d20s, logs the roll entry, and pops a d20 popup', async () => {
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(rollD20).toHaveBeenCalledTimes(2);
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'roll',
                rollType: 'attack',
                name: 'Longsword',
                characterName: defaultCharacterName,
                rolls: [15, 15],
            }));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'd20',
                rollType: 'attack',
                name: 'Longsword',
            }));
        });

        it('marks hit at total >= folded AC and miss below it', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 17 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(popupOf(0).hit).toBe(true);

            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 21 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(popupOf(1).hit).toBe(false);
        });

        it('leaves hit undefined when no target is resolved', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            await fn('Longsword', 5, 'attack', {});
            expect(popupOf().hit).toBeUndefined();
        });

        it('floors a low d20 to 10 when context.d20Floor10, flipping miss to hit', async () => {
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 15 });
            await fn('Longsword', 9, 'attack', { targetName: 'Goblin', d20Floor10: true });
            // raw 5 + 9 = 14 would miss AC 15; floored 10 + 9 = 19 hits
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rolls: [5, 15],
                total: 10,
                hit: true,
            }));
        });

        it('folds defensiveDuelistBonus into effectiveAC', async () => {
            rollD20.mockReturnValue(12);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            await fn('Longsword', 0, 'attack', { targetName: 'Goblin', defensiveDuelistBonus: 3 });
            const popup = popupOf();
            expect(popup.effectiveAc).toBe(15);
            expect(popup.defensiveDuelistBonus).toBe(3);
            expect(popup.hit).toBe(false);
        });

        it('honors isAutoMiss and isAutoCrit context flags', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isAutoMiss: true });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: false,
                isAutoMiss: true,
            }));

            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isAutoCrit: true });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isCrit: true,
                isAutoCrit: true,
            }));
        });
    });

    describe('critical range', () => {
        it('marks isCrit when the roll falls inside an extended critical range', async () => {
            rollD20.mockReturnValueOnce(19);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', criticalRange: '19-20' });
            const popup = popupOf();
            expect(popup.hit).toBe(true);
            expect(popup.isCrit).toBe(true);
        });

        it('keeps the crit inside the range even when the total would miss, and never crits outside it', async () => {
            rollD20.mockReturnValueOnce(19);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 30 });
            await fn('Longsword', 0, 'attack', { targetName: 'Goblin', criticalRange: '19-20' });
            const critMiss = popupOf();
            expect(critMiss.hit).toBe(false);
            expect(critMiss.isCrit).toBe(true);

            rollD20.mockReturnValueOnce(18);
            await fn('Longsword', 0, 'attack', { targetName: 'Goblin', criticalRange: '19-20' });
            const outside = popupOf(1);
            expect(outside.isCrit).toBe(false);
        });
    });

    describe('target resolution', () => {
        it('resolves player target AC from the characters array', async () => {
            const ally = { name: 'Ally', type: 'player', armorClass: 16 };
            findCreatureByName.mockReturnValue(ally);
            getTargetFromAttacker.mockReturnValue(ally);
            deps.characters = [{ name: 'Ally', computedStats: { armorClass: 16 } }];
            fn = createLogAndShow(deps);
            await fn('Longsword', 5, 'attack', { targetName: 'Ally' });
            expect(popupOf().targetAc).toBe(16);
        });

        it('throws when a player target has no armorClass', async () => {
            findCreatureByName.mockReturnValue({ name: 'Ally', type: 'player' });
            getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });
            deps.characters = [{ name: 'Ally' }];
            fn = createLogAndShow(deps);
            await expect(fn('Longsword', 5, 'attack', { targetName: 'Ally' })).rejects.toThrow('has no AC defined');
        });
    });

    describe('auto damage transport', () => {
        it('includes autoDamage in popupHtml when autoDamageFormula is provided', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            await fn('Fireball', 0, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '8d6',
                autoDamageName: 'Fireball',
                damageType: 'fire',
            });
            expect(popupOf().autoDamage).toEqual(expect.objectContaining({
                formula: '8d6',
                damageType: 'fire',
            }));
        });
    });

    describe('initiative roll type', () => {
        it('logs initiative, resets tandemFootworkBonus, and clears expiration effects', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            getRuntimeValue.mockImplementation((name, prop) => (
                name === defaultCharacterName && prop === 'tandemFootworkBonus' ? 5 : null
            ));
            await fn('Initiative', 3, 'initiative', {});
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'initiative',
                name: 'Initiative',
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith(defaultCharacterName, 'tandemFootworkBonus', 0, defaultCampaignName);
            expect(clearAllExpirationEffects).toHaveBeenCalledWith(defaultCharacterName, defaultCampaignName);
        });

        it('does not crash when context is undefined or null (MN-001 regression)', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            await expect(fn('Initiative', 3, 'initiative')).resolves.toBeUndefined();
            await expect(fn('Initiative', 3, 'initiative', null)).resolves.toBeUndefined();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'initiative',
            }));
        });
    });

    describe('save roll type', () => {
        it('logs save result with saveDc and saveType when provided', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            await fn('Constitution', 3, 'save', { saveType: 'CON', saveDc: 15, attackerName: 'Goblin' });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'save',
                saveType: 'CON',
                saveDc: 15,
            }));
        });
    });

    describe('Indomitable Might', () => {
        const mightLogs = () => addEntry.mock.calls.filter(([, e]) => e.abilityName === 'Indomitable Might');

        it('logs the STR replacement on ability checks and saving throws', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            rollD20.mockReturnValueOnce(3).mockReturnValueOnce(8);
            await fn('Athletics', 1, 'check', { strCheckReplace: true, strScore: 18 });
            rollD20.mockReturnValueOnce(2).mockReturnValueOnce(5);
            await fn('Constitution', 2, 'save', { strSaveReplace: true, strScore: 16 });

            const logs = mightLogs();
            expect(logs).toHaveLength(2);
            for (const [, entry] of logs) {
                expect(entry).toEqual(expect.objectContaining({
                    type: 'ability_use',
                    characterName: defaultCharacterName,
                    description: expect.stringContaining('Indomitable Might'),
                }));
            }
        });

        it('does not log when the total beats strScore or no replace flag is set', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            rollD20.mockReturnValueOnce(18).mockReturnValueOnce(20);
            await fn('Athletics', 5, 'check', { strCheckReplace: true, strScore: 14 });
            rollD20.mockReturnValueOnce(3).mockReturnValueOnce(8);
            await fn('Athletics', 1, 'check', {});
            expect(mightLogs()).toHaveLength(0);
        });
    });

    describe('compelled duel / taunting step target gating', () => {
        function mockTargetEffects(effects) {
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'campaign' && prop === 'targetEffects') return effects;
                return null;
            });
        }

        it('imposes disadvantage on attacks against creatures other than the source', async () => {
            for (const effect of ['compelled_duel', 'taunting_step']) {
                mockTargetEffects([{ target: defaultCharacterName, effect, source: 'Elarielle' }]);
                rollD20.mockReturnValueOnce(9).mockReturnValueOnce(3);
                await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
                expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                    mode: 'disadvantage',
                    rolls: [9, 3],
                    total: 3,
                }));
            }
        });

        it('leaves the roll normal when attacking the source or when the effect is elsewhere', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Elarielle', ac: 12 });
            mockTargetEffects([{ target: defaultCharacterName, effect: 'compelled_duel', source: 'Elarielle' }]);
            await fn('Longsword', 5, 'attack', { targetName: 'Elarielle' });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ mode: 'normal' }));

            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            mockTargetEffects([{ target: 'SomebodyElse', effect: 'compelled_duel', source: 'Elarielle' }]);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ mode: 'normal' }));
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
    });
});
