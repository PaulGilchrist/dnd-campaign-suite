// @maintained-by-ai
// steps/ lane: owns attackRollBonuses.js `applyBrutalStrikeBonuses` — the APPLICATION
// face of the REAL selector: the chosen rider's dice are rolled and appended to the
// attack-roll acc, chosen options are granted to campaign targetEffects, logged, and
// the _brutalStrikeActive/_brutalStrikeEffects sticky is consumed. Selection ORDER is
// CANON in brutalStrikeSelection.test.js (#986) — never re-derived here; the lv9/
// lv13/lv17 trio only survives as distinct-byte input proving the selected rider's
// dice bytes reach the formula (2d10 is distinguishable; two 1d10 riders are not).
//
// steps-family split: selection-core CANON #938 (fixed queues in literal bytes out),
// attackPostProcessing #931-#934, handlePlainDamage #940-#942, handler-family #941
// (this lane is a pipeline step, not a handler). cla048-celestial-rider sibling queued NEXT.
//
// Applied recs: #986 folded old-t3 ordering dupe into t1 keeping dice-application at
// ITS turn; improvedBrutalStrike staggering leg kept as-is. Full-object te pins (#1007);
// collaborator call-bytes exact once (#786/#744); hand-derived exact bytes, never a
// loop-oracle (#829/#815/#710); RNG stubbed exact never range-only (#973); guards
// folded — inactive guard + weak dice legs live in attackRollDamageSteps-automationBonuses.test.js
// on the same step (#936, no duplicate here); honest titles (#910).
//
// old->new map: old t1 (bind lv13 + Sundering Blow) + old t3 (prefer lv17 2d10) → t1;
// old t2 (Staggering Blow) → t2 kept as-is.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAutomationBonusesStep } from './attackRollBonuses.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 6, rolls: [6], modifier: 0 })),
}));
vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => null),
}));
vi.mock('../../automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));
vi.mock('../automation/automationExpressions.js', () => ({
    resolveDiceExpression: vi.fn((expr) => expr),
}));
vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve({})),
}));

import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const lv9Rider = {
    type: 'attack_rider',
    name: 'Brutal Strike',
    featureLevel: 9,
    damageExpression: '1d10',
    damageType: 'same_as_weapon',
    trigger: 'strength_attack_hit_after_reckless',
    options: [
        { name: 'Forceful Blow', effect: 'push_15ft' },
        { name: 'Hamstring Blow', effect: 'speed_reduction' },
    ],
};

const lv13Rider = {
    type: 'attack_rider',
    name: 'Improved Brutal Strike',
    featureLevel: 13,
    damageExpression: '1d10',
    damageType: 'same_as_weapon',
    trigger: 'strength_attack_hit_after_reckless',
    options: [
        { name: 'Forceful Blow', effect: 'push_15ft' },
        { name: 'Hamstring Blow', effect: 'speed_reduction' },
        { name: 'Staggering Blow', effect: 'disadvantage_on_next_save', noOpportunityAttacks: true },
        { name: 'Sundering Blow', effect: 'next_attack_bonus', value: 5 },
    ],
};

// Dice-count differs (2d10) so the SELECTED rider is distinguishable in the
// formula bytes — this step's application contract, not the sort table (#986).
const lv17Rider = {
    ...lv13Rider,
    name: 'Brutal Strike (Level 17)',
    featureLevel: 17,
    damageExpression: '2d10',
    maxEffects: 2,
};

function makeCtx() {
    return {
        campaignName: 'test-campaign',
        playerStats: {
            name: 'DraconicDragon',
            level: 13,
            automation: { actions: [], passives: [lv9Rider, lv13Rider] },
        },
        targetName: 'Ogre',
        formula: '1d8+5',
        total: 9,
        rolls: [8],
    };
}

describe('CLA-182: attackRollBonuses hit-time brutal strike application (pipeline step)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applies the selected lv17 rider: rolls 2d10 into the attack roll, grants both chosen options, logs, and consumes the sticky', async () => {
        getRuntimeValue.mockImplementation((key, rk) => {
            if (rk === '_brutalStrikeActive') return true;
            if (rk === '_brutalStrikeEffects') return ['Sundering Blow', 'Forceful Blow'];
            if (rk === 'targetEffects') return [];
            return null;
        });

        const ctx = makeCtx();
        ctx.playerStats.automation.passives = [lv9Rider, lv13Rider, lv17Rider];
        const step = buildAutomationBonusesStep();
        const result = await step.handler(ctx);

        // Selected rider (dice-count first per #986 canon) — its dice rolled once, exact bytes.
        expect(rollExpression).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledWith('2d10');
        // Hand-derived: '1d8+5' + ' + 2d10 [same_as_weapon]', stubbed roll 6 → total 15.
        expect(result.data).toEqual({
            formula: '1d8+5 + 2d10 [same_as_weapon]',
            total: 15,
            rolls: [8, 6],
        });

        // Exactly ONE campaign targetEffects write carrying both full-object grants
        // (next_attack_bonus + push, both clock:false — no expiration scheduled).
        const sundering = {
            target: 'Ogre', source: 'DraconicDragon', option: 'Sundering Blow',
            effect: 'next_attack_bonus', value: 5, noOpportunityAttacks: false,
            duration: 'until_start_of_next_turn',
        };
        const push = {
            target: 'Ogre', source: 'DraconicDragon', option: 'Forceful Blow',
            effect: 'push', value: 15, duration: 'instant',
        };
        expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects')).toEqual([
            ['campaign', 'targetEffects', [sundering, push], 'test-campaign'],
        ]);

        // Automation logs each option grant plus the rider use — exact bytes, once each.
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use', characterName: 'DraconicDragon', abilityName: 'Sundering Blow',
            description: 'Sundering Blow applied to Ogre', targetName: 'Ogre',
        });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use', characterName: 'DraconicDragon', abilityName: 'Forceful Blow',
            description: 'Forceful Blow: Ogre pushed 15 ft straight away (token position GM-enforced)', targetName: 'Ogre',
        });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use', characterName: 'DraconicDragon', abilityName: 'Brutal Strike (Level 17)',
            description: 'DraconicDragon used Brutal Strike (Level 17) on Ogre', targetName: 'Ogre',
        });

        // One-shot consumption: next strength attack is not retroactively buffed.
        expect(setRuntimeValue).toHaveBeenCalledWith('DraconicDragon', '_brutalStrikeActive', null, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('DraconicDragon', '_brutalStrikeEffects', null, 'test-campaign');
    });

    it('applies Staggering Blow targetEffect from the improved rider options', async () => {
        getRuntimeValue.mockImplementation((key, rk) => {
            if (rk === '_brutalStrikeActive') return true;
            if (rk === '_brutalStrikeEffects') return ['Staggering Blow'];
            if (rk === 'targetEffects') return [];
            return null;
        });

        const step = buildAutomationBonusesStep();
        await step.handler(makeCtx());

        const stored = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
        expect(stored[2]).toEqual([expect.objectContaining({
            target: 'Ogre',
            option: 'Staggering Blow',
            effect: 'disadvantage_on_next_save',
            noOpportunityAttacks: true,
        })]);
    });
});
