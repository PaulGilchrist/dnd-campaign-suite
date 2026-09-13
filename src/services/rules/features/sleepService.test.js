// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

vi.mock('../effects/tranceRules.js', () => ({
    hasTranceTrait: vi.fn(() => false),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

import storage from '../../ui/storage.js';
import {
    triggerSleep,
    isSleepImmune,
    stageSleepTargets,
    applySleepTurnEnd,
    wakeSleepTarget,
    wakeSleepOnDamage,
    SLEEP_TE_EFFECT,
} from './sleepService.js';
import { executeHandler } from '../../automation/index.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { addConcentration } from '../../combat/concentration/concentrationService.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { hasTranceTrait } from '../effects/tranceRules.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const playerStats = {
    name: 'Wizard',
    spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
    proficiency: 4,
};

function makeSleepTe(overrides = {}) {
    return {
        target: 'Thug 1',
        effect: SLEEP_TE_EFFECT,
        source: 'Wizard',
        condition: 'incapacitated',
        stage: 'incapacitated',
        dc: 17,
        saveType: 'WIS',
        duration: 'concentration',
        ...overrides,
    };
}

describe('sleepService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        hasTranceTrait.mockReturnValue(false);
        getMonsterData.mockResolvedValue(null);
    });

    describe('triggerSleep', () => {
        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Sleep', level: 1, school: 'Enchantment' };

            await triggerSleep({ spell: spell, metaCtx: {}, playerStats: playerStats, campaignName, mapName });

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
                undefined,
            );
        });

        it('resolves saveDc from metaCtx, playerStats, or proficiency', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep({ spell: { name: 'Sleep', level: 1 }, metaCtx: { spellSaveDc: 18, slotLevel: 3 }, playerStats, campaignName, mapName });
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ saveDc: 18 }), spellSlotLevel: 3 }),
                playerStats,
                campaignName,
                mapName,
                undefined,
            );

            await triggerSleep({ spell: { name: 'Sleep', level: 1 }, metaCtx: {}, playerStats, campaignName, mapName });
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ saveDc: 15 }) }),
                playerStats,
                campaignName,
                mapName,
                undefined,
            );
        });

        it('forwards characters to the handler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const characters = [{ name: 'Elf', computedStats: { name: 'Elf' } }];

            await triggerSleep({ spell: { name: 'Sleep', level: 1 }, metaCtx: { slotLevel: 1 }, playerStats: playerStats, campaignName, mapName, characters });

            expect(executeHandler).toHaveBeenCalledWith(
                expect.anything(),
                playerStats,
                campaignName,
                mapName,
                characters,
            );
        });

        it('throws when proficiency is missing and no saveDc fallback', async () => {
            await expect(
                triggerSleep({ spell: { name: 'Sleep', level: 1 }, metaCtx: {}, playerStats: { name: 'Wizard' }, campaignName, mapName })
            ).rejects.toThrow('playerStats.proficiency is required for sleep spell');
        });

        it('uses metaCtx slotLevel over spell.level for spellSlotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep({ spell: { name: 'Sleep', level: 1 }, metaCtx: { slotLevel: 4, spellSaveDc: 17 }, playerStats, campaignName, mapName });
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 4 }),
                playerStats,
                campaignName,
                mapName,
                undefined,
            );
        });

        it('returns null when the handler throws', async () => {
            executeHandler.mockRejectedValue(new Error('boom'));
            const result = await triggerSleep({ spell: { name: 'Sleep', level: 1 }, metaCtx: { slotLevel: 1 }, playerStats: playerStats, campaignName, mapName });
            expect(result).toBeNull();
        });
    });

    describe('isSleepImmune', () => {
        it('auto-succeeds for undead by monsterType without consulting monsters.json', async () => {
            const result = await isSleepImmune(campaignName, { name: 'Zombie 1', type: 'npc', monsterType: 'Undead', immunities: ['Poison'] });
            expect(result).toBe(true);
            expect(getMonsterData).not.toHaveBeenCalled();
        });

        it('auto-succeeds for constructs by monsterType', async () => {
            const result = await isSleepImmune(campaignName, { name: 'Iron Golem', type: 'npc', monsterType: 'Construct' });
            expect(result).toBe(true);
        });

        it('consults monsters.json condition immunities for humanoids', async () => {
            getMonsterData.mockResolvedValue({ name: 'Thug', condition_immunities: ['Exhaustion'] });
            const immune = await isSleepImmune(campaignName, { name: 'Thug 1', type: 'npc', monsterType: 'Humanoid', immunities: ['Poison'] });
            expect(immune).toBe(true);
            expect(getMonsterData).toHaveBeenCalledWith('Thug 1');

            getMonsterData.mockResolvedValue({ name: 'Thug', condition_immunities: [] });
            const susceptible = await isSleepImmune(campaignName, { name: 'Thug 1', type: 'npc', monsterType: 'Humanoid', immunities: ['Poison'] });
            expect(susceptible).toBe(false);
        });

        it('auto-succeeds for players with the Trance trait', async () => {
            hasTranceTrait.mockReturnValue(true);
            const result = await isSleepImmune(campaignName,
                { name: 'Elf', type: 'player', immunities: [] },
                [{ name: 'Elf', computedStats: { name: 'Elf', race: { traits: [{ name: 'Trance' }] } } }]);
            expect(result).toBe(true);
        });

        it('auto-succeeds for players with Magical Sleep or Exhaustion immunities', async () => {
            const viaStats = await isSleepImmune(campaignName,
                { name: 'PlayerA', type: 'player', immunities: [] },
                [{ name: 'PlayerA', computedStats: { name: 'PlayerA', immunities: ['Magical Sleep'] } }]);
            expect(viaStats).toBe(true);

            const viaCs = await isSleepImmune(campaignName,
                { name: 'PlayerB', type: 'player', immunities: ['Exhaustion'] });
            expect(viaCs).toBe(true);
        });

        it('is not immune for a plain humanoid NPC without sleep immunities', async () => {
            getMonsterData.mockResolvedValue({ name: 'Thug', condition_immunities: [] });
            const result = await isSleepImmune(campaignName, { name: 'Thug 1', type: 'npc', monsterType: 'Humanoid', immunities: ['Poison'] });
            expect(result).toBe(false);
        });
    });

    describe('stageSleepTargets', () => {
        it('applies Incapacitated, registers sleep_staged targetEffects, and records concentration at the real DC', async () => {
            getRuntimeValue.mockImplementation((target, key) => {
                if (target === 'campaign' && key === 'targetEffects') return [];
                return null;
            });
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'Wizard', concentration: null }] });

            await stageSleepTargets(campaignName, 'Wizard', ['Thug 1', 'Bandit 2'], 17);

            const condCall = setRuntimeValue.mock.calls.find(c => c[0] === 'Thug 1' && c[1] === 'activeConditions');
            expect(condCall[2]).toContain('incapacitated');

            const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
            expect(teCall[2]).toHaveLength(2);
            expect(teCall[2][0]).toMatchObject({ target: 'Thug 1', effect: SLEEP_TE_EFFECT, stage: 'incapacitated', dc: 17, duration: 'concentration', source: 'Wizard' });
            expect(teCall[2][1].target).toBe('Bandit 2');

            expect(addConcentration).toHaveBeenCalledWith(expect.anything(), 'Wizard', 'Sleep', 17);
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.anything(), campaignName);
        });

        it('replaces an existing sleep_staged effect and skips concentration when already concentrating on Sleep', async () => {
            const existing = makeSleepTe({ stage: 'unconscious' });
            getRuntimeValue.mockImplementation((target, key) => {
                if (target === 'campaign' && key === 'targetEffects') return [existing];
                return null;
            });
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'Wizard', concentration: { spell: 'Sleep', dc: 17 } }] });

            await stageSleepTargets(campaignName, 'Wizard', ['Thug 1'], 17);

            const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
            expect(teCall[2]).toHaveLength(1);
            expect(teCall[2][0]).toMatchObject({ stage: 'incapacitated', dc: 17 });
            expect(addConcentration).not.toHaveBeenCalled();
        });
    });

    describe('applySleepTurnEnd', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Wizard', type: 'player', concentration: { spell: 'Sleep', dc: 17 } },
                    { name: 'Thug 1', type: 'npc', saveBonuses: { wis: 0 } },
                ],
            });
        });

        it('is a no-op when the target has no staged sleep effect', async () => {
            const result = await applySleepTurnEnd(campaignName, 'Thug 1');
            expect(result).toEqual({ handled: false });
        });

        it('is a no-op when the sleep effect already escalated to Unconscious', async () => {
            getRuntimeValue.mockImplementation((target, key) => {
                if (target === 'campaign' && key === 'targetEffects') return [makeSleepTe({ stage: 'unconscious' })];
                return null;
            });
            const result = await applySleepTurnEnd(campaignName, 'Thug 1');
            expect(result).toEqual({ handled: false });
        });

        it('escalates an NPC that fails the repeat save to Unconscious with a round-based expiration', async () => {
            getRuntimeValue.mockImplementation((target, key) => {
                if (target === 'campaign' && key === 'targetEffects') return [makeSleepTe()];
                if (target === 'Thug 1' && key === 'activeConditions') return ['incapacitated'];
                return null;
            });
            vi.spyOn(Math, 'random').mockReturnValue(0);

            const result = await applySleepTurnEnd(campaignName, 'Thug 1');
            expect(result).toMatchObject({ handled: true, success: false, roll: 1 });

            const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
            expect(teCall[2][0]).toMatchObject({ stage: 'unconscious', condition: 'unconscious' });

            const removeIncapCall = setRuntimeValue.mock.calls.find(c => c[0] === 'Thug 1' && c[1] === 'activeConditions' && !c[2].includes('incapacitated'));
            expect(removeIncapCall).toBeTruthy();
            const applyUnconsciousCall = setRuntimeValue.mock.calls.filter(c => c[0] === 'Thug 1' && c[1] === 'activeConditions').pop();
            expect(applyUnconsciousCall[2]).toContain('unconscious');

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Wizard', targetName: 'Thug 1', effects: [
                { type: 'condition', condition: 'unconscious' },
                { type: 'remove_target_effect', effectKey: SLEEP_TE_EFFECT, source: 'Wizard', target: 'Thug 1' },
            ], campaignName, rounds: 10 });

            vi.restoreAllMocks();
        });

        it('clears the staged effect and condition when the NPC succeeds the repeat save', async () => {
            getRuntimeValue.mockImplementation((target, key) => {
                if (target === 'campaign' && key === 'targetEffects') return [makeSleepTe()];
                if (target === 'Thug 1' && key === 'activeConditions') return ['incapacitated'];
                return null;
            });
            vi.spyOn(Math, 'random').mockReturnValue(0.999);

            const result = await applySleepTurnEnd(campaignName, 'Thug 1');
            expect(result).toMatchObject({ handled: true, success: true, roll: 20 });

            const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
            expect(teCall[2]).toHaveLength(0);
            expect(addExpiration).not.toHaveBeenCalled();

            const lastCondCall = setRuntimeValue.mock.calls.filter(c => c[0] === 'Thug 1' && c[1] === 'activeConditions').pop();
            expect(lastCondCall[2]).not.toContain('incapacitated');

            vi.restoreAllMocks();
        });

        it('prompts player targets to roll their own repeat save', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Wizard', type: 'player', concentration: { spell: 'Sleep', dc: 17 } },
                    { name: 'PlayerB', type: 'player', saveBonuses: { wis: 2 } },
                ],
            });
            getRuntimeValue.mockImplementation((target, key) => {
                if (target === 'campaign' && key === 'targetEffects') return [makeSleepTe({ target: 'PlayerB' })];
                if (target === 'PlayerB' && key === 'activeConditions') return ['incapacitated'];
                return null;
            });
            createSaveListener.mockReturnValue({
                promptId: 'sleep-repeat',
                promise: Promise.resolve({ success: true, roll: 19, saveBonus: 2, total: 21 }),
            });

            const result = await applySleepTurnEnd(campaignName, 'PlayerB');
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName: 'PlayerB', saveDc: 17, saveType: 'WIS' }));
            expect(result).toMatchObject({ handled: true, success: true, roll: 19, total: 21 });

            const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
            expect(teCall[2]).toHaveLength(0);
        });

        it('honours skipSync for remote SSE echo clients', async () => {
            getRuntimeValue.mockImplementation((target, key) => {
                if (target === 'campaign' && key === 'targetEffects') return [makeSleepTe()];
                if (target === 'Thug 1' && key === 'activeConditions') return ['incapacitated'];
                return null;
            });
            vi.spyOn(Math, 'random').mockReturnValue(0);

            await applySleepTurnEnd(campaignName, 'Thug 1', { skipSync: true });

            const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
            expect(teCall[4]).toBe(true);
            vi.restoreAllMocks();
        });
    });

    describe('wakeSleepTarget / wakeSleepOnDamage', () => {
        it('does nothing without a sleep_staged effect', () => {
            expect(wakeSleepOnDamage(campaignName, 'Thug 1', 5)).toBe(false);
        });

        it('does not wake on zero damage', () => {
            getRuntimeValue.mockImplementation((target, key) => {
                if (target === 'campaign' && key === 'targetEffects') return [makeSleepTe()];
                return null;
            });
            expect(wakeSleepOnDamage(campaignName, 'Thug 1', 0)).toBe(false);
        });

        it('clears the staged effect, both conditions, and logs when damage wakes the target', () => {
            getRuntimeValue.mockImplementation((target, key) => {
                if (target === 'campaign' && key === 'targetEffects') return [makeSleepTe({ stage: 'unconscious', condition: 'unconscious' }), { target: 'Other', effect: 'hex' }];
                if (target === 'Thug 1' && key === 'activeConditions') return ['unconscious'];
                return null;
            });

            expect(wakeSleepOnDamage(campaignName, 'Thug 1', 7)).toBe(true);

            const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
            expect(teCall[2]).toEqual([{ target: 'Other', effect: 'hex' }]);

            const condCalls = setRuntimeValue.mock.calls.filter(c => c[0] === 'Thug 1' && c[1] === 'activeConditions');
            expect(condCalls.length).toBeGreaterThan(0);
            expect(condCalls.every(c => !c[2].includes('unconscious') && !c[2].includes('incapacitated'))).toBe(true);
        });

        it('wakeSleepTarget removes the effect even with zero-damage reasons (shake awake)', () => {
            getRuntimeValue.mockImplementation((target, key) => {
                if (target === 'campaign' && key === 'targetEffects') return [makeSleepTe()];
                if (target === 'Thug 1' && key === 'activeConditions') return ['incapacitated'];
                return null;
            });
            expect(wakeSleepTarget(campaignName, 'Thug 1', 'shaken awake')).toBe(true);
            const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
            expect(teCall[2]).toHaveLength(0);
        });
    });
});
