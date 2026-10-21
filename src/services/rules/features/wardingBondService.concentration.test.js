// @maintained-by-ai
// LANE: this file owns ONLY the concentration-DC stamp in shareWardingBondDamage —
// wardingBondService.js:47-49 (`if (concentration && sharedDamage > 0)
// concentration.dc = Math.max(10, Math.floor(sharedDamage / 2))`) — plus WHERE the
// concentration object comes from on each caster path (non-player: `casterCreature.concentration`
// :36; player: live store object at getRuntimeValue(casterName, 'concentration', campaign) :34-35).
// Sibling lanes (verified by header scan, never duplicated here):
//   .test.js       — buff lookup gates (:57-62), distance gate/end (:67-75), SP-125 end envelopes
//   .damage.test.js— HP arithmetic (:22-30), full hp_change envelopes, both caster HP paths (:78-80)
//   .log.test.js   — hp_change payload bytes
//   .edgeCases.test.js — wardDamage 0/-3 multi-buff artifacts (delta -0 byte lives there)
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

function withinRange30() {
    getDistanceFeet.mockReturnValue(30);
}

describe('wardingBondService concentration DC stamp (service :47-49)', () => {
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

    it('player caster: stamps dc on the LIVE store concentration object and never writes the key back', () => {
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

        expect(conc.dc).toBe(22); // floor(45/2) — :48 mutates the object the store holds
        expect(reads).toEqual([
            'Goblin|activeBuffs',
            'Paladin|currentHitPoints',
            'Paladin|maxHitPoints',
            'Paladin|concentration',
        ]);
        // QUIRK PIN: currentHitPoints gets a setRuntimeValue write (:27) but the mutated
        // concentration dc does NOT — in-place store mutation, no write-back, no SSE broadcast.
        expect(writes.map(w => [w[1], w[2]])).toEqual([['currentHitPoints', 55]]);
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
