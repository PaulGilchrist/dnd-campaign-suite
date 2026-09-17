// MA-0248: Ancient Silver Dragon Paralyzing Breath staging (paralyzingBreath
// Service, MA-0068 staged-sleep shape / MA-0102 sibling): first failed CON
// save stages Incapacitated + paralyzing_staged te (NO caster concentration,
// NO damage-wake); turn-END seam repeats the CON save every turn — first
// fail escalates to Paralyzed with a 10-round auto-success clock (CLA-334),
// every later repeat save ends the whole effect on a success.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import { addEntry } from '../../ui/logService.js';
import {
    stageParalysisTargets,
    applyParalyzingBreathTurnEnd,
    PARALYZING_STAGED_TE,
} from './paralyzingBreathService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';

const campaignName = 'test-campaign';
const caster = 'Ancient Silver Dragon 1';

function makeStagedTe(overrides = {}) {
    return {
        target: 'Thug 1',
        effect: PARALYZING_STAGED_TE,
        source: caster,
        condition: 'incapacitated',
        stage: 'incapacitated',
        dc: 24,
        saveType: 'CON',
        duration: 'staged_until_repeat_save',
        label: 'Paralyzing Breath',
        logLabel: 'Paralyzing Breath',
        paralyzedRounds: 10,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    getCombatSummary.mockReturnValue(null);
});

describe('MA-0248 paralyzingBreathService staging', () => {
    it('stageParalysisTargets grants Incapacitated ONLY + CON staged te, no concentration keys, 10 rounds', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [];
            return null;
        });

        const staged = await stageParalysisTargets(campaignName, caster, ['Thug 1'], 24, {
            saveType: 'Constitution',
            label: 'Paralyzing Breath',
            logLabel: 'Paralyzing Breath',
            paralyzedRounds: 10,
        });

        expect(staged).toEqual(['Thug 1']);

        const condCall = setRuntimeValue.mock.calls.find(c => c[0] === 'Thug 1' && c[1] === 'activeConditions');
        expect(condCall[2]).toContain('incapacitated');
        expect(condCall[2]).not.toContain('paralyzed');

        const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teCall[2][0]).toMatchObject({
            target: 'Thug 1',
            effect: PARALYZING_STAGED_TE,
            stage: 'incapacitated',
            condition: 'incapacitated',
            dc: 24,
            saveType: 'CON',
            duration: 'staged_until_repeat_save',
            label: 'Paralyzing Breath',
            paralyzedRounds: 10,
        });
    });

    it('turn-END stage-1 repeat save rolls CON (not WIS), consumes saveBonuses.con', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Thug 1', type: 'npc', saveBonuses: { con: 1, wis: 9 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe()];
            if (target === 'Thug 1' && key === 'activeConditions') return ['incapacitated'];
            return null;
        });
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

        const result = await applyParalyzingBreathTurnEnd(campaignName, 'Thug 1');

        expect(result).toMatchObject({ handled: true, success: false, roll: 1, total: 2 });

        const saveLog = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-paralyzing-repeat');
        expect(saveLog.saveType).toBe('CON');
        expect(saveLog.saveDc).toBe(24);
        expect(saveLog.description).toContain('Constitution save');
        expect(saveLog.description).toContain('becomes Paralyzed');

        spy.mockRestore();
    });

    it('failed stage-1 repeat save escalates to Paralyzed with a 10-round clock + Paralyzed log', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Thug 1', type: 'npc', saveBonuses: { con: 1 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe()];
            if (target === 'Thug 1' && key === 'activeConditions') return ['incapacitated'];
            return null;
        });
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

        await applyParalyzingBreathTurnEnd(campaignName, 'Thug 1');

        const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teCall[2][0]).toMatchObject({ stage: 'paralyzed', condition: 'paralyzed' });

        const condWrite = setRuntimeValue.mock.calls.filter(c => c[0] === 'Thug 1' && c[1] === 'activeConditions');
        // Incapacitated stripped, then Paralyzed applied (last write = the
        // live state; the stateless mock re-reads the pre-removal store).
        expect(condWrite[0][2]).toEqual([]);
        expect(condWrite.at(-1)[2]).toContain('paralyzed');

        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: caster,
            targetName: 'Thug 1',
            effects: [
                { type: 'condition', condition: 'paralyzed' },
                { type: 'remove_target_effect', effectKey: PARALYZING_STAGED_TE, source: caster, target: 'Thug 1' },
            ],
            campaignName,
            rounds: 10,
        });

        const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'applied');
        expect(condLog.condition).toBe('Paralyzed');
        expect(condLog.reason).toBe('Paralyzing Breath (failed repeat save)');
        expect(condLog.note).toContain('succeeds automatically');

        spy.mockRestore();
    });

    it('failed repeat save while Paralyzed keeps Paralyzed and registers NO second clock', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Thug 1', type: 'npc', saveBonuses: { con: 1 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe({ stage: 'paralyzed', condition: 'paralyzed' })];
            if (target === 'Thug 1' && key === 'activeConditions') return ['paralyzed'];
            return null;
        });
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

        const result = await applyParalyzingBreathTurnEnd(campaignName, 'Thug 1');

        expect(result).toMatchObject({ handled: true, success: false });
        expect(addExpiration).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();

        const saveLog = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-paralyzing-repeat');
        expect(saveLog.description).toContain('remains Paralyzed');

        spy.mockRestore();
    });

    it('successful stage-1 repeat save strips te + Incapacitated only', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Thug 1', type: 'npc', saveBonuses: { con: 5 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe()];
            if (target === 'Thug 1' && key === 'activeConditions') return ['incapacitated'];
            return null;
        });
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);

        const result = await applyParalyzingBreathTurnEnd(campaignName, 'Thug 1');

        expect(result).toMatchObject({ handled: true, success: true, roll: 20 });
        const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teCall[2]).toHaveLength(0);
        const condCall = setRuntimeValue.mock.calls.find(c => c[0] === 'Thug 1' && c[1] === 'activeConditions');
        expect(condCall[2]).toHaveLength(0);
        const removeLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'removed');
        expect(removeLog.condition).toBe('Incapacitated');
        expect(removeLog.reason).toBe('Paralyzing Breath ends (repeat save succeeded)');
        expect(addExpiration).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('successful stage-2 repeat save strips te + Paralyzed (effect ends on itself)', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Thug 1', type: 'npc', saveBonuses: { con: 5 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe({ stage: 'paralyzed', condition: 'paralyzed' })];
            if (target === 'Thug 1' && key === 'activeConditions') return ['paralyzed'];
            return null;
        });
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);

        const result = await applyParalyzingBreathTurnEnd(campaignName, 'Thug 1');

        expect(result).toMatchObject({ handled: true, success: true, roll: 20 });
        const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teCall[2]).toHaveLength(0);
        const removeLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'removed');
        expect(removeLog.condition).toBe('Paralyzed');

        spy.mockRestore();
    });

    it('PC targets get a CON repeat-save prompt labeled Paralyzing Breath', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'HexWarlock', type: 'player', saveBonuses: { con: 0 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe({ target: 'HexWarlock' })];
            if (target === 'HexWarlock' && key === 'activeConditions') return ['incapacitated'];
            return null;
        });
        createSaveListener.mockReturnValue({
            promptId: 'paralysis-repeat',
            promise: Promise.resolve({ success: false, roll: 3, saveBonus: 0, total: 3 }),
        });

        const result = await applyParalyzingBreathTurnEnd(campaignName, 'HexWarlock');

        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'HexWarlock',
            saveType: 'CON',
            saveDc: 24,
            condition: 'Paralyzing Breath (repeat save)',
        }));
        expect(result).toMatchObject({ handled: true, success: false });
    });

    it('no staged te → handled:false, zero writes/logs', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe({ effect: 'sleep_staged' })];
            return null;
        });

        const result = await applyParalyzingBreathTurnEnd(campaignName, 'Thug 1');

        expect(result).toEqual({ handled: false });
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
