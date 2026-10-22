// @maintained-by-ai
/**
 * massHealingWordService lane — AoE PRODUCER (bonus-action, multi-target,
 * per-target d4 dice). Twin of the #1384 massCureWoundsService lane; this
 * file pins ITS OWN bytes at ITS OWN lane (#1344 family verdict method:
 * structurally identical slice(0,6)/clamp/MOD idioms stay duplicated here
 * on purpose — each service keeps its own copy; nothing folded).
 *
 * TWIN DIFF vs massCureWoundsService.js (read side-by-side):
 *  - UNIQUE here: NO postCastHealService import — CLA-038 blessed-healer
 *    does NOT fire from this lane (grep: source imports 6 modules, none is
 *    postCastHealService; upstream postCastHealService.js:19 lists the
 *    spell-name for its own caller lane). No unique-vs-twin test needed
 *    beyond the name/note/default-slot bytes below.
 *  - DIFFERENT here: default slot :113 `|| 3` (twin || 5); name gate
 *    'Mass Healing Word'; log note + console prefixes '[massHealingWordService]'
 *    (requireCreatures :57) and '[massHealingWord]' (floating addEntry
 *    catch :103 — twin has no such catch, its log-rejection lane is unique).
 *  - SHARED SHAPE (post-#1385, pinned here verbatim): selectLawfulTargets
 *    (:122-131, called :155) filters candidates through canonical
 *    isWithinRange(casterName, name, rangeToFeet(spell.range)) then
 *    slice(0, maxTargets) (range read off disk; maxTargets off
 *    automation.maxTargets :6794 else disk-text default 6), one roll per
 *    target :86, clamp Math.min :90, stored-HP `!= null && !== ''` guard
 *    :84, heal-apply-before-log :93 vs :98, Fortified-Health latch
 *    :173-175, delta-0/negative over-log :98.
 *
 * Producer vs forwarder verdict (#1335): this lane computes its own heals —
 * resolveHealExpression ladder (:35-58) + MOD substitute (:55), dice per
 * target (:86), clamp per target (:90). It OWNS its numbers.
 *
 * LIVE export: triggerMassHealingWord — sole export; live caller
 * triggerSpells.js handleMassHealingWord :421-423 (imports :37). Dead-export
 * hunt: no other import of this module anywhere (grep src/server).
 * Caller lanes aoeHealingSpecial/aoeSpells/noformula-* mock this module and
 * own routing — not re-pinned here.
 *
 * DISK DETERMINATION (both rulesets, imported below; old hand-rolled fixture
 * used '2d4 + MOD' at lv3 — matched the 2024 row only, silently mis-modelling
 * 5e):
 *  5e   'Mass Healing Word': lv3, 60ft, V, bonus action,
 *       heal_at_slot_level 3:'1d4 + MOD' ... 9:'7d4 + MOD'.
 *  2024 'Mass Healing Word': lv3, 60ft, V, Bonus Action,
 *       heal_at_slot_level 3:'2d4 + MOD' ... 9:'8d4 + MOD'.
 *  Cross-ruleset divergence at the SAME lv3 slot (1d4 vs 2d4) pinned.
 *
 * BUG CLASSES re-checked from twin #1384:
 *  (1) :122-131/:155 selection — FIXED #1385: candidates now pass canonical
 *      isWithinRange(casterName, name, rangeToFeet(spell.range)); disk range
 *      '60 feet' enforced, no hardcoded feet. Choice-clause verdict: disk
 *      :6760 'up to six creatures of your choice that you can see within
 *      range' — 'of your choice', no friendly/allies wording -> hostiles
 *      are RAW-legal, affiliation deliberately unfiltered. Law arms pinned
 *      in the '#1385 selection law' describe below.
 *  (2) :98 over-log: every processed creature logs hp_change even with
 *      delta 0, and :90 lets negative actualHeal (storedHp > maxHp) reach
 *      the log and the returned totals (:112/:180).
 *  (3) :17 gate (used :135) case-sensitive while caller triggerSpells.js:422
 *      gates on lowercased name — case-drift passes caller, silently nulls.
 *  (4) :25 ability found but bonus undefined -> MOD never substituted;
 *      dice receives literal '1d4 + MOD' bytes (:55 guard).
 *  (5) stored HP ''/string coercion guard shape :84 — '' and null/undefined
 *      mean full HP; numeric strings coerce via Number.
 *  (6) heal-then-log ordering :93 before :98 — pinned via call order.
 *  :0-swallow census (#1374): :139 slotLevel||level||3 coerces (not NaN,
 *  not throw), and :148 prof||0 / level||1 — both pinned.
 *
 * Store audit: getRuntimeValue reads ONLY key 'currentHitPoints' per target
 * at CAMPAIGN — strict fake throws on any other key/campaign (#1371).
 * ZERO writes: the mocked useRuntimeState exports getRuntimeValue ONLY, so
 * any setRuntimeValue/setRuntimeObject attempt is a machine-checked TypeError;
 * skipSync positions: none exist in this lane. Dice is a fixed-stub single
 * queue asserting routing order; unstubbed dice THROWS (#1380).
 * NO-CLOCK audit: heals are instantaneous; Date.now() stamps log payloads
 * only, frozen at 0 by fake timers; no expiry stored, no timers started.
 *
 * PRESERVED-CITED-BY: none — no src file cites this test (grep, only the
 * .opencode maintenance queue lists it).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerMassHealingWord } from './massHealingWordService.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

// ── Mocks (module boundaries only) ────────────────────────────

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

// getRuntimeValue ONLY: any store WRITE in this lane is a TypeError.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
    resolveHealingBonusesWithDetails: vi.fn(),
    hasHealingMaximization: vi.fn(),
    hasHealingMaximizationForTarget: vi.fn(),
    markFortifiedHealthUsed: vi.fn(),
}));

// #1385 range boundary: canonical isWithinRange (rules/combat/rangeCheck.js).
// Pre-fix the service imports NO range util and never reaches this module
// (capture arms prove selection ignores it). Post-fix the service imports it
// and every candidate must pass this seam; rangeValidation.js links through
// this mock via its own isDistanceInRange import, so provide both exports.
let outOfRange; // names the fixture map places beyond the disk range
vi.mock('../combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async (_source, targetName, ft) => {
        if (ft == null) return true; // canonical null = unrestricted
        return !outOfRange.has(targetName);
    }),
    isDistanceInRange: vi.fn((dist, rangeFt) => rangeFt == null || dist == null || dist <= rangeFt),
}));

import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization, hasHealingMaximizationForTarget, markFortifiedHealthUsed } from '../../combat/automation/automationService.js';
import { isWithinRange } from '../combat/rangeCheck.js';

// ── Canon helpers ─────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

function diskRow(spells, name) {
    const spell = spells.find(s => s.name === name);
    if (!spell) throw new Error(`spell missing from disk: ${name}`);
    return spell;
}
const mhw5e = diskRow(spells5e, 'Mass Healing Word');
const mhw2024 = diskRow(spells2024, 'Mass Healing Word');

function stats(overrides = {}) {
    return {
        name: 'Cleric',
        hitPoints: 50,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
        spellAbilities: { spellCastingAbility: 'Wisdom', modifier: 4 },
        proficiency: 3,
        level: 8,
        ...overrides,
    };
}

// ── Shared fakes: single dice queue + strict store ────────────

let diceQ;      // [{ mode: 'normal'|'max', value: {total, rolls} | null }]
let store;      // 'entity|campaign' -> stored currentHitPoints
let reads;      // ordered store reads
let dispatchSpy;
let consoleSpy;

function roll(mode, total, rolls) {
    diceQ.push({ mode, value: { total, rolls } });
}
function rollNull() {
    diceQ.push({ mode: 'normal', value: null });
}
function seedHp(entity, value, campaign = CAMPAIGN) {
    store.set(`${entity}|${campaign}`, value);
}
function cs(creatures) {
    return { creatures };
}
function trigger(spell = mhw5e, metaCtx = { slotLevel: 3 }, casterStats = stats()) {
    return triggerMassHealingWord(spell, metaCtx, casterStats, CAMPAIGN, MAP);
}

function lastRollArg(mock) {
    return mock.mock.calls[mock.mock.calls.length - 1][0];
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // explicit re-seed after reset (vitest-4 retains impls otherwise — #1312)
    diceQ = [];
    reads = [];
    store = new Map();
    outOfRange = new Set();
    const pop = (mode) => {
        const e = diceQ.shift();
        if (!e) throw new Error(`unstubbed dice: ${mode} roll has no queued entry`);
        if (e.mode !== mode) throw new Error(`dice routing drift: ${mode} called, queued ${e.mode}`);
        return e.value;
    };
    rollExpression.mockImplementation(() => pop('normal'));
    rollExpressionMaximized.mockImplementation(() => pop('max'));
    getRuntimeValue.mockImplementation((entity, key, campaign) => {
        if (key !== 'currentHitPoints') {
            throw new Error(`unexpected store key read: ${key} (massHealingWord reads only currentHitPoints)`);
        }
        if (campaign !== CAMPAIGN) {
            throw new Error(`unexpected store read campaign: ${campaign}`);
        }
        reads.push(`${entity}|${key}`);
        return store.get(`${entity}|${campaign}`);
    });
    getCombatContext.mockImplementation(() => { throw new Error('unseeded combat context'); });
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    hasHealingMaximization.mockReturnValue(false);
    hasHealingMaximizationForTarget.mockReturnValue(false);
    markFortifiedHealthUsed.mockResolvedValue(undefined);
    addEntry.mockReturnValue(Promise.resolve());
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────

describe('massHealingWordService.triggerMassHealingWord', () => {
    it.each([
        ['real-disk family twin Mass Cure Wounds', diskRow(spells5e, 'Mass Cure Wounds')],
        ['real-disk near-miss Healing Word (same 1d4 ladder family)', diskRow(spells5e, 'Healing Word')],
        ['real-disk near-miss Mass Heal', diskRow(spells5e, 'Mass Heal')],
        ['case-drift name (caller gates lowercase, service does not)', { name: 'mass healing word', level: 3, heal_at_slot_level: mhw5e.heal_at_slot_level }],
        ['missing name', { level: 3, heal_at_slot_level: mhw5e.heal_at_slot_level }],
        ['null name', { name: null, level: 3 }],
    ])('name gate rejects %s before any engine work', async (_label, spell) => {
        expect(await trigger(spell)).toBeNull();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(hasHealingMaximization).not.toHaveBeenCalled();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(rollExpressionMaximized).not.toHaveBeenCalled();
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
        expect(reads).toEqual([]);
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('short-circuits combat context: null context, missing creatures array (exact throw + log), empty creatures', async () => {
        getCombatContext.mockResolvedValueOnce(null);
        expect(await trigger()).toBeNull();
        expect(rollExpression).not.toHaveBeenCalled();

        // creatures absent: requireCreatures throws identically-shaped Error + exact console pair
        getCombatContext.mockResolvedValueOnce({});
        await expect(trigger()).rejects.toThrowError(new Error('Expected array, got undefined'));
        expect(consoleSpy).toHaveBeenCalledWith('[massHealingWordService] Missing array:', undefined);
        expect(rollExpression).not.toHaveBeenCalled();

        // empty creatures: exact noTargets envelope, nothing downstream
        getCombatContext.mockResolvedValueOnce(cs([]));
        expect(await trigger()).toEqual({ noTargets: true });
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(getCombatContext).toHaveBeenCalledTimes(3);
        expect(getCombatContext).toHaveBeenLastCalledWith(CAMPAIGN);
    });

    it('disk ladder, both rulesets: reached tiers substituted and mutually distinguishable (5e lv3 1d4 vs 2024 lv3 2d4)', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Ally', maxHp: 100 }]));
        seedHp('Ally', 50);
        for (const [slot, expr] of Object.entries(mhw5e.heal_at_slot_level)) {
            roll('normal', 20, [4, 4, 4, 4, 4]);
            const result = await trigger(mhw5e, { slotLevel: Number(slot) });
            expect(lastRollArg(rollExpression)).toBe(expr.replace('MOD', '4'));
            expect(result.formula).toBe(expr.replace('MOD', '4'));
        }
        // 2024 divergence at the same lv3 slot, plus its top tier
        for (const [slot, expr] of [[3, '2d4 + 4'], [9, '8d4 + 4']]) {
            roll('normal', 20, [4, 4, 4, 4, 4]);
            const result = await trigger(mhw2024, { slotLevel: slot });
            expect(lastRollArg(rollExpression)).toBe(expr);
            expect(result.formula).toBe(expr);
        }
        expect(rollExpression).toHaveBeenCalledTimes(9);
        expect(rollExpressionMaximized).not.toHaveBeenCalled();
    });

    it('slot resolution chain: metaCtx > spell.level > 3 default (unique byte vs twin||5), :0-swallow, highest-below fallback, below-floor and missing-ladder null before combat fetch', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Ally', maxHp: 100 }]));
        seedHp('Ally', 50);
        const base = { name: 'Mass Healing Word', spellCastingAbility: 'Wisdom' };
        const full = { ...base, level: 3, heal_at_slot_level: { 3: '1d4 + MOD', 4: '2d4 + MOD', 5: '3d4 + MOD' } };
        const sparse = { ...base, level: 3, heal_at_slot_level: { 3: '4d4', 5: '6d4' } };

        roll('normal', 20, [20]);
        expect((await trigger(full, { slotLevel: 4 })).formula).toBe('2d4 + 4');           // metaCtx wins over spell.level 3
        roll('normal', 20, [20]);
        expect((await trigger({ ...full, level: 5 }, {})).formula).toBe('3d4 + 4');         // spell.level fallback
        roll('normal', 20, [20]);
        expect((await trigger({ ...full, level: undefined }, {})).formula).toBe('1d4 + 4'); // || 3 default
        roll('normal', 20, [20]);
        expect((await trigger({ ...full, level: 5 }, { slotLevel: 0 })).formula).toBe('3d4 + 4'); // :0 swallowed (#1374)
        roll('normal', 20, [20]);
        expect((await trigger(sparse, { slotLevel: 4 })).formula).toBe('4d4');               // exact miss -> highest below (3)
        roll('normal', 20, [20]);
        expect((await trigger(sparse, { slotLevel: 9 })).formula).toBe('6d4');               // beyond top -> highest (5)
        expect(await trigger(sparse, { slotLevel: 2 })).toBeNull();                           // below floor -> null, no roll
        expect(await trigger({ ...base, level: 3, heal_at_slot_level: null }, {})).toBeNull(); // no ladder -> null
        expect(diceQ).toEqual([]);
    });

    it('spellcasting-mod sources: spell ability, negative byte, spellAbilities ability, modifier fallback, zero, unresolved-MOD leak quirk', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Ally', maxHp: 100 }]));
        seedHp('Ally', 50);
        // mhw5e's lv3 tier is '1d4 + MOD'; MOD replaced by String(bonus)

        roll('normal', 20, [20]);
        expect((await trigger({ ...mhw5e, spellCastingAbility: 'Intelligence' }, { slotLevel: 3 },
            stats({ abilities: [{ name: 'Wisdom', bonus: 4 }, { name: 'Intelligence', bonus: -3 }] }))).formula)
            .toBe('1d4 + -3'); // negative modifier concatenated verbatim
        roll('normal', 20, [20]);
        expect((await trigger({ ...mhw5e, spellCastingAbility: undefined }, { slotLevel: 3 },
            stats({ abilities: [{ name: 'Charisma', bonus: 2 }], spellAbilities: { spellCastingAbility: 'Charisma', modifier: 9 } }))).formula)
            .toBe('1d4 + 2'); // spellAbilities.spellCastingAbility path
        roll('normal', 20, [20]);
        expect((await trigger(mhw5e, { slotLevel: 3 },
            stats({ abilities: [], spellAbilities: { spellCastingAbility: 'Wisdom', modifier: 3 } }))).formula)
            .toBe('1d4 + 3'); // lookup miss -> spellAbilities.modifier
        roll('normal', 20, [20]);
        expect((await trigger(mhw5e, { slotLevel: 3 },
            { name: 'Cleric', hitPoints: 50 })).formula)
            .toBe('1d4 + 0'); // no abilities at all -> 0
        roll('normal', 20, [20]);
        expect((await trigger(mhw5e, { slotLevel: 3 },
            stats({ abilities: [{ name: 'Wisdom' }] }))).formula)
            .toBe('1d4 + MOD'); // QUIRK: ability found, bonus undefined -> MOD never substituted
    });

    it('healing-bonus ctx tuple: identity stats, prof/level :0-coercion census (prof||0, level||1), resolved once per cast not per target', async () => {
        getCombatContext.mockResolvedValue(cs([
            { name: 'Ally1', maxHp: 100 }, { name: 'Ally2', maxHp: 100 }, { name: 'Ally3', maxHp: 100 },
        ]));
        seedHp('Ally1', 50); seedHp('Ally2', 50); seedHp('Ally3', 50);
        const caster = stats();
        roll('normal', 10, [10]); roll('normal', 10, [10]); roll('normal', 10, [10]);
        await trigger(mhw5e, { slotLevel: 3 }, caster);
        expect(resolveHealingBonusesWithDetails).toHaveBeenCalledTimes(1);
        const [statsArg, ctxArg] = resolveHealingBonusesWithDetails.mock.calls[0];
        expect(statsArg).toBe(caster);
        expect(ctxArg).toEqual({ prof: 3, level: 8, slotLevel: 3, campaignName: CAMPAIGN });

        const zeroed = stats({ proficiency: 0, level: 0 });
        roll('normal', 10, [10]); roll('normal', 10, [10]); roll('normal', 10, [10]);
        await trigger(mhw5e, { slotLevel: 3 }, zeroed);
        expect(resolveHealingBonusesWithDetails.mock.calls[1][1])
            .toEqual({ prof: 0, level: 1, slotLevel: 3, campaignName: CAMPAIGN });
    });

    it('flagship 4-target cast: per-target rolls and clamps, string/stored-HP canon, apply-before-log order, caster and full-HP over-log at delta 0, exact log envelope, exact result envelope, single dispatch', async () => {
        const combatCtx = cs([
            { name: 'Goblin', maxHp: 7 },
            { name: 'Orc', maxHp: 15 },
            { name: 'Cleric', maxHp: 50 },   // caster included; unseeded -> full HP
            { name: 'Ally', maxHp: 20 },     // stored '' -> treated as full HP
        ]);
        getCombatContext.mockResolvedValue(combatCtx);
        seedHp('Goblin', 5);
        seedHp('Orc', '9'); // string stored HP coerced by Number()
        seedHp('Ally', '');
        const caster = stats();

        roll('normal', 6, [2, 4]);   // Goblin: clamp(6, 7-5) = 2
        roll('normal', 12, [4, 4, 4]); // Orc: clamp(12, 15-9) = 6
        roll('normal', 4, [4]);      // Cleric: full -> 0 (over-log)
        roll('normal', 3, [3]);      // Ally: '' full -> 0 (over-log)
        const result = await trigger(mhw5e, { slotLevel: 3 }, caster);

        expect(rollExpression).toHaveBeenCalledTimes(4); // one fixed roll per target
        expect(rollExpression).toHaveBeenCalledWith('1d4 + 4');
        expect(reads).toEqual(['Goblin|currentHitPoints', 'Orc|currentHitPoints', 'Cleric|currentHitPoints', 'Ally|currentHitPoints']);
        expect(hasHealingMaximization).toHaveBeenCalledTimes(1);
        expect(hasHealingMaximization).toHaveBeenCalledWith(caster);
        expect(hasHealingMaximizationForTarget.mock.calls.map(c => [c[1], c[2]]))
            .toEqual([['Goblin', CAMPAIGN], ['Orc', CAMPAIGN], ['Cleric', CAMPAIGN], ['Ally', CAMPAIGN]]);
        expect(applyHealingToTarget).toHaveBeenCalledTimes(2);
        expect(applyHealingToTarget).toHaveBeenNthCalledWith(1, combatCtx, 'Goblin', 2, CAMPAIGN);
        expect(applyHealingToTarget).toHaveBeenNthCalledWith(2, combatCtx, 'Orc', 6, CAMPAIGN);

        // over-log quirk: full-HP creatures logged at delta 0 although never applied;
        // heal-apply strictly precedes the log for healed targets
        expect(addEntry).toHaveBeenCalledTimes(4);
        expect(addEntry.mock.calls.map(c => [c[0], c[1].targetName, c[1].delta]))
            .toEqual([['test-campaign', 'Goblin', 2], ['test-campaign', 'Orc', 6], ['test-campaign', 'Cleric', 0], ['test-campaign', 'Ally', 0]]);
        const goblinLog = addEntry.mock.calls[0][1];
        expect(goblinLog).toEqual({
            type: 'hp_change',
            targetName: 'Goblin',
            delta: 2,
            currentHp: 7,
            maxHp: 7,
            isHealing: true,
            sourceName: 'Cleric',
            note: 'Mass Healing Word',
            formula: '1d4 + 4',
            bonusDetails: undefined,
            timestamp: 0,
        });

        expect(result).toEqual({
            targets: [
                { targetName: 'Goblin', healAmount: 2, rolls: [2, 4], rawTotal: 6 },
                { targetName: 'Orc', healAmount: 6, rolls: [4, 4, 4], rawTotal: 12 },
                { targetName: 'Cleric', healAmount: 0, rolls: [4], rawTotal: 4 },
                { targetName: 'Ally', healAmount: 0, rolls: [3], rawTotal: 3 },
            ],
            formula: '1d4 + 4',
            totalHealed: 8,
            rolls: [2, 4, 4, 4, 4, 4, 3],
            rawTotal: 25,
        });
        const events = dispatchSpy.mock.calls.map(c => c[0]);
        expect(events.map(e => e.type)).toEqual(['combat-summary-updated']);
    });

    it('first-6 slice is array-order and affiliation-blind; maxHp falls back to numeric playerStats.hitPoints; stored HP above max yields negative delta quirk', async () => {
        const many = Array.from({ length: 8 }, (_, i) => ({ name: `C${i}`, maxHp: 100 }));
        getCombatContext.mockResolvedValue(cs(many));
        many.forEach(c => seedHp(c.name, 50));
        for (let i = 0; i < 6; i++) roll('normal', 10, [10]);
        const result = await trigger(mhw5e, { slotLevel: 3 });
        // selection boundary forwarded to this lane verbatim: slice(0, 6), no sorting/filtering here
        expect(result.targets.map(t => t.targetName)).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'C5']);
        expect(rollExpression).toHaveBeenCalledTimes(6);
        expect(applyHealingToTarget).toHaveBeenCalledTimes(6);

        // creature without maxHp borrows numeric playerStats.hitPoints (50);
        // Titan stored above max -> heal clamps negative, apply skipped, log still written
        const combatCtx2 = cs([{ name: 'Armor' }, { name: 'Titan', maxHp: 50 }]);
        getCombatContext.mockResolvedValueOnce(combatCtx2);
        seedHp('Armor', 40);
        seedHp('Titan', '60');
        roll('normal', 25, [5, 20]);
        roll('normal', 10, [10]);
        const q = await trigger(mhw5e, { slotLevel: 3 });
        expect(q.targets).toEqual([
            { targetName: 'Armor', healAmount: 10, rolls: [5, 20], rawTotal: 25 },
            { targetName: 'Titan', healAmount: -10, rolls: [10], rawTotal: 10 },
        ]);
        expect(q.totalHealed).toBe(0);
        expect(applyHealingToTarget).toHaveBeenLastCalledWith(combatCtx2, 'Armor', 10, CAMPAIGN);
        expect(applyHealingToTarget.mock.calls.filter(c => c[1] === 'Titan')).toEqual([]);
        const titanLog = addEntry.mock.calls.find(c => c[1].targetName === 'Titan')[1];
        expect(titanLog).toMatchObject({ delta: -10, currentHp: 50, maxHp: 50, timestamp: 0 });
    });

    it('dice routing: global maximization, per-target maximization, null-roll target skipped silently', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Goblin', maxHp: 7 }, { name: 'Orc', maxHp: 15 }]));
        seedHp('Goblin', 1);
        seedHp('Orc', 1);
        const caster = stats();

        hasHealingMaximization.mockReturnValueOnce(true);
        roll('max', 5, [1, 4]);
        roll('max', 5, [1, 4]);
        const g = await trigger(mhw5e, { slotLevel: 3 }, caster);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(rollExpressionMaximized).toHaveBeenNthCalledWith(1, '1d4 + 4');
        expect(g.totalHealed).toBe(10); // 5 + 5

        // per-target: only Goblin maximized (drift-proof queue asserts call order/mode)
        hasHealingMaximizationForTarget.mockImplementation((_s, name) => name === 'Goblin');
        roll('max', 5, [1, 4]);
        roll('normal', 4, [4]);
        const p = await trigger(mhw5e, { slotLevel: 3 }, caster);
        expect(p.targets.map(t => t.healAmount)).toEqual([5, 4]);

        // null roll: target skipped — no result entry, no log for it, cast still dispatches
        hasHealingMaximizationForTarget.mockReturnValue(false);
        addEntry.mockClear();
        roll('normal', 4, [4]);
        rollNull();
        const n = await trigger(mhw5e, { slotLevel: 3 }, caster);
        expect(n.targets.map(t => t.targetName)).toEqual(['Goblin']);
        expect(addEntry.mock.calls.map(c => c[1].targetName)).toEqual(['Goblin']);
        expect(dispatchSpy).toHaveBeenCalledTimes(3);
    });

    it('healing bonuses: exact composed log formula, bonusDetails identity, Fortified-Health latch armed only on real heal', async () => {
        const details = [{ name: 'Inspiring Leader', amount: 2 }, { name: 'Fortified Health', amount: 1 }];
        resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 3, details });
        getCombatContext.mockResolvedValue(cs([{ name: 'Goblin', maxHp: 7 }]));
        seedHp('Goblin', 1);
        const caster = stats();

        roll('normal', 5, [1, 4]);
        const r = await trigger(mhw5e, { slotLevel: 3 }, caster);
        expect(r.targets).toEqual([{ targetName: 'Goblin', healAmount: 6, rolls: [1, 4], rawTotal: 8 }]);
        expect(addEntry.mock.calls[0][1]).toMatchObject({
            formula: '1d4 + 4 + (2 Inspiring Leader + 1 Fortified Health)',
            delta: 6,
            currentHp: 7,
        });
        expect(addEntry.mock.calls[0][1].bonusDetails).toBe(details);
        expect(markFortifiedHealthUsed).toHaveBeenCalledTimes(1);
        expect(markFortifiedHealthUsed).toHaveBeenCalledWith(caster, CAMPAIGN);

        // all full: zero heals must NOT arm the fortified latch (still over-logs delta 0)
        seedHp('Goblin', 7);
        roll('normal', 5, [5]);
        await trigger(mhw5e, { slotLevel: 3 }, caster);
        expect(markFortifiedHealthUsed).toHaveBeenCalledTimes(1);

        // fortified absent from details while healing happens: latch stays untouched
        resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [{ name: 'Inspiring Leader', amount: 2 }] });
        seedHp('Goblin', 1);
        roll('normal', 4, [4]);
        await trigger(mhw5e, { slotLevel: 3 }, caster);
        expect(markFortifiedHealthUsed).toHaveBeenCalledTimes(1);
    });

    it('log rejection swallowed by floating catch with exact lane-unique prefix; cast completes', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Goblin', maxHp: 7 }]));
        seedHp('Goblin', 1);
        roll('normal', 6, [2, 4]);
        addEntry.mockRejectedValueOnce(new Error('boom'));
        const r = await trigger(mhw5e, { slotLevel: 3 });
        await Promise.resolve(); // let the floating .catch (:103) run
        expect(r.totalHealed).toBe(6);
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        // prefix '[massHealingWord]' (no 'Service') is unique to this lane vs twin's '[massCureWounds]'
        expect(consoleSpy).toHaveBeenCalledWith('[massHealingWord] Error:', new Error('boom'));
    });
});

// ── #1385 AoE selection law (range enforced, affiliation per disk verdict) ──
// DISK (public/data/spells.json 'Mass Healing Word'):
//   :6760 'As you call out words of restoration, up to six creatures of your
//          choice that you can see within range regain hit points equal to
//          1d4 + your spellcasting ability modifier.'  <- choice clause is
//          OF YOUR CHOICE: no friendly/allies wording -> hostile selection is
//          RAW-legal; affiliation filtering would be product stance, not law.
//   :6765 range '60 feet' (enforced from caster via canonical isWithinRange)
//   :6794 automation.maxTargets 6 (read from disk, not hardcoded).
describe('massHealingWordService #1385 selection law', () => {
    it('PRE-FIX CAPTURE / POST-FIX LAW: hostile 5ft in AoE is selected (of your choice -> lawful); ally 100ft out is NEVER selected (range law)', async () => {
        getCombatContext.mockResolvedValue(cs([
            { name: 'Goblin', maxHp: 7 },   // hostile, 5ft inside AoE
            { name: 'FarAlly', maxHp: 50 }, // ally, 100ft out (beyond disk 60ft)
            { name: 'Cleric', maxHp: 50 },  // caster
        ]));
        seedHp('Goblin', 5);
        seedHp('FarAlly', 40);
        seedHp('Cleric', 10);
        outOfRange.add('FarAlly');
        roll('normal', 20, [20]);
        roll('normal', 20, [20]);
        roll('normal', 20, [20]); // 3rd stays queued post-fix (FarAlly rejected); consumed by the pre-fix defect
        const result = await trigger(mhw5e, { slotLevel: 3 });
        // FarAlly: out-of-range never selected (post-fix); pre-fix it was included.
        expect(result.targets.map(t => t.targetName)).toEqual(['Goblin', 'Cleric']);
        // range seam consulted per candidate with the disk feet value, caster-centric
        expect(isWithinRange).toHaveBeenCalledTimes(3);
        expect(isWithinRange).toHaveBeenCalledWith('Cleric', 'FarAlly', 60);
        // affiliation arm: hostile in range stays eligible (disk-verdict lawful)
        expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin', 2, CAMPAIGN);
    });

    it('exactly-6 cap holds on the LAWFUL pool in array order; out-of-range candidates open no dice slot', async () => {
        const many = Array.from({ length: 8 }, (_, i) => ({ name: `C${i}`, maxHp: 100 }));
        many[7] = { name: 'Far7', maxHp: 100 };
        getCombatContext.mockResolvedValue(cs(many));
        many.forEach(c => seedHp(c.name, 50));
        outOfRange.add('C4');
        outOfRange.add('Far7');
        // lawful pool = C0,C1,C2,C3,C5,C6 -> slice(0,6) consumes every lawful name
        for (let i = 0; i < 6; i++) roll('normal', 10, [10]);
        const result = await trigger(mhw5e, { slotLevel: 3 });
        expect(result.targets.map(t => t.targetName)).toEqual(['C0', 'C1', 'C2', 'C3', 'C5', 'C6']);
        expect(rollExpression).toHaveBeenCalledTimes(6); // lawful pool exhausted at cap
        expect(applyHealingToTarget).toHaveBeenCalledTimes(6);
    });

    it('#1348 single-target edges: one lawful target heals exactly it; sole candidate out-of-range -> noTargets, zero dice, zero dispatch', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Near', maxHp: 100 }]));
        seedHp('Near', 90);
        roll('normal', 15, [7, 8]);
        const one = await trigger(mhw5e, { slotLevel: 3 });
        expect(one.targets.map(t => t.targetName)).toEqual(['Near']);
        expect(one.totalHealed).toBe(10);

        getCombatContext.mockResolvedValueOnce(cs([{ name: 'Beyond', maxHp: 100 }]));
        seedHp('Beyond', 95);
        outOfRange.add('Beyond');
        roll('normal', 15, [7, 8]); // stays queued post-fix; consumed by the pre-fix range-blind defect
        const none = await trigger(mhw5e, { slotLevel: 3 });
        expect(none).toEqual({ noTargets: true });
        expect(rollExpression).toHaveBeenCalledTimes(1);
        expect(applyHealingToTarget).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(isWithinRange).toHaveBeenCalledWith('Cleric', 'Beyond', 60);
    });

    it('maxTargets read from disk: real row pins automation.maxTargets 6; synthetic row override 2 proves no hardcode', async () => {
        expect(mhw5e.automation.maxTargets).toBe(6); // disk truth byte (:6794)
        const spell = { ...mhw5e, automation: { ...mhw5e.automation, maxTargets: 2 } };
        const many = Array.from({ length: 4 }, (_, i) => ({ name: `C${i}`, maxHp: 100 }));
        getCombatContext.mockResolvedValue(cs(many));
        many.forEach(c => seedHp(c.name, 50));
        // 4 queued: post-fix consumes 2 (disk override); pre-fix consumes all 4 and
        // its 4-name target list fails the assertion — the no-disk-read capture.
        for (let i = 0; i < 4; i++) roll('normal', 10, [10]);
        const result = await trigger(spell, { slotLevel: 3 });
        expect(result.targets.map(t => t.targetName)).toEqual(['C0', 'C1']); // disk override honored, no hardcode
    });
});
