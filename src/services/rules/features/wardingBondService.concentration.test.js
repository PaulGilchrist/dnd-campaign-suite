// @maintained-by-ai
// LANE: this file owns ONLY the concentration-DC stamp in shareWardingBondDamage —
// wardingBondService.js:78-98 (`if (concentration && sharedDamage > 0)` → player leg
// clone-write setRuntimeValue(casterName,'concentration',{...concentration,dc},campaign)
// fix#349 #1425; NPC leg in-place casterCreature.concentration.dc = ...,
// combatSummary-persisted like applyDamage.js:910) — plus WHERE the
// concentration object comes from on each caster path (non-player: `casterCreature.concentration`
// :36; player: live store object at getRuntimeValue(casterName, 'concentration', campaign) :34-35).
// Sibling lanes (verified by header scan, never duplicated here):
//   .test.js       — buff lookup gates (:57-62), distance gate/end (:67-75), SP-125 end envelopes
//   .damage.test.js— HP arithmetic (:22-30), full hp_change envelopes, both caster HP paths (:78-80)
//   .log.test.js   — hp_change payload bytes
//   .edgeCases.test.js — wardDamage 0 '-0' artifact, #1427 negative/NaN loud-refuse
//     arms (delta -0 byte lives there) multi-buff first-match
//   .errors.test.js — addEntry rejection console.error('[wardingBond] Error:', e)
// DISK TEXT (both rulesets): public/data/spells.json + public/data/2024/spells.json 'Warding Bond':
// concentration: false, duration '1 hour', "each time it takes damage, you take the same amount of
// damage" — full (not half) mirror is the disk-RAW byte, pinned by .damage.test.js
// ('uses the wardDamage parameter as the shared damage value'); the dc floor(dmg/2) here is the
// concentration-save-DC house seam on the caster's OTHER concentration. NO-CLOCK POLICY: this lane
// contains zero minutes×N / Date.now() gates / expiry countdowns — the '1 hour' disk duration is
// combat-scoped per policy and never counted down here (Date.now() at :18 is a log stamp only,
// owned by endWardingBond/log lanes).
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
// getRuntimeValue returns the LIVE stored reference — production useRuntimeState.js:74
// (`store.get(propertyName)`) does the same, which is what lets :48 mutate concentration
// in place without a write-back.
function seedStore(initial, writeOverrides = {}) {
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
        const override = writeOverrides[`${owner}|${key}`];
        if (override) return override(); // REAL-PROMISE inject: awaited by the service's fix#352(e) loud-CATCH arm
        data.set(`${owner}|${key}`, value);
    });
    return { reads, writes, data };
}

function bondBuff(casterName) {
    return [{ effect: 'warding_bond', sourceCharacter: casterName }];
}

function withinRange30() {
    getDistanceFeet.mockReturnValue(30);
}

describe('wardingBondService concentration DC stamp (service :78-98, fix#349 store-first)', () => {
    let consoleError;

    beforeEach(() => {
        // vitest 4: resetAllMocks strips implementations retained by clearAllMocks —
        // every fake below is re-seeded explicitly per test (bond state never persists).
        vi.resetAllMocks();
        addEntry.mockResolvedValue(undefined);
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    // NPC caster riding inside combatSummary: concentration is read from — and
    // mutated on — the caster creature object (service :36), never the store.
    // High HP keeps every row non-terminal so endWardingBond (base lane) stays out.
    it.each([
        // dmg, seeded dc, expected dc, why
        [0, 15, 15, 'sharedDamage > 0 guard (:47) blocks the stamp'],
        [5, 15, 10, 'clamped to 10, OVERWRITING the higher seed dc — Math.max is against 10, not the existing dc'],
        [25, 15, 12, 'odd half floored: floor(25/2) = 12 (disk text silent on dc; floor byte is the pin)'],
        [100, 10, 50, 'no RAW max-30 cap in production — honest pin of computed half'],
    ])('dc %i -> %i after %i shared damage (%#)', (dmg, seedDc, expectedDc) => {
        withinRange30();
        const conc = { dc: seedDc };
        const paladin = { name: 'Paladin', currentHp: 999, maxHp: 999, concentration: conc };
        const goblin = { name: 'Goblin' };
        const { reads, writes } = seedStore({ 'Goblin|activeBuffs': bondBuff('Paladin') });

        applyWardingBond(goblin, { creatures: [paladin, goblin] }, campaignName, dmg);

        expect(paladin.concentration).toBe(conc); // same object mutated — no replacement
        expect(conc.dc).toBe(expectedDc);
        expect(paladin.currentHp).toBe(999 - dmg); // damage path really executed
        // Store census: buffs lookup is the ONLY store touch on the NPC-caster lane.
        expect(reads).toEqual(['Goblin|activeBuffs']);
        expect(writes).toEqual([]);
        expect(addEntry.mock.calls.map(c => c[1].type)).toEqual(['hp_change']);
    });

    it('falsy concentration triple (null/undefined/0) is untouched while damage still lands', () => {
        withinRange30();
        const goblin = { name: 'Goblin' };

        for (const seed of [null, undefined, 0]) {
            vi.resetAllMocks();
            addEntry.mockResolvedValue(undefined);
            const paladin = { name: 'Paladin', currentHp: 999, maxHp: 999, concentration: seed };
            const { reads, writes } = seedStore({ 'Goblin|activeBuffs': bondBuff('Paladin') });

            applyWardingBond(goblin, { creatures: [paladin, goblin] }, campaignName, 5);

            expect(paladin.concentration, `seed ${String(seed)}`).toBe(seed);
            expect(paladin.currentHp, `seed ${String(seed)}`).toBe(994);
            expect(reads).toEqual(['Goblin|activeBuffs']);
            expect(writes).toEqual([]);
        }
    });

    // fix#349 #1425 dc-write-goes-through-store arm — RETIRES the old QUIRK
    // PIN ('stamps dc on the LIVE store concentration object and never writes
    // the key back'): the player leg now clone-writes { ...concentration, dc }
    // through setRuntimeValue (store-first law, sleetStormHandler.js:219-224
    // idiom), so the dc PERSISTS and BROADCASTS. The live seeded object is now
    // untouched — raw in-place store mutation alone must never land.
    it('player caster: dc write goes through the store as a clone — setRuntimeValue(concentration) carries the new dc, live object untouched', () => {
        withinRange30();
        const goblin = { name: 'Goblin' };
        const conc = { dc: 15 };
        // Caster absent from combatSummary -> casterIsPlayer (:77 `!casterCreature`);
        // null distance stays in range (rangeCheck.js:44 `dist == null || ...`).
        const { reads, writes } = seedStore({
            'Goblin|activeBuffs': bondBuff('Paladin'),
            'Paladin|currentHitPoints': 100,
            'Paladin|maxHitPoints': 200,
            'Paladin|concentration': conc,
        });

        applyWardingBond(goblin, { creatures: [goblin] }, campaignName, 45);

        expect(conc.dc).toBe(15); // LIVE store object NEVER mutated in place
        expect(reads).toEqual([
            'Goblin|activeBuffs',
            'Paladin|currentHitPoints',
            'Paladin|maxHitPoints',
            'Paladin|concentration',
        ]);
        // Writes: currentHitPoints (:51) then the concentration clone carrying
        // dc = floor(45/2) = 22 — the pre-fix silent-drift byte (no write-back)
        // is dead; the key now persists with the full concentration shape.
        expect(writes).toEqual([
            ['Paladin', 'currentHitPoints', 55],
            ['Paladin', 'concentration', { dc: 22 }],
        ]);
        // store truth: the key now HOLDS the new dc (write-back landed)
        expect(reads.length).toBe(4);
    });

    // fix#352(e) arm: the player-leg concentration write (service :111) is
    // fire-and-forget RETAINED (fix#349(d)) but now carries a loud-CATCH —
    // a rejected store write surfaces in a microtask, silent strands die.
    it('store-reject arm: rejected concentration write logs loudly, never strands silent (fix#352(e))', async () => {
        withinRange30();
        const conc = { dc: 15 };
        const errC = new Error('concentration store down');
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const goblin = { name: 'Goblin' };
            const { writes, data } = seedStore(
                {
                    'Goblin|activeBuffs': bondBuff('Paladin'),
                    'Paladin|currentHitPoints': 100,
                    'Paladin|maxHitPoints': 200,
                    'Paladin|concentration': conc,
                },
                { 'Paladin|concentration': () => Promise.reject(errC) },
            );
            addEntry.mockResolvedValue(undefined);

            applyWardingBond(goblin, { creatures: [goblin] }, campaignName, 45);

            // Sync census: both write ATTEMPTS recorded; a REAL Promise rejects
            // only in a microtask, so console is still clean here.
            expect(writes).toEqual([
                ['Paladin', 'currentHitPoints', 55],
                ['Paladin', 'concentration', { dc: 22 }],
            ]);
            expect(consoleError.mock.calls).toEqual([]);

            for (let i = 0; i < 10; i++) await Promise.resolve(); // bounded flush (#1401 form)
            expect(consoleError.mock.calls).toEqual([['[wardingBond] caster concentration store reject:', errC]]);
            expect(consoleError.mock.calls[0][1]).toBe(errC); // identical instance #1385
            expect(data.get('Paladin|concentration')).toBe(conc); // stranded honesty: dc lives only in the refused copy
        } finally {
            consoleError.mockRestore();
        }
    });

    it('lethal mirror damage still stamps dc before the bond ends, and ending leaves the concentration object intact', () => {
        withinRange30();
        const conc = { dc: 15 };
        const paladin = { name: 'Paladin', currentHp: 3, maxHp: 10, concentration: conc };
        const goblin = { name: 'Goblin' };
        const { reads, writes } = seedStore({
            'Goblin|activeBuffs': bondBuff('Paladin'),
            'Paladin|activeBuffs': bondBuff('Paladin'),
        });

        applyWardingBond(goblin, { creatures: [paladin, goblin] }, campaignName, 25);

        expect(conc.dc).toBe(12); // :47-48 run BEFORE the drop-to-0 end at :51
        expect(paladin.currentHp).toBe(0);
        // End envelope (base owns SP-125 strips broadly): exact read order through endWardingBond
        // and both activeBuffs strips, with NO concentration-key write anywhere.
        expect(reads).toEqual([
            'Goblin|activeBuffs',
            'Goblin|activeBuffs',
            'Paladin|activeBuffs',
        ]);
        expect(writes).toEqual([
            ['Goblin', 'activeBuffs', []],
            ['Paladin', 'activeBuffs', []],
        ]);
        expect(addEntry.mock.calls.map(c => c[1].type)).toEqual(['hp_change', 'ability_use']);
        expect(addEntry.mock.calls[1][1].description).toBe(
            'Warding Bond ends — Paladin dropped to 0 hit points.' // em dash byte-exact (:17)
        );
    });
});
