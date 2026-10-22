// @maintained-by-ai
// LANE: this .test.js base file owns ONLY the family-map face cited VERBATIM by all five
// siblings: ".test.js — buff-lookup gates (:57-62), distance gate/end (:67-75),
// SP-125 end envelopes" (.concentration:8, .damage:7, .log:9-10, .errors:5,
// .edgeCases:17-18). Concretely: the gate BLOCK shapes (every input that must stop at
// :57-62 or :69-71 before any damage), the exact-boundary distance pair #1345
// (60 stays bonded, 61 ends), the INTENTIONAL null-distance leniency contract, and the
// endWardingBond (:6-20) STRIP TUPLES + separation-end envelope bytes.
// Sibling faces CITED, never re-grown here:
//   .damage.test.js — HP arithmetic (:22-30/:81-83), caster-hp-0 gate (:81) census,
//                     both caster-HP read paths (:77-80), terminal clamp rows incl the
//                     isUnconscious byte (#1426); player-store path inSummary:false (:201-244)
//   .concentration  — dc stamp VALUES (:47-49), lethal-end census (:190-198 there) and
//                     the exact em-dash end byte 'Warding Bond ends — Paladin dropped to
//                     0 hit points.' (:200-202 there), Date.now() :18 sentinel (#1428)
//   .log            — settled hp_change payload bytes field-by-field (:95, :193-203 there)
//   .edgeCases      — '-0' delta artifact, #1427 negative/NaN loud-refuse arms (bond
//                     never heals — fix verified), NaN-invalid refuse rows, multi-buff
//                     first-match SWAP census (#1427) — every gate row here is SINGLE-buff;
//                     the swapped-order pin is deliberately NOT duplicated (GATE shape only)
//   .errors         — rejection console arms '[wardingBond] Error:' (:46) and
//                     '[wardingBond] Break log error:' (:19) (#1382/#1385/#1388/#1428) —
//                     success rows census console CLEAN, the stub is never cloned.
// REC #1 EXECUTED (verbatim: "Stale { catch: fn => fn() } success-path-fires-catch stub
// persists in wardingBondService.test.js:13 ... candidates for those lanes' next
// maintenance"): the fake-thenable at old :13 is GONE. addEntry is a plain vi.fn()
// re-seeded mockResolvedValue(undefined) per test (#1312: vitest-4 clearAllMocks RETAINS
// implementations, so this file uses vi.resetAllMocks + explicit per-row re-seed).
// The service's floating .catch (:19/:46) now settles a REAL Promise in a microtask and
// NEVER fires its console handler on success — proven by the bounded 10-tick flush
// (#1401 form) + empty console census on every log-reaching row. Rejection-console face
// belongs to .errors — cited, never cloned here.
// REC #2 EXECUTED (verbatim: "wardingBondService.test.js:142-147 stale comment claims
// distance===null production bug; current source :67-75 null-distance is INTENTIONAL
// leniency (rangeCheck.js:44 lenient)"): the bug-narration comment and the
// 'documents production bug' test titles are REMOVED. Current contract, pinned as
// behavior rows below: source :67 short-circuits distance to null when either creature
// is missing (or unpositioned); :68 comment says gridless leniency; :69 guard is
// `distance != null && !isDistanceInRange(...)`; isDistanceInRange REAL (unmocked,
// family standard per #1427/#1428) returns true for null at rangeCheck.js:45
// (`dist == null || dist <= rangeFt`). Null distance therefore PASSES the gate.
// DISTANCE FACE: rangeCheck.js REAL is the family standard (repo rule: range checks flow
// through rangeCheck/isWithinRange) — only getDistanceFeet (rangeValidation.js) is
// mocked, as every sibling does. Exact boundary BOTH sides (#1345): 60 stays bonded
// (real comparator: 60 <= 60), 61 ends (:69-71, real comparator: 61 > 60). .errors:283
// touches 61 only as an error-path discriminator; the 60/61 boundary census is THIS lane.
// SP-125 (git 9c745d7f6: "fix(SP-125): Warding Bond — +1 AC bonus never reaches the AC
// resolver and ward te stripped at caster's next turn-start instead of lasting 1 hour"):
// in THIS service the ticket's end-of-bond contract is that the bond ends ONLY via the
// two explicit triggers — separation > 60 ft (:69-71) and caster drop to 0 HP (:51-53).
// There is NO turn-start / clock strip. Pinned as exact ability_use envelope bytes (the
// separation row — the description string .log:10 cedes to this lane as 'separation-end
// description') plus the NEGATIVE assertion that every bonded row writes ZERO activeBuffs
// strips (:9/:12 are unreachable unless endWardingBond runs).
// QUIRK SCAN (this face's inputs): (1) LATCH STRICTNESS: :59 latch is
// effect === 'warding_bond' EXACT — decoy rows 'WARDING_BOND' and 'warding bond'
// (space vs underscore) block; the latch-byte face is owned here per map (:57-62).
// (2) GOLDEN UNGUARDED DEREF: a buffs array containing a null entry makes :59
// `b.effect` throw TypeError synchronously — service has ZERO try/catch (.errors:21),
// so it propagates native across the applyDamage.js:804 sync-void caller boundary
// ('do not reorder' — .errors:37-41) with console UNTOUCHED (#1360 golden form,
// cited .errors:25). (3) SILENT-NULL GUARDS: production store miss returns
// null (useRuntimeState.js:76 `hasKey ? store.get(propertyName) : null` — re-read disk
// this pass); the :58 Array.isArray guard turns that into a silent block — pinned.
// (4) NEVER-EXECUTED GUARDS: :73-75 second isDistanceInRange is DEAD (any dist that
// reaches it already passed :69, whose false domain is exactly dist!=null && dist>60) —
// reported twice, cited (.damage:34-35, .edgeCases:32-37); NO new in-lane row.
// (5) CHOKEPOINT INLINE-DUP #1357: endWardingBond :7-12 repeats read-filter-write
// inline for target and caster — the behavior impact is exactly the two strip tuples,
// pinned once per end row; not grown into its own test.
// (6) te-source collision: N/A declared — this service never touches targetEffects.
// (7) shareWardingBondDamage receives combatSummary at :82 but its destructure (:22)
// ignores it — dead parameter, report-only.
// MARKER INCIDENT #1361: exactly one marker, this line, line 1 only.
// SUITE-NAME-VS-BEHAVIOR #1423: every title states the pinned behavior. VACUOUS
// HARVEST: gate rows are non-vacuous via the THROWING store fake — any read past :57
// aborts the row — and getDistanceFeet/write/log censuses are exact arrays; no bare
// toHaveBeenCalled()/some()/length>0 on any mutation claim.
// INPUT PURITY #1395: struck-target snapshot compared on damage rows.
// STUBS: argument-keyed STATEFUL store fake THROWS on unknown owner|key, wrong
// campaign, arity drift (get=3/set=4) (#1372/#1393/#1400/#1425-#1429); console.error
// spy restored afterEach; vi.useRealTimers in afterEach guards the one fake-clock row.
// NO-CLOCK: zero timers gate game state. The only clock touch is vi.useFakeTimers on
// the separation-end row to freeze the Date.now() log stamp at :18 (benign determinism);
// the end-entry timestamp byte on the lethal trigger is cited to .concentration #1428 —
// the lethal row asserts a typeof-number sentinel only, never the byte.
// STANDARDS: full-set envelopes + exact key-set arrays (#1419/#1421/#1424 bar — the
// old single-field objectContaining pattern purged at .log); addEntry arity-2 +
// campaign byte on every log row (#1408 disk truth, .log:35-37).
// CALLER BOUNDARY: applyDamage.js:804 (handleWardedDamageEvents, 'do not reorder') —
// applyWardingBond is sync-void; cited to .errors:37-41, not re-proven here.
// DEAD-EXPORT: sole export applyWardingBond (:56), LIVE re-verified at
// applyDamage.js:804 (cited .damage:32-33, #1426).
// ZERO-DICE: damage arrives pre-rolled as the wardDamage parameter — no RNG here.
// PRESERVED-CITED-BY: siblings cite this lane's SOURCE faces by number only
// (".test.js — buff-lookup gates (:57-62), distance gate/end (:67-75), SP-125 end
// envelopes" at .concentration:8, .damage:7, .log:9-10, .errors:5, .edgeCases:17-18);
// grep for inbound test-file-line citations into this file: none exist — service-line
// numbers cannot shift with edits here, so no ledger renumbering is required.
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
    // REC #1: plain vi.fn() — NO { catch: fn => fn() } fake-thenable. Re-seeded
    // mockResolvedValue(undefined) per test; the floating .catch never fires on success.
    addEntry: vi.fn(),
}));

// rangeCheck.js deliberately UNMOCKED — real isDistanceInRange is the family standard
// (lenient null at :45). Only getDistanceFeet is mocked, as every sibling does.
vi.mock('../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

const campaignName = 'TestCampaign';

// DISTINGUISHABLE FIXTURES #1348 — NEW names/numbers (siblings consumed 10/7/3,
// 26/52/16, 100/200/55, 5/-3, 18/24/9, 19/23/13, 42, 30, 61, 999 and names
// Paladin/Goblin/Sprite/Wizard/Seraphine/Grix/Kestrel/Harsk): caster Thessa 64/80,
// mirror damage 6, in-range distance 47, boundary 60/61, target Grul, bystander Nyssa
// 12/12, lethal pair 4/9, preserved-buff byte 'aegis_mark'.
const CASTER = 'Thessa';
const TARGET = 'Grul';
const PRESERVED_BUFF = { effect: 'aegis_mark', sourceCharacter: CASTER };

// Argument-keyed STATEFUL store fake. Throws on unknown owner|key, wrong campaign,
// arity drift at this service's call sites (getRuntimeValue/3, setRuntimeValue/4).
// Same fake shape as the sibling .damage/.concentration lanes so the family behaves
// identically under audit. Unseeded caster keys make "the gate stopped before the
// caster was ever read" non-vacuous: any leak PAST :57 THROWS here.
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

function bondBuff(casterName) {
    return [{ effect: 'warding_bond', sourceCharacter: casterName }];
}

// Bounded microtask flush (#1401 form, .log:142 idiom): the service is synchronous;
// only the two floating .catch arms (:19/:46) are async. 10 fixed ticks, no timers.
const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('wardingBondService base lane — buff-lookup gates (:57-62) block before any distance, damage, write, or log', () => {
    let consoleError;

    beforeEach(() => {
        // vitest 4: resetAllMocks strips implementations retained by clearAllMocks —
        // every fake is re-seeded explicitly per test (#1312, rec #1).
        vi.resetAllMocks();
        addEntry.mockResolvedValue(undefined); // REAL Promise — rec #1
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    // Every row must BLOCK at :57-62: the throwing store fake proves the target buff
    // lookup is the ONLY read ever attempted (caster keys unseeded — any leak throws),
    // getDistanceFeet is never reached, zero writes, zero log entries, clean console.
    // SINGLE-buff shapes only — the multi-buff first-match/swap census is .edgeCases
    // (#1427) and is deliberately not duplicated here (GATE shape only).
    it.each([
        // label, buffs value at 'Grul|activeBuffs', blocked-at
        ['store miss returns null (production useRuntimeState.js:76)', null, ':58 Array.isArray guard — silent block'],
        ['store holds a non-array object', {}, ':58 Array.isArray guard'],
        ['store holds an empty array', [], ':59 find misses'],
        ['other effects only — no warding_bond', [{ effect: 'holy_aura' }, { effect: 'shield' }], ':59 find misses'],
        ['entry without an effect key', [{ sourceCharacter: CASTER }], ':59 b.effect undefined — miss'],
        ['case-drift decoy: uppercase latch', [{ effect: 'WARDING_BOND', sourceCharacter: CASTER }], ':59 latch exact byte'],
        ['separator-drift decoy: space not underscore', [{ effect: 'warding bond', sourceCharacter: CASTER }], ':59 latch exact byte'],
        ['bond without sourceCharacter', [{ effect: 'warding_bond' }], ':60 !sourceCharacter clause'],
        ['bond with empty-string sourceCharacter', [{ effect: 'warding_bond', sourceCharacter: '' }], ':60 falsy sourceCharacter slot'],
        ['self-sourced bond (source === struck creature)', [{ effect: 'warding_bond', sourceCharacter: TARGET }], ':60 sourceCharacter === creature.name clause'],
    ])('gate BLOCKS on %s (%#)', (_label, buffs, _blockedAt) => {
        // Distance pre-seeded: if the gate leaked, getDistanceFeet WOULD return 47 and
        // the mirror WOULD fire — the exact censuses below catch any such leak.
        getDistanceFeet.mockReturnValue(47);
        const thessa = { name: CASTER, currentHp: 64, maxHp: 80, position: { x: 1, y: 1 } };
        const grul = { name: TARGET, position: { x: 2, y: 1 } };
        const { reads, writes } = seedStore({ [`${TARGET}|activeBuffs`]: buffs });

        applyWardingBond(grul, { creatures: [thessa, grul] }, campaignName, 6);

        expect(reads).toEqual(['Grul|activeBuffs']);
        expect(getDistanceFeet.mock.calls).toEqual([]);
        expect(writes).toEqual([]);
        expect(thessa.currentHp).toBe(64); // mirror never fired
        expect(addEntry.mock.calls).toEqual([]);
        expect(consoleError.mock.calls).toEqual([]);
    });

    it('golden unguarded deref: null entry inside the buffs array throws TypeError synchronously — console untouched, nothing written (#1360 golden form)', () => {
        getDistanceFeet.mockReturnValue(47);
        const grul = { name: TARGET, position: { x: 2, y: 1 } };
        const { reads, writes } = seedStore({
            [`${TARGET}|activeBuffs`]: [{ effect: 'holy_aura' }, null],
        });

        // :59 `b.effect` on the null entry; the service has ZERO try/catch (.errors:21)
        // so it propagates native across the applyDamage.js:804 sync-void boundary
        // (caller serialization cited .errors:37-41) — gates never reached the log.
        expect(() => applyWardingBond(grul, { creatures: [grul] }, campaignName, 6))
            .toThrow(TypeError);

        expect(reads).toEqual(['Grul|activeBuffs']);
        expect(writes).toEqual([]);
        expect(addEntry.mock.calls).toEqual([]);
        expect(consoleError.mock.calls).toEqual([]); // rejection-console face is .errors — cited, not cloned
    });

    // :73-75 second isDistanceInRange guard: DEAD code, reported twice — cited
    // (.damage:34-35, .edgeCases:32-37); declared NO new in-lane row (quirk scan #4).
});

describe('wardingBondService base lane — distance gate (:67-71): bond HOLDS on 60/60 and on lenient null distance', () => {
    let consoleError;

    beforeEach(() => {
        vi.resetAllMocks();
        addEntry.mockResolvedValue(undefined);
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    // REC #2 CONTRACT ROWS (replacing the retired 'production bug' narration): null
    // distance is INTENTIONAL leniency (source :68 comment; rangeCheck.js:45
    // `dist == null || dist <= rangeFt`). Two distinct null paths both PASS:
    //   'both-unpositioned': both creatures in summary, both lack positions, the mocked
    //     getDistanceFeet returns null (:67 branch A still CALLS it);
    //   'target-absent': grul missing from summary -> :67 `casterCreature && targetCreature`
    //     short-circuits to null and getDistanceFeet is NEVER called (branch B).
    // 60 is the exact in-side of the #1345 boundary via the REAL comparator (out-side 61
    // is pinned in the end describe below). Arithmetic VALUES are .damage's face — the
    // 58 byte here is only the gate-pass witness that the mirror executed.
    it.each([
        ['in range 47 ft', 47, 'measured'],
        ['EXACT boundary 60 ft stays bonded (#1345 in-side, real :67-71 + rangeCheck :45)', 60, 'measured'],
        ['null distance — both creatures present but unpositioned: INTENTIONAL leniency (rec #2)', null, 'both-unpositioned'],
        ['null distance — target absent from summary: :67 short-circuit, feet never called (rec #2)', null, 'target-absent'],
    ])('gate PASSES at %s — bond buffs survive, zero strips (SP-125 no premature end)', async (_label, feet, shape) => {
        getDistanceFeet.mockReturnValue(feet);
        const thessa = { name: CASTER, currentHp: 64, maxHp: 80 };
        const grul = { name: TARGET };
        if (shape === 'measured') {
            thessa.position = { x: 1, y: 1 };
            grul.position = { x: 2, y: 1 };
        }
        const bystander = { name: 'Nyssa', currentHp: 12, maxHp: 12 };
        const grulSnapshot = JSON.parse(JSON.stringify(grul)); // input purity #1395
        const creatures = shape === 'target-absent'
            ? [thessa, bystander] // grul absent -> targetCreature undefined -> null dist
            : [thessa, grul, bystander];
        const { reads, writes } = seedStore({ [`${TARGET}|activeBuffs`]: bondBuff(CASTER) });

        applyWardingBond(grul, { creatures }, campaignName, 6);

        await flushMicrotasks(); // rec #1: REAL settled Promise — .catch (:46) never fires

        if (shape === 'measured') {
            expect(getDistanceFeet.mock.calls).toEqual([[thessa.position, grul.position]]);
        } else if (shape === 'both-unpositioned') {
            expect(getDistanceFeet.mock.calls).toEqual([[undefined, undefined]]);
        } else {
            expect(getDistanceFeet.mock.calls).toEqual([]);
        }
        expect(thessa.currentHp).toBe(58); // gate passed -> FULL mirror executed (:23)
        expect(JSON.parse(JSON.stringify(grul))).toEqual(grulSnapshot);
        expect(bystander.currentHp).toBe(12); // survivor scoping #1327
        // SP-125 negative witness: a held bond strips NOTHING (:9/:12 unreached).
        expect(reads).toEqual(['Grul|activeBuffs']);
        expect(writes).toEqual([]);
        // Exactly ONE entry and it is NOT an end entry; payload bytes are .log's face.
        expect(addEntry.mock.calls).toHaveLength(1);
        expect(addEntry.mock.calls[0]).toHaveLength(2);
        expect(addEntry.mock.calls[0][0]).toBe(campaignName);
        expect(addEntry.mock.calls.map(c => c[1].type)).toEqual(['hp_change']);
        expect(consoleError.mock.calls).toEqual([]); // success never fires .catch (:46)
    });
});

describe('wardingBondService base lane — bond ENDS (:69-71 separation, :51-53 lethal) — SP-125 end envelopes', () => {
    let consoleError;

    beforeEach(() => {
        vi.resetAllMocks();
        addEntry.mockResolvedValue(undefined);
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
        vi.useRealTimers();
    });

    it('EXACT boundary out-side (#1345): 61 ft ends the bond — no mirror damage, full-set ability_use envelope byte-pinned under a frozen clock, both strip tuples land preserving other buffs', async () => {
        // Real (unmocked) rangeCheck.js comparator: isDistanceInRange(61, 60) === false
        // consumes :69 -> endWardingBond(:70-71) -> return; caster HP must be untouched.
        // Fake clock freezes the :18 Date.now() stamp for byte determinism (benign,
        // NO-CLOCK allows); end-entry stamps on the lethal trigger are cited to
        // .concentration #1428 — separation description bytes are THIS lane's (.log:10).
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-21T12:34:56Z'));
        getDistanceFeet.mockReturnValue(61);
        const thessa = { name: CASTER, currentHp: 64, maxHp: 80, position: { x: 0, y: 0 } };
        const grul = { name: TARGET, position: { x: 5, y: 1 } };
        const { reads, writes } = seedStore({
            [`${TARGET}|activeBuffs`]: [...bondBuff(CASTER), PRESERVED_BUFF],
            [`${CASTER}|activeBuffs`]: bondBuff(CASTER),
        });

        applyWardingBond(grul, { creatures: [thessa, grul] }, campaignName, 6);

        await flushMicrotasks();

        expect(getDistanceFeet.mock.calls).toEqual([[thessa.position, grul.position]]);
        expect(thessa.currentHp).toBe(64); // NO mirror damage — the bond ended instead (:71)

        // Read order :57 -> endWardingBond(:7 -> :10) — exact census.
        expect(reads).toEqual([
            'Grul|activeBuffs',
            'Grul|activeBuffs',
            'Thessa|activeBuffs',
        ]);
        // SP-125 strip tuples (:9/:12): bond removed, NON-bond buffs preserved byte-exact
        // (chokepoint inline-dup #1357: target+caster pattern pinned once, here).
        expect(writes).toEqual([
            ['Grul', 'activeBuffs', [PRESERVED_BUFF]],
            ['Thessa', 'activeBuffs', []],
        ]);

        // FULL-SET end envelope (#1419/#1421/#1424 bar — no objectContaining):
        expect(addEntry.mock.calls).toHaveLength(1);
        const [campaignArg, entry] = addEntry.mock.calls[0];
        expect(addEntry.mock.calls[0]).toHaveLength(2);
        expect(campaignArg).toBe(campaignName);
        expect(Object.keys(entry)).toEqual(['type', 'characterName', 'abilityName', 'description', 'timestamp']);
        expect(entry).toEqual({
            type: 'ability_use',
            characterName: 'Thessa', // caster byte (:15), not the struck creature
            abilityName: 'Warding Bond', // service-owned literal (:16)
            description: 'Warding Bond ends — Grul separated from Thessa by more than 60 feet.', // :17 + :70 interpolation, exact
            timestamp: Date.UTC(2026, 9, 21, 12, 34, 56), // frozen :18 stamp
        });
        expect(consoleError.mock.calls).toEqual([]); // success never fires .catch (:19)
    });

    it('SP-125 lethal end (:51-53): caster drop-to-0 appends the ability_use entry AFTER the hp_change entry; strips land on both stores — em-dash description byte cited to .concentration:200-202, not cloned', async () => {
        // Trigger witness bytes only: 4 - 9 clamps to 0 at :25 (clamp arithmetic and the
        // isUnconscious byte are .damage/#1426's face). The exact lethal em-dash string
        // is .concentration's (:200-202) — this row discriminates the TRIGGER via the
        // reason tail and the ENTRY ORDER (hp_change first: damage landed, then end),
        // vs the separation row above (single ability_use, no damage). Fixtures are
        // lane-distinct (#1348) so even the shared census shape cannot mask a regression.
        getDistanceFeet.mockReturnValue(47);
        const thessa = { name: CASTER, currentHp: 4, maxHp: 80, position: { x: 1, y: 1 } };
        const grul = { name: TARGET, position: { x: 2, y: 1 } };
        const grulSnapshot = JSON.parse(JSON.stringify(grul)); // input purity #1395
        const { reads, writes } = seedStore({
            [`${TARGET}|activeBuffs`]: [...bondBuff(CASTER), PRESERVED_BUFF],
            [`${CASTER}|activeBuffs`]: bondBuff(CASTER),
        });

        applyWardingBond(grul, { creatures: [thessa, grul] }, campaignName, 9);

        await flushMicrotasks();

        expect(thessa.currentHp).toBe(0); // trigger condition byte (drop-to-0)
        expect(JSON.parse(JSON.stringify(grul))).toEqual(grulSnapshot);

        expect(reads).toEqual([
            'Grul|activeBuffs',
            'Grul|activeBuffs',
            'Thessa|activeBuffs',
        ]);
        expect(writes).toEqual([
            ['Grul', 'activeBuffs', [PRESERVED_BUFF]],
            ['Thessa', 'activeBuffs', []],
        ]);

        expect(addEntry.mock.calls.map(c => c[1].type)).toEqual(['hp_change', 'ability_use']);
        const [campaignArg, endEntry] = addEntry.mock.calls[1];
        expect(campaignArg).toBe(campaignName);
        expect(addEntry.mock.calls[1]).toHaveLength(2);
        expect(Object.keys(endEntry)).toEqual(['type', 'characterName', 'abilityName', 'description', 'timestamp']);
        expect(endEntry.type).toBe('ability_use');
        expect(endEntry.characterName).toBe(CASTER);
        expect(endEntry.abilityName).toBe('Warding Bond');
        // Cited, not cloned (.concentration:200-202 owns the exact em-dash byte):
        expect(endEntry.description).toContain('dropped to 0 hit points');
        expect(typeof endEntry.timestamp).toBe('number'); // NO-CLOCK type-sentinel only (#1428)
        expect(consoleError.mock.calls).toEqual([]); // rejection-console face is .errors — cited
    });
});
