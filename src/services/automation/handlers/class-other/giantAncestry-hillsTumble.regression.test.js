// Regression test for CLA-169: Hill's Tumble – Goliath (Hill Giant).
//
// Attempt-2 report claimed the feature never offered/fired after a melee hit.
// Live E2E (test-campaign, ElderPaladin lvl 20, Longsword +11 vs Bandit 1):
// the Actions-panel "Hill's Tumble:" b.clickable DOES render and dispatch
// (uses 6→5, te stamped, popup shown) once race.subrace is the canonical
// "Hill Giant" — the never-offers symptom was subrace rig drift (§CLA-141).
// What was genuinely broken (fires-on-miss family + duration axis):
//   - handler had NO hit/damage gate (spent a use and stamped te on a MISS,
//     no hills_tumble_refused log) — now shares attackerRollGate (CLA-141),
//   - te carried NO duration and the clock was attacker-anchored
//     (expireOnCreatureName=attacker drops the te off the target axis) —
//     now duration until_end_of_next_turn + ONE target-anchored rounds:2
//     clock (MA-0038/MA-0073 verified shape),
//   - getRuntimeValue('campaign','targetEffects') read without campaignName.
// These tests lock the fixed contract, mirroring the firesBurn lane.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => {}),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

import { handleHillsTumble, handleHillsTumbleDirect } from './giantAncestryHandler.js';
import { getRuntimeUsesKey } from './giantAncestryOptions.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { elementalHandlers } from '../../../combat/automation/automationInfoBuilder/elemental-handlers.js';
import { routeAutomation } from '../../../combat/automation/automationRouter.js';

const PLAYER = 'GoliathHillGiant';
const TARGET = 'Bandit 1';
const CAMPAIGN = 'test-campaign';

function makePlayerStats() {
    return { name: PLAYER, proficiency: 6 };
}

// Exact automation shape authored in public/data/2024/races.json Hill Giant trait.
function makeDirectAction() {
    return {
        name: "Hill's Tumble",
        automation: {
            type: 'hills_tumble',
            trigger: 'melee_hit',
            effect: 'disadvantage_next_attack',
            uses: 'proficiency_bonus',
            recharge: 'long_rest',
            casting_time: '1 action',
        },
    };
}

function seedRuntime({ lastAttack, uses }) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === PLAYER && key === 'hillsTumbleUses') return uses;
        if (name === 'campaign' && key === 'lastAttack') return lastAttack;
        return null;
    });
}

function hitAttack(extra = {}) {
    return {
        attackerName: PLAYER,
        targetName: TARGET,
        d20: 6,
        bonus: 11,
        total: 17,
        targetAc: 12,
        hit: true,
        rollType: 'attack',
        weaponType: 'melee',
        primaryDamage: 19,
        actualDamage: 19,
        ...extra,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('CLA-169 Hill\'s Tumble regression (verified Fire\'s Burn lane)', () => {
    it('uses runtime key hillsTumbleUses', () => {
        expect(getRuntimeUsesKey("Hill's Tumble")).toBe('hillsTumbleUses');
    });

    it('chip lane is reachable: builds info and routes hills_tumble (1 action) into actions', () => {
        const feature = makeDirectAction();
        const info = elementalHandlers.hills_tumble(feature, makePlayerStats());
        expect(info).toMatchObject({ type: 'hills_tumble', trigger: 'melee_hit', effect: 'disadvantage_next_attack', casting_time: '1 action' });

        const result = { actions: [], bonusActions: [], reactions: [], passives: [], specialActions: [] };
        routeAutomation(info, feature.automation, result);
        expect(result.actions).toHaveLength(1);
        expect(result.passives).toHaveLength(0);
    });

    it('HIT + damage: decrements uses, stamps te with until_end_of_next_turn, arms ONE rounds:2 target-anchored clock, logs', async () => {
        seedRuntime({ uses: 6, lastAttack: hitAttack() });

        const result = await handleHillsTumbleDirect(makeDirectAction(), makePlayerStats(), CAMPAIGN);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain(TARGET);
        expect(result.payload.description).toContain('Disadvantage');
        expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'hillsTumbleUses', 5, CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
            expect.objectContaining({
                target: TARGET,
                effect: 'disadvantage_next_attack',
                source: PLAYER,
                duration: 'until_end_of_next_turn',
            }),
        ]), CAMPAIGN, true);
        // One clock, target-anchored (rounds:2), NO attacker anchor (CLA-148 axis).
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: PLAYER,
            targetName: TARGET,
            campaignName: CAMPAIGN,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: PLAYER, target: TARGET }],
        });
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'ability_use',
            characterName: PLAYER,
            abilityName: "Hill's Tumble",
        }));
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'condition',
            targetName: TARGET,
            source: "Hill's Tumble",
        }));
    });

    it('MISS refuses with zero spend and logs hills_tumble_refused (fires-on-miss family)', async () => {
        seedRuntime({ uses: 6, lastAttack: hitAttack({ hit: false, primaryDamage: 0, actualDamage: 0, targetAc: 22 }) });

        const result = await handleHillsTumbleDirect(makeDirectAction(), makePlayerStats(), CAMPAIGN);

        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('missed');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'automation',
            characterName: PLAYER,
            automationType: 'hills_tumble_refused',
            name: "Hill's Tumble",
        }));
    });

    it('hit that dealt no damage refuses with zero spend and logs hills_tumble_refused', async () => {
        seedRuntime({ uses: 6, lastAttack: hitAttack({ primaryDamage: 0, actualDamage: 0 }) });

        const result = await handleHillsTumbleDirect(makeDirectAction(), makePlayerStats(), CAMPAIGN);

        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('deal damage');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            automationType: 'hills_tumble_refused',
        }));
    });

    it('0 uses exhaustion refusal: popup only, zero spend, no gate pass', async () => {
        seedRuntime({ uses: 0, lastAttack: hitAttack() });

        const result = await handleHillsTumbleDirect(makeDirectAction(), makePlayerStats(), CAMPAIGN);

        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('no uses remaining');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('LR re-arm semantics: null uses key falls back to proficiency max', async () => {
        // restRules-longRest nulls hillsTumbleUses; the handler must treat
        // null as full PB charges and spend one.
        seedRuntime({ uses: null, lastAttack: hitAttack() });

        const result = await handleHillsTumbleDirect(makeDirectAction(), makePlayerStats(), CAMPAIGN);

        expect(result.type).toBe('popup');
        expect(result.payload.automationType).toBe('hills_tumble');
        expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'hillsTumbleUses', 5, CAMPAIGN);
    });

    it('dispatch variant shares the gate: MISS refuses zero-spend, HIT spends', async () => {
        const option = { name: "Hill's Tumble", type: 'auto_effect', trigger: 'melee_hit', effect: 'disadvantage_next_attack' };
        seedRuntime({ uses: 6, lastAttack: hitAttack({ hit: false, actualDamage: 0 }) });
        const miss = await handleHillsTumble(makeDirectAction(), makePlayerStats(), CAMPAIGN, option);
        expect(miss.payload.description).toContain('missed');
        expect(setRuntimeValue).not.toHaveBeenCalled();

        vi.clearAllMocks();
        seedRuntime({ uses: 6, lastAttack: hitAttack() });
        const hit = await handleHillsTumble(makeDirectAction(), makePlayerStats(), CAMPAIGN, option);
        expect(hit.payload.automationType).toBe('hills_tumble');
        expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'hillsTumbleUses', 5, CAMPAIGN);
    });

    it('long rest lane re-arms hillsTumbleUses (restRules key intact)', () => {
        const src = readFileSync(resolve('src/services/rules/effects/restRules-longRest.js'), 'utf8');
        expect(src).toMatch(/\['hillsTumbleUses', null\]/);
    });
});
