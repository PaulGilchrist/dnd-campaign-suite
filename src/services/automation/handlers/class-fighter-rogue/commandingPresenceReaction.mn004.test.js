// MN-004: Commanding Presence reaction executor rule deviations — the die was
// spent twice (once on the check, again here), disadvantage went down a phantom
// `activeConditions 'disadvantage'` channel no consumer folded into attacks,
// there was no forced WIS save vs the maneuver DC, and there was no once-per-
// round reaction latch. Pinned here: free reaction economy (zero die spend),
// real WIS save (DC = 8 + CHA + PB at prompt time, MN-020), te channel grant
// only on save fail + one expiration clock, round latch with refusal tokens.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCommandingPresenceReaction } from './executeActionManeuvers.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const MANEUVER = {
    name: 'Commanding Presence',
    actionType: 'skill_check',
    reactionSaveType: 'WIS',
    reactionEffect: 'disadvantage_next_attack',
    reactionDuration: 'until_end_of_next_turn',
    description: 'Maneuver description.',
};

vi.mock('./combatSuperiorityUtils.js', () => ({
    findManeuver: vi.fn(async () => MANEUVER),
    checkSuperiorityDice: vi.fn(() => ({ superiorityDice: [], hasDiceRemaining: false })),
    expendSuperiorityDie: vi.fn(async () => {}),
    rollManeuverDie: vi.fn(() => ({ dieValue: 5, dieDescription: 'Rolled d12 for 5.', expendedDie: 5 })),
    buildManeuverNotFoundPopup: vi.fn(name => ({ type: 'popup', payload: { type: 'automation_info', name, description: `${name} not found.` } })),
    buildNoDiceRemainingPopup: vi.fn(name => ({ type: 'popup', payload: { type: 'automation_info', name, description: `${name}: no dice.` } })),
    filterMeleeAttacks: vi.fn(a => a),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

const COMBAT_CREATURES = [
    { name: 'EvasiveFighter', type: 'player' },
    { name: 'Bandit', type: 'monster', currentHp: 11, maxHp: 11 },
    { name: 'FarGoblin', type: 'monster', currentHp: 7, maxHp: 7 },
];

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ creatures: COMBAT_CREATURES })),
}));

let inRange = true;
vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async (_source, target) => inRange && target !== 'FarGoblin'),
    isDistanceInRange: vi.fn(() => true),
    isWithinRangeOf: vi.fn(async () => true),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(r => (r === '30_ft' ? 30 : parseInt(String(r), 10) || 30)),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

let resolveSave;
let saveListenerCalls = [];
vi.mock('../../../automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((auto, playerStats) => 8 + playerStats.abilities.CHA + playerStats.proficiency),
    createSaveListener: vi.fn((campaignName, config) => {
        saveListenerCalls.push(config);
        return { promptId: 'p1', promise: new Promise(r => { resolveSave = r; }) };
    }),
}));

import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { createSaveListener } from '../../../automation/common/savePrompt.js';
import { expendSuperiorityDie, rollManeuverDie, checkSuperiorityDice } from './combatSuperiorityUtils.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';

const LATCH_KEY = '_Commanding_Presence_usedRound';
const PLAYER = 'EvasiveFighter';
const CAMPAIGN = 'test-campaign';

const store = {};

const STATS = { name: PLAYER, level: 18, proficiency: 6, abilities: { CHA: 5 }, rules: '2024' };
const AUTO = {
    type: 'combat_superiority_commanding_presence_reaction',
    name: 'Commanding Presence (Reaction)',
    description: 'desc',
    maneuverName: 'Commanding Presence',
    reactionSaveType: 'WIS',
    reactionEffect: 'disadvantage_next_attack',
    reactionDuration: 'until_end_of_next_turn',
    reactionRange: '30_ft',
    saveDc: 'ability',
    saveAbility: 'CHA',
    hasAutomation: true,
};
const ACTION = { automation: { ...AUTO } };

function seedStore(overrides = {}) {
    Object.keys(store).forEach(k => delete store[k]);
    Object.entries(overrides).forEach(([k, v]) => { store[k] = v; });
}

beforeEach(() => {
    vi.clearAllMocks();
    inRange = true;
    saveListenerCalls = [];
    seedStore();
    getRuntimeValue.mockImplementation((name, key) => store[`${name}.${key}`]);
    setRuntimeValue.mockImplementation(async (name, key, value) => { store[`${name}.${key}`] = value; });
    getCurrentCombatRound.mockReturnValue(1);
});

async function flush(ms = 0) {
    await new Promise(r => setTimeout(r, ms));
}

async function confirm(saveOk) {
    const promise = executeCommandingPresenceReaction(
        { automation: { ...AUTO, targetName: 'Bandit' } }, STATS, CAMPAIGN, 'Commanding Presence');
    await flush(5);
    resolveSave({ success: saveOk, promptId: 'p1' });
    return promise;
}

describe('MN-004 executeCommandingPresenceReaction', () => {
    it('no target opens the 30-ft target modal with the CHA-based DC', async () => {
        const result = await executeCommandingPresenceReaction(ACTION, STATS, CAMPAIGN, 'Commanding Presence');
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('commandingPresenceReaction');
        expect(result.payload.targets.map(t => t.name)).toEqual(['Bandit']);
        expect(result.payload.featureDescription).toContain('DC 19');
        expect(result.payload.featureDescription).toContain('WIS');
    });

    it('confirm offers a forced WIS save at DC 19 and stamps the round latch before the save resolves', async () => {
        const promise = executeCommandingPresenceReaction(
            { automation: { ...AUTO, targetName: 'Bandit' } }, STATS, CAMPAIGN, 'Commanding Presence');
        await flush(5);
        expect(saveListenerCalls).toHaveLength(1);
        expect(saveListenerCalls[0]).toMatchObject({ targetName: 'Bandit', saveType: 'WIS', saveDc: 19 });
        expect(store[`${PLAYER}.${LATCH_KEY}`]).toBe(1);
        resolveSave({ success: true, promptId: 'p1' });
        await promise;
    });

    it('failed save grants te disadvantage_next_attack + one expiration clock', async () => {
        const result = await confirm(false);
        const effects = store['campaign.targetEffects'];
        expect(effects).toHaveLength(1);
        expect(effects[0]).toMatchObject({
            effect: 'disadvantage_next_attack',
            target: 'Bandit',
            source: PLAYER,
            duration: 'until_end_of_next_turn',
        });
        expect(addExpiration).toHaveBeenCalledTimes(1);
        const clock = addExpiration.mock.calls[0][0];
        expect(clock).toMatchObject({ attackerName: PLAYER, targetName: 'Bandit', campaignName: CAMPAIGN, rounds: 2 });
        expect(clock.effects[0]).toMatchObject({ type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: PLAYER });
        expect(result.payload.description).toContain('Disadvantage');
    });

    it('successful save grants no te and no expiration clock', async () => {
        const result = await confirm(true);
        expect(store['campaign.targetEffects']).toBeUndefined();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(result.payload.description).toContain('succeeded');
    });

    it('reaction spends zero superiority dice — no roll, no expend, no dice gate', async () => {
        // checkSuperiorityDice mock reports hasDiceRemaining:false; the reaction must still fire.
        await confirm(false);
        expect(rollManeuverDie).not.toHaveBeenCalled();
        expect(expendSuperiorityDie).not.toHaveBeenCalled();
        expect(checkSuperiorityDice).not.toHaveBeenCalled();
    });

    it('second use in the same round refuses with refusal token, zero save prompt, zero stamp', async () => {
        seedStore({ [`${PLAYER}.${LATCH_KEY}`]: 1 });
        const result = await executeCommandingPresenceReaction(
            { automation: { ...AUTO, targetName: 'Bandit' } }, STATS, CAMPAIGN, 'Commanding Presence');
        expect(result.type).toBe('popup');
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith(PLAYER, LATCH_KEY, 1, CAMPAIGN);
        const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'commanding_presence_refused');
        expect(refusal).toBeDefined();
        expect(refusal.reason).toBe('already_used_this_round');
    });

    it('re-arms at round wrap — round 2 with latch at 1 fires again', async () => {
        getCurrentCombatRound.mockReturnValue(2);
        seedStore({ [`${PLAYER}.${LATCH_KEY}`]: 1 });
        const promise = executeCommandingPresenceReaction(
            { automation: { ...AUTO, targetName: 'Bandit' } }, STATS, CAMPAIGN, 'Commanding Presence');
        await flush(5);
        expect(saveListenerCalls).toHaveLength(1);
        resolveSave({ success: true, promptId: 'p1' });
        await promise;
        expect(store[`${PLAYER}.${LATCH_KEY}`]).toBe(2);
    });

    it('out-of-range target refuses with token, no prompt, no stamp', async () => {
        inRange = false;
        const result = await executeCommandingPresenceReaction(
            { automation: { ...AUTO, targetName: 'Bandit' } }, STATS, CAMPAIGN, 'Commanding Presence');
        expect(result.type).toBe('popup');
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith(PLAYER, LATCH_KEY, 1, CAMPAIGN);
        const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'commanding_presence_refused');
        expect(refusal.reason).toBe('no_target_in_range');
    });

    it('modal skip declines without spending or stamping', async () => {
        const result = await executeCommandingPresenceReaction(ACTION, STATS, CAMPAIGN, 'Commanding Presence');
        await result.payload.onSkip();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'commanding_presence_refused');
        expect(refusal.reason).toBe('declined');
    });

    it('logs the reaction use with the resolved DC on fire', async () => {
        await confirm(false);
        const use = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
        expect(use).toBeDefined();
        expect(use.description).toContain('DC 19');
        expect(use.description).toContain('WIS');
    });
});
