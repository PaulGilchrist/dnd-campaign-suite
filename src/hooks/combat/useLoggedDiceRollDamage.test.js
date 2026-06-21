// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('./useMetamagic.js', () => ({
    saveLastDamageEvent: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
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

vi.mock('./useLoggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary, getCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { getAffectedCreatures } from '../../services/rules/combat/aoeService.js';
import {
    readAoeContext,
    isMagicMissileImmune,
    hasSoulstitchProtection,
    applyMinDamageAdjustment,
} from './useLoggedDiceRollUtils.js';
import { computeDamageAfterSave, rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('createLogDamageAndShow (useLoggedDiceRollDamage)', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
        pendingSecondaryDamageRef: { current: null },
    };

    beforeEach(() => {
        rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        isMagicMissileImmune.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        computeDamageAfterSave.mockReturnValue(8);
        rollSaveForCreature.mockReturnValue({ success: true, roll: 15, total: 18, bonus: 3 });
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }] });
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    describe('early exits and auto-miss', () => {
        it('returns early with immunity popup when target is magic missile immune', async () => {
            isMagicMissileImmune.mockReturnValue(true);
            const fn = createFn();
            await fn('Magic Missile', '4d4+2', 10, [3, 2, 3, 2], 2, { targetName: 'Goblin', damageType: 'force' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                finalDamage: 0,
                damageReduced: true,
                note: 'Shield: Immune to Magic Missile',
            }));
        });

        it('returns early when no AOE context', async () => {
            readAoeContext.mockReturnValue(null);
            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'overlay-fireball',
                damageType: 'fire',
            });
            expect(getAffectedCreatures).not.toHaveBeenCalled();
        });

        it('logs and displays auto miss', async () => {
            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, { targetName: 'Goblin', damageType: 'fire', isAutoMiss: true });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'auto-miss-damage',
            }));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'auto-miss',
            }));
        });
    });

    describe('AOE damage', () => {
        it('does not process AOE when no context', async () => {
            readAoeContext.mockReturnValue(null);
            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'overlay-fireball',
                damageType: 'fire',
            });
            expect(getAffectedCreatures).not.toHaveBeenCalled();
        });
    });

    describe('NPC save damage', () => {
        it('rolls save automatically for NPCs', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }] });
            rollSaveForCreature.mockReturnValue({ success: false, roll: 8, total: 11, bonus: 3, rawRolls: [8] });
            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
            });
            expect(rollSaveForCreature).toHaveBeenCalled();
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'save-damage',
            }));
        });
    });

    describe('player save damage', () => {
        it('handles careful spell metamagic', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Ally', type: 'player', ac: 16, currentHp: 20, maxHp: 20 }] });
            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Ally',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                metamagicCareful: true,
            });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                note: 'careful_spell_damage_roll_before_apply',
            }));
        });

        it('handles Contact Other Plane auto save', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'TestWizard', type: 'player', ac: 16, currentHp: 20, maxHp: 20 }] });
            const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'contact_patron_auto_save' }] } };
            const fn = createFn();
            await fn('Contact Other Plane', '4d6', 14, [3, 4, 3, 4], 0, {
                targetName: 'TestWizard',
                damageType: 'psychic',
                saveDc: 15,
                saveType: 'INT',
                dcSuccess: 'half',
                playerStats,
            });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                note: 'contact_patron_damage_roll_before_apply',
            }));
        });
    });

    describe('plain damage', () => {
        it('applies damage without save', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }] });
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });
            expect(applyDamageToTarget).toHaveBeenCalled();
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'damage',
            }));
        });

        it('handles ram active condition', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13, size: 'Small' }] });
            getRuntimeValue.mockReturnValueOnce({ hit: false }).mockReturnValueOnce([]);
            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
            const fn = createFn();
            await fn('Ram', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'bludgeoning',
                ramActive: true,
                isMelee: true,
            });
            expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Object));
            dispatchEventSpy.mockRestore();
        });
    });

    describe('multi-target damage', () => {
        it('applies damage to twin target', async () => {
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
                ],
            });
            const fn = createFn();
            await fn('Magic Missile', '4d4+2', 10, [3, 2, 3, 2], 2, {
                targetName: 'Goblin',
                damageType: 'force',
                metamagicTwinTarget: 'Orc',
            });
            expect(applyDamageToTarget.mock.calls.length).toBeGreaterThanOrEqual(2);
        });

        it('applies damage to multi target', async () => {
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
                ],
            });
            const fn = createFn();
            await fn('Words of Creation', '4d6', 14, [3, 4, 3, 4], 0, {
                targetName: 'Goblin',
                damageType: 'force',
                multiTarget: 'Orc',
            });
            expect(applyDamageToTarget.mock.calls.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('secondary damage', () => {
        it('stores secondary damage in pendingSecondaryDamageRef', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }] });
            const fn = createFn();
            await fn('Eldritch Blast (Agonizing)', '2d10+4', 14, [5, 9], 4, {
                targetName: 'Goblin',
                damageType: 'force',
                autoDamageSecondaryFormula: '1d10',
            });
            expect(deps.pendingSecondaryDamageRef.current).toEqual(expect.objectContaining({
                formula: '1d10',
            }));
        });
    });

    describe('applyMinDamageAdjustment', () => {
        it('adjusts total when ones are present and playerStats has min damage', async () => {
            applyMinDamageAdjustment.mockReturnValue(10);
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }] });
            const fn = createFn();
            await fn('Fireball', '8d6', 8, [1, 1, 3, 3, 3, 3, 3, 3], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                playerStats: { automation: { passives: [] } },
            });
            expect(applyMinDamageAdjustment).toHaveBeenCalledWith(8, [1, 1, 3, 3, 3, 3, 3, 3], expect.any(Object), 'fire');
        });
    });

    describe('route logic', () => {
        it('routes to plain damage when no saveDc/saveType', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }] });
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });
            expect(applyDamageToTarget).toHaveBeenCalled();
        });

        it('routes to NPC save damage when target is npc with saveDc', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }] });
            rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3, rawRolls: [5] });
            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
            });
            expect(rollSaveForCreature).toHaveBeenCalled();
        });
    });
});
