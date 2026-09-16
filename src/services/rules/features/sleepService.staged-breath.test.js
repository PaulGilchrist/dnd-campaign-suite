// MA-0068: Adult Brass Dragon Sleep Breath re-uses the SP-107 sleepService
// staging seams via the options parameter — CON repeat save, NO caster
// concentration, Unconscious escalation expires after 10 minutes (100 rounds,
// CLA-334 minutes×10). Sleep-spell defaults stay byte-identical
// (sleepService.test.js locks those).
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
    stageSleepTargets,
    applySleepTurnEnd,
    wakeSleepOnDamage,
    SLEEP_TE_EFFECT,
} from './sleepService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { addConcentration } from '../../combat/concentration/concentrationService.js';
import { addEntry } from '../../ui/logService.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';

const campaignName = 'test-campaign';

function makeBreathSleepTe(overrides = {}) {
    return {
        target: 'Thug 1',
        effect: SLEEP_TE_EFFECT,
        source: 'Adult Brass Dragon 1',
        condition: 'incapacitated',
        stage: 'incapacitated',
        dc: 18,
        saveType: 'CON',
        duration: 'staged_until_repeat_save',
        label: 'Sleep Breath',
        logLabel: 'Sleep Breath',
        unconsciousRounds: 100,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    getCombatSummary.mockReturnValue(null);
});

describe('MA-0068 sleepService staged Sleep Breath', () => {
    it('stageSleepTargets stages CON/label/unconsciousRounds and skips concentration for concentrate:false', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [];
            return null;
        });

        const staged = await stageSleepTargets(campaignName, 'Adult Brass Dragon 1', ['Thug 1'], 18, {
            saveType: 'Constitution',
            concentrate: false,
            label: 'Sleep Breath',
            logLabel: 'Sleep Breath',
            unconsciousRounds: 100,
        });

        expect(staged).toEqual(['Thug 1']);

        const condCall = setRuntimeValue.mock.calls.find(c => c[0] === 'Thug 1' && c[1] === 'activeConditions');
        expect(condCall[2]).toContain('incapacitated');
        expect(condCall[2]).not.toContain('unconscious');

        const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teCall[2][0]).toMatchObject({
            target: 'Thug 1',
            effect: SLEEP_TE_EFFECT,
            stage: 'incapacitated',
            dc: 18,
            saveType: 'CON',
            duration: 'staged_until_repeat_save',
            label: 'Sleep Breath',
            unconsciousRounds: 100,
        });

        expect(addConcentration).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
    });

    it('turn-END repeat save rolls CON (not WIS), consumes saveBonuses.con', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Thug 1', type: 'npc', saveBonuses: { con: 1, wis: 9 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeBreathSleepTe()];
            if (target === 'Thug 1' && key === 'activeConditions') return ['incapacitated'];
            return null;
        });
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

        const result = await applySleepTurnEnd(campaignName, 'Thug 1');

        expect(result).toMatchObject({ handled: true, success: false, roll: 1, total: 2 });

        const saveLog = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-sleep-repeat');
        expect(saveLog.saveType).toBe('CON');
        expect(saveLog.saveDc).toBe(18);
        expect(saveLog.description).toContain('Constitution save');
        expect(saveLog.description).toContain('falls Unconscious');

        spy.mockRestore();
    });

    it('failed repeat save escalates to Unconscious with a 100-round expiry and Sleep Breath labels', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Thug 1', type: 'npc', saveBonuses: { con: 1 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeBreathSleepTe()];
            if (target === 'Thug 1' && key === 'activeConditions') return ['incapacitated'];
            return null;
        });
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

        await applySleepTurnEnd(campaignName, 'Thug 1');

        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Adult Brass Dragon 1',
            targetName: 'Thug 1',
            effects: [
                { type: 'condition', condition: 'unconscious' },
                { type: 'remove_target_effect', effectKey: SLEEP_TE_EFFECT, source: 'Adult Brass Dragon 1', target: 'Thug 1' },
            ],
            campaignName,
            rounds: 100,
        });

        const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'applied');
        expect(condLog.condition).toBe('Unconscious');
        expect(condLog.reason).toBe('Sleep Breath (failed repeat save)');

        spy.mockRestore();
    });

    it('successful repeat save strips the staged te and Incapacitated, with Sleep Breath removal reason', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Thug 1', type: 'npc', saveBonuses: { con: 1 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeBreathSleepTe()];
            if (target === 'Thug 1' && key === 'activeConditions') return ['incapacitated'];
            return null;
        });
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);

        const result = await applySleepTurnEnd(campaignName, 'Thug 1');

        expect(result).toMatchObject({ handled: true, success: true, roll: 20 });
        const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teCall[2]).toHaveLength(0);
        const removeLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'removed');
        expect(removeLog.reason).toBe('Sleep Breath ends (repeat save succeeded)');
        expect(addExpiration).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('PC targets get a CON repeat-save prompt labeled Sleep Breath', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'PlayerB', type: 'player', saveBonuses: { con: 2 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeBreathSleepTe({ target: 'PlayerB' })];
            if (target === 'PlayerB' && key === 'activeConditions') return ['incapacitated'];
            return null;
        });
        createSaveListener.mockReturnValue({
            promptId: 'breath-repeat',
            promise: Promise.resolve({ success: false, roll: 3, saveBonus: 2, total: 5 }),
        });

        const result = await applySleepTurnEnd(campaignName, 'PlayerB');

        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'PlayerB',
            saveType: 'CON',
            saveDc: 18,
            condition: 'Sleep Breath (repeat save)',
        }));
        expect(result).toMatchObject({ handled: true, success: false });
    });

    it('wake-on-damage seam clears the staged breath sleep (any damage > 0)', () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeBreathSleepTe({ stage: 'unconscious', condition: 'unconscious' })];
            if (target === 'Thug 1' && key === 'activeConditions') return ['unconscious'];
            return null;
        });
        expect(wakeSleepOnDamage(campaignName, 'Thug 1', 4)).toBe(true);
        const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teCall[2]).toHaveLength(0);
    });
});
