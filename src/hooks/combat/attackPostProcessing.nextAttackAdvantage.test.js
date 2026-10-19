// @maintained-by-ai: 2026-10-19
// CLA-230 lane (consumeOneShotAdvantage, attackPostProcessing.js:280-291): a
// one-shot next_attack_advantage te (Moonlight Step / Shadow Step / Steady Aim /
// Blink) is consumed by the ONE attack roll it benefits — hit OR miss both
// consume; an auto-miss rolls no d20 so the advantage survives; an attacker with
// nothing armed triggers zero writes. One write, exact cleared payload: everything
// except the attacker's NON-vex next_attack_advantage tes survives untouched —
// vex tes (vexTarget) keep their own hit-vs-target lifecycle. Falsified by a
// hit-only gate (miss leg fails), by dropping the finalAutoMiss guard (auto-miss
// leg strips), by dropping the empty-list guard (#921 same-shape zero-write
// control fails), by a first-only removal (stacked one-shot leg keeps a te), and
// by rewriting the exact cleared payload. The consume is silent BY DESIGN —
// consumeOneShotAdvantage emits no log bytes; grant-side logging runs in the
// owner lanes below. Turn-based mandate: expiry is turn/anchor based, no clock.
// Family map: generic attack dispatch gates are owned by the seam
// useLoggedDiceRollAttack.potent-cantrip.test.js; MA-1170 shield consume
// (attackPostProcessing.ma1170-shield-consume.test.js), MN-017 riposte
// (.riposte) and CLA-120 potent cantrip (-cla120-potent-cantrip) run their own
// lanes — never re-litigated here. Granting is owned by tempTeleportHandler.test.js
// and steadyAimHandler.test.js; miss-trigger grants (Vex passives) by
// useLoggedDiceRollAttack.studied-attacks.test.js; roll-side advantage application
// and WM-008 vex consume by contextBuilder-sync tests — cited, not duplicated.
// MA-1463 adjudication: this lane carries NO guardian_protection face — that is
// an activeBuffs stamp consumed by consumeGuardianProtectionAcBonus (source
// comment :47-53), still lane-less; cited here, not claimed.
// Old→new: t1 hit-strip fuzzy find → armed it.each hit leg (exact ONE-write
// payload, vex-other-target + other-creature kept); t2 miss-strip → armed it.each
// miss leg (same exact bytes); t3 auto-miss survive + t5 no-te zero-write →
// zero-write it.each (toHaveLength(0) + store unchanged, both guards falsifiable);
// t4 stack-consumed-as-one → folded into the armed fixture (2× one-shot stack,
// single exact payload).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(async () => null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => ({ finalDamage: 0, newHp: 0 })),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    hasPotentCantrip: vi.fn(() => false),
    applyMinDamageAdjustment: vi.fn((t) => t),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { processAttackAfterResult } from './attackPostProcessing.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const ATTACKER = 'Wild_Sage_Druid';
const TARGET = 'Zombie 1';
const VEX_TARGET = 'Goblin 2';

// Grant shapes mirror steadyAimHandler/tempTeleportHandler stamped bytes.
function oneShotTe(source) {
    return { target: ATTACKER, source, effect: 'next_attack_advantage', value: null, duration: 'until_end_of_turn' };
}
function vexTe() {
    return { target: ATTACKER, source: 'Vex', effect: 'next_attack_advantage', vexTarget: VEX_TARGET, duration: 'until_start_of_next_turn' };
}
function otherCreatureTe() {
    return { target: 'OtherPC', source: 'Moonlight Step', effect: 'next_attack_advantage', value: null, duration: 'until_end_of_turn' };
}

// Faithful in-memory campaign targetEffects store: reads reflect the last write,
// so multi-leg post-processing composes exactly as in production.
function mountTargetEffects(initial) {
    let store = [...initial];
    getRuntimeValue.mockImplementation((key, prop) =>
        (key === 'campaign' && prop === 'targetEffects') ? store : null);
    setRuntimeValue.mockImplementation((key, prop, value) => {
        if (key === 'campaign' && prop === 'targetEffects') store = value;
    });
    return () => store;
}

function runAttack({ hit, isAutoMiss }) {
    const d20 = isAutoMiss ? null : (hit ? 13 : 2);
    return processAttackAfterResult({
        hit,
        isAutoMiss,
        targetName: TARGET,
        characterName: ATTACKER,
        campaignName: CAMPAIGN,
        context: { rollType: 'attack', name: 'Unarmed Strike', playerStats: { automation: { passives: [] } } },
        combatSummary: null,
        characters: [],
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
        state: {
            effectiveD20: d20,
            r1: d20,
            r2: hit ? 3 : null,
            bonus: 5,
            effectiveD20Roll: d20,
            isCrit: false,
            targetAc: 8,
            effectiveAc: 8,
            homingStrikesUsed: false,
            homingStrikesBonus: 0,
            hit,
            isAutoMiss,
        },
    });
}

function campaignTeWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects');
}

describe('processAttackAfterResult — CLA-230 next_attack_advantage consumption', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { name: 'hit', hit: true, isAutoMiss: false },
        { name: 'miss', hit: false, isAutoMiss: false },
    ])('resolved $name attack consumes every stacked one-shot te with ONE exact cleared write', async ({ hit, isAutoMiss }) => {
        const stacked = [oneShotTe('Moonlight Step'), oneShotTe('Shadow Step')];
        const kept = [vexTe(), otherCreatureTe()];
        const read = mountTargetEffects([...stacked, ...kept]);

        await runAttack({ hit, isAutoMiss });

        const writes = campaignTeWrites();
        expect(writes).toHaveLength(1);
        expect(writes[0][2]).toEqual(kept);
        expect(writes[0][3]).toBe(CAMPAIGN);
        expect(read()).toEqual(kept);
    });

    it.each([
        { name: 'auto-miss (no d20 rolled)', hit: false, isAutoMiss: true, arm: true },
        { name: 'attacker holds no one-shot te', hit: true, isAutoMiss: false, arm: false },
    ])('leaves targetEffects untouched — ZERO writes on $name', async ({ hit, isAutoMiss, arm }) => {
        const tes = arm
            ? [oneShotTe('Moonlight Step'), vexTe(), otherCreatureTe()]
            : [vexTe(), otherCreatureTe()];
        const read = mountTargetEffects(tes);

        await runAttack({ hit, isAutoMiss });

        expect(campaignTeWrites()).toHaveLength(0);
        expect(read()).toEqual(tes);
    });
});
