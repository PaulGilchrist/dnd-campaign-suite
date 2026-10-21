// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processManeuvers } from './maneuvers.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import maneuversData from '../../../../public/data/2024/maneuvers.json';

// Serve the real disk-backed 2024 maneuvers at the network boundary so the
// real loadManeuvers and renameMagicInitiateFeatures modules run unmocked.
const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => maneuversData,
}));
vi.stubGlobal('fetch', fetchMock);

const CHARACTER = 'TestFighter';
const CAMPAIGN = 'test-campaign';
const SELECTION_KEY = 'BattleMasterManeuvers_selection';

function makeFixtures() {
    const playerStats = {
        name: CHARACTER,
        rules: '2024',
        bonusActions: [],
        reactions: [],
        automation: { specialActions: [] },
    };
    const playerSummary = { campaignName: CAMPAIGN };
    const allFeatures = [];
    const collectAutomationFromFeatures = vi.fn(() => ({ specialActions: [] }));
    const mergeAutomationSpecialActions = vi.fn();
    return { playerStats, playerSummary, allFeatures, collectAutomationFromFeatures, mergeAutomationSpecialActions };
}

async function runWith(f, selection) {
    setRuntimeValue(CHARACTER, SELECTION_KEY, selection, CAMPAIGN);
    await processManeuvers(f.playerStats, f.playerSummary, f.allFeatures, f.collectAutomationFromFeatures, f.mergeAutomationSpecialActions);
}

describe('processManeuvers', () => {
    beforeEach(() => {
        fetchMock.mockClear();
        setRuntimeValue(CHARACTER, SELECTION_KEY, [], CAMPAIGN);
    });

    it('does nothing when no maneuvers are selected', async () => {
        const f = makeFixtures();
        await runWith(f, []);

        expect(f.allFeatures).toHaveLength(0);
        expect(f.collectAutomationFromFeatures).not.toHaveBeenCalled();
        expect(f.mergeAutomationSpecialActions).not.toHaveBeenCalled();
    });

    // Truth table: one row per actionType branch in maneuvers.js — selected
    // maneuver must land in the right container with the right automation type.
    // [selection, actionType, automation.type, container (null = allFeatures only), effect, trigger, range]
    it.each([
        ['Evasive Footwork', 'bonus_action', 'combat_superiority_bonus_action', 'bonusActions', 'ac_bonus_disengage', null, null],
        ['Riposte', 'reaction', 'combat_superiority_reaction', 'reactions', 'melee_attack_reaction', 'melee_attack_miss', null],
        ['Commander\'s Strike', 'grant_attack', 'combat_superiority_grant_attack', null, null, 'replace_attack', '30_ft'],
        ['Bait and Switch', 'movement', 'combat_superiority_movement', null, 'ac_bonus_and_swap', null, '5_ft'],
        ['Ambush', 'skill_check', 'combat_superiority_skill_check', null, null, null, null],
    ])('%s → %s', async (name, actionType, type, container, effect, trigger, range) => {
        const f = makeFixtures();
        await runWith(f, [name]);

        expect(f.allFeatures).toHaveLength(1);
        const feature = f.allFeatures[0];
        expect(feature.hasAutomation).toBe(true);
        expect(feature.automation).toMatchObject({ type, maneuverName: name, actionType, hasAutomation: true });
        expect(feature.automation.dieExpression).toBe('superiority_die');
        if (effect !== null) expect(feature.automation.effect).toBe(effect);
        if (trigger !== null) expect(feature.automation.trigger).toBe(trigger);
        if (range !== null) expect(feature.automation.range).toBe(range);
        if (actionType === 'grant_attack') expect(feature.automation.oncePerTurn).toBe(true);

        if (container) {
            expect(f.playerStats[container]).toEqual([feature]);
        } else {
            expect(f.playerStats.bonusActions).toHaveLength(0);
            expect(f.playerStats.reactions).toHaveLength(0);
        }
        expect(f.collectAutomationFromFeatures).toHaveBeenCalledWith(f.allFeatures, f.playerStats);
        expect(f.mergeAutomationSpecialActions).toHaveBeenCalledWith(f.playerStats);
    });

    it('skill_check maneuver with reactionSaveType adds a companion (Reaction) feature', async () => {
        const f = makeFixtures();
        await runWith(f, ['Commanding Presence']);

        const names = f.allFeatures.map(a => a.name);
        expect(names).toEqual(['Commanding Presence', 'Commanding Presence (Reaction)']);

        const companion = f.allFeatures[1].automation;
        expect(companion).toMatchObject({
            type: 'combat_superiority_commanding_presence_reaction',
            maneuverName: 'Commanding Presence',
            reactionSaveType: 'WIS',
            reactionEffect: 'disadvantage_next_attack',
            reactionDuration: 'until_end_of_next_turn',
            reactionRange: '30_ft',
            saveDc: 'ability',
            saveAbility: 'CHA',
            hasAutomation: true,
        });
    });

    it('attack_rider maneuvers are not surfaced here (handled by the attack pipeline)', async () => {
        const f = makeFixtures();
        await runWith(f, ['Disarming Attack', 'Menacing Attack']);

        expect(f.allFeatures).toHaveLength(0);
        expect(f.playerStats.bonusActions).toHaveLength(0);
        expect(f.playerStats.reactions).toHaveLength(0);
        expect(f.collectAutomationFromFeatures).not.toHaveBeenCalled();
    });
});
