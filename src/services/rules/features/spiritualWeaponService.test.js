// @maintained-by-ai
// SP-112: Spiritual Weapon force record + combat-scoped expiry (#1420) + later-turn move/attack.
// Producer-vs-forwarder: this lane PRODUCES a persisted force-record buff and an
// attack DESCRIPTOR; dice rolling belongs to the attackCalc lane (consumed via
// CharBonusActions.jsx -> rollAttack). No rolls happen here — envelope pins only.
//
// Disk rows read verbatim (both rulesets, public/data):
//   5e   spells.json spiritual-weapon: level 2, casting_time '1 bonus action',
//        duration '1 minute', concentration false, damage 2: '1d8' (Force)
//   2024 spells.json spiritual-weapon: level 2, casting_time 'Bonus Action',
//        duration 'Concentration, up to 1 minute', concentration true,
//        damage 2: '1d8 + 3' (Force) — caster modifier baked into disk bytes.
// Case-split casting_time (#1391 class) confirmed on disk.
//
// :0-swallow FIXED (#1420, was #1345-class pinned-as-is): parseDurationRounds returns
// 0 — the DOCUMENTED encounter-scoped marker (durationParser.js L9-10) — for both disk
// duration strings; the service no longer coerces it with `|| DEFAULT_DURATION_ROUNDS`.
// Lawful arms: 0 -> combat-scoped stamp (rounds: Infinity, until: 'combat',
// zoneDurationClock.js:102 canonical — no-clock policy per AGENTS.md: authored >=1
// minute never a round countdown, swept at a new initiative roll / short / long rest);
// explicit N_rounds -> rounds: N; unparseable/absent -> console.error, NO expiry armed
// (no-fallbacks / MA-1215 never-fabricate-a-clock).
// Shared-reference law (#1420, fix#1536 family): the move lane CLONES the store-read
// buff before latching lastMoveRound — the live store ref is never mutated in place.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../effects/expirations.js', () => ({
    addExpiration: vi.fn(),
    KEY: 'pendingExpirations',
}));
vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));
vi.mock('../combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(),
}));
vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
}));

import {
    activateSpiritualWeaponForce,
    getSpiritualWeaponForce,
    buildSpiritualWeaponForceAttack,
    resolveSpiritualWeaponMoveAndAttack,
} from './spiritualWeaponService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../effects/expirations.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { isWithinRange } from '../combat/rangeCheck.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';
import { parseDurationRounds } from '../effects/durationParser.js';

const campaignName = 'test-campaign';
const OWNER = 'Divine_Cleric';
const MARKER = 'Spiritual Weapon (Divine_Cleric)';
const BUFF_NAME = 'Spiritual Weapon';
const FORCE_EFFECT = 'spiritual_weapon_force';
const STAMP_MS = 1700000123456;

const playerStats = {
    name: OWNER,
    level: 17,
    proficiency: 6,
    spellAbilities: { toHit: 9, saveDc: 17, modifier: 3, spellCastingAbility: 'Wisdom' },
    abilities: [{ name: 'Wisdom', bonus: 3 }],
};

// 2024 disk row (public/data/2024/spells.json) — fields the service reads, verbatim.
const spell2024Disk = {
    index: 'spiritual-weapon',
    name: BUFF_NAME,
    level: 2,
    school: 'Evocation',
    concentration: true,
    casting_time: 'Bonus Action',
    duration: 'Concentration, up to 1 minute',
    damage: { damage_type: 'Force', damage_at_slot_level: { 2: '1d8 + 3', 3: '2d8 + 3', 4: '3d8 + 3', 5: '4d8 + 3', 6: '5d8 + 3', 7: '6d8 + 3', 8: '7d8 + 3', 9: '8d8 + 3' } },
};
// 5e disk row (public/data/spells.json) — concentration FALSE on disk here.
const spell5eDisk = {
    index: 'spiritual-weapon',
    name: BUFF_NAME,
    level: 2,
    school: 'Evocation',
    concentration: false,
    casting_time: '1 bonus action',
    duration: '1 minute',
    damage: { damage_type: 'Force', damage_at_slot_level: { 2: '1d8', 3: '1d8', 4: '2d8', 5: '2d8', 6: '3d8', 7: '3d8', 8: '4d8', 9: '4d8' } },
};

const baseForce = () => ({
    name: BUFF_NAME,
    effect: FORCE_EFFECT,
    damageFormula: '1d8 + 3',
    forceMarkerName: MARKER,
    attackRangeFt: 5,
    moveRangeFt: 20,
    activatedRound: 1,
});
const armedCs = () => ({ creatures: [{ name: OWNER, targetName: 'Thug 1' }, { name: 'Thug 1', currentHp: 32 }] });

// Argument-keyed STRICT store: unknown owner|key or campaign THROWS (#1375 class),
// arity-3/4 enforced, full read/write censuses recorded, state persists across
// calls within a test (stateful compose, #1307).
function makeStore(seed = {}) {
    const state = {
        [`${OWNER}|activeBuffs`]: seed.buffs ?? [],
        [`${OWNER}|pendingExpirations`]: seed.expirations ?? [],
        'campaign|lastAttack': seed.lastAttack ?? null,
    };
    const reads = [];
    const writes = [];
    return {
        state,
        reads,
        writes,
        get: (...args) => {
            if (args.length !== 3) throw new Error(`getRuntimeValue arity: ${args.length}`);
            const [owner, key, campaign] = args;
            if (campaign !== campaignName) throw new Error(`unknown campaign: ${campaign}`);
            const id = `${owner}|${key}`;
            if (!(id in state)) throw new Error(`unknown store read: ${id}`);
            reads.push(id);
            return state[id];
        },
        set: (...args) => {
            if (args.length !== 4) throw new Error(`setRuntimeValue arity: ${args.length}`);
            const [owner, key, value, campaign] = args;
            if (campaign !== campaignName) throw new Error(`unknown campaign: ${campaign}`);
            const id = `${owner}|${key}`;
            if (!(id in state)) throw new Error(`unknown store write: ${id}`);
            writes.push({ id, value });
            state[id] = value;
            return Promise.resolve();
        },
    };
}

let store;
function armStore(seed = {}) {
    store = makeStore(seed);
    getRuntimeValue.mockImplementation(store.get);
    setRuntimeValue.mockImplementation(store.set);
    return store;
}

function refusalEnvelope(message) {
    return {
        type: 'automation',
        creatureName: OWNER,
        name: 'Spiritual Weapon: Move & Attack',
        description: `spiritual_weapon_refused — ${message}`,
        timestamp: STAMP_MS,
    };
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.setSystemTime(new Date(STAMP_MS));
    armStore();
    // Explicit re-seed after reset (#1312).
    addEntry.mockResolvedValue(undefined);
    getCombatContext.mockResolvedValue(armedCs());
    isWithinRange.mockResolvedValue(true);
    getCurrentCombatRound.mockReturnValue(1);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('activateSpiritualWeaponForce', () => {
    it('2024 disk row: pins the full-set force buff, expiry envelope, summon log bytes, and read order', async () => {
        const buff = await activateSpiritualWeaponForce(spell2024Disk, playerStats, campaignName, { slotLevel: 3, formula: '2d8 + 3' });

        // Full-set envelope — exact 14 keys; explicit slotLevel/formula pass
        // through (not the || defaults); duration/damageType are disk bytes.
        expect(buff).toEqual({
            name: BUFF_NAME,
            effect: FORCE_EFFECT,
            spell: BUFF_NAME,
            duration: 'Concentration, up to 1 minute',
            concentration: true,
            slotLevel: 3,
            damageFormula: '2d8 + 3',
            damageType: 'Force',
            forceMarkerName: MARKER,
            moveRangeFt: 20,
            attackRangeFt: 5,
            appearsRangeFt: 60,
            appearsInRange: true,
            activatedRound: 1,
        });

        // Exactly one write; the returned buff IS the stored buff (identity).
        expect(store.writes).toHaveLength(1);
        expect(store.writes[0].id).toBe(`${OWNER}|activeBuffs`);
        expect(store.writes[0].value[0]).toBe(buff);

        // #1420 flipped pin (was :0-swallow pinned-as-is): disk duration parses to
        // the documented encounter-scope 0 (durationParser.js L9-10) and the zero
        // SURVIVES — combat-scoped stamp rounds: Infinity + until: 'combat'
        // (zoneDurationClock.js:102 canonical), never the resurrected rounds: 10.
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: OWNER,
            targetName: OWNER,
            effects: [{ type: 'remove_active_buff', buffName: BUFF_NAME }],
            campaignName,
            rounds: Infinity,
            until: 'combat',
        });

        // Exact log bytes incl em-dash and armed-target tail.
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'summons',
            characterName: OWNER,
            summonName: BUFF_NAME,
            summonSource: 'spell',
            description: `${OWNER} casts ${BUFF_NAME} (slot level 3) — a floating spectral force appears within 60 feet (${MARKER}). Force is combat-scoped (authored 1 minute — no-clock policy): it lasts the whole combat, ended by a new initiative roll, a rest, or concentration breaking. Target within 5 ft of the force gate: checked.`,
            summonedCreatures: [MARKER],
            timestamp: STAMP_MS,
        });

        // 60-ft appear gate goes through isWithinRange (repo rule, #1384) —
        // never a hand-rolled distance.
        expect(isWithinRange).toHaveBeenCalledTimes(1);
        expect(isWithinRange).toHaveBeenCalledWith(OWNER, 'Thug 1', 60);
        expect(getCurrentCombatRound).toHaveBeenCalledWith(campaignName);

        // Read-order census: queued-expiry drop reads before the buff write.
        expect(store.reads).toEqual([`${OWNER}|pendingExpirations`, `${OWNER}|activeBuffs`]);
    });

    it('5e disk row + coercion: slotLevel 0 -> spell.level 2, empty formula -> 1d8 + 3 (not disk 1d8), concentration false from disk; appears gate across armed/out/no-target branches', async () => {
        const rows = [
            { name: 'armed+in', cs: armedCs(), near: true, tail: 'Target within 5 ft of the force gate: checked.', appearsInRange: true, gateCalls: 1 },
            { name: 'armed+out', cs: armedCs(), near: false, tail: 'Target within 5 ft of the force gate: out of range.', appearsInRange: false, gateCalls: 1 },
            { name: 'no-target', cs: { creatures: [{ name: OWNER }] }, near: true, tail: 'No target armed — immediate melee spell attack skipped until a target is armed.', appearsInRange: true, gateCalls: 0 },
        ];
        for (const row of rows) {
            [addEntry, isWithinRange, getCombatContext, getCurrentCombatRound, addExpiration].forEach((m) => m.mockClear());
            armStore();
            getCombatContext.mockResolvedValue(row.cs);
            isWithinRange.mockResolvedValue(row.near);

            const buff = await activateSpiritualWeaponForce(spell5eDisk, playerStats, campaignName, { slotLevel: 0, formula: '' });

            expect(buff, row.name).toEqual({
                name: BUFF_NAME,
                effect: FORCE_EFFECT,
                spell: BUFF_NAME,
                duration: '1 minute',
                concentration: false,
                slotLevel: 2,
                // Service default '1d8 + 3' wins over the 5e disk row's flat '1d8'
                // — drift pinned deliberately: caller (noSavePath finalFormula) is
                // expected to pass a formula; a bare cast lands on 2024-flavored bytes.
                damageFormula: '1d8 + 3',
                damageType: 'Force',
                forceMarkerName: MARKER,
                moveRangeFt: 20,
                attackRangeFt: 5,
                appearsRangeFt: 60,
                appearsInRange: row.appearsInRange,
                activatedRound: 1,
            });
            expect(store.writes.map((w) => w.id), row.name).toEqual([`${OWNER}|activeBuffs`]);
            expect(addEntry, row.name).toHaveBeenCalledWith(campaignName, {
                type: 'summons',
                characterName: OWNER,
                summonName: BUFF_NAME,
                summonSource: 'spell',
                description: `${OWNER} casts ${BUFF_NAME} (slot level 2) — a floating spectral force appears within 60 feet (${MARKER}). Force is combat-scoped (authored 1 minute — no-clock policy): it lasts the whole combat, ended by a new initiative roll, a rest, or concentration breaking. ${row.tail}`,
                summonedCreatures: [MARKER],
                timestamp: STAMP_MS,
            });
            expect(isWithinRange, row.name).toHaveBeenCalledTimes(row.gateCalls);
        }
    });

    it('#1420 zero-survives: the three duration arms are mutually distinguishable (0->combat-scoped, N_rounds->finite, absent->loud no-stamp)', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            // Disk-law pin: BOTH ruleset disk durations parse to the documented 0
            // (durationParser.js L9-10) — proof the old `|| 10` swallowed real bytes.
            expect(parseDurationRounds('1 minute')).toBe(0);
            expect(parseDurationRounds('Concentration, up to 1 minute')).toBe(0);

            // Arm 1 — lawful encounter-scope 0: combat-scoped stamp, never rounds: 10.
            armStore();
            [addExpiration].forEach((m) => m.mockClear());
            await activateSpiritualWeaponForce(spell5eDisk, playerStats, campaignName, { slotLevel: 2, formula: '1d8 + 3' });
            expect(addExpiration, 'zero-survives arm').toHaveBeenCalledTimes(1);
            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: OWNER,
                targetName: OWNER,
                effects: [{ type: 'remove_active_buff', buffName: BUFF_NAME }],
                campaignName,
                rounds: Infinity,
                until: 'combat',
            });

            // Arm 2 — explicit rounds duration passes through: rounds: 3, NO until marker.
            [addExpiration].forEach((m) => m.mockClear());
            armStore();
            await activateSpiritualWeaponForce({ ...spell5eDisk, duration: '3_rounds' }, playerStats, campaignName, { slotLevel: 2, formula: '1d8 + 3' });
            expect(addExpiration, 'explicit-rounds arm').toHaveBeenCalledTimes(1);
            expect(addExpiration.mock.calls[0][0].rounds).toBe(3);
            expect(addExpiration.mock.calls[0][0]).not.toHaveProperty('until');

            // Arm 3 — absent/unparseable duration: LOUD, no expiry armed (no-fallbacks).
            [addExpiration].forEach((m) => m.mockClear());
            armStore();
            await activateSpiritualWeaponForce({ ...spell5eDisk, duration: 'Instantaneous' }, playerStats, campaignName, { slotLevel: 2, formula: '1d8 + 3' });
            expect(addExpiration, 'loud-absent arm').not.toHaveBeenCalled();
            expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[spiritualWeaponService:duration-unparseable]'));
        } finally {
            errSpy.mockRestore();
        }
    });

    it('recast on a stateful store: drops only the queued force expiry (survivor preserved), writes before the buff write, and second recast skips the no-op expiry write', async () => {
        const survivor = { target: 'Thug 1', effects: [{ type: 'remove_condition', condition: 'Prone' }] };
        const forceExpiry = { target: OWNER, effects: [{ type: 'remove_active_buff', buffName: BUFF_NAME }], expiryRounds: Infinity, until: 'combat' };
        const unrelated = { name: 'Bless', effect: 'bless' };
        armStore({ expirations: [forceExpiry, survivor], buffs: [unrelated] });

        await activateSpiritualWeaponForce(spell2024Disk, playerStats, campaignName, { slotLevel: 2, formula: '1d8 + 3' });

        expect(store.writes.map((w) => w.id)).toEqual([`${OWNER}|pendingExpirations`, `${OWNER}|activeBuffs`]);
        // Survivor kept by identity; force expiry dropped.
        expect(store.writes[0].value).toEqual([survivor]);
        expect(store.writes[0].value[0]).toBe(survivor);
        // Unrelated buff kept; force appended.
        expect(store.writes[1].value).toEqual([unrelated, expect.objectContaining({ effect: FORCE_EFFECT })]);
        expect(store.writes[1].value[0]).toBe(unrelated);

        // Second cast on the SAME stateful store: expirations now hold only the
        // survivor -> kept.length === stored.length -> NO further expiry write,
        // and activeBuffs keeps exactly one force (same-name filter).
        await activateSpiritualWeaponForce(spell2024Disk, playerStats, campaignName, { slotLevel: 2, formula: '1d8 + 3' });

        expect(store.writes.filter((w) => w.id === `${OWNER}|pendingExpirations`)).toHaveLength(1);
        const lastBuffs = store.writes[store.writes.length - 1].value;
        expect(lastBuffs.filter((b) => b.name === BUFF_NAME)).toHaveLength(1);
        expect(addExpiration).toHaveBeenCalledTimes(2);
    });
});

describe('getSpiritualWeaponForce', () => {
    it('selects by name AND effect identity — null on partial match, malformed store; exact object on match', () => {
        armStore({ buffs: [] });
        expect(getSpiritualWeaponForce(playerStats, campaignName)).toBeNull();

        store.state[`${OWNER}|activeBuffs`] = 'not-an-array';
        expect(getSpiritualWeaponForce(playerStats, campaignName)).toBeNull();

        store.state[`${OWNER}|activeBuffs`] = [
            { name: BUFF_NAME, effect: 'other_effect' },
            { name: 'Other', effect: FORCE_EFFECT },
        ];
        expect(getSpiritualWeaponForce(playerStats, campaignName)).toBeNull();

        const force = { name: BUFF_NAME, effect: FORCE_EFFECT, damageFormula: '1d8 + 3' };
        store.state[`${OWNER}|activeBuffs`] = [{ name: 'Bless' }, force];
        expect(getSpiritualWeaponForce(playerStats, campaignName)).toBe(force);
        expect(store.reads).toHaveLength(4);
    });
});

describe('buildSpiritualWeaponForceAttack', () => {
    it('builds the exact full-set spell-attack descriptor consumed by the rollAttack/normalizeAutoDamage lanes', () => {
        const atk = buildSpiritualWeaponForceAttack(playerStats, { damageFormula: '2d8 + 3' });
        expect(atk).toEqual({
            name: 'Spiritual Weapon: Move & Attack',
            attackType: 'spell',
            school: 'Evocation',
            isRanged: false,
            range: '5_ft',
            toHit: 9,
            hitBonus: 9,
            hitBonusFormula: 'To Hit Bonus = Wisdom Modifier (3) + Proficiency (6)',
            damage: '2d8 + 3',
            damageType: 'Force',
            damageFormula: 'Damage Formula = 2d8 + 3 (Force)',
            autoDamageFormula: '2d8 + 3',
            autoDamageName: BUFF_NAME,
            abilityName: 'Wisdom',
            actionType: 'Bonus Action',
            isSpiritualWeapon: true,
        });
    });

    it('coerces missing spellAbilities/proficiency/formula to 0 and 1d8 + 3 on frozen inputs (purity by throw)', () => {
        const bareStats = Object.freeze({ name: OWNER });
        const emptyForce = Object.freeze({});
        const atk = buildSpiritualWeaponForceAttack(bareStats, emptyForce);
        expect(atk).toEqual({
            name: 'Spiritual Weapon: Move & Attack',
            attackType: 'spell',
            school: 'Evocation',
            isRanged: false,
            range: '5_ft',
            toHit: 0,
            hitBonus: 0,
            hitBonusFormula: 'To Hit Bonus = Wisdom Modifier (0) + Proficiency (0)',
            damage: '1d8 + 3',
            damageType: 'Force',
            damageFormula: 'Damage Formula = 1d8 + 3 (Force)',
            autoDamageFormula: '1d8 + 3',
            autoDamageName: BUFF_NAME,
            abilityName: 'Wisdom',
            actionType: 'Bonus Action',
            isSpiritualWeapon: true,
        });
    });
});

describe('resolveSpiritualWeaponMoveAndAttack', () => {
    it('refuses every gate with exact spiritual_weapon_refused bytes and writes nothing', async () => {
        const rows = [
            { name: 'no-force', buffs: [], cs: armedCs(), round: 2, near: true, message: `${OWNER} has no active Spiritual Weapon force — cast Spiritual Weapon first.` },
            { name: 'already-moved', buffs: [baseForce()], cs: armedCs(), round: 2, near: true, latch: 2, message: `The Spiritual Weapon force has already moved and attacked this turn (2).` },
            { name: 'no-target', buffs: [baseForce()], cs: { creatures: [{ name: OWNER, targetName: null }] }, round: 2, near: true, message: `${OWNER} has no target armed for the Spiritual Weapon attack — arm a target on the initiative card first.` },
            { name: 'out-of-range', buffs: [baseForce()], cs: armedCs(), round: 2, near: false, message: `Thug 1 is not within 5 feet of the Spiritual Weapon force.`, gateArgs: ['Thug 1', MARKER, 5] },
            { name: 'marker-coercion', buffs: [{ name: BUFF_NAME, effect: FORCE_EFFECT, activatedRound: 1 }], cs: armedCs(), round: 2, near: false, message: `Thug 1 is not within 5 feet of the Spiritual Weapon force.`, gateArgs: ['Thug 1', BUFF_NAME, 5] },
            { name: 'dead-target', buffs: [baseForce()], cs: { creatures: [{ name: OWNER, targetName: 'Thug 1' }, { name: 'Thug 1', currentHp: 0 }] }, round: 2, near: true, message: `Thug 1 is dead — choose a living target within 5 feet of the force.` },
        ];
        for (const row of rows) {
            [addEntry, isWithinRange, getCombatContext, getCurrentCombatRound].forEach((m) => m.mockClear());
            const buffs = row.buffs.map((b) => ({ ...b }));
            if (row.latch) buffs[0].lastMoveRound = row.latch;
            armStore({ buffs });
            getCombatContext.mockResolvedValue(row.cs);
            isWithinRange.mockResolvedValue(row.near);
            getCurrentCombatRound.mockReturnValue(row.round);

            const res = await resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName);

            expect(res, row.name).toEqual({ refused: true, message: row.message });
            expect(addEntry, row.name).toHaveBeenCalledWith(campaignName, refusalEnvelope(row.message));
            expect(store.writes, row.name).toEqual([]);
            if (row.gateArgs) expect(isWithinRange, row.name).toHaveBeenCalledWith(...row.gateArgs);
        }
    });

    it('resolves the armed target from campaign lastAttack when the card target is empty, and refuses a self-armed lastAttack', async () => {
        armStore({ buffs: [baseForce()], lastAttack: { targetName: 'Thug 1' } });
        getCombatContext.mockResolvedValue({ creatures: [{ name: OWNER, targetName: null }] });
        getCurrentCombatRound.mockReturnValue(2);

        const res = await resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName);
        expect(res.targetName).toBe('Thug 1');
        expect(res.attack.hitBonus).toBe(9);
        expect(isWithinRange).toHaveBeenCalledWith('Thug 1', MARKER, 5);

        // Self-armed lastAttack must not enable a self-attack (targetName === caster).
        store.state['campaign|lastAttack'] = { targetName: OWNER };
        getCurrentCombatRound.mockReturnValue(3);
        const res2 = await resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName);
        expect(res2).toEqual({ refused: true, message: `${OWNER} has no target armed for the Spiritual Weapon attack — arm a target on the initiative card first.` });
    });

    it('success latches lastMoveRound in the store payload (clone, not the read ref), logs the 20-ft move exactly, and never re-stamps expiry', async () => {
        const unrelated = { name: 'Bless', effect: 'bless' };
        const force = baseForce();
        armStore({ buffs: [unrelated, force] });
        // Target with NO currentHp key — `?? 1` keeps it attackable (both-sides of the ??).
        getCombatContext.mockResolvedValue({ creatures: [{ name: OWNER, targetName: 'Thug 1' }, { name: 'Thug 1' }] });
        getCurrentCombatRound.mockReturnValue(2);

        const res = await resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName);

        // Exact two-key success envelope; attack descriptor full-set.
        expect(res).toEqual({
            attack: {
                name: 'Spiritual Weapon: Move & Attack',
                attackType: 'spell',
                school: 'Evocation',
                isRanged: false,
                range: '5_ft',
                toHit: 9,
                hitBonus: 9,
                hitBonusFormula: 'To Hit Bonus = Wisdom Modifier (3) + Proficiency (6)',
                damage: '1d8 + 3',
                damageType: 'Force',
                damageFormula: 'Damage Formula = 1d8 + 3 (Force)',
                autoDamageFormula: '1d8 + 3',
                autoDamageName: BUFF_NAME,
                abilityName: 'Wisdom',
                actionType: 'Bonus Action',
                isSpiritualWeapon: true,
            },
            targetName: 'Thug 1',
        });

        // Write census: exactly one latch write, full-set buff map.
        expect(store.writes.map((w) => w.id)).toEqual([`${OWNER}|activeBuffs`]);
        const written = store.writes[0].value;
        expect(written).toEqual([unrelated, { ...force, lastMoveRound: 2 }]);
        expect(written[0]).toBe(unrelated);
        expect(written[1]).not.toBe(force);

        // #1420 flipped pin (shared-reference law, fix#1536 family): the service
        // used to mutate the store-read buff object in place pre-clone (old :179).
        // It now clones FIRST — the live store ref (strict store.get hands back
        // state[id] by identity) stays UNTOUCHED, and the latch lands only on the
        // cloned object persisted via the setRuntimeValue map write.
        expect(force.lastMoveRound).toBeUndefined();
        expect(store.state[`${OWNER}|activeBuffs`][1]).not.toBe(force);
        expect(store.state[`${OWNER}|activeBuffs`][1]).toEqual({ ...force, lastMoveRound: 2 });

        expect(isWithinRange).toHaveBeenCalledTimes(1);
        expect(isWithinRange).toHaveBeenCalledWith('Thug 1', MARKER, 5);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: OWNER,
            abilityName: 'Spiritual Weapon: Move & Attack',
            description: `${OWNER} moved the Spiritual Weapon force up to 20 feet and repeated the melee spell attack against Thug 1 (within 5 ft of the force; range gate pass).`,
            targetName: 'Thug 1',
            timestamp: STAMP_MS,
        });
        // Move lane never touches the expiration queue.
        expect(addExpiration).not.toHaveBeenCalled();
        expect(getCurrentCombatRound).toHaveBeenCalledWith(campaignName);
    });
});
