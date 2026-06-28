// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
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

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
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

vi.mock('../../services/shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { getAffectedCreatures, processAoeNpcs, sendAoePlayerSaves } from '../../services/rules/combat/aoeService.js';
import { hasPotentCantrip, hasSoulstitchProtection, applyMinDamageAdjustment, readAoeContext } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('AOE damage handling', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Ally1', computedStats: { armorClass: 14, saveBonuses: { DEX: 2 } } },
            { name: 'Ally2', computedStats: { armorClass: 12, saveBonuses: { DEX: 0 } } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
                { name: 'Ally1', type: 'player', ac: 14, currentHp: 20, maxHp: 20 },
                { name: 'Ally2', type: 'player', ac: 12, currentHp: 15, maxHp: 15 },
            ],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
        deps.pendingSaves = {};
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    it('does not process AOE when readAoeContext returns null', async () => {
        readAoeContext.mockReturnValue(null);
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-fireball',
            damageType: 'fire',
        });
        expect(getAffectedCreatures).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
    });

    it('does not process AOE when combatSummary is null', async () => {
        readAoeContext.mockReturnValue({ overlay: { label: 'Fireball' }, players: [], npcs: [] });
        loadCombatSummary.mockResolvedValue(null);
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-fireball',
            damageType: 'fire',
        });
        expect(getAffectedCreatures).not.toHaveBeenCalled();
    });

    it('processes AOE with NPC saves when saveDc and saveType are provided', async () => {
        const overlay = { id: 'fireball-1', label: 'Fireball', shape: 'circle' };
        readAoeContext.mockReturnValue({
            overlay,
            players: [{ name: 'Ally1', x: 1, y: 1 }, { name: 'Ally2', x: 2, y: 2 }],
            npcs: [{ name: 'Goblin', x: 3, y: 3 }],
        });
        getAffectedCreatures.mockReturnValue([
            { creature: { name: 'Goblin', type: 'npc', ac: 12 }, inOverlay: true },
            { creature: { name: 'Ally1', type: 'player', ac: 14 }, inOverlay: true },
            { creature: { name: 'Ally2', type: 'player', ac: 12 }, inOverlay: true },
        ]);
        processAoeNpcs.mockReturnValue([
            { creatureName: 'Goblin', finalDamage: 10, newHp: 3, damageReduced: false, saveSuccess: false, saveRoll: 8, saveBonus: 3 },
        ]);
        sendAoePlayerSaves.mockReturnValue([]);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-fireball',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(processAoeNpcs).toHaveBeenCalled();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'aoe-damage',
            affectedCount: 3,
        }));
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.any(String));
    });

    it('sends save prompts for player targets in AOE', async () => {
        const overlay = { id: 'fireball-1', label: 'Fireball', shape: 'circle' };
        readAoeContext.mockReturnValue({
            overlay,
            players: [{ name: 'Ally1', x: 1, y: 1 }],
            npcs: [],
        });
        getAffectedCreatures.mockReturnValue([
            { creature: { name: 'Ally1', type: 'player', ac: 14 }, inOverlay: true },
        ]);
        processAoeNpcs.mockReturnValue([]);
        sendAoePlayerSaves.mockReturnValue([
            { promptId: 'prompt-1', targetName: 'Ally1', rawDamage: 20, saveDc: 15, saveType: 'DEX', dcSuccess: 'half', damageType: 'fire' },
        ]);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-fireball',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(sendAoePlayerSaves).toHaveBeenCalled();
        expect(deps.pendingSaves['prompt-1']).toBeDefined();
        expect(deps.pendingSaves['prompt-1'].isAoe).toBe(true);
    });

    it('applies 0 damage to soulstitch-protected players in AOE', async () => {
        const overlay = { id: 'fireball-1', label: 'Fireball', shape: 'circle' };
        readAoeContext.mockReturnValue({
            overlay,
            players: [{ name: 'Ally1', x: 1, y: 1 }],
            npcs: [],
        });
        getAffectedCreatures.mockReturnValue([
            { creature: { name: 'Ally1', type: 'player', ac: 14 }, inOverlay: true },
        ]);
        processAoeNpcs.mockReturnValue([]);
        sendAoePlayerSaves.mockReturnValue([]);
        hasSoulstitchProtection.mockReturnValue(true);
        applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 20, damageReduced: true });

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-fireball',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(applyDamageToTarget).toHaveBeenCalledWith(
            expect.any(Object),
            'Ally1',
            0,
            ['fire'],
            'test-campaign',
            expect.any(Array),
            false,
            'TestWizard'
        );
    });

    it('calls endInvisibilityOnHostileAction when AOE deals damage', async () => {
        const overlay = { id: 'fireball-1', label: 'Fireball', shape: 'circle' };
        readAoeContext.mockReturnValue({
            overlay,
            players: [],
            npcs: [{ name: 'Goblin', x: 1, y: 1 }],
        });
        getAffectedCreatures.mockReturnValue([
            { creature: { name: 'Goblin', type: 'npc', ac: 12 }, inOverlay: true },
        ]);
        // No saveDc/saveType so the else branch runs applyDamageToTarget + endInvisibility
        sendAoePlayerSaves.mockReturnValue([]);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 3, damageReduced: false });

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-fireball',
            damageType: 'fire',
        });

        expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    });

    it('calls handleOverchannelSelfDamage after AOE processing', async () => {
        const overlay = { id: 'fireball-1', label: 'Fireball', shape: 'circle' };
        readAoeContext.mockReturnValue({
            overlay,
            players: [],
            npcs: [{ name: 'Goblin', x: 1, y: 1 }],
        });
        getAffectedCreatures.mockReturnValue([
            { creature: { name: 'Goblin', type: 'npc', ac: 12 }, inOverlay: true },
        ]);
        processAoeNpcs.mockReturnValue([]);
        sendAoePlayerSaves.mockReturnValue([]);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 3, damageReduced: false });

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-fireball',
            damageType: 'fire',
            overchannelActive: true,
            overchannelUseCount: 2,
            overchannelSpellLevel: 1,
        });

        expect(rollExpression).toHaveBeenCalledWith('3d12');
    });

    it('uses attackerName from context for target lookups', async () => {
        const overlay = { id: 'fireball-1', label: 'Fireball', shape: 'circle' };
        readAoeContext.mockReturnValue({
            overlay,
            players: [],
            npcs: [{ name: 'Goblin', x: 1, y: 1 }],
        });
        getAffectedCreatures.mockReturnValue([
            { creature: { name: 'Goblin', type: 'npc', ac: 12 }, inOverlay: true },
        ]);
        processAoeNpcs.mockReturnValue([]);
        sendAoePlayerSaves.mockReturnValue([]);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 3, damageReduced: false });

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-fireball',
            damageType: 'fire',
            attackerName: 'AllyCaster',
        });

        expect(applyDamageToTarget).toHaveBeenCalledWith(
            expect.any(Object),
            'Goblin',
            20,
            ['fire'],
            'test-campaign',
            expect.any(Array),
            false,
            'AllyCaster'
        );
    });

    it('handles overlay with id prefix correctly', async () => {
        const overlay = { id: 'my-overlay-123', label: 'Ice Storm', shape: 'square' };
        readAoeContext.mockReturnValue({
            overlay,
            players: [],
            npcs: [],
        });
        getAffectedCreatures.mockReturnValue([]);
        processAoeNpcs.mockReturnValue([]);
        sendAoePlayerSaves.mockReturnValue([]);

        const fn = createFn();
        await fn('Ice Storm', '4d8', 18, [2, 4, 6, 3, 3], 0, {
            targetName: 'overlay-my-overlay-123',
            damageType: 'cold',
        });

        expect(readAoeContext).toHaveBeenCalledWith('test-campaign', 'my-overlay-123');
    });
});
