// @maintained-by-ai
// LANE: this .edgeCases file owns ONLY the three #1425/#1426/#1427 assigned byte families
// ("zero-shape '-0' delta artifact, negative/NaN input verdict, multi-buff first-match"):
//   1) -0 delta artifact (service shareWardingBondDamage delta byte) + the whole 0-swallow
//      duty: zero-shaped damage still WRITES (or mutates) and still EMITS the hp_change
//      entry carrying delta -0. Object.is is the ONLY valid discriminator (vitest
//      toEqual/toBe conflate +0/-0; toEqual(NaN) is satisfied by any NaN).
//   2) #1427 FIX-VERDICT (was QUIRK-1/QUIRK-2, now GATED at applyWardingBond entry):
//      non-finite wardDamage (undefined/NaN/null/string) -> LOUD console.error + refuse
//      BOTH legs (fix#39 strict-presence-before-coercion + fix#5 refuse-shape);
//      negative wardDamage -> LOUD refuse — RAW shares DAMAGE only ("each time it takes
//      damage, you take the same amount of damage", 5e spells.json:10387 + 2024
//      spells.json:14391), the old bytes healed the caster UNCAPPED (5/-10 -> 15/max10)
//      and logged POSITIVE delta with isHealing:false. Producer census: sole production
//      caller applyDamage.js:821 dispatches only under wardDamage > 0 (:900) — invalid
//      arrivals here are upstream programming errors, so refuse-loud, never clamp-fold.
//      Zero (-0/0) stays in-range and STILL emits: fix#49 renderer fourth arm
//      (LogHpHealingEntry.jsx:91 isZero -> 'No HP Change', delta decides polarity :90).
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
// NO-CLOCK: zero timers, zero Date.now() gates on this face. Every VALID input row takes
// the non-terminal branch (newHp>0), so endWardingBond — the service's only Date.now()
// (break-log stamp) — never executes in this lane; hp_change envelopes carry no timestamp
// key, so full-set toEqual is deterministic with no fake-timer freeze.
// ZERO-DICE: damage arrives pre-rolled as the wardDamage parameter; no RNG here.
// UNREACHABLE-GUARD RE-VERIFICATION: second isDistanceInRange guard stays dead
// from every edge angle — the real rangeCheck.js comparator returns true iff
// (range == null) or (dist == null) or (dist <= range); with the literal range 60 its
// FALSE domain is exactly dist!=null && dist>60, already consumed by the separation-end
// branch unless getDistanceFeet is nondeterministic across the two calls. No VALID input
// reaches it; INVALID (#1427) inputs die in the damage-executor gate before any write.
// Cited to the .damage dead-code report; not grown into a test.
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
        // [label, damage] — the two surviving in-range zero shapes: 0 and -0 both pass
        // the #1427 entry gate (Number.isFinite true, dmg < 0 false for -0) and coerce
        // to +0 in the HP math (Math.max(0, 17-0)=17) while the delta byte minted the
        // -0 artifact. Object.is is the discriminator: toEqual({delta: -0}) would ALSO
        // pass on +0. 0-swallow verdict: NOT swallowed — the hp_change entry still
        // emits and the caster HP write/mutation still happens (fix#49 fourth arm
        // renders it neutral 'No HP Change', never heal chrome).
        ['integer 0', 0],
        // legacy byte: the old lane pinned only this row, HP-10 value, objectContaining.
        ['negative-zero -0 input', -0],
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
        expect(writes).toEqual([]); // NPC caster mutates in place, never the store
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
            isHealing: false, // sign-derived: -0 > 0 is false (CharHitPoints.jsx:35 law)
            isUnconscious: false,
            abilityName: 'Warding Bond',
        });
        expect(consoleError).not.toHaveBeenCalled();
    });

    it.each([
        // #1427(c) LOUD-REFUSE rows (fix#5 refuse-shape in the damage executor):
        // non-finite wardDamage no longer poisons HP/stores with NaN — share-ward
        // returns with ZERO writes and ZERO logs, after nothing but the read-only
        // buff lookup (caster HP read may precede; pure read, no state touched).
        // null REFUSES (fix#39 refuse-does-not-fold: the old bytes coerced
        // Number(null)===0 into a -0 artifact entry). Strings '5'/'three' refuse
        // too: '5' would fold silently, 'three' poisoned caster HP with NaN.
        ['undefined', undefined],
        ['NaN', NaN],
        ['null', null],
        ['Infinity', Infinity],
        ['numeric string', '5'],
        ['word string', 'three'],
    ])('invalid input %# (%s): loud refuse — no write, no log, caster intact', (_label, dmg) => {
        getDistanceFeet.mockReturnValue(30);
        const paladin = npcCaster('Paladin', 17, 20);
        const goblin = { name: 'Goblin' };
        const { reads, writes } = seedStore({
            'Goblin|activeBuffs': [{ effect: 'warding_bond', sourceCharacter: 'Paladin' }],
        });

        applyWardingBond(goblin, { creatures: [paladin, goblin] }, campaignName, dmg);

        expect(paladin.currentHp).toBe(17); // untouched — NaN poison impossible now
        expect(reads).toEqual(['Goblin|activeBuffs']); // read-only lookup; executor gate precedes every write
        expect(writes).toEqual([]);
        expect(addEntry).not.toHaveBeenCalled(); // no NaN-carrying envelope
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(String(consoleError.mock.calls[0][0])).toContain('Invalid wardDamage');
        expect(String(consoleError.mock.calls[0][0])).toContain('non-finite');
    });

    it.each([
        // #1427(a)+(b) NEGATIVE-NEVER-HEALS rows: the bond mirrors DAMAGE (RAW both
        // rulesets). Negative input is upstream garbage (producer census: applyDamage.js
        // dispatches only wardDamage > 0 at :900 -> :821) and LOUD-REFUSED in the
        // damage executor. Pre-fix captured bytes (now structurally impossible):
        // [5,-3]->8, [5,-10]->15 on a maxHp-10 caster with POSITIVE delta logged
        // isHealing:false. Caster must stay EXACTLY at startHp; zero legs, one shout.
        // (Dead-caster rows belong to the untouched :110 casterHp gate — .damage lane.)
        // [startHp, dmg]
        [5, -3],
        [5, -10], // the ticket's landmark byte: pre-fix 15 vs maxHp 10
    ])('negative damage %# (hp %i, dmg %i): caster NEVER heals — loud refuse, zero legs', (hp, dmg) => {
        getDistanceFeet.mockReturnValue(30);
        const paladin = npcCaster('Paladin', hp, 10);
        const goblin = { name: 'Goblin' };
        const { reads, writes } = seedStore({
            'Goblin|activeBuffs': [{ effect: 'warding_bond', sourceCharacter: 'Paladin' }],
        });

        applyWardingBond(goblin, { creatures: [paladin, goblin] }, campaignName, dmg);

        expect(paladin.currentHp).toBe(hp); // no heal byte (pre-fix +3/+10 captured)
        expect(paladin.currentHp <= 10).toBe(true); // maxHp can never be exceeded
        expect(reads).toEqual(['Goblin|activeBuffs']);
        expect(writes).toEqual([]); // no buff strips, no HP writes — bond survives intact
        expect(addEntry).not.toHaveBeenCalled(); // contradiction entry cannot exist
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(String(consoleError.mock.calls[0][0])).toContain('Invalid wardDamage');
        expect(String(consoleError.mock.calls[0][0])).toContain('negative damage is not damage');
    });

    it('negative damage on a PLAYER caster: store stays clean (no uncapped heal write)', () => {
        // The pre-fix player-lane byte (captured 5/-10): setRuntimeValue('Wizard',
        // 'currentHitPoints', 15) against maxHitPoints 10. Post-fix: store NEVER
        // written — the refuse happens after the read-only HP lookup, before any write.
        getDistanceFeet.mockReturnValue(30);
        const wizard = { name: 'Wizard', type: 'player' };
        const goblin = { name: 'Goblin' };
        const { reads, writes } = seedStore({
            'Goblin|activeBuffs': [{ effect: 'warding_bond', sourceCharacter: 'Wizard' }],
            'Wizard|currentHitPoints': 5,
        });

        applyWardingBond(goblin, { creatures: [wizard, goblin] }, campaignName, -10);

        expect(reads).toEqual(['Goblin|activeBuffs', 'Wizard|currentHitPoints']); // reads only, gate stops there
        expect(writes).toEqual([]); // pre-fix store byte ['Wizard','currentHitPoints',15] impossible
        expect(addEntry).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledTimes(1);
    });

    it.each([
        // #1427(b)+#1348 SIGN-CONVENTION COMPLIANCE rows: isHealing is DERIVED from
        // the delta sign in production (fixed byte `isHealing: delta > 0`; canonical
        // law CharHitPoints.jsx:35, renderer polarity fix#49 LogHpHealingEntry.jsx:90).
        // Every positive-damage row must carry NEGATIVE delta + isHealing:false; the
        // caster floor (Math.max clamp) keeps currentHp >= 0 (ceiling honored — a
        // damage mirror can never write above startHp, let alone above maxHp).
        // [startHp, dmg, expectedNewHp, expectedDelta]
        [17, 5, 12, -5], // ordinary mirror: exact full mirror, sign-honest envelope
        [10, 10, 0, -10], // exact drop to 0 is terminal: endWardingBond strips both buffs
        [10, 25, 0, -10], // overkill: floor clamp, delta = ACTUAL loss, never below 0
    ])('sign-convention row %# (hp %i, dmg %i): delta %i, isHealing false, floor honored', (hp, dmg, expectedNewHp, expectedDelta) => {
        getDistanceFeet.mockReturnValue(30);
        const paladin = npcCaster('Paladin', hp, 10);
        const goblin = { name: 'Goblin' };
        const seed = { 'Goblin|activeBuffs': [{ effect: 'warding_bond', sourceCharacter: 'Paladin' }] };
        if (expectedNewHp === 0) seed['Paladin|activeBuffs'] = seed['Goblin|activeBuffs'];
        const { writes } = seedStore(seed);

        applyWardingBond(goblin, { creatures: [paladin, goblin] }, campaignName, dmg);

        expect(paladin.currentHp).toBe(expectedNewHp);
        expect(paladin.currentHp <= hp).toBe(true); // damage mirror: never above start
        expect(paladin.currentHp >= 0).toBe(true); // floor clamp honored (#1348 matrix)
        const entry = addEntry.mock.calls[0][1];
        expect(entry.type).toBe('hp_change');
        expect(entry.delta).toBe(expectedDelta);
        expect(entry.delta <= 0).toBe(true); // bond lane emits damage-side delta ONLY
        expect(entry.isHealing).toBe(entry.delta > 0); // flag-and-delta coupling pin
        expect(entry.isHealing).toBe(false);
        expect(writes).toEqual(expectedNewHp === 0 ? [['Goblin', 'activeBuffs', []], ['Paladin', 'activeBuffs', []]] : []);
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
