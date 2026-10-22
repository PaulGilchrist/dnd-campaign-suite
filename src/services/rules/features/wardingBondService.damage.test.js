// @maintained-by-ai
// LANE: this file owns ONLY HP arithmetic (service :22-30/:81-83) and the full
// hp_change numeric envelopes (:37-46) on both caster-HP read paths (:77-80).
// #1425 split table, verbatim: ".damage.test.js — HP arithmetic (:22-30), full
// hp_change envelopes, both caster HP paths (:78-80)". Faces owned elsewhere and
// NEVER re-grown here:
//   .test.js          — buff-lookup gates (:57-62), distance gate/end (:67-75), SP-125 end envelopes
//   .concentration    — concentration-dc stamp (:47-49) + :34-36 read-source split; lethal end
//                       census + em-dash byte (:174-203 there); player in-place mutate no write-back
//                       QUIRK (:147-172 there)
//   .log              — hp_change payload/message bytes field-by-field
//   .edgeCases        — wardDamage 0 '-0' delta artifact, #1427 negative/NaN loud-refuse
//                       arms + sign-convention rows, multi-buff first-match
//   .errors           — addEntry rejection console.error('[wardingBond] Error:', e)
// MIRRORED DAMAGE IS FULL, NOT HALF (disk RAW, both rulesets):
// public/data/spells.json + public/data/2024/spells.json 'Warding Bond':
// "each time it takes damage, you take the same amount of damage". The /2 in this
// service exists only at :48 concentration-save-DC math (owned by .concentration).
// Upstream forwarding (applyDamage.js): :865 `let wardDamage = finalDamage;` —
// pre-rolled, unreduced by the bond; sole caller :804 inside handleWardedDamageEvents.
// Service signature (:56) forwards wardDamage verbatim into shareWardingBondDamage
// (:82); :23 `const sharedDamage = wardDamage;` — the shared-damage carrier pin.
// ZERO-DICE DECLARATION: damage arrives pre-rolled as the wardDamage parameter —
// this service contains no dice RNG, so no fixed-stub is needed (nothing to stub).
// NO-CLOCK: zero timers/Date.now() gates here. hp_change entries carry NO timestamp
// key (:37-46), so full-set envelopes are deterministic with no fake-timer freeze.
// The only Date.now() (:18) is the ability_use log stamp inside endWardingBond —
// inspected here only as an entry-type sentinel, never byte-read (log/base/concentration lanes).
// CLAMP SEMANTICS PIN (:25 Math.max(0, hp - shared)): overkill clamps newHp to 0 and
// the envelope delta byte equals ACTUAL HP lost, not raw damage (oldHp - newHp, :40).
// newHp <= 0 is always terminal (:51) — the bond ends on any drop to 0; end byte censuses
// cited to .concentration test 4 and .test.js SP-125, not duplicated.
// DEAD-EXPORT HUNT: service exports exactly one symbol, applyWardingBond (:56) — re-verified
// live via sole production caller applyDamage.js:804. No extras.
// NO-CLOCK QUIRK SCAN: service :73-75 second isDistanceInRange guard is unreachable
// dead code (reported in maintenance pass; gates themselves owned by .test.js lane).
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
// (`store.get(propertyName)`) does the same. Same fake shape as the sibling
// .concentration lane (:47-76) so the family behaves identically under audit.
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

const MISSING = Symbol('missing-key');

describe('wardingBondService damage lane — HP arithmetic and full hp_change envelopes', () => {
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

    it('uses the wardDamage parameter as the shared damage value', () => {
        // FULL-MIRROR RAW pin: "you take the SAME amount of damage" (both spells.json).
        // 10 - 7 = 3. A /2 mirror would leave 7 — the byte 3 discriminates full vs half.
        // Also pins: service writes ONLY the caster (target and bystander untouched),
        // NPC lane touches the store exactly once (the buff lookup), and the whole
        // hp_change numeric envelope as one exact set (payload message bytes owned by .log).
        getDistanceFeet.mockReturnValue(30);
        const paladin = { name: 'Paladin', currentHp: 10, maxHp: 10 };
        const goblin = { name: 'Goblin' };
        const sprite = { name: 'Sprite', currentHp: 40, maxHp: 40 };
        const { reads, writes } = seedStore({ 'Goblin|activeBuffs': bondBuff('Paladin') });

        applyWardingBond(goblin, { creatures: [paladin, goblin, sprite] }, campaignName, 7);

        expect(paladin.currentHp).toBe(3); // full mirror: sharedDamage === wardDamage (:23)
        expect(sprite.currentHp).toBe(40); // bystander never written (survivor scoping)
        expect('currentHp' in goblin).toBe(false); // target HP is the caller's job (:865 upstream)
        expect(reads).toEqual(['Goblin|activeBuffs']); // NO caster store read on the NPC lane
        expect(writes).toEqual([]); // NPC caster mutates in place (:29), never the store
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry.mock.calls[0][1]).toEqual({
            type: 'hp_change',
            targetName: 'Paladin',
            delta: -7, // raw damage, not halved
            currentHp: 3,
            maxHp: 10,
            isHealing: false,
            isUnconscious: false,
            abilityName: 'Warding Bond',
        });
        expect(consoleError).not.toHaveBeenCalled(); // addEntry resolved — rejection face owned by .errors
    });

    it.each([
        // [startHp, wardDamage, newHp, envelope delta, seed maxHp, envelope maxHp, terminal?]
        // Overkill: :25 clamps to 0; delta byte is ACTUAL loss (-10), NOT raw damage (-25).
        [10, 25, 0, -10, 10, 10, true],
        // Exact drop: no clamp distortion — delta matches raw damage.
        [25, 25, 0, -25, 25, 25, true],
        // Caster missing maxHp in combatSummary: :33 `|| 10` fallback lands in envelope.
        [17, 5, 12, -5, MISSING, 10, false],
    ])('NPC caster %i HP minus %i shared damage clamps per :25 (row %#)', (hp, dmg, newHp, delta, seedMaxHp, envMaxHp, terminal) => {
        getDistanceFeet.mockReturnValue(30);
        const paladin = { name: 'Paladin', currentHp: hp };
        if (seedMaxHp !== MISSING) paladin.maxHp = seedMaxHp;
        const goblin = { name: 'Goblin' };
        // Terminal rows must seed the caster's own buffs — endWardingBond (:10) strips
        // them from the STORE even for an in-summary NPC caster. Non-terminal rows leave
        // it unseeded: the fake THROWS if production reads it before the drop-to-0 gate.
        const seed = { 'Goblin|activeBuffs': bondBuff('Paladin') };
        if (terminal) seed['Paladin|activeBuffs'] = bondBuff('Paladin');
        const { reads, writes } = seedStore(seed);

        applyWardingBond(goblin, { creatures: [paladin, goblin] }, campaignName, dmg);

        expect(paladin.currentHp).toBe(newHp);
        expect(addEntry.mock.calls[0][1]).toEqual({
            type: 'hp_change',
            targetName: 'Paladin',
            delta,
            currentHp: newHp,
            maxHp: envMaxHp,
            isHealing: false,
            isUnconscious: newHp <= 0,
            abilityName: 'Warding Bond',
        });
        if (terminal) {
            // Drop-to-0 ends the bond (:51). Byte censuses live in .concentration test 4
            // and .test.js SP-125 — only structure is pinned here: read order through
            // endWardingBond and both activeBuffs strips, entry types in order.
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
        } else {
            expect(reads).toEqual(['Goblin|activeBuffs']);
            expect(writes).toEqual([]);
            expect(addEntry).toHaveBeenCalledTimes(1);
        }
    });

    it.each([
        // Both player-caster HP read paths (:77-80): HP comes from the LIVE STORE,
        // never from combatSummary. Caster absent from summary — getDistanceFeet is
        // not even called (null distance stays in range; gridless leniency face is .test.js).
        { inSummary: false },
        // Caster IN summary but type 'player' with STALE summary HP — :77 short-circuits
        // on type === 'player' and the store value wins (in-summary 999 is ignored).
        { inSummary: true },
    ])('player caster HP read from live store (in-summary: $inSummary) — setRuntimeValue write census', ({ inSummary }) => {
        const goblin = { name: 'Goblin' };
        const staleCaster = { name: 'Paladin', type: 'player', currentHp: 999, maxHp: 999 };
        const creatures = inSummary ? [staleCaster, goblin] : [goblin];
        if (inSummary) getDistanceFeet.mockReturnValue(30);
        const { reads, writes } = seedStore({
            'Goblin|activeBuffs': bondBuff('Paladin'),
            'Paladin|currentHitPoints': 26,
            'Paladin|maxHitPoints': 52,
            'Paladin|concentration': null, // read at :34-36; dc-stamp face owned by .concentration
        });

        applyWardingBond(goblin, { creatures }, campaignName, 10);

        // Write census: exact [owner, key, value] (campaign enforced by the fake's throw) —
        // value from the store (26 - 10), not the summary (999 - 10).
        expect(writes).toEqual([['Paladin', 'currentHitPoints', 16]]);
        expect(reads).toEqual([
            'Goblin|activeBuffs',
            'Paladin|currentHitPoints',
            'Paladin|maxHitPoints',
            'Paladin|concentration',
        ]);
        expect(staleCaster.currentHp).toBe(999); // player-in-summary never mutated in place (:26-27)
        expect(addEntry.mock.calls[0][1]).toEqual({
            type: 'hp_change',
            targetName: 'Paladin',
            delta: -10,
            currentHp: 16,
            maxHp: 52, // from store maxHitPoints (:31-32), not the stale 999
            isHealing: false,
            isUnconscious: false,
            abilityName: 'Warding Bond',
        });
        if (!inSummary) expect(getDistanceFeet).not.toHaveBeenCalled();
    });

    it('caster already at 0 HP: :81 gate skips the mirror — zero writes, zero logs', () => {
        // Non-vacuous via census: HP byte unchanged AND the fake proves no read past
        // the buff lookup, no store write, no log entry, no console noise.
        getDistanceFeet.mockReturnValue(30);
        const paladin = { name: 'Paladin', currentHp: 0, maxHp: 10 };
        const goblin = { name: 'Goblin' };
        const { reads, writes } = seedStore({ 'Goblin|activeBuffs': bondBuff('Paladin') });

        applyWardingBond(goblin, { creatures: [paladin, goblin] }, campaignName, 5);

        expect(paladin.currentHp).toBe(0);
        expect(reads).toEqual(['Goblin|activeBuffs']); // :78-80 caster read never reached past gate
        expect(writes).toEqual([]);
        expect(addEntry).not.toHaveBeenCalled();
        expect(consoleError).not.toHaveBeenCalled();
    });
});
