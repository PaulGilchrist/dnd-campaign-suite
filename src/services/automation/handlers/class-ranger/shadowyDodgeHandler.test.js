// @maintained-by-ai 2026-11-26
// Sole owner of shadowyDodgeHandler.handle() runtime composition (Gloom Stalker reaction
// dodge/teleport when hit): lastAttack lookup, reaction-economy gates (self-attack, range
// flow through the real rangeToFeet, attack-instance latch _ShadowyDodge_appliedAttack,
// round latch _ShadowyDodge_usedRound — CLA-310), sequential latch-stamp commit censuses,
// exact seed pins through the canonical rollD20 lane (fix#169 recipe), full-string
// popup/log composition, rollback trigger + negation-suffix logic, and zero-spend write
// censuses on every refusal path. FROZEN Date.now keeps the log timestamp pin exact.
// Turn-based only — latches advance at initiative seams, never on a clock.
// Lanes owned elsewhere: shadowy_dodge type registration
// (automationCollector.types.test.js), infoPopup shape internals (infoPopup.test.js),
// targetEffect registry internals (targetEffectDefinitions.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './shadowyDodgeHandler.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as logService from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import * as diceRoller from '../../../dice/diceRoller.js';

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
    rollbackDamage: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(),
}));

// Canonical dice lane mock (fix#169 recipe): the disadvantage second d20 rolls
// through diceRoller.rollD20, never raw Math.random.
vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
}));

const APPLIED_ATTACK_KEY = '_ShadowyDodge_appliedAttack';
const USED_ROUND_KEY = '_ShadowyDodge_usedRound';
const CAMPAIGN = 'test-campaign';
const PLAYER = 'Test Rogue';

// Frozen wall clock so the addEntry timestamp pin is exact (no expect.any slack).
const FROZEN_NOW = 1730000000000;

const TELEPORT_TEXT = '<br/>Teleported 30 feet to an unoccupied space you can see.';
const BASE_LOG = 'Test Rogue used Shadowy Dodge (Reaction) on Goblin, imposing Disadvantage and teleporting 30 feet.';

const makePlayerStats = (overrides = {}) => ({
    name: PLAYER,
    ...overrides,
});

const makeAction = (overrides = {}) => ({
    name: 'Shadowy Dodge',
    automation: {
        type: 'shadowy_dodge',
        trigger: 'after_attack_roll_against_you',
        range: '30_ft',
        casting_time: '1 reaction',
        ...overrides.automation,
    },
    ...overrides,
});

function makeAttack(overrides = {}) {
    return {
        attackEvent: { timestamp: 5000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14, ...overrides.attackEvent },
        attackerName: 'Goblin',
        targetName: PLAYER,
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['slashing'],
        ...overrides.result,
    };
}

describe('shadowyDodgeHandler', () => {
    beforeEach(() => {
        // Bare vi.fn factories + full cold re-seed: any persistent reject
        // survivor from a prior test is re-installed to its happy-path here.
        vi.clearAllMocks();
        damageRollback.findLastAttack.mockResolvedValue(null);
        damageRollback.rollbackDamage.mockResolvedValue(0);
        logService.addEntry.mockResolvedValue(undefined);
        getRuntimeValue.mockReturnValue(undefined);
        getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
        isWithinRange.mockResolvedValue(true);
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    });

    it('trip wire: hit→miss rolls the second d20, stamps both latches in order, refunds damage, logs once, returns the full popup', async () => {
        diceRoller.rollD20.mockReturnValue(2); // second d20 = 2 → final 2+7=9 < 14 → miss
        damageRollback.findLastAttack.mockResolvedValue(
            makeAttack({ attackEvent: { timestamp: 7000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }),
        );
        damageRollback.rollbackDamage.mockResolvedValue(10);
        const action = makeAction();

        const result = await handle(action, makePlayerStats(), CAMPAIGN, null);

        expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Shadowy Dodge',
                description:
                    '<b>Shadowy Dodge</b><br/>Attacker: Goblin<br/>' +
                    'Original roll: d20(15) + 7 = 22 vs AC 14 → <b>HIT</b><br/>' +
                    'Disadvantage (second d20: 2): d20(2) + 7 = 9 vs AC 14 → <b>MISS</b><br/>' +
                    '<br/><i>The attack now misses due to Disadvantage!</i><br/>' +
                    'Damage negated: 10 HP restored.' + TELEPORT_TEXT,
                automation: action.automation,
            },
        });
        expect(damageRollback.rollbackDamage).toHaveBeenCalledWith('Goblin', PLAYER, CAMPAIGN, 'Shadowy Dodge');
        // Exact ordered write census: attack-instance stamp before round stamp
        // (sequential awaits — concurrent full-store POSTs race, pitfall 21).
        expect(setRuntimeValue.mock.calls).toEqual([
            [PLAYER, APPLIED_ATTACK_KEY, '7000', CAMPAIGN],
            [PLAYER, USED_ROUND_KEY, 1, CAMPAIGN],
        ]);
        expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, {
            type: 'ability_use',
            characterName: PLAYER,
            abilityName: 'Shadowy Dodge',
            description: `${BASE_LOG} 10 damage was negated.`,
            targetName: 'Goblin',
            timestamp: FROZEN_NOW,
        }]]);
    });

    it.each([
        [
            'no recent attack',
            () => damageRollback.findLastAttack.mockResolvedValue(null),
            makeAction().automation,
            null,
            'No recent attack roll against you found. Shadowy Dodge can only be used shortly after an attack roll.',
        ],
        [
            'last attack targeted another creature',
            () => damageRollback.findLastAttack.mockResolvedValue(makeAttack({ result: { targetName: 'HexWarlock' } })),
            makeAction().automation,
            null,
            'No recent attack roll against you found. Shadowy Dodge can only be used shortly after an attack roll.',
        ],
        [
            'the attacker is the holder (stale self-overwritten lastAttack)',
            () => damageRollback.findLastAttack.mockResolvedValue(makeAttack({ result: { attackerName: PLAYER } })),
            makeAction().automation,
            null,
            'Shadowy Dodge: you cannot attack yourself — the triggering attack must come from another creature.',
        ],
        [
            'the attacker is beyond 30 feet on an active map',
            () => {
                damageRollback.findLastAttack.mockResolvedValue(makeAttack());
                isWithinRange.mockResolvedValue(false);
            },
            makeAction().automation,
            30,
            'Goblin is not within 30 feet of you. Shadowy Dodge requires the attacker to be in range.',
        ],
        [
            'range flows from automation.range',
            () => {
                damageRollback.findLastAttack.mockResolvedValue(makeAttack());
                isWithinRange.mockResolvedValue(false);
            },
            makeAction({ automation: { range: '60_ft' } }).automation,
            60,
            'Goblin is not within 60 feet of you. Shadowy Dodge requires the attacker to be in range.',
        ],
        [
            'missing automation.range falls back to 30 feet',
            () => {
                damageRollback.findLastAttack.mockResolvedValue(makeAttack());
                isWithinRange.mockResolvedValue(false);
            },
            { type: 'shadowy_dodge', trigger: 'after_attack_roll_against_you' },
            30,
            'Goblin is not within 30 feet of you. Shadowy Dodge requires the attacker to be in range.',
        ],
        [
            'the same attack instance was already dodged (attack-instance latch)',
            () => {
                damageRollback.findLastAttack.mockResolvedValue(
                    makeAttack({ attackEvent: { timestamp: 7000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }),
                );
                getRuntimeValue.mockImplementation((_name, key) =>
                    key === APPLIED_ATTACK_KEY ? '7000' : undefined);
            },
            makeAction().automation,
            30, // in-gate refusals clear self + range checks first
            'Reaction already used — you have already dodged this attack roll with Shadowy Dodge. Your Reaction is spent until your next turn.',
        ],
        [
            'the same stale attack instance stays refused in a later round (instance check precedes round check)',
            () => {
                damageRollback.findLastAttack.mockResolvedValue(
                    makeAttack({ attackEvent: { timestamp: 7000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }),
                );
                getCombatContext.mockResolvedValue({ round: 3, creatures: [] });
                getRuntimeValue.mockImplementation((_name, key) =>
                    key === APPLIED_ATTACK_KEY ? '7000' : undefined);
            },
            makeAction().automation,
            30,
            'Reaction already used — you have already dodged this attack roll with Shadowy Dodge. Your Reaction is spent until your next turn.',
        ],
        [
            'a NEW attack in the same round (round latch: Reaction spent)',
            () => {
                damageRollback.findLastAttack.mockResolvedValue(
                    makeAttack({ attackEvent: { timestamp: 8000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }),
                );
                getRuntimeValue.mockImplementation((_name, key) =>
                    key === USED_ROUND_KEY ? 1 : undefined);
            },
            makeAction().automation,
            30,
            'You have already used Shadowy Dodge this round — your Reaction is spent until your next turn.',
        ],
    ])('refuses %s with an exact refusal popup and a zero-spend census', async (_label, setup, automation, expectedRangeFt, description) => {
        setup();

        const result = await handle({ name: 'Shadowy Dodge', automation }, makePlayerStats(), CAMPAIGN, null);

        expect(result).toEqual({
            type: 'popup',
            payload: { type: 'automation_info', name: 'Shadowy Dodge', description, automation },
        });
        // Gates short-circuit in source order: pre-range refusals never query range.
        expect(isWithinRange.mock.calls).toEqual(
            expectedRangeFt == null ? [] : [[PLAYER, 'Goblin', expectedRangeFt]],
        );
        // Zero-spend census: no die, no rollback, no log, no latch write.
        expect(diceRoller.rollD20.mock.calls).toEqual([]);
        expect(damageRollback.rollbackDamage.mock.calls).toEqual([]);
        expect(logService.addEntry.mock.calls).toEqual([]);
        expect(setRuntimeValue.mock.calls).toEqual([]);
    });

    it.each([
        [
            'hit→miss with nothing to refund (no negation suffix)',
            2,
            { timestamp: 5000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 },
            '<b>Shadowy Dodge</b><br/>Attacker: Goblin<br/>' +
            'Original roll: d20(15) + 7 = 22 vs AC 14 → <b>HIT</b><br/>' +
            'Disadvantage (second d20: 2): d20(2) + 7 = 9 vs AC 14 → <b>MISS</b><br/>' +
            '<br/><i>The attack now misses due to Disadvantage!</i>' + TELEPORT_TEXT,
            1,
        ],
        [
            'hit→still hits: no rollback, no negation suffix',
            20, // final min(18,20)=18 → 18+7=25 ≥ 14 → hit
            { timestamp: 5000, d20: 18, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 },
            '<b>Shadowy Dodge</b><br/>Attacker: Goblin<br/>' +
            'Original roll: d20(18) + 7 = 25 vs AC 14 → <b>HIT</b><br/>' +
            'Disadvantage (second d20: 20): d20(18) + 7 = 25 vs AC 14 → <b>HIT</b><br/>' +
            '<br/><i>The attack still hits despite Disadvantage.</i>' + TELEPORT_TEXT,
            0,
        ],
        [
            'original attack already missed',
            11, // final min(3,11)=3
            { timestamp: 5000, d20: 3, bonus: 2, targetAc: 14, hit: false, effectiveAc: 14 },
            '<b>Shadowy Dodge</b><br/>Attacker: Goblin<br/>' +
            'Original roll: d20(3) + 2 = 5 vs AC 14 → <b>MISS</b><br/>' +
            'Disadvantage (second d20: 11): d20(3) + 2 = 5 vs AC 14 → <b>MISS</b><br/>' +
            '<br/><i>The attack already missed — Disadvantage has no additional effect.</i>' + TELEPORT_TEXT,
            0,
        ],
        [
            'effectiveAc wins over targetAc',
            11, // final min(10,11)=10 → 15 < 16 → miss
            { timestamp: 5000, d20: 10, bonus: 5, targetAc: 13, hit: true, effectiveAc: 16 },
            '<b>Shadowy Dodge</b><br/>Attacker: Goblin<br/>' +
            'Original roll: d20(10) + 5 = 15 vs AC 16 → <b>HIT</b><br/>' +
            'Disadvantage (second d20: 11): d20(10) + 5 = 15 vs AC 16 → <b>MISS</b><br/>' +
            '<br/><i>The attack now misses due to Disadvantage!</i>' + TELEPORT_TEXT,
            1,
        ],
        [
            'falls back to targetAc when effectiveAc is absent',
            11, // final min(10,11)=10 → 15 ≥ 13 → hit
            { timestamp: 6000, d20: 10, bonus: 5, targetAc: 13, hit: true, effectiveAc: undefined },
            '<b>Shadowy Dodge</b><br/>Attacker: Goblin<br/>' +
            'Original roll: d20(10) + 5 = 15 vs AC 13 → <b>HIT</b><br/>' +
            'Disadvantage (second d20: 11): d20(10) + 5 = 15 vs AC 13 → <b>HIT</b><br/>' +
            '<br/><i>The attack still hits despite Disadvantage.</i>' + TELEPORT_TEXT,
            0,
        ],
        [
            'null AC renders — / N/A with no outcome line and no rollback',
            2,
            { timestamp: 5000, d20: 10, bonus: 5, hit: true, targetAc: undefined, effectiveAc: undefined },
            '<b>Shadowy Dodge</b><br/>Attacker: Goblin<br/>' +
            'Original roll: d20(10) + 5 = 15 vs AC — → <b>HIT</b><br/>' +
            'Disadvantage (second d20: 2): d20(2) + 5 = 7 vs AC — → <b>N/A</b><br/>' +
            TELEPORT_TEXT,
            0,
        ],
    ])('composes descriptions for %s', async (_label, secondD20, attackEvent, expectedDescription, rollbackCalls) => {
        diceRoller.rollD20.mockReturnValue(secondD20);
        damageRollback.findLastAttack.mockResolvedValue(makeAttack({ attackEvent }));

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

        expect(result.payload.description).toBe(expectedDescription);
        expect(damageRollback.rollbackDamage).toHaveBeenCalledTimes(rollbackCalls);
        // Suffix-free log line in every branch (rollback resolves 0 by default).
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'ability_use',
            characterName: PLAYER,
            abilityName: 'Shadowy Dodge',
            targetName: 'Goblin',
            description: BASE_LOG,
        }));
    });

    it('re-arms on a new attack in a later round and re-stamps both latches', async () => {
        diceRoller.rollD20.mockReturnValue(11);
        damageRollback.findLastAttack.mockResolvedValue(
            makeAttack({ attackEvent: { timestamp: 9000, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }),
        );
        getCombatContext.mockResolvedValue({ round: 2, creatures: [] });
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === APPLIED_ATTACK_KEY) return '7000';
            if (key === USED_ROUND_KEY) return 1;
            return undefined;
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

        expect(result.payload.description).toContain('Disadvantage (second d20: 11): d20(11) + 7 = 18 vs AC 14 → <b>HIT</b>');
        expect(setRuntimeValue.mock.calls).toEqual([
            [PLAYER, APPLIED_ATTACK_KEY, '9000', CAMPAIGN],
            [PLAYER, USED_ROUND_KEY, 2, CAMPAIGN],
        ]);
    });

    it('stamps the roll signature as attack identity when the attack carries no timestamp', async () => {
        diceRoller.rollD20.mockReturnValue(11);
        damageRollback.findLastAttack.mockResolvedValue(
            makeAttack({ attackEvent: { timestamp: undefined, d20: 15, bonus: 7, targetAc: 14, hit: true, effectiveAc: 14 } }),
        );

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

        expect(result.payload.description).toContain('Disadvantage (second d20: 11): d20(11) + 7 = 18 vs AC 14 → <b>HIT</b>');
        expect(setRuntimeValue.mock.calls).toEqual([
            [PLAYER, APPLIED_ATTACK_KEY, 'd20:15+7:Goblin', CAMPAIGN],
            [PLAYER, USED_ROUND_KEY, 1, CAMPAIGN],
        ]);
    });

    it('defaults the feature and attacker names, preferring an explicit action.name', async () => {
        diceRoller.rollD20.mockReturnValue(11);
        damageRollback.findLastAttack.mockResolvedValue(makeAttack());

        const custom = await handle(makeAction({ name: 'Custom Dodge' }), makePlayerStats(), CAMPAIGN, null);
        expect(custom.payload.name).toBe('Custom Dodge');
        expect(custom.payload.description).toContain('<b>Custom Dodge</b>');
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ abilityName: 'Custom Dodge' }));

        const defaulted = await handle({ automation: {} }, makePlayerStats(), CAMPAIGN, null);
        expect(defaulted.payload.name).toBe('Shadowy Dodge');
        expect(defaulted.payload.description).toContain('<b>Shadowy Dodge</b>');

        damageRollback.findLastAttack.mockResolvedValue(makeAttack({ result: { attackerName: null } }));
        const unknown = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);
        expect(unknown.payload.description).toContain('Attacker: Unknown creature');
    });

    it('propagates a findLastAttack rejection without swallowing it', async () => {
        damageRollback.findLastAttack.mockRejectedValue(new Error('database error'));

        await expect(handle(makeAction(), makePlayerStats(), CAMPAIGN, null))
            .rejects.toThrow('database error');
    });

    it('survives an addEntry rejection: popup still returned, error surfaced to console', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
        diceRoller.rollD20.mockReturnValue(11);
        damageRollback.findLastAttack.mockResolvedValue(makeAttack());
        logService.addEntry.mockRejectedValue(new Error('log write failed'));

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Teleported 30 feet');
        expect(consoleSpy).toHaveBeenCalledWith('[shadowyDodge] Error:', expect.any(Error));

        consoleSpy.mockRestore();
    });
});
