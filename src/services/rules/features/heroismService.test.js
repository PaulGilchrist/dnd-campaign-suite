// @maintained-by-ai
/**
 * heroismService lane — PRODUCER of the cast-time stamps for 'Heroism'
 * (Concentration, up to 1 minute); per-turn grant, expiry dispatch and
 * concentration internals are delegated (table + citations below).
 *
 * LIVE-vs-DEAD (#1370 method): all four exports have production callers —
 * handle via automation/index.js:529 (type dispatch), applyHeroism +
 * isHeroismActive via automation/index.js:650-651, removeHeroismBuff via
 * concentrationService.js:13 (concentration break). No dead exports.
 * Spell lanes that vi.mock this module (spellCastService.*) never cover the
 * body — this file is its only behavioral owner.
 *
 * PRODUCER verdict (#1335 discipline): disk 'Heroism' rows, both rulesets,
 * read programmatically: temp HP = spellcasting ability modifier and
 * automation.tempHpExpression === 'spellcasting_ability_modifier' on both.
 * heroismService.js:106-110 is the PRODUCER of the numeric stamp — its own
 * ladder: known expression → modifier, unknown expression → 0 (never-executed
 * else branch pinned honestly in row 'expr 2d4'), missing modifier → 0 via
 * the || coercion class (#1359/:1360/:1372), negative modifier stamped
 * faithfully (downstream clamps). resolveHealExpression (#1278) is never
 * called here and owns nothing in this lane.
 *
 * DELEGATIONS (owned elsewhere — not re-pinned here):
 *  - Per-turn grant + replace-bigger temp-HP math, VERBATIM from
 *    turnStartEffects_additional.test.js (#1324):
 *    'heroism_temp_hp: Heroism 5 replaces tempHp 3' /
 *    'no Heroism buff — zero writes' /
 *    'Heroism without a positive amount — zero writes'
 *    (applyHeroismTempHp lives at turnStartEffects.js:173-181).
 *  - remove_heroism_buff queue dispatch and expiry, VERBATIM from
 *    clearAllExpirationEffects_additional.test.js (#1285):
 *    'remove_heroism_buff strips the matching heroism targetEffect in one
 *    exact write' — self-buff keys and applied-round bookkeeping owned there.
 *    This lane pins only its own addExpiration call tuple.
 *  - Concentration internals: concentrationService.js:111 lane (#1290
 *    boundary precedent). Only the addConcentration call tuple is pinned.
 *
 * STORE: strict argument-keyed fake — unknown composite reads and
 * wrong-campaign reads THROW (machine proof of read scoping, of zero reads
 * in handle/guards, and of the service NEVER reading 'turnStartEffects'
 * from the store — it dedups from the passed playerStats only; pinned in
 * the turnStart quirk table). Call-shape quirk pinned: activeBuffs reads
 * carry campaignName (ignored — useRuntimeState.js:63 takes 2 args) while
 * 'campaign','targetEffects' reads omit it.
 * skipSync audit: only 4-tuple setRuntimeValue writes
 * (useRuntimeState.js:78 has no skipSync param; no setRuntimeObject and no
 * SSE-echo path in this lane — cast writes legitimately broadcast).
 *
 * CLOCK POLICY: clean. 'Concentration, up to 1 minute' is combat-scoped per
 * repo MANDATE: no round/minute countdowns stamped here, no scheduled
 * callbacks, expiry flows as one queue entry (owner #1285); Date.now()
 * appears only in the log payload timestamp — fake timers freeze it at TS.
 *
 * SOURCE BUGS REPORTED (not fixed here):
 *  - heroismService.js:48-60 pushes the fresh te pair onto the UNFILTERED
 *    `effects` array after writing `filteredEffects` at :45 — a re-cast's
 *    final targetEffects write resurrects the stale pair, leaving TWO
 *    identical 'heroism' te and TWO 'wisdom_save_advantage' te in store
 *    (pinned in the re-cast budget).
 *  - The re-cast-only duplication also flows from the dedup filter at :43
 *    matching effect === 'heroism' only; both removers
 *    (heroismService.js:158, clearExpirationEffects.js handleRemoveHeroismBuff)
 *    likewise never strip 'wisdom_save_advantage' — that te LEAKS for the
 *    whole campaign (pinned in the remove budget).
 *  - 'wisdom_save_advantage' is absent from targetEffectDefinitions.js
 *    (registry holds 'heroism' at :772) — violates the te registry rule;
 *    GM EffectAdder UI cannot ever add it manually.
 *  - heroismService.js:28-38 addHeroismTurnStartEffect dedups against the
 *    CASTER's passed playerStats.turnStartEffects (never the target's stored
 *    value) and writes that caster-local array onto the TARGET key — any
 *    other caster-local entries clobber/land in the target's stored list
 *    (pinned in the turnStart quirk table).
 *
 * PRESERVED-CITED-BY: none — no src file cites heroismService.test.js
 * (grep for 'heroismService.test' across the repo returns zero hits).
 * Mock hygiene: legacy tempHpService module mock deleted — heroismService.js
 * does not import tempHpService (grants live in turnStartEffects.js, #1324).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneDeep } from 'lodash';
import { handle, applyHeroism, removeHeroismBuff, isHeroismActive } from './heroismService.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
}));

vi.mock('../effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

import { setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../effects/expirations.js';
import { addEntry } from '../../../services/ui/logService.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js';

const CAM = 'test-campaign';
const MAP = 'testMap';
const TS = Date.UTC(2026, 9, 20, 12, 0, 0);
const DUR = 'Concentration, up to 1 minute';

// ── Strict store fake: throws on unknown reads and wrong-campaign reads;
// clones on every read/write so recorded call-payloads never alias later
// mutations (faithful round-trip between targets, stable assertions). ──
function strictStore(seed = {}) {
    const state = {};
    for (const [k, v] of Object.entries(seed)) state[k] = cloneDeep(v);
    getRuntimeValue.mockImplementation((characterKey, propertyName, campaignName) => {
        if (campaignName !== undefined && campaignName !== CAM) {
            throw new Error(`wrong-campaign read: ${String(campaignName)}`);
        }
        const composite = `${characterKey}.${propertyName}`;
        if (!(composite in state)) {
            throw new Error(`unexpected read: ${composite}`);
        }
        return cloneDeep(state[composite]);
    });
    setRuntimeValue.mockImplementation((characterKey, propertyName, value) => {
        state[`${characterKey}.${propertyName}`] = cloneDeep(value);
    });
}

const STATS = (over = {}) => ({
    name: 'Bard',
    spellAbilities: { modifier: 3, saveDc: 13 },
    proficiency: 3,
    turnStartEffects: [],
    ...over,
});

const action = (spellOver = {}, name = 'Heroism') => ({
    name,
    spell: {
        name: 'Heroism',
        level: 1,
        casting_time: 'Action',
        range: 'Touch',
        automation: { type: 'heroism', tempHpExpression: 'spellcasting_ability_modifier', duration: DUR, ...spellOver },
    },
});

const buffStamp = amount => ({
    name: 'Heroism',
    effect: 'heroism',
    duration: DUR,
    sourceCharacter: 'Bard',
    tempHpAmount: amount,
    conditionImmunity: ['Frightened'],
});
const tsStamp = amount => ({ type: 'heroism_temp_hp', name: 'Heroism', tempHpAmount: amount });
const teHeroism = target => ({ target, effect: 'heroism', source: 'Heroism', duration: 'concentration' });
const teWisdom = target => ({ target, effect: 'wisdom_save_advantage', source: 'Heroism', duration: 'concentration' });
const logEntry = (target, amount) => ({
    type: 'ability_use',
    characterName: 'Bard',
    abilityName: 'Heroism',
    description: `Bard cast Heroism on ${target}. Target is immune to Frightened and gains ${amount} temp HP per turn.`,
    timestamp: TS,
});

describe('heroismService', () => {
    let dispatchSpy;

    beforeEach(() => {
        vi.clearAllMocks(); // vitest 4: RETAINS implementations — re-seed everything explicitly
        vi.useFakeTimers();
        vi.setSystemTime(TS);
        strictStore({}); // deny-by-default
        getCombatSummary.mockReturnValue(null);
        addEntry.mockImplementation(() => Promise.resolve());
        dispatchSpy = vi.spyOn(window, 'dispatchEvent').mockReturnValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('handle — target-selection popup (pure builder)', () => {
        it.each([
            {
                label: 'full spell + 3-creature summary',
                summary: { creatures: [{ name: 'Bard' }, { name: 'Fighter' }, { name: 'Rogue' }] },
                act: action(),
                payload: {
                    type: 'heroism_target_selection',
                    name: 'Heroism',
                    creatureTargets: ['Bard', 'Fighter', 'Rogue'],
                    range: 'Touch',
                    duration: DUR,
                },
            },
            {
                label: 'no combat summary — empty creatureTargets',
                summary: null,
                act: action(),
                payload: {
                    type: 'heroism_target_selection',
                    name: 'Heroism',
                    creatureTargets: [],
                    range: 'Touch',
                    duration: DUR,
                },
            },
            {
                label: 'bare action {} — name/range/duration defaults (never-executed guard pins)',
                summary: null,
                act: {},
                payload: {
                    type: 'heroism_target_selection',
                    name: 'Heroism',
                    creatureTargets: [],
                    range: 'Touch',
                    duration: DUR,
                },
            },
        ])('handle: $label', ({ summary, act, payload }) => {
            getCombatSummary.mockReturnValue(summary);

            const result = handle(act, STATS(), CAM, MAP);

            expect(result).toEqual({ type: 'popup', payload });
            expect(getCombatSummary.mock.calls).toEqual([[CAM]]);
            // machine proof: handle touches no store, no queue, no log
            expect(getRuntimeValue.mock.calls).toEqual([]);
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addExpiration.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });
    });

    describe('applyHeroism', () => {
        it.each([[[]], [null], [undefined]])('invalid targets %s — null, zero side effects', async targets => {
            const result = await applyHeroism(action(), STATS(), CAM, MAP, targets);

            expect(result).toBeNull();
            expect(getCombatSummary.mock.calls).toEqual([]);
            expect(getRuntimeValue.mock.calls).toEqual([]); // strict fake would throw on any read
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addExpiration.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });

        it('single target — exact read order, full write budget, stamps, queue, log, popup', async () => {
            strictStore({
                'Fighter.activeBuffs': [],
                'campaign.targetEffects': [],
            });

            const result = await applyHeroism(action(), STATS(), CAM, MAP, ['Fighter']);

            expect(getCombatSummary.mock.calls).toEqual([[CAM]]);
            // campaign te read omits campaignName while activeBuffs read carries it (quirk pinned)
            expect(getRuntimeValue.mock.calls).toEqual([
                ['Fighter', 'activeBuffs', CAM],
                ['campaign', 'targetEffects'],
            ]);
            // full write budget in exact source order: buffs -> turnStart -> te
            expect(setRuntimeValue.mock.calls).toEqual([
                ['Fighter', 'activeBuffs', [buffStamp(3)], CAM],
                ['Fighter', 'turnStartEffects', [tsStamp(3)], CAM],
                ['campaign', 'targetEffects', [teHeroism('Fighter'), teWisdom('Fighter')], CAM],
            ]);
            expect(addExpiration.mock.calls).toEqual([
                [{ attackerName: 'Bard', targetName: 'Fighter', effects: [{ type: 'remove_heroism_buff', buffName: 'Heroism' }], campaignName: CAM }],
            ]);
            expect(addEntry.mock.calls).toEqual([[CAM, logEntry('Fighter', 3)]]);
            expect(addConcentration.mock.calls).toEqual([]); // summary null — concentration skipped
            expect(dispatchSpy.mock.calls.map(c => c[0].type)).toEqual([]);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Heroism',
                    description: "Fighter gained Heroism from Bard's cast: immune to Frightened, 3 temp HP at start of each turn.",
                    automation: {},
                },
            });
        });

        it.each([
            { label: 'saveDc 13 passthrough', spellAbilities: { modifier: 3, saveDc: 13 }, proficiency: 3, dc: 13 },
            { label: 'no saveDc — 8 + proficiency (||0 coercion class)', spellAbilities: { modifier: 3 }, proficiency: 3, dc: 11 },
            { label: 'no saveDc, no proficiency — floor 8', spellAbilities: { modifier: 3 }, proficiency: undefined, dc: 8 },
        ])('concentration: $label', async ({ spellAbilities, proficiency, dc }) => {
            const summary = { creatures: [{ name: 'Bard' }] };
            strictStore({
                'Fighter.activeBuffs': [],
                'campaign.targetEffects': [],
            });
            getCombatSummary.mockReturnValue(summary);

            await applyHeroism(action(), STATS({ spellAbilities, proficiency }), CAM, MAP, ['Fighter']);

            expect(addConcentration.mock.calls).toEqual([[summary, 'Bard', 'Heroism', dc, 'Fighter']]);
            expect(dispatchSpy.mock.calls.map(c => c[0].type)).toEqual(['combat-summary-updated']);
        });

        it.each([
            { label: 'mod 0 via || coercion — stamps 0', stats: STATS({ spellAbilities: { modifier: 0, saveDc: 10 } }), act: action(), amount: 0 },
            { label: 'mod -1 stamped faithfully — downstream clamps (#1324)', stats: STATS({ spellAbilities: { modifier: -1, saveDc: 8 } }), act: action(), amount: -1 },
            { label: 'spellAbilities absent — ?. || 0 coercion', stats: STATS({ spellAbilities: undefined }), act: action(), amount: 0 },
            { label: 'expr 2d4 — unknown-expression else branch, 0, no dice rolled', stats: STATS(), act: action({ tempHpExpression: '2d4' }), amount: 0 },
            { label: 'automation absent — default expression resolves mod', stats: STATS(), act: (() => { const a = action(); delete a.spell.automation; return a; })(), amount: 3 },
        ])('temp-HP producer ladder: $label', async ({ stats, act, amount }) => {
            strictStore({
                'Fighter.activeBuffs': [],
                'campaign.targetEffects': [],
            });

            await applyHeroism(act, stats, CAM, MAP, ['Fighter']);

            expect(setRuntimeValue.mock.calls).toEqual([
                ['Fighter', 'activeBuffs', [buffStamp(amount)], CAM],
                ['Fighter', 'turnStartEffects', [tsStamp(amount)], CAM],
                ['campaign', 'targetEffects', [teHeroism('Fighter'), teWisdom('Fighter')], CAM],
            ]);
            expect(addEntry.mock.calls).toEqual([[CAM, logEntry('Fighter', amount)]]);
        });

        it('multiple targets — per-target writes in order, cumulative te, batch popup', async () => {
            strictStore({
                'Fighter.activeBuffs': [],
                'Rogue.activeBuffs': [],
                'campaign.targetEffects': [],
            });

            const result = await applyHeroism(action(), STATS(), CAM, MAP, ['Fighter', 'Rogue']);

            expect(getRuntimeValue.mock.calls).toEqual([
                ['Fighter', 'activeBuffs', CAM],
                ['campaign', 'targetEffects'],
                ['Rogue', 'activeBuffs', CAM],
                ['campaign', 'targetEffects'],
            ]);
            expect(setRuntimeValue.mock.calls).toEqual([
                ['Fighter', 'activeBuffs', [buffStamp(3)], CAM],
                ['Fighter', 'turnStartEffects', [tsStamp(3)], CAM],
                ['campaign', 'targetEffects', [teHeroism('Fighter'), teWisdom('Fighter')], CAM],
                ['Rogue', 'activeBuffs', [buffStamp(3)], CAM],
                ['Rogue', 'turnStartEffects', [tsStamp(3)], CAM],
                // store round-trip: Rogue's sync re-reads Fighter's pair (no Rogue match →
                // no dedup write) and appends, overwriting with the cumulative list
                ['campaign', 'targetEffects', [teHeroism('Fighter'), teWisdom('Fighter'), teHeroism('Rogue'), teWisdom('Rogue')], CAM],
            ]);
            expect(addExpiration.mock.calls).toEqual([
                [{ attackerName: 'Bard', targetName: 'Fighter', effects: [{ type: 'remove_heroism_buff', buffName: 'Heroism' }], campaignName: CAM }],
                [{ attackerName: 'Bard', targetName: 'Rogue', effects: [{ type: 'remove_heroism_buff', buffName: 'Heroism' }], campaignName: CAM }],
            ]);
            expect(addEntry.mock.calls).toEqual([
                [CAM, logEntry('Fighter', 3)],
                [CAM, logEntry('Rogue', 3)],
            ]);
            expect(result.payload.description).toBe('2 targets gained Heroism: Fighter, Rogue.');
        });

        it('re-cast replaces buff but final te write resurrects the stale pair (SOURCE BUG #48-60)', async () => {
            const staleHeroismTe = teHeroism('Fighter');
            const staleWisdomTe = teWisdom('Fighter');
            strictStore({
                'Fighter.activeBuffs': [
                    { name: 'Heroism', effect: 'heroism', tempHpAmount: 2 },
                    { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
                ],
                'campaign.targetEffects': [staleHeroismTe, staleWisdomTe],
            });

            await applyHeroism(action(), STATS(), CAM, MAP, ['Fighter']);

            // buffs: old Heroism spliced out, fresh appended after the neighbor
            expect(setRuntimeValue.mock.calls).toEqual([
                ['Fighter', 'activeBuffs', [{ name: 'Bardic Inspiration', effect: 'bardic_inspiration' }, buffStamp(3)], CAM],
                ['Fighter', 'turnStartEffects', [tsStamp(3)], CAM],
                // intermediate write is correctly filtered...
                ['campaign', 'targetEffects', [staleWisdomTe], CAM],
                // ...but the final write pushes onto the UNFILTERED array:
                // stale pair resurrected + fresh pair appended = te duplication. Pinned honestly.
                ['campaign', 'targetEffects', [staleHeroismTe, staleWisdomTe, teHeroism('Fighter'), teWisdom('Fighter')], CAM],
            ]);
            expect(addExpiration.mock.calls).toEqual([
                [{ attackerName: 'Bard', targetName: 'Fighter', effects: [{ type: 'remove_heroism_buff', buffName: 'Heroism' }], campaignName: CAM }],
            ]);
        });

        it.each([
            {
                label: 'caster-local non-heroism entry is copied onto the TARGET key (clobber quirk)',
                tsLocal: [{ type: 'mage_hand_legerdemain', name: 'Mage Hand Legerdemain' }],
                writes: [
                    ['Fighter', 'activeBuffs', [buffStamp(3)], CAM],
                    ['Fighter', 'turnStartEffects', [{ type: 'mage_hand_legerdemain', name: 'Mage Hand Legerdemain' }, tsStamp(3)], CAM],
                    ['campaign', 'targetEffects', [teHeroism('Fighter'), teWisdom('Fighter')], CAM],
                ],
            },
            {
                label: 'heroism_temp_hp already in caster stats — guard hits, zero turnStartEffects writes',
                tsLocal: [tsStamp(3)],
                writes: [
                    ['Fighter', 'activeBuffs', [buffStamp(3)], CAM],
                    ['campaign', 'targetEffects', [teHeroism('Fighter'), teWisdom('Fighter')], CAM],
                ],
            },
        ])('turnStart dedup reads CASTER stats, never the target store: $label', async ({ tsLocal, writes }) => {
            // strict fake: no 'Fighter.turnStartEffects' key seeded — any store read would THROW
            strictStore({
                'Fighter.activeBuffs': [],
                'campaign.targetEffects': [],
            });

            await applyHeroism(action(), STATS({ turnStartEffects: tsLocal }), CAM, MAP, ['Fighter']);

            expect(setRuntimeValue.mock.calls).toEqual(writes);
        });

        it('log rejection is caught — buffs unaffected, identical Error + exact prefix to console.error', async () => {
            strictStore({
                'Fighter.activeBuffs': [],
                'campaign.targetEffects': [],
            });
            const err = new Error('log down');
            addEntry.mockImplementation(() => Promise.reject(err));
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await applyHeroism(action(), STATS(), CAM, MAP, ['Fighter']);

            expect(errorSpy.mock.calls).toEqual([['[heroism] Error logging:', err]]);
            expect(setRuntimeValue.mock.calls).toEqual([
                ['Fighter', 'activeBuffs', [buffStamp(3)], CAM],
                ['Fighter', 'turnStartEffects', [tsStamp(3)], CAM],
                ['campaign', 'targetEffects', [teHeroism('Fighter'), teWisdom('Fighter')], CAM],
            ]);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Heroism',
                    description: "Fighter gained Heroism from Bard's cast: immune to Frightened, 3 temp HP at start of each turn.",
                    automation: {},
                },
            });
        });
    });

    describe('removeHeroismBuff (concentration-break lane, live caller concentrationService.js:13)', () => {
        it('strips heroism buff and heroism te, keeps neighbors — wisdom te LEAKS (source bug, pinned)', () => {
            strictStore({
                'Fighter.activeBuffs': [
                    { name: 'Heroism', effect: 'heroism' },
                    { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
                ],
                'campaign.targetEffects': [
                    teHeroism('Fighter'),
                    teWisdom('Fighter'),
                    { target: 'Fighter', effect: 'bless_bonus', source: 'Bard', duration: 'concentration' },
                ],
            });

            removeHeroismBuff('Fighter', CAM);

            expect(setRuntimeValue.mock.calls).toEqual([
                ['Fighter', 'activeBuffs', [{ name: 'Bardic Inspiration', effect: 'bardic_inspiration' }], CAM],
                // filter matches effect === 'heroism' only — wisdom_save_advantage survives removal forever
                ['campaign', 'targetEffects', [teWisdom('Fighter'), { target: 'Fighter', effect: 'bless_bonus', source: 'Bard', duration: 'concentration' }], CAM],
            ]);
            expect(addEntry.mock.calls).toEqual([]); // silent remover — no log by design
        });

        it('nothing to remove — zero writes (guarded conditional writes)', () => {
            strictStore({
                'Fighter.activeBuffs': [{ name: 'Bless', effect: 'bless' }],
                'campaign.targetEffects': [{ target: 'Fighter', effect: 'bless_bonus', source: 'Bard', duration: 'concentration' }],
            });

            removeHeroismBuff('Fighter', CAM);

            expect(setRuntimeValue.mock.calls).toEqual([]);
        });
    });

    describe('isHeroismActive', () => {
        it.each([
            { label: 'exact name+effect match', buffs: [{ name: 'Heroism', effect: 'heroism' }], expected: true },
            { label: 'different name — false', buffs: [{ name: 'Bardic Inspiration', effect: 'bardic_inspiration' }], expected: false },
            { label: 'right name wrong effect — false', buffs: [{ name: 'Heroism', effect: 'concentration_sustenance' }], expected: false },
            { label: 'empty list — false', buffs: [], expected: false },
            { label: 'null store — false (Array.isArray guard)', buffs: null, expected: false },
        ])('$label -> $expected', ({ buffs, expected }) => {
            strictStore({ 'Fighter.activeBuffs': buffs });

            expect(isHeroismActive('Fighter', CAM)).toBe(expected);
        });
    });
});
