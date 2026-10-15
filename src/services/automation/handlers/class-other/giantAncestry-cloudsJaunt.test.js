// @maintained-by-ai
// giantAncestry-cloudsJaunt — Cloud's Jaunt lane seam map (simplest trait:
// no attack gate, no damage, no targetEffects — pure uses-consumption).
//
// This file OWNS:
// - Both Cloud's Jaunt lanes as ONE pin table: handleCloudsJaunt
//   (giantAncestryDispatch.js, option-driven) and handleCloudsJauntDirect
//   (giantAncestryTraits.js, hardcoded). For the same uses state they emit
//   byte-identical results, so each case runs over both lanes — a lane that
//   drifts from the other fails here, naming itself.
// - exact-key uses pin: getRuntimeUsesKey("Cloud's Jaunt") ===
//   'cloudsJauntUses' (read AND the decrement write).
// - unwritten-key default: uses fall back to proficiency max
//   (`?? usesMax`, inline here — other traits ride resolveAncestryUses).
// - full-string popup composition: success (automationType 'teleport') and
//   the no-uses refusal, with a ZERO-side-effect guard (no write, no log).
// - exactly ONE ability_use log entry with the full teleport description
//   (contrast Hill's Tumble, which logs two).
//
// Owned ELSEWHERE (do not re-pin here):
// - giantAncestry-selection.test.js — handle()/handleDirectType() routing,
//   confirmGiantAncestry, option list, getters.
// - targetEffectDefinitions.test.js — registry internals (Cloud's Jaunt
//   creates no targetEffect at all).
//
// Deterministic: pure handler behaviour over an in-memory runtime-store
// mock, no timers, no DOM, no network. The OPTION row mirrors
// giantAncestryOptions.GIANT_OPTIONS so rule-data edits fail here on purpose.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn((_expr) => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((_expr) => 5),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 15, oldHp: 20, damageReduced: false })),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => ({ actualHeal: 12, oldHp: 10, newHp: 22 })),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(async () => null),
}));

import {
    handleCloudsJaunt,
    handleCloudsJauntDirect,
} from './giantAncestryHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

function makePlayerStats(overrides = {}) {
    return { name: 'TestHero', proficiency: 3, ...overrides };
}

// Mirrors the GIANT_OPTIONS "Cloud's Jaunt" row — edits to the rule data
// must fail this suite.
const CLOUDS_OPTION = { name: "Cloud's Jaunt", type: 'teleport', range: '30_ft' };

const RESOURCE_POOL_ACTION = {
    name: 'Giant Ancestry',
    description: 'Choose a giant ancestry benefit.',
    automation: { type: 'resource_pool', options: [], recharge: 'short_rest', casting_time: '1 action' },
};

const DIRECT_ACTION = {
    name: "Cloud's Jaunt",
    automation: {
        type: 'clouds_jaunt',
        distance: '30 ft',
        range: '30_ft',
        uses: 'proficiency_bonus',
        recharge: 'long_rest',
        casting_time: '1 bonus action',
    },
};

// Both lanes produce byte-identical popups/logs for the same uses state —
// pin them through one table so a lane drift names itself on failure.
const LANES = [
    ['handleCloudsJaunt (option lane)', RESOURCE_POOL_ACTION, (stats) => handleCloudsJaunt(RESOURCE_POOL_ACTION, stats, 'campaign', CLOUDS_OPTION)],
    ['handleCloudsJauntDirect (trait lane)', DIRECT_ACTION, (stats) => handleCloudsJauntDirect(DIRECT_ACTION, stats, 'campaign')],
];

describe("Cloud's Jaunt", () => {
    beforeEach(() => { vi.resetAllMocks(); });

    describe.each(LANES)('%s', (_label, action, invoke) => {
        it.each([3, 1])('consumes one of %i uses: exact-key decrement, full popup, one log', async (uses) => {
            getRuntimeValue.mockImplementation((_name, key) => (key === 'cloudsJauntUses' ? uses : null));

            const result = await invoke(makePlayerStats());

            expect(getRuntimeValue).toHaveBeenCalledWith('TestHero', 'cloudsJauntUses', 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'cloudsJauntUses', uses - 1, 'campaign');
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: "Cloud's Jaunt",
                    automationType: 'teleport',
                    description: "Cloud's Jaunt: Teleported up to 30 feet to an unoccupied space they can see.",
                    automation: action.automation,
                },
            });
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith('campaign', {
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: "Cloud's Jaunt",
                description: "TestHero used Cloud's Jaunt to teleport up to 30 feet to an unoccupied space they can see.",
            });
        });

        it('defaults uses to the proficiency max when the uses key is unwritten', async () => {
            // factory default getRuntimeValue → null: `?? usesMax` inline lane.
            const result = await invoke(makePlayerStats({ proficiency: 3 }));

            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'cloudsJauntUses', 2, 'campaign');
            expect(result.type).toBe('popup');
        });

        it('refuses at zero uses with the full Long-Rest message and ZERO side effects', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await invoke(makePlayerStats());

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: "Cloud's Jaunt",
                    description: "Cloud's Jaunt has no uses remaining. Uses will reset on the next Long Rest.",
                    automation: action.automation,
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });
});
