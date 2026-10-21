// @maintained-by-ai
// LANE: this .edgeCases file owns ONLY the three #1425/#1426 assigned byte families,
// verbatim from the sibling headers ("wardingDamage 0 '-0' delta artifact, negative
// damage, multi-buff first-match"):
//   1) -0 delta artifact (service :40) + the whole 0-swallow duty: the :22-54 mirror
//      has NO short-circuit for dmg<=0 — zero-shaped damage still WRITES (or mutates)
//      and still EMITS the hp_change entry carrying delta -0. Object.is is the ONLY
//      valid discriminator (vitest toEqual/toBe conflate +0/-0; toEqual(NaN) is
//      satisfied by any NaN, so the NaN poison rows are pinned by byte value).
//   2) negative-damage RAW verdict (:23/:25): sharedDamage = wardDamage verbatim,
//      Math.max(0, hp - negative) HEALS the caster with NO maxHp cap and NO dmg>0
//      gate — QUIRK reported (QUIRK-1 below), pinned honestly.
//   3) multi-buff first-match (:59 Array.prototype.find + :60): winner is decided by
//      ARRAY ORDER alone — swap order, winner flips (selection census); a leading
//      warding_bond lacking sourceCharacter shadow-blocks every valid bond behind it.
// Sibling lanes (verified by header scan, NEVER re-grown here):
//   .test.js        — buff-lookup gates :57-62 (single-buff no-source row included),
//                     distance gate/end :67-75 (null-distance leniency), SP-125 envelopes
//   .damage.test.js — HP arithmetic :22-30/:81-83 positive/terminal rows, full hp_change
//                     envelopes :37-46, clamp-delta=actual-loss, both caster-HP paths :77-80,
//                     caster-hp-0 gate (:81) census
//   .concentration  — dc stamp :47-49 (sharedDamage>0 branch + falsy-concentration object),
//                     lethal-end census + em-dash byte, player no-write-back quirk
//   .log            — hp_change payload/message bytes field-by-field (positive-damage path)
//   .errors         — addEntry-rejection console.error('[wardingBond] Error:', e)
// NO-CLOCK: zero timers, zero Date.now() gates on this face. Every input here takes the
// non-terminal :51 branch (newHp>0), so endWardingBond — the service's only Date.now()
// (:18 log stamp) — never executes in this lane; hp_change envelopes carry no timestamp
// key (:37-46), so full-set toEqual is deterministic with no fake-timer freeze.
// ZERO-DICE: damage arrives pre-rolled as the wardDamage parameter (:56->:82->:23);
// no RNG in this service, nothing to stub.
// UNREACHABLE-GUARD RE-VERIFICATION (:73-75): second isDistanceInRange guard stays dead
// from every edge angle — the real rangeCheck.js comparator returns true iff
// (range == null) or (dist == null) or (dist <= range); with the literal range 60 its
// FALSE domain is exactly dist!=null && dist>60, already consumed at :69 unless
// getDistanceFeet is nondeterministic across the two calls. No input reaches :74.
// Cited to the .damage dead-code report; not grown into a test.
// QUIRK SCAN on this lane's own inputs: no golden unguarded-deref TypeError reachable
// (every shape survives Number coercion to an fp_value or NaN — no throw, no console
// noise, asserted per row). QUIRK-1 (negative damage, report-only, never fixed here):
// heal routes through the damage mirror uncapped — byte evidence below (newHp>maxHp,
// positive delta logged with isHealing:false). QUIRK-2 (NaN poison, report-only):
// undefined/NaN wardDamage poisons caster HP with NaN and logs currentHp/delta NaN.
// STANDARDS: argument-keyed STATEFUL store fake throws on unknown owner|key, wrong
// campaign, arity drift (get=3/set=4); read-order + write-budget exact censuses;
// full-set envelopes + exact key-set arrays; vi.resetAllMocks + explicit re-seed per
// test (#1312 — no mockReturnValueOnce chains); console.error spy restored afterEach;
// no bare toHaveBeenCalled()/objectContaining/expect.any on mutation claims.
// MARKER INCIDENT #1361: exactly one marker, this line.
// PRESERVED-CITED-BY (headers of siblings, text unchanged — do not re-home these faces):
//   .damage.test.js:12, .concentration.test.js:11 -> ".edgeCases — wardDamage 0 '-0'
//   delta artifact, negative damage, multi-buff first-match".
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyWardingBond } from './wardingBondService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

const campaignName = 'TestCampaign';

// Argument-keyed STATEFUL store fake. Throws on unknown owner|key, wrong campaign,
// or arity drift at this service's call sites (getRuntimeValue/3, setRuntimeValue/4).
// Same fake shape as the sibling .damage/.concentration lanes so the family behaves
// identically under audit. Unseeded loser-caster keys make "only the winner is read"
// non-vacuous: production reading them THROWS here.
function seedStore(initial) {
    const data = new Map(Object.entries(initial));
    const reads = [];
    const writes = [];
    getRuntimeValue.mockImplementation(function (owner, key, campaign) {
        if (arguments.length !== 3) {
            throw new Error(`getRuntimeValue arity drift: ${arguments.length} args`);
        }
        if (campaign !== campaignName) {
            throw new Error(`getRuntimeValue wrong campaign: ${campaign}`);
        }
        const k = `${owner}|${key}`;
        reads.push(k);
        if (!data.has(k)) {
            throw new Error(`unexpected read getRuntimeValue('${owner}', '${key}')`);
        }
        return data.get(k);
    });
    setRuntimeValue.mockImplementation(function (owner, key, value, campaign) {
        if (arguments.length !== 4) {
            throw new Error(`setRuntimeValue arity drift: ${arguments.length} args`);
        }
        if (campaign !== campaignName) {
            throw new Error(`setRuntimeValue wrong campaign: ${campaign}`);
        }
        writes.push([owner, key, value]);
        data.set(`${owner}|${key}`, value);
    });
    return { reads, writes, data };
}

const HP_KEYS = [
    'type',
    'targetName',
    'delta',
    'currentHp',
    'maxHp',
    'isHealing',
    'isUnconscious',
    'abilityName',
];

function npcCaster(name, hp, maxHp) {
    const caster = { name, type: 'npc', currentHp: hp };
    if (maxHp !== undefined) caster.maxHp = maxHp;
    return caster;
}

describe('wardingBondService edge cases — -0 delta artifact, negative damage, multi-buff first-match', () => {
    let consoleError;

    beforeEach(() => {
        // vitest 4: resetAllMocks strips implementations retained by clearAllMocks —
        // every fake is re-seeded explicitly per test (bond state never persists).
        vi.resetAllMocks();
        addEntry.mockResolvedValue(undefined);
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it.each([
        // [label, damage] — every "zero shape" coerces to +0 at :25 (Math.max(0, 17-0)=17)
        // and :40 -(17-17) minted the -0 artifact. Object.is is the discriminator:
        // toEqual({delta: -0}) would ALSO pass on +0. 0-swallow verdict: NOT swallowed —
        // the hp_change entry still emits and the caster HP write/mutation still happens.
        ['integer 0', 0],
        // legacy byte: the old lane pinned only this row, HP-10 value, objectContaining.
        ['negative-zero -0 input', -0],
        ['null (Number(null) === 0)', null],
    ])('%# (%s): NPC caster HP unchanged, hp_change still emitted with delta -0', (_label, dmg) => {
        getDistanceFeet.mockReturnValue(30);
        const paladin = npcCaster('Paladin', 17, 20); // distinct from result 17-vs-10
        const goblin = { name: 'Goblin' };
        const { reads, writes } = seedStore({
            'Goblin|activeBuffs': [{ effect: 'warding_bond', sourceCharacter: 'Paladin' }],
        });

        applyWardingBond(goblin, { creatures: [paladin, goblin] }, campaignName, dmg);

        expect(paladin.currentHp).toBe(17); // value pin (NaN poison would fail here)
        expect(reads).toEqual(['Goblin|activeBuffs']); // NPC lane: single store read
        expect(writes).toEqual([]); // NPC caster mutates in place (:29), never the store
        expect(addEntry).toHaveBeenCalledTimes(1);
        const entry = addEntry.mock.calls[0][1];
        expect(Object.keys(entry)).toEqual(HP_KEYS); // exact key-set: no timestamp key
        expect(Object.is(entry.delta, -0)).toBe(true); // THE -0 artifact byte
        expect(Object.is(5 - 5, -0)).toBe(false); // negative control: toEqual conflate-safe
        expect(entry).toEqual({
            type: 'hp_change',
            targetName: 'Paladin',
            delta: -0, // conflate-safe only because Object.is pinned above
            currentHp: 17,
            maxHp: 20,
            isHealing: false,
            isUnconscious: false,
            abilityName: 'Warding Bond',
        });
        expect(consoleError).not.toHaveBeenCalled();
    });

    it.each([
        // QUIRK-2 (report-only): undefined/NaN damage passes the :81 caster-HP gate
        // (the gate tests casterHp, not damage), so :25 yields NaN — the store/mutation
        // and the envelope are POISONED with NaN. No throw: every shape coerces to an
        // fp_value, so there is no golden unguarded-deref TypeError on this face.
        // Note: toEqual({currentHp: NaN}) is satisfied by ANY NaN — the byte form of
        // the poison is pinned by Number.isNaN plus the exact key-set.
        ['undefined', undefined],
        ['NaN', NaN],
    ])('NaN-poison rows (%#): %s wardDamage poisons caster HP with NaN, logs currentHp/delta NaN', (_label, dmg) => {
        getDistanceFeet.mockReturnValue(30);
        const paladin = npcCaster('Paladin', 17, 20);
        const goblin = { name: 'Goblin' };
        const { reads, writes } = seedStore({
            'Goblin|activeBuffs': [{ effect: 'warding_bond', sourceCharacter: 'Paladin' }],
        });

        applyWardingBond(goblin, { creatures: [paladin, goblin] }, campaignName, dmg);

        expect(Number.isNaN(paladin.currentHp)).toBe(true); // QUIRK-2 mutation byte
        expect(reads).toEqual(['Goblin|activeBuffs']); // :81 gate reads HP, not damage
        expect(writes).toEqual([]); // NPC in-place lane (player lane would store NaN)
        expect(addEntry).toHaveBeenCalledTimes(1);
        const entry = addEntry.mock.calls[0][1];
        expect(Object.keys(entry)).toEqual(HP_KEYS); // entry STILL emitted
        expect(Number.isNaN(entry.delta)).toBe(true); // -(17-NaN) = NaN
        expect(Number.isNaN(entry.currentHp)).toBe(true);
        expect(entry.maxHp).toBe(20); // scalar bytes stay intact
        expect(entry.targetName).toBe('Paladin');
        expect(entry.type).toBe('hp_change');
        expect(entry.isHealing).toBe(false);
        expect(entry.isUnconscious).toBe(false); // NaN <= 0 is false — no terminal branch
        expect(entry.abilityName).toBe('Warding Bond');
        expect(consoleError).not.toHaveBeenCalled(); // no crash, no console noise
    });

    it.each([
        // QUIRK-1 (report-only, RAW verdict): :23 forwards negative wardDamage verbatim
        // and :25 Math.max(0, hp - (-3)) = 8 HEALS the caster; the max() clamps only at
        // 0, never at maxHp — row 2 heals 5 -> 15 on a 10-max caster. The mirror is
        // authored for damage only ("each time it takes damage, you take the same amount
        // of damage", spells.json), so the service never clamps/gates negative input.
        // Log byte contradiction pinned: POSITIVE delta with isHealing:false (:43).
        // Concentration untouched (:47 sharedDamage>0 false) — no store reads past :57;
        // dc-stamp absence shape owned by .concentration, not re-grown.
        [5, -3, 8, 10, 10, false], // [startHp, dmg, newHp, seed maxHp, envelope maxHp, beyondCap]
        [5, -10, 15, 10, 10, true], // maxHp bypass: 15 > maxHp 10
    ])('negative damage %# (hp %i, dmg %i): caster healed to %i, positive delta logged isHealing:false (maxHp bypass: %s)', (hp, dmg, newHp, seedMaxHp, envMaxHp, beyondCap) => {
        getDistanceFeet.mockReturnValue(30);
        const paladin = npcCaster('Paladin', hp, seedMaxHp);
        const goblin = { name: 'Goblin' };
        const { reads, writes } = seedStore({
            'Goblin|activeBuffs': [{ effect: 'warding_bond', sourceCharacter: 'Paladin' }],
        });

        applyWardingBond(goblin, { creatures: [paladin, goblin] }, campaignName, dmg);

        expect(paladin.currentHp).toBe(newHp); // QUIRK-1 heal byte (:25)
        expect(newHp > seedMaxHp).toBe(beyondCap); // :25 clamps only at 0, never at maxHp
        expect(reads).toEqual(['Goblin|activeBuffs']); // no terminal branch (:51)
        expect(writes).toEqual([]); // no buff strips — bond survives the heal
        expect(addEntry).toHaveBeenCalledTimes(1);
        const entry = addEntry.mock.calls[0][1];
        expect(Object.keys(entry)).toEqual(HP_KEYS);
        expect(entry).toEqual({
            type: 'hp_change',
            targetName: 'Paladin',
            delta: newHp - hp, // POSITIVE delta byte logged through the DAMAGE mirror
            currentHp: newHp,
            maxHp: envMaxHp,
            isHealing: false, // contradiction pinned: heals, still flagged not-healing
            isUnconscious: false,
            abilityName: 'Warding Bond',
        });
        expect(consoleError).not.toHaveBeenCalled();
    });

    it.each([
        // Selection census (:59 Array.prototype.find): array order alone decides the
        // winner — no canonical key, no tie-break. Wizard is typed 'player' only to
        // make the bytes discriminable: Paladin wins as in-place NPC mutation,
        // Wizard wins as an exact store-write tuple.
        {
            label: 'Paladin listed first wins (in-place NPC mutation)',
            winner: 'Paladin',
            buffs: () => [
                { effect: 'shield' },
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
                { effect: 'warding_bond', sourceCharacter: 'Wizard' },
            ],
        },
        {
            label: 'swapped array order flips the winner (store write census)',
            winner: 'Wizard',
            buffs: () => [
                { effect: 'shield' },
                { effect: 'warding_bond', sourceCharacter: 'Wizard' },
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ],
        },
        {
            label: 'leading warding_bond WITHOUT sourceCharacter shadow-blocks the valid bond behind it',
            winner: null, // :60 !sourceCharacter -> whole apply returns
            buffs: () => [
                { effect: 'warding_bond' },
                { effect: 'warding_bond', sourceCharacter: 'Paladin' },
            ],
        },
    ])('multi-buff first-match — $label', ({ buffs, winner }) => {
        getDistanceFeet.mockReturnValue(30);
        const paladin = npcCaster('Paladin', 20, 20);
        const wizard = { name: 'Wizard', type: 'player' };
        const goblin = { name: 'Goblin' };
        // Loser-caster store keys deliberately UNSEEDED: the fake throws if production
        // crosses the first-match shadow. Blocked row reads nothing past the lookup.
        const seed = { 'Goblin|activeBuffs': buffs() };
        if (winner === 'Wizard') {
            seed['Wizard|currentHitPoints'] = 20;
            seed['Wizard|maxHitPoints'] = 30;
            seed['Wizard|concentration'] = null; // read at :34-36; dc-stamp face is .concentration
        }
        const { reads, writes } = seedStore(seed);

        applyWardingBond(goblin, { creatures: [paladin, wizard, goblin] }, campaignName, 5);

        if (winner === null) {
            // :59 find locks onto the malformed first entry; :60 aborts the WHOLE
            // apply — the valid second bond never fires (QUIRK, report-only).
            expect(reads).toEqual(['Goblin|activeBuffs']);
            expect(writes).toEqual([]);
            expect(paladin.currentHp).toBe(20); // untouched bystander
            expect(addEntry).not.toHaveBeenCalled();
        } else if (winner === 'Wizard') {
            // Swapped order: Wizard (player path) takes the full 5 mirror via store.
            expect(paladin.currentHp).toBe(20); // loser bystander untouched (:29 unreached)
            expect(reads).toEqual([
                'Goblin|activeBuffs',
                'Wizard|currentHitPoints',
                'Wizard|maxHitPoints',
                'Wizard|concentration',
            ]);
            expect(writes).toEqual([['Wizard', 'currentHitPoints', 15]]); // store tuple byte
            expect(addEntry).toHaveBeenCalledTimes(1);
            const entry = addEntry.mock.calls[0][1];
            expect(entry.targetName).toBe('Wizard');
            expect(entry.delta).toBe(-5); // full mirror, winner is the caster
            expect(entry.currentHp).toBe(15);
        } else {
            // Original order: first-match entry is {shield-skipped, Paladin}.
            expect(paladin.currentHp).toBe(15); // winner byte
            expect(reads).toEqual(['Goblin|activeBuffs']); // loser store never touched
            expect(writes).toEqual([]);
            expect(addEntry).toHaveBeenCalledTimes(1);
            const entry = addEntry.mock.calls[0][1];
            expect(entry.targetName).toBe('Paladin');
            expect(entry.delta).toBe(-5);
            expect(entry.currentHp).toBe(15);
        }
        expect(consoleError).not.toHaveBeenCalled();
    });
});
