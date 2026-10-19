// @maintained-by-ai: 2026-10-19
// MA-1170 ticket lane (consumeShieldAcBonus, attackPostProcessing.js): the monster
// reaction Shield stamp (effect 'shield', oneShot:true) is consumed by the ONE
// resolved attack it defends — hit OR miss both consume (MA-0341 parry lineage).
// PC Shield-spell buffs (shieldHandler, no oneShot flag) must NEVER be stripped
// here; they expire on their own turn-start clock. Falsified by a hit-only gate
// (miss leg fails), by dropping the oneShot guard (PC-shield leg strips), or by
// rewriting the consume log bytes.
// Family map: generic attack dispatch gates are owned by the seam
// useLoggedDiceRollAttack.potent-cantrip.test.js; CLA-230 oneShot advantage,
// MN-017 riposte and CLA-120 potent cantrip run their own lanes
// (attackPostProcessing.nextAttackAdvantage/.riposte/-cla120-potent-cantrip) —
// never re-litigated here. MA-0341 parry and MA-1463 guardian_protection consume
// branches are cited to the source comments, not re-covered in this lane.
// Old→new: t1 miss-strip+haste-kept+regex-log → armed it.each miss leg (exact
// write+log bytes); t2 hit-strip → armed it.each hit leg (haste kept, byte-distinguish);
// t3 PC-shelf-never + t4 no-shield → unarmed it.each (4 falsifiable store states).
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
import { addEntry } from '../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const ATTACKER = 'Bandit 1';
const ARCANIST = 'Mind Flayer Arcanist 1';

const monsterShield = { effect: 'shield', acBonus: 5, oneShot: true, source: 'Shield' };
const pcShieldSpell = { effect: 'shield', name: 'Shield', automation: { type: 'buff', effect: 'shield' } };

function makeContext() {
    return { rollType: 'attack', name: 'Scimitar', playerStats: { automation: { passives: [] } } };
}

function makeState(overrides = {}) {
    return {
        effectiveD20: 13,
        r1: 13,
        r2: 3,
        bonus: 5,
        effectiveD20Roll: 13,
        isCrit: false,
        targetAc: 21,
        effectiveAc: 21,
        homingStrikesUsed: false,
        homingStrikesBonus: 0,
        hit: false,
        isAutoMiss: false,
        ...overrides,
    };
}

function resolveAttack({ hit, effectiveD20 }) {
    return processAttackAfterResult({
        hit,
        isAutoMiss: false,
        targetName: ARCANIST,
        characterName: ATTACKER,
        campaignName: CAMPAIGN,
        context: makeContext(),
        combatSummary: null,
        characters: [],
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
        state: makeState({ hit, effectiveD20 }),
    });
}

function shieldWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[0] === ARCANIST && c[1] === 'activeBuffs');
}

function shieldConsumeLogs() {
    return addEntry.mock.calls.filter(c => c[1] && c[1].automationType === 'shield_consumed');
}

describe('MA-1170 consumeShieldAcBonus via processAttackAfterResult', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        ['a miss', false, 13],
        ['a hit', true, 16],
    ])('consumes the armed oneShot monster Shield stamp once on %s vs AC 21 — exact write payload and log bytes', async (_label, hit, effectiveD20) => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === ARCANIST && prop === 'activeBuffs') return [{ effect: 'haste' }, monsterShield];
            return null;
        });

        await resolveAttack({ hit, effectiveD20 });

        // Exactly one write, exact payload: stamp stripped, co-existing buffs kept byte-identical.
        expect(shieldWrites()).toEqual([[ARCANIST, 'activeBuffs', [{ effect: 'haste' }], CAMPAIGN]]);
        expect(shieldConsumeLogs()).toEqual([[CAMPAIGN, {
            type: 'automation',
            automationType: 'shield_consumed',
            characterName: ARCANIST,
            description: "Mind Flayer Arcanist 1's Shield +5 AC was consumed by Bandit 1's resolved attack — AC returns to base for further attacks.",
            targetName: ARCANIST,
            timestamp: expect.any(Number),
        }]]);
    });

    it.each([
        ['PC Shield-spell buff (no oneShot flag — its own turn-start clock owns expiry)', [pcShieldSpell]],
        ['an unrelated buff', [{ effect: 'bless' }]],
        ['an empty buff list', []],
        ['no stored buffs (null)', null],
    ])('writes nothing and logs no consume when the defended target holds only %s', async (_label, buffs) => {
        getRuntimeValue.mockImplementation((key, prop) =>
            (key === ARCANIST && prop === 'activeBuffs') ? buffs : null);

        await resolveAttack({ hit: true, effectiveD20: 16 });

        expect(shieldWrites()).toHaveLength(0);
        expect(shieldConsumeLogs()).toHaveLength(0);
    });
});
