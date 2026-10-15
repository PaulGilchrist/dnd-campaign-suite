// @maintained-by-ai: 2026-10-15
// Deterministic contract tests for gloriousDefenseHandler: guard popups, the
// CHA-adjusted hit/miss verdict, counterattack side effects (rollback, uses
// decrement, log), and the hasGloriousDefenseActive predicate.
// damageRollback / logService / runtime store are mocked; infoPopup runs REAL
// (pure payload builder), so popup shapes are pinned end-to-end here.
// Seam notes:
// - automation/index.js dispatches 'glorious_defense' to handle() (registry pin
//   lives in automationCollector.types.test.js — never re-pin it here).
// - The counterattack roll consumer (triggerGloriousDefenseCounterAttack, its own
//   runtime keys and 'did not target you' guard) is covered by useLoggedDiceRollSaves.test.js.
// - gloriousDefenseBonus is intentionally ABSENT from combat context (this handler
//   applies the bonus retroactively); the absence-guard lives in
//   contextBuilder-sync.passives.test.js — keep that seam honest.
// Full-string pins: copy changes to the popup/log prose must be mirrored here
// deliberately. Known quirks pinned as-is: target range is not enforced by the
// handler (upstream decides targeting), the outcome notes hardcode the feature
// name, effectiveAc affects display only (new AC is computed from targetAc), and
// uses are still spent when no counterattack weapon exists.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
    rollbackDamage: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

const { findLastAttack, rollbackDamage } = await import('../../common/damageRollback.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

import { handle, hasGloriousDefenseActive } from './gloriousDefenseHandler.js';

const campaignName = 'test-campaign';
const playerName = 'Test Paladin';
const LONGSWORD = { name: 'Longsword', type: 'Action', range: 5, hitBonus: 7, damage: '1d8+3', damageType: 'Slashing' };

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 7,
        abilities: [{ name: 'Charisma', bonus: 3 }],
        attacks: [LONGSWORD],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Glorious Defense',
        automation: {
            type: 'glorious_defense',
            effect: 'ac_bonus',
            range: '10_ft',
            casting_time: '1 reaction',
            ...overrides.automation,
        },
        ...overrides,
    };
}

// Key-based runtime mock — immune to the order/count of getRuntimeValue calls.
function mockRuntime(overrides = {}) {
    getRuntimeValue.mockImplementation((name, key) => overrides[`${name}|${key}`] ?? null);
}

// Default attack event: d20(9) + 7 = 16 vs AC 16 → hit; with CHA +3 (new AC 19) → miss.
function mockLastAttack({ d20 = 9, bonus = 7, targetAc = 16, effectiveAc, hit = true, attackerName = 'Goblin', targetName = playerName, totalDamage = 10 } = {}) {
    findLastAttack.mockResolvedValue({
        attackEvent: { timestamp: 1700000000000, d20, bonus, targetAc, effectiveAc, hit },
        attackerName,
        targetName,
        primaryDamage: totalDamage,
        secondaryDamage: 0,
        totalDamage,
        damageTypes: ['slashing'],
    });
}

const popupFor = (name, description, automation) => ({
    type: 'popup',
    payload: { type: 'automation_info', name, description, automation },
});

beforeEach(() => {
    vi.clearAllMocks();
    mockRuntime({ [`${playerName}|gloriousDefenseUses`]: 4 });
    rollbackDamage.mockResolvedValue(0);
});

describe('gloriousDefenseHandler.handle — guards', () => {
    it('denies when uses are exhausted — no attack lookup, no writes', async () => {
        mockRuntime({ [`${playerName}|gloriousDefenseUses`]: 0 });
        const action = makeAction();

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result).toEqual(popupFor('Glorious Defense', 'Glorious Defense has no uses remaining. Recharges on a Long Rest.', action.automation));
        expect(findLastAttack).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('denies when there is no recent attack — missing record or null attackEvent', async () => {
        const action = makeAction();
        for (const record of [
            undefined,
            { attackEvent: null, attackerName: null, targetName: null, primaryDamage: 0, secondaryDamage: 0, totalDamage: 0, damageTypes: [] },
        ]) {
            findLastAttack.mockResolvedValue(record);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual(popupFor('Glorious Defense', 'Glorious Defense: No recent attack roll found. This reaction must be used in response to an attack.', action.automation));
            expect(setRuntimeValue).not.toHaveBeenCalled();
        }
    });

    it('denies when the last attack dealt no damage', async () => {
        mockLastAttack({ totalDamage: 0 });
        const action = makeAction();

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result).toEqual(popupFor('Glorious Defense', 'Glorious Defense: The last attack dealt no damage.', action.automation));
        expect(rollbackDamage).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

describe('gloriousDefenseHandler.handle — attack still hits (popup, no side effects)', () => {
    // Range is NOT enforced by the handler — an attack on any target in the log is
    // processed (targeting is decided upstream); full pin covers attacker/roll/AC detail.
    it('pins the full still-hits popup for an ally target without rolling back or spending a use', async () => {
        mockLastAttack({ d20: 15, targetName: 'Ally Character' });
        const action = makeAction();

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result).toEqual(popupFor(
            'Glorious Defense',
            '<b>Glorious Defense</b><br/>Target: Ally Character<br/>Attacker: Goblin<br/>Original roll: d20(15) + 7 = 22 vs AC 16 → <b>HIT</b><br/>With CHA modifier (3): d20(15) + 7 = 22 vs AC 19 → <b>HIT</b><br/><br/><i>The attack still hits despite your Glorious Defense.</i>',
            action.automation,
        ));
        expect(findLastAttack).toHaveBeenCalledWith(campaignName);
        expect(rollbackDamage).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('floors the CHA modifier at +1 when Charisma is negative', async () => {
        mockLastAttack({ d20: 16 }); // 23 vs new AC 16+1=17 → still hits
        const action = makeAction();

        const result = await handle(action, makePlayerStats({ abilities: [{ name: 'Charisma', bonus: -2 }] }), campaignName, null);

        expect(result).toEqual(popupFor(
            'Glorious Defense',
            '<b>Glorious Defense</b><br/>Target: Test Paladin<br/>Attacker: Goblin<br/>Original roll: d20(16) + 7 = 23 vs AC 16 → <b>HIT</b><br/>With CHA modifier (1): d20(16) + 7 = 23 vs AC 17 → <b>HIT</b><br/><br/><i>The attack still hits despite your Glorious Defense.</i>',
            action.automation,
        ));
    });

    it('shows effectiveAc in the original-roll line but computes new AC from targetAc (current behaviour)', async () => {
        mockLastAttack({ d20: 15, effectiveAc: 18 }); // display AC 18; new AC 16+3=19 → still hits
        const action = makeAction();

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result).toEqual(popupFor(
            'Glorious Defense',
            '<b>Glorious Defense</b><br/>Target: Test Paladin<br/>Attacker: Goblin<br/>Original roll: d20(15) + 7 = 22 vs AC 18 → <b>HIT</b><br/>With CHA modifier (3): d20(15) + 7 = 22 vs AC 19 → <b>HIT</b><br/><br/><i>The attack still hits despite your Glorious Defense.</i>',
            action.automation,
        ));
    });
});

describe('gloriousDefenseHandler.handle — attack already missed', () => {
    it('appends the no-effect note and leaves uses untouched', async () => {
        mockLastAttack({ d20: 3, bonus: 2, hit: false, totalDamage: 5 });
        const action = makeAction();

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result).toEqual(popupFor(
            'Glorious Defense',
            '<b>Glorious Defense</b><br/>Target: Test Paladin<br/>Attacker: Goblin<br/>Original roll: d20(3) + 2 = 5 vs AC 16 → <b>MISS</b><br/>With CHA modifier (3): d20(3) + 2 = 5 vs AC 19 → <b>MISS</b><br/><br/><i>The attack already missed — Glorious Defense has no additional effect.</i>',
            action.automation,
        ));
        expect(rollbackDamage).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

describe('gloriousDefenseHandler.handle — block and counterattack', () => {
    it('rolls back damage, spends one use, logs the ability use, and returns a Longsword attack_roll', async () => {
        mockLastAttack(); // d20(9) + 7 = 16 vs new AC 19 → miss
        rollbackDamage.mockResolvedValue(10);
        const stats = makePlayerStats();

        const result = await handle(makeAction(), stats, campaignName, null);

        expect(result).toEqual({
            type: 'attack_roll',
            payload: { attack: stats.attacks[0], targetName: 'Goblin', sourceName: 'Glorious Defense' },
        });
        expect(rollbackDamage).toHaveBeenCalledWith('Goblin', playerName, campaignName, 'Glorious Defense');
        expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', 3, campaignName);
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Glorious Defense',
            description: 'Test Paladin used Glorious Defense to protect Test Paladin from Goblin — the attack misses due to the CHA modifier (3) and Test Paladin makes a melee counterattack. 10 damage was negated.',
            targetName: 'Goblin',
            timestamp: expect.any(Number),
        });
    });

    it('still counterattacks and spends the use when rollback negates 0 damage — log omits the negation sentence', async () => {
        mockLastAttack();
        rollbackDamage.mockResolvedValue(0);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('attack_roll');
        expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', 3, campaignName);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            description: expect.not.stringContaining('negated'),
        }));
    });

    it('falls back to the first attack when no melee attacks are available', async () => {
        mockLastAttack();
        rollbackDamage.mockResolvedValue(10);
        const longbow = { name: 'Longbow', type: 'Action', range: 150, hitBonus: 7, damage: '1d8+3' };

        const result = await handle(makeAction(), makePlayerStats({ attacks: [longbow] }), campaignName, null);

        expect(result).toEqual({
            type: 'attack_roll',
            payload: { attack: longbow, targetName: 'Goblin', sourceName: 'Glorious Defense' },
        });
    });

    it('still rolls back and spends the use but skips the log when no attacks exist at all', async () => {
        mockLastAttack();
        rollbackDamage.mockResolvedValue(10);
        const action = makeAction();

        const result = await handle(action, makePlayerStats({ attacks: [] }), campaignName, null);

        expect(result).toEqual(popupFor(
            'Glorious Defense',
            '<b>Glorious Defense</b><br/>Target: Test Paladin<br/>Attacker: Goblin<br/>Original roll: d20(9) + 7 = 16 vs AC 16 → <b>HIT</b><br/>With CHA modifier (3): d20(9) + 7 = 16 vs AC 19 → <b>MISS</b><br/><br/><i>The attack now misses due to your Glorious Defense!</i><br/>Damage negated: 10 HP restored to Test Paladin.<br/><br/>No melee attack available for the counterattack.',
            action.automation,
        ));
        expect(rollbackDamage).toHaveBeenCalledWith('Goblin', playerName, campaignName, 'Glorious Defense');
        expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', 3, campaignName);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('falls back to "Unknown creature" as counterattack target when attackerName is missing', async () => {
        mockLastAttack({ attackerName: null });
        rollbackDamage.mockResolvedValue(10);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result).toEqual({
            type: 'attack_roll',
            payload: { attack: LONGSWORD, targetName: 'Unknown creature', sourceName: 'Glorious Defense' },
        });
        expect(rollbackDamage).toHaveBeenCalledWith('Unknown creature', playerName, campaignName, 'Glorious Defense');
    });

    it('defaults uses to max(1, CHA) when the runtime key is unset — also without Charisma', async () => {
        rollbackDamage.mockResolvedValue(10);
        // Uses unset: CHA +3 → 3 uses → drops to 2. No Charisma → floors to 1 use → drops to 0
        // (and chaMod floors to +1, so d20(9)+7=16 vs AC 17 still flips to a miss).
        const cases = [
            { abilities: [{ name: 'Charisma', bonus: 3 }], usesAfter: 2 },
            { abilities: [], usesAfter: 0 },
        ];
        for (const { abilities, usesAfter } of cases) {
            vi.clearAllMocks();
            mockRuntime({});
            rollbackDamage.mockResolvedValue(10);

            const result = await handle(makeAction(), makePlayerStats({ abilities }), campaignName, null);

            expect(result.type).toBe('attack_roll');
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', usesAfter, campaignName);
        }
    });
});

describe('gloriousDefenseHandler.handle — custom action name', () => {
    it('threads the action name through payload and header (outcome notes keep the feature name hardcoded — current behaviour)', async () => {
        mockLastAttack({ d20: 15, attackerName: 'Orc' });
        const action = makeAction({ name: 'My Glorious Defense' });

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result).toEqual(popupFor(
            'My Glorious Defense',
            '<b>My Glorious Defense</b><br/>Target: Test Paladin<br/>Attacker: Orc<br/>Original roll: d20(15) + 7 = 22 vs AC 16 → <b>HIT</b><br/>With CHA modifier (3): d20(15) + 7 = 22 vs AC 19 → <b>HIT</b><br/><br/><i>The attack still hits despite your Glorious Defense.</i>',
            action.automation,
        ));
        expect(rollbackDamage).not.toHaveBeenCalled();
    });
});

describe('hasGloriousDefenseActive', () => {
    it('is true only for Paladin + Oath of Glory (major or subclass); other combos are false', () => {
        const cases = [
            [{ class: { name: 'Paladin', major: { name: 'Oath of Glory' } } }, true],
            [{ class: { name: 'Paladin', subclass: { name: 'Oath of Glory' } } }, true],
            // major takes precedence over subclass in the lookup
            [{ class: { name: 'Paladin', major: { name: 'Oath of Devotion' }, subclass: { name: 'Oath of Glory' } } }, false],
            [{ class: { name: 'Paladin', major: { name: 'Oath of Devotion' } } }, false],
            // class guard fires even when the subclass name matches
            [{ class: { name: 'Cleric', major: { name: 'Oath of Glory' } } }, false],
            [{ class: { name: 'Cleric', major: { name: 'Life Domain' } } }, false],
        ];
        for (const [stats, expected] of cases) {
            expect(hasGloriousDefenseActive(stats)).toBe(expected);
        }
    });

    it('returns false for nullish or incomplete class data', () => {
        for (const stats of [null, undefined, {}, { class: {} }, { class: { name: 'Paladin' } }]) {
            expect(hasGloriousDefenseActive(stats)).toBe(false);
        }
    });
});
