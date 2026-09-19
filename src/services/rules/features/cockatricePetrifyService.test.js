// MA-0501: Cockatrice Petrifying Bite staging (cockatricePetrifyService,
// MA-0248 paralyzingBreathService ladder shape): the 1d4+1 Piercing damage
// rides the ATTACK HIT (dc_success:"full"); the CON save (DC 11) gates only
// the ladder. First failed save → Restrained + petrifying_bite_staged te;
// turn-END seam repeats the CON save while Restrained — success sheds
// Restrained and retires the ladder, a second failure (repeat save OR fresh
// bite while Restrained) Petrifies with a 24-hour clock (24×600 rounds,
// CLA-334 hours×600).
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
    stagePetrifyingBiteTargets,
    applyPetrifyingBiteTurnEnd,
    PETRIFYING_BITE_STAGED_TE,
} from './cockatricePetrifyService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';

const campaignName = 'test-campaign';
const caster = 'Cockatrice 1';

function makeStagedTe(overrides = {}) {
    return {
        target: 'Bandit 1',
        effect: PETRIFYING_BITE_STAGED_TE,
        source: caster,
        condition: 'restrained',
        stage: 'restrained',
        dc: 11,
        saveType: 'CON',
        duration: 'ladder_until_second_failure',
        label: 'Petrifying Bite',
        petrifiedRounds: 14400,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    getCombatSummary.mockReturnValue(null);
});

describe('MA-0501 cockatricePetrifyService staging', () => {
    it('first failed bite grants Restrained ONLY + CON staged te + ladder-armed log', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [];
            return null;
        });

        const staged = await stagePetrifyingBiteTargets({
            campaignName, casterName: caster, targetNames: ['Bandit 1'], saveDc: 11,
            options: { saveType: 'CON', label: 'Petrifying Bite', petrifiedRounds: 14400 },
        });

        expect(staged).toEqual(['Bandit 1']);

        const condCall = setRuntimeValue.mock.calls.find(c => c[0] === 'Bandit 1' && c[1] === 'activeConditions');
        expect(condCall[2]).toContain('restrained');
        expect(condCall[2]).not.toContain('petrified');

        const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teCall[2][0]).toMatchObject({
            target: 'Bandit 1',
            effect: PETRIFYING_BITE_STAGED_TE,
            stage: 'restrained',
            condition: 'restrained',
            dc: 11,
            saveType: 'CON',
            duration: 'ladder_until_second_failure',
            label: 'Petrifying Bite',
            petrifiedRounds: 14400,
        });

        const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'applied');
        expect(condLog.condition).toBe('Restrained');
        expect(condLog.reason).toBe('Petrifying Bite (failed save)');
        expect(condLog.sourceName).toBe(caster);
        expect(condLog.note).toContain('second failure Petrifies');
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('second bite save-fail while Restrained escalates to Petrified with ONE 24-hour clock, no repeat save rolled', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe()];
            if (target === 'Bandit 1' && key === 'activeConditions') return ['restrained'];
            return null;
        });

        const staged = await stagePetrifyingBiteTargets({
            campaignName, casterName: caster, targetNames: ['Bandit 1'], saveDc: 11,
            options: { saveType: 'CON', label: 'Petrifying Bite', petrifiedRounds: 14400 },
        });

        expect(staged).toEqual(['Bandit 1']);

        const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teCall[2]).toHaveLength(0);

        const condWrite = setRuntimeValue.mock.calls.filter(c => c[0] === 'Bandit 1' && c[1] === 'activeConditions');
        // Restrained stripped first, then Petrified applied (last write = live
        // state; the stateless mock re-reads the pre-removal store, MA-0248 shape).
        expect(condWrite[0][2]).toEqual([]);
        expect(condWrite.at(-1)[2]).toContain('petrified');

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: caster,
            targetName: 'Bandit 1',
            effects: [{ type: 'condition', condition: 'petrified' }],
            campaignName,
            rounds: 14400,
        });

        const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'applied');
        expect(condLog.condition).toBe('Petrified');
        expect(condLog.reason).toBe('Petrifying Bite (second failed save)');
        expect(condLog.note).toContain('24 hours');
    });

    it('turn-END repeat save is CON vs te dc, consumes saveBonuses.con', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', saveBonuses: { con: 0 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe()];
            if (target === 'Bandit 1' && key === 'activeConditions') return ['restrained'];
            return null;
        });
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);

        const result = await applyPetrifyingBiteTurnEnd(campaignName, 'Bandit 1');

        expect(result).toMatchObject({ handled: true, success: true, roll: 20, total: 20 });
        const saveLog = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-petrifying-repeat');
        expect(saveLog.saveType).toBe('CON');
        expect(saveLog.saveDc).toBe(11);

        spy.mockRestore();
    });

    it('failed turn-END repeat save escalates to Petrified with 14400-round clock + Petrified log', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', saveBonuses: { con: 0 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe()];
            if (target === 'Bandit 1' && key === 'activeConditions') return ['restrained'];
            return null;
        });
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

        const result = await applyPetrifyingBiteTurnEnd(campaignName, 'Bandit 1');

        expect(result).toMatchObject({ handled: true, success: false, roll: 1, total: 1 });

        const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teCall[2]).toHaveLength(0);

        const condWrite = setRuntimeValue.mock.calls.filter(c => c[0] === 'Bandit 1' && c[1] === 'activeConditions');
        expect(condWrite[0][2]).toEqual([]);
        expect(condWrite.at(-1)[2]).toContain('petrified');

        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: caster,
            targetName: 'Bandit 1',
            effects: [{ type: 'condition', condition: 'petrified' }],
            campaignName,
            rounds: 14400,
        });

        const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'applied');
        expect(condLog.condition).toBe('Petrified');
        expect(condLog.reason).toBe('Petrifying Bite (second failed save)');

        spy.mockRestore();
    });

    it('successful turn-END repeat save sheds Restrained + retires the ladder, NO Petrified, NO clock', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', saveBonuses: { con: 5 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe()];
            if (target === 'Bandit 1' && key === 'activeConditions') return ['restrained'];
            return null;
        });
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);

        const result = await applyPetrifyingBiteTurnEnd(campaignName, 'Bandit 1');

        expect(result).toMatchObject({ handled: true, success: true });
        const teCall = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teCall[2]).toHaveLength(0);
        const condCall = setRuntimeValue.mock.calls.find(c => c[0] === 'Bandit 1' && c[1] === 'activeConditions');
        expect(condCall[2]).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();

        const removeLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'removed');
        expect(removeLog.condition).toBe('Restrained');
        expect(removeLog.reason).toBe('Petrifying Bite ends (repeat save succeeded)');

        spy.mockRestore();
    });

    it('Petrified stage does NOT repeat at turn-END (24h is clock-bound, no re-roll)', async () => {
        const result = await applyPetrifyingBiteTurnEnd(campaignName, 'Bandit 1');
        // staged te fully retired by the second-fail leg → handled:false
        expect(result).toEqual({ handled: false });
        expect(addEntry).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('PC targets get a CON repeat-save prompt labeled Petrifying Bite', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'AberrantSorcerer', type: 'player', saveBonuses: { con: -1 } }],
        });
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe({ target: 'AberrantSorcerer' })];
            if (target === 'AberrantSorcerer' && key === 'activeConditions') return ['restrained'];
            return null;
        });
        createSaveListener.mockReturnValue({
            promptId: 'petrify-repeat',
            promise: Promise.resolve({ success: false, roll: 3, saveBonus: -1, total: 2 }),
        });

        const result = await applyPetrifyingBiteTurnEnd(campaignName, 'AberrantSorcerer');

        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'AberrantSorcerer',
            saveType: 'CON',
            saveDc: 11,
            dcSuccess: 'none',
            condition: 'Petrifying Bite (repeat save)',
        }));
        expect(result).toMatchObject({ handled: true, success: false });
    });

    it('no staged te → handled:false, zero writes/logs (save-success/miss stays inert)', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (target === 'campaign' && key === 'targetEffects') return [makeStagedTe({ effect: 'paralyzing_staged' })];
            return null;
        });

        const result = await applyPetrifyingBiteTurnEnd(campaignName, 'Bandit 1');

        expect(result).toEqual({ handled: false });
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
