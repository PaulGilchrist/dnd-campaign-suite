// @maintained-by-ai
// MA-0501: Cockatrice Petrifying Bite staging (cockatricePetrifyService,
// MA-0248 paralyzingBreathService ladder shape): the 1d4+1 Piercing damage
// rides the ATTACK HIT (dc_success:"full"); the CON save (DC 11, disk canon
// monsters.json Petrifying Bite row save_dc) gates only the ladder. First
// failed save → Restrained + petrifying_bite_staged te; turn-END seam
// repeats the CON save while Restrained — success sheds Restrained and
// retires the ladder, a second failure (repeat save OR fresh bite while
// Restrained) Petrifies with a 24-hour clock (24×600 = 14400 rounds,
// CLA-334 hours×600, disk canon staged_petrify.petrified_hours: 24).
// All four production call sites (saveProcessing, handleNpcSaveDamage,
// SaveAttackAoeModal picker, navigationHandlers turn-END) omit skipSync →
// every write is pinned skipSync:false (SSE must broadcast).
//
// OWNERSHIP: this file owns the service ladder legs (cited by
// MonsterCardModal.cockatrice-regent-bite.test.jsx:12 and
// MonsterCardModal.gorgon-breath.test.jsx:11 — the dc15 'Petrifying Breath'
// + petrifiedRounds 14400 legs below preserve that citation). Picker wiring
// lives in SaveAttackAoeModal.staged-petrify.test.jsx (which re-runs this
// real service end-to-end), row transport in
// MonsterCardModal.cockatrice-bite.test.jsx, registry bytes in
// targetEffectDefinitions.test.js — not duplicated here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
const TARGET = 'Bandit 1';

// Byte mirror of stageEffect()'s authored envelope (disk-driven values:
// dc/label/petrifiedRounds ride the call from the monsters.json row).
function makeStagedTe(overrides = {}) {
    return {
        target: TARGET,
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

function seedRuntime(teEffects, activeConditions) {
    getRuntimeValue.mockImplementation((target, key) => {
        if (target === 'campaign' && key === 'targetEffects') return teEffects;
        if (target === TARGET && key === 'activeConditions') return activeConditions;
        return null;
    });
}

const condWrites = () => setRuntimeValue.mock.calls.filter(c => c[0] === TARGET && c[1] === 'activeConditions');
const teWrites = () => setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects');
const logEntries = () => addEntry.mock.calls.map(c => c[1]);

beforeEach(() => {
    vi.clearAllMocks();
    // Explicit re-seed: kill every undefined-mock default branch.
    getRuntimeValue.mockReturnValue(null);
    getCombatSummary.mockReturnValue(null);
});

afterEach(() => {
    vi.restoreAllMocks(); // always release Math.random spies
});

describe('MA-0501 cockatricePetrifyService staging (failed rider-save leg)', () => {
    it('first failed bite: Restrained ONLY + exact staged te envelope + ladder-armed log, zero clocks', async () => {
        seedRuntime([], undefined);

        const staged = await stagePetrifyingBiteTargets({
            campaignName, casterName: caster, targetNames: [TARGET], saveDc: 11,
            options: { saveType: 'CON', label: 'Petrifying Bite', petrifiedRounds: 14400 },
        });

        expect(staged).toEqual([TARGET]);

        const condWrite = condWrites();
        expect(condWrite).toHaveLength(1);
        expect(condWrite[0][2]).toEqual(['restrained']);
        expect(condWrite[0][3]).toBe(campaignName);
        expect(condWrite[0][4]).toBe(false); // caller-omitted skipSync → broadcast

        const teWrite = teWrites();
        expect(teWrite).toHaveLength(1);
        expect(teWrite[0][2]).toEqual([makeStagedTe()]);

        const condLog = logEntries().find(e => e.type === 'condition' && e.action === 'applied');
        expect(condLog).toMatchObject({
            characterName: TARGET,
            condition: 'Restrained',
            reason: 'Petrifying Bite (failed save)',
            sourceName: caster,
        });
        expect(condLog.note).toContain('second failure Petrifies');
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('re-fire bite on a Restrained-staged target: second failure — ATOMIC Restrained→Petrified swap, ladder te retired, ONE 24-hour clock', async () => {
        // Unrelated te alongside the ladder te must survive the splice, and
        // the store array must not be mutated in place (MA-0904: the old
        // remove→apply POST pair raced out of order in live E2E — one write).
        const unrelatedTe = { target: 'Bandit 2', effect: 'frightened', source: 'Hobgoblin 1' };
        const tes = [unrelatedTe, makeStagedTe()];
        seedRuntime(tes, ['restrained']);

        const staged = await stagePetrifyingBiteTargets({
            campaignName, casterName: caster, targetNames: [TARGET], saveDc: 11,
            options: { saveType: 'CON', label: 'Petrifying Bite', petrifiedRounds: 14400 },
        });

        expect(staged).toEqual([TARGET]);

        const condWrite = condWrites();
        expect(condWrite).toHaveLength(1);
        expect(condWrite[0][2]).toEqual(['petrified']);

        const teWrite = teWrites();
        expect(teWrite[0][2]).toEqual([unrelatedTe]);
        expect(teWrite[0][2]).not.toBe(tes); // copy, not store mutation

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: caster,
            targetName: TARGET,
            effects: [{ type: 'condition', condition: 'petrified' }],
            campaignName,
            rounds: 14400,
        });

        const condLog = logEntries().find(e => e.type === 'condition' && e.action === 'applied');
        expect(condLog.condition).toBe('Petrified');
        expect(condLog.reason).toBe('Petrifying Bite (second failed save)');
        expect(condLog.note).toContain('24 hours');
    });

    it('already-Petrified target is skipped even with a stale ladder te: no re-escalation, no second clock, no logs', async () => {
        seedRuntime([makeStagedTe()], ['petrified']);

        const staged = await stagePetrifyingBiteTargets({
            campaignName, casterName: caster, targetNames: [TARGET], saveDc: 11,
            options: { saveType: 'CON', label: 'Petrifying Bite', petrifiedRounds: 14400 },
        });

        expect(staged).toEqual([]);
        expect(condWrites()).toHaveLength(0);
        expect(teWrites()[0][2]).toEqual([makeStagedTe()]); // untouched
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});

describe('MA-0501 turn-END repeat-save repeater', () => {
    it('NPC auto-roll succeeds at the exact DC boundary (roll + con bonus === te dc): ladder retired, Restrained shed, no clock', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: TARGET, type: 'npc', saveBonuses: { con: 0 } }],
        });
        seedRuntime([makeStagedTe()], ['restrained']);
        vi.spyOn(Math, 'random').mockReturnValue(0.5); // 1d4-style seam → nat 11

        const result = await applyPetrifyingBiteTurnEnd(campaignName, TARGET);

        expect(result).toEqual({ handled: true, success: true, roll: 11, total: 11 });

        const saveLog = logEntries().find(e => e.rollType === 'save-petrifying-repeat');
        expect(saveLog).toMatchObject({ saveType: 'CON', saveDc: 11, roll: 11, total: 11, success: true });

        expect(teWrites()[0][2]).toEqual([]); // ladder fully retired
        expect(condWrites()[0][2]).toEqual([]); // Restrained shed
        expect(addExpiration).not.toHaveBeenCalled();

        const removeLog = logEntries().find(e => e.type === 'condition' && e.action === 'removed');
        expect(removeLog.condition).toBe('Restrained');
        expect(removeLog.reason).toBe('Petrifying Bite ends (repeat save succeeded)');
    });

    it('NPC auto-roll fails: second failure — atomic Petrified swap + ONE 14400-round clock, exact save/condition log copy', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: TARGET, type: 'npc', saveBonuses: { con: 0 } }],
        });
        seedRuntime([makeStagedTe()], ['restrained']);
        vi.spyOn(Math, 'random').mockReturnValue(0); // nat 1

        const result = await applyPetrifyingBiteTurnEnd(campaignName, TARGET);

        expect(result).toEqual({ handled: true, success: false, roll: 1, total: 1 });

        const condWrite = condWrites();
        expect(condWrite).toHaveLength(1);
        expect(condWrite[0][2]).toEqual(['petrified']);
        expect(condWrite[0][4]).toBe(false); // turn-END seam omits skipSync → broadcast

        expect(teWrites()[0][2]).toEqual([]);

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: caster,
            targetName: TARGET,
            effects: [{ type: 'condition', condition: 'petrified' }],
            campaignName,
            rounds: 14400,
        });

        const condLog = logEntries().find(e => e.type === 'condition' && e.action === 'applied');
        expect(condLog.condition).toBe('Petrified');
        expect(condLog.reason).toBe('Petrifying Bite (second failed save)');
    });

    it('PC target repeats through the queued save prompt: exact CON/DC-11 envelope, result passthrough', async () => {
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

        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
            targetName: 'AberrantSorcerer',
            saveType: 'CON',
            saveDc: 11,
            dcSuccess: 'none',
            sourceName: caster,
            condition: 'Petrifying Bite (repeat save)',
        });
        expect(result).toEqual({ handled: true, success: false, roll: 3, total: 2 });
    });

    it.each([
        ['no staged te at all', []],
        ['near-miss sibling ladder key paralyzing_staged (Silver Dragon stays inert)', [makeStagedTe({ effect: 'paralyzing_staged' })]],
        ['near-miss sibling ladder key eye_ray_petrifying (Beholder stays inert)', [makeStagedTe({ effect: 'eye_ray_petrifying' })]],
        ['own te but Petrified stage (24h is clock-bound, never re-rolled)', [makeStagedTe({ stage: 'petrified', condition: 'petrified' })]],
        ['own te belonging to another target', [makeStagedTe({ target: 'Other' })]],
    ])('turn-END stays fully inert (%s): handled:false, zero writes/logs/clocks/prompts', async (_label, tes) => {
        seedRuntime(tes, ['restrained']);

        const result = await applyPetrifyingBiteTurnEnd(campaignName, TARGET);

        expect(result).toEqual({ handled: false });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();
    });
});

// MA-0904: the SAME ladder consumer adjudicates picker-armed te (Gorgon
// Petrifying Breath cone). Picker wiring is owned by
// SaveAttackAoeModal.staged-petrify.test.jsx; this leg pins the cited
// parametrisation — dc/label/petrifiedRounds are carried by the te, not
// hardcoded to the Cockatrice defaults.
describe('MA-0904 picker-armed Gorgon cone ladder (shared MA-0501 ladder)', () => {
    it('turn-END repeat save uses the te-carried DC 15 and Petrifying Breath copy: fail escalates to Petrified with a 14400-round clock', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: TARGET, type: 'npc', saveBonuses: { con: -19 } }],
        });
        seedRuntime([makeStagedTe({ dc: 15, label: 'Petrifying Breath', source: 'Gorgon 1' })], ['restrained']);
        vi.spyOn(Math, 'random').mockReturnValue(0.5); // nat 11 + (-19) = -8 < 15

        const result = await applyPetrifyingBiteTurnEnd(campaignName, TARGET);

        expect(result).toEqual({ handled: true, success: false, roll: 11, total: -8 });

        const saveLog = logEntries().find(e => e.rollType === 'save-petrifying-repeat');
        expect(saveLog).toMatchObject({ saveDc: 15, success: false });
        expect(saveLog.description).toContain('DC 15');
        expect(saveLog.description).toContain('Petrified for 24 hours');

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Gorgon 1',
            targetName: TARGET,
            effects: [{ type: 'condition', condition: 'petrified' }],
            campaignName,
            rounds: 14400,
        });

        const condLog = logEntries().find(e => e.type === 'condition' && e.action === 'applied');
        expect(condLog.condition).toBe('Petrified');
        expect(condLog.reason).toBe('Petrifying Breath (second failed save)');
    });
});
