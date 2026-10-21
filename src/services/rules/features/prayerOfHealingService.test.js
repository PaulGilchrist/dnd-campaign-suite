// @maintained-by-ai
// prayerOfHealingService BASE lane (2024 fixture; direct-service trigger).
// Lane split (per prayerOfHealingService.results.test.js header + sp091 #1311):
//   - THIS lane owns: name gate, pre-combat guards (ladder-null, combat-context
//     falsy, requireCreatures throw), target selection (caster exclusion, 2024
//     disk cap-5, range filter, distance sort + stable ties + placedItems
//     fallback), heal_at_slot_level ladder (:31-49) + casting-mod resolution,
//     clamp application (:128-129), caster-stats-leak + maxHp fallback chain
//     (:121), and the 2024 CONSUME-SIDE setRuntimeBatch stamp bytes (:136).
//   - .results lane owns: 5e-twin (enforce=false) outcome shape, envelope bytes,
//     delta-0 census, exact applyHealingToTarget 5e args, FH consumption,
//     maximization routing, 5e disk cap-6 parity — NOT re-pinned here.
//   - sp091 (restRules-longRest.sp091-prayer-latch.test.js) owns the CLEAR side
//     of 'prayerOfHealingAffected'; refusal-vs-5e twins split per #1393 verbatim.
//   - prayerOfHealingHandler.test.js owns the modal/handler lane bytes.
// Writer triplet (#1311): base consume-stamp = HERE, inert-5e = .results,
// clear = sp091. Cited-by ledger: .results cites base combat-context/selection/
// cap-5 (:149-162/:412-508/:571 legacy refs); sp091 cites the consume-stamp
// contract — both PRESERVED, shifted ranges reported on run.
// Caller evidence: triggerSpells.js:431 positional call (spell, metaCtx,
// playerStats, campaignName, mapName) — the module's ONLY export; live.
// Disk canon (both rulesets, guarded by the disk-parity test): lv2, 30 ft,
// Instantaneous, no concentration => NO CLOCK (latchStamp is the round counter
// only — pinned as batch byte 7 with round:7, and :194 '|| 1' fallback).
// HP-key census: reads ONLY canonical 'currentHitPoints' (:122) + latch key
// (:116); strict argument-keyed store fake THROWS on unknown owner/key/
// campaign/arity and records read order (#1372/84/93). Dice fixed-stub queues
// THROW past the last stub (#1380). Fake timers freeze Date.now log bytes;
// spies afterEach-restored (#1312/#1388).
// Selection census: affiliation-blind (only c.name !== caster filters — the
// Ogre row proves it); range enforced HERE at :94 (casting-time band is the
// advisory at latch:71); distance sort :95 stable (ES2019) with null coords
// coerced to 0 by the comparator => unpositioned creatures rank FIRST
// (quirk pinned by the Ghost row); placedItems fallback :73-76 behavioral;
// caster without a grid pos bypasses range+sort entirely (:83-84 slice path).
// Never-executed guards found: :45 spellCastingMod null-side unreachable
// (getSpellCastingMod returns number|undefined only) — the undefined side IS
// reachable via a bonus-less ability row and leaves literal 'MOD' in the dice
// expression (quirk pinned); :38 filter(l<=slot).pop() cannot yield 0;
// :123 storedHp==='' side pinned; :121 truthy-non-array creatures:{} slips
// requireCreatures and dies raw on .filter (golden unguarded-deref, #1360).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerPrayerOfHealing } from './prayerOfHealingService.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionMaximized: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
}));

// rangeCheck kept REAL-FAITHFUL: rangeCheck.js:43-46 passes null distance and
// null range through — the mock mirrors it so the Ghost/null-grid quirks below
// pin production behavior, not mock convenience.
vi.mock('../combat/rangeCheck.js', () => ({
    isDistanceInRange: vi.fn((dist, range) => range == null || dist == null || dist <= range),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
    resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
    markFortifiedHealthUsed: vi.fn(),
    hasHealingMaximization: vi.fn(() => false),
    hasHealingMaximizationForTarget: vi.fn(() => false),
}));

import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../combat/rangeValidation.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization, hasHealingMaximizationForTarget } from '../../combat/automation/automationService.js';
import { getShortRestResources } from '../effects/restRules-constants.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';
const FIXED_TS = new Date('2026-10-21T12:00:00.000Z').getTime();
const HP = 'currentHitPoints';
const LATCH = 'prayerOfHealingAffected';

// Disk truth (2024): lv2 '2d8' no MOD — mutually distinguishable from the 5e
// disk ladder '2d8 + MOD' (#1348); guarded byte-exact in the disk-parity test.
const SPELL_2024 = spells2024.find(s => s.name === 'Prayer of Healing');
const SPELL_5E = spells5e.find(s => s.name === 'Prayer of Healing');

// 2024 enforcement lane: rules:'2024' => enforcementEnabled()===true (:53-55).
const CLERIC = {
    name: 'Cleric',
    rules: '2024',
    spellAbilities: { spellCastingAbility: 'Wisdom', modifier: 3 },
    proficiency: 3,
    level: 5,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
};

function modSpell(ladder, extra = {}) {
    return { name: 'Prayer of Healing', level: 2, range: '30 feet', heal_at_slot_level: ladder, ...extra };
}

const LADDER_MOD = { 2: '2d8 + MOD', 3: '3d8 + MOD', 4: '4d8 + MOD' };
const LADDER_LOW = { 2: '2d8 + MOD', 3: '3d8 + MOD' };

function buildParty(nameHp, round = 7) {
    // nameHp: [[name, maxHp]] — Cleric first at (1,1), allies one cell apart.
    return {
        players: nameHp.map(([name, _hp], i) => ({ name, gridX: 1 + i, gridY: 1 })),
        creatures: nameHp.map(([name, maxHp]) => ({ name, maxHp })),
        placedItems: [],
        round,
    };
}

// Faithful 5ft/cell Manhattan distance — grid positions become behavioral.
function distanceFeet(a, b) {
    return (Math.abs(a.gridX - b.gridX) + Math.abs(a.gridY - b.gridY)) * 5;
}

// Strict keyed store fake (#1372): records read order, THROWS on unknown
// owner/key/campaign/arity. 2024 lane touches ONLY latch (:116) + HP (:122).
function seedStore(hpByTarget, { latched = [], allowLatch = true } = {}) {
    const reads = [];
    getRuntimeValue.mockImplementation(function (owner, key, campaign) {
        if (arguments.length !== 3) {
            throw new Error(`getRuntimeValue arity: expected 3, got ${arguments.length}`);
        }
        if (campaign !== CAMPAIGN_NAME) throw new Error(`Unknown campaign: ${campaign}`);
        if (key === LATCH) {
            if (!allowLatch) throw new Error('non-enforce lane must not read the latch key');
            reads.push([owner, key]);
            return latched.includes(owner) ? 1 : undefined;
        }
        if (key !== HP) throw new Error(`Unknown key '${key}' for ${owner}`);
        if (!(owner in hpByTarget)) throw new Error(`Unknown owner: ${owner}`);
        reads.push([owner, key]);
        return hpByTarget[owner];
    });
    return reads;
}

// Fixed dice-stub queue (#1380): (n+1)th roll THROWS — target-count drift
// cannot hide behind a reused stub.
function seedDice(rolls) {
    let i = 0;
    return (expr) => {
        if (i >= rolls.length) throw new Error(`Unstubbed roll #${i + 1}: ${expr}`);
        return rolls[i++];
    };
}

// Byte builders for the latch automation logs (latch:41-54, :71-78).
const shortRestLog = (name) => ({
    type: 'automation',
    automationType: 'short_rest_benefit_applied',
    characterName: name,
    description: `${name} gains the benefits of a Short Rest from Cleric's Prayer of Healing — short-rest feature uses re-armed (shortRestHitDice pool untouched, no action expended).`,
    timestamp: FIXED_TS,
});
const hpLog = (name, delta, currentHp, maxHp) => ({
    type: 'hp_change',
    targetName: name,
    delta,
    currentHp,
    maxHp,
    isHealing: true,
    sourceName: 'Cleric',
    note: 'Prayer of Healing',
    formula: '2d8',
    bonusDetails: undefined,
    timestamp: FIXED_TS,
});
const refuseLog = (name) => ({
    type: 'automation',
    automationType: 'prayer_of_healing_refused',
    characterName: name,
    description: `${name} refuses Prayer of Healing — already affected since their last Long Rest (no effect until that creature finishes a Long Rest).`,
    timestamp: FIXED_TS,
});
const advisoryLog = (names) => ({
    type: 'automation',
    automationType: 'prayer_of_healing_range_advisory',
    characterName: 'Cleric',
    // Quirk noted: the advisory text hardcodes '30 feet' / '10-minute'
    // regardless of spell.range (latch:76).
    description: `GM confirms ${names.join(', ')} remained within 30 feet of Cleric for the spell's entire 10-minute casting (range/duration not enforced — advisory).`,
    timestamp: FIXED_TS,
});

// Consume-side batch bytes: stamp key first, then every SHORT_REST_RESOURCES
// key nulled (latch:42-45) — built from the REAL constants module (guard-real-
// tables #1352): a CLA drift in the reset list lands here as a byte mismatch.
const batchUpdates = (stamp) => ({
    [LATCH]: stamp,
    ...Object.fromEntries(getShortRestResources().map(k => [k, null])),
});

function seedDefaults() {
    rangeToFeet.mockReturnValue(30);
    getDistanceFeet.mockImplementation(distanceFeet);
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    hasHealingMaximization.mockReturnValue(false);
    hasHealingMaximizationForTarget.mockReturnValue(false);
    applyHealingToTarget.mockReturnValue(undefined);
    setRuntimeValue.mockReturnValue(undefined);
    setRuntimeBatch.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    rollExpressionMaximized.mockImplementation(() => {
        throw new Error('maximized roller must not fire without a maximization flag');
    });
    window.dispatchEvent = vi.fn();
}

function clearCalls() {
    [getCombatContext, rollExpression, rollExpressionMaximized, applyHealingToTarget,
        addEntry, setRuntimeBatch, getRuntimeValue, getDistanceFeet, rangeToFeet]
        .forEach(m => m.mockClear());
}

describe('prayerOfHealingService (base, 2024 lane)', () => {
    let consoleSpy;

    beforeEach(() => {
        vi.resetAllMocks(); // #1312: full reset, then explicit re-seed
        seedDefaults();
        vi.useFakeTimers(); // #1388: freeze Date.now so log timestamps are byte-pinned
        vi.setSystemTime(FIXED_TS);
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        consoleSpy.mockRestore();
    });

    it('disk canon (both rulesets): lv2 gates the two distinguishable ladders, Instantaneous => no clock', () => {
        expect(SPELL_2024).toBeDefined();
        expect(SPELL_5E).toBeDefined();
        expect(SPELL_2024.level).toBe(2);
        expect(SPELL_5E.level).toBe(2);
        expect(SPELL_2024.range).toBe('30 feet');
        expect(SPELL_2024.duration).toBe('Instantaneous');
        expect(SPELL_2024.concentration).toBe(false);
        // Tiers mutually distinguishable (#1348): 2024 verbatim d8s, 5e '+ MOD'.
        expect(SPELL_2024.heal_at_slot_level['2']).toBe('2d8');
        expect(SPELL_5E.heal_at_slot_level['2']).toBe('2d8 + MOD');
        // Disk truth for the two cap + latch pins below / in .results lane.
        expect(SPELL_2024.description[0]).toContain('Up to five creatures');
        expect(SPELL_2024.description[0]).toContain("can't be affected by this spell again until that creature finishes a Long Rest");
        expect(SPELL_5E.description[0]).toContain('Up to six creatures');
        // Gate-drift tripwire: the service constant must equal the disk name or
        // every cast silently returns null (#1357 zero-producer drift).
        expect(modSpell(LADDER_MOD).name).toBe(SPELL_2024.name);
    });

    it('name gate: exact "Prayer of Healing" only — near-miss names return null before ANY downstream call', async () => {
        const nearMisses = [
            { name: 'Cure Wounds', level: 1 },
            { level: 1 },
            { name: '', level: 2 },
            { name: 'prayer of healing', level: 2 },
            { name: 'Prayer of Healing ', level: 2 },
        ];
        for (const spell of nearMisses) {
            clearCalls();
            const result = await triggerPrayerOfHealing(spell, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);
            expect(result).toBeNull();
        }
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns null before combat when no heal expression resolves (:33/:38/:43)', async () => {
        const rows = [
            { name: 'Prayer of Healing', level: 2, range: '30 feet' },
            { name: 'Prayer of Healing', level: 2, range: '30 feet', heal_at_slot_level: {} },
            { name: 'Prayer of Healing', level: 1, range: '30 feet', heal_at_slot_level: { 2: '2d8 + MOD' } },
        ];
        for (const spell of rows) {
            clearCalls();
            const result = await triggerPrayerOfHealing(spell, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);
            expect(result).toBeNull();
        }
        // Ladder resolves BEFORE combat context is fetched (:170 precedes :176).
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(rollExpression).not.toHaveBeenCalled();
    });

    it('guards the combat context: falsy resolves null, requireCreatures throws on nullish, {} dies raw', async () => {
        for (const falsy of [null, undefined, false]) {
            clearCalls();
            getCombatContext.mockResolvedValue(falsy);
            const result = await triggerPrayerOfHealing(SPELL_2024, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);
            expect(result).toBeNull();
        }
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(setRuntimeBatch).not.toHaveBeenCalled();

        consoleSpy.mockClear();
        getCombatContext.mockResolvedValue(buildParty([['Cleric', 60], ['Ally1', 50]]));
        getCombatContext.mockResolvedValueOnce({ players: [], creatures: null, placedItems: [] });
        await expect(triggerPrayerOfHealing(SPELL_2024, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME))
            .rejects.toThrow('Expected array, got null');
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('[prayerOfHealingService] Missing array:', null);

        consoleSpy.mockClear();
        getCombatContext.mockResolvedValueOnce({ players: [], creatures: undefined, placedItems: [] });
        await expect(triggerPrayerOfHealing(SPELL_2024, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME))
            .rejects.toThrow('Expected array, got undefined');
        expect(consoleSpy).toHaveBeenCalledTimes(1);

        // Golden unguarded-deref (#1360): requireCreatures only traps == null —
        // a truthy non-array slips past the guard AND the console.error.
        consoleSpy.mockClear();
        getCombatContext.mockResolvedValueOnce({ players: [], creatures: {}, placedItems: [] });
        await expect(triggerPrayerOfHealing(SPELL_2024, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME))
            .rejects.toThrow(/is not a function/);
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('resolves the heal expression: slot ladder, casting-mod priority, and the literal-MOD survivor', async () => {
        const singleParty = buildParty([['Cleric', 60], ['Ally1', 50]]);
        const charismaSpell = modSpell(LADDER_LOW, { spellCastingAbility: 'Charisma' });
        const rows = [
            // Disk 2024 lv2 verbatim — no MOD token to substitute.
            { spell: SPELL_2024, metaCtx: {}, stats: CLERIC, expr: '2d8' },
            // metaCtx.slotLevel beats spell.level (:159).
            { spell: modSpell(LADDER_MOD), metaCtx: { slotLevel: 4 }, stats: CLERIC, expr: '4d8 + 3' },
            // undefined metaCtx exercises the optional chain -> spell.level 2.
            { spell: modSpell(LADDER_MOD), metaCtx: undefined, stats: CLERIC, expr: '2d8 + 3' },
            // slotLevel above every rung clamps to the HIGHEST rung below (:37-41).
            { spell: modSpell(LADDER_LOW), metaCtx: { slotLevel: 9 }, stats: CLERIC, expr: '3d8 + 3' },
            // Quirk: slotLevel 0 is falsy and falls through to spell.level (:159).
            { spell: modSpell(LADDER_MOD), metaCtx: { slotLevel: 0 }, stats: CLERIC, expr: '2d8 + 3' },
            // spell.spellCastingAbility outranks playerStats.spellAbilities (:18).
            { spell: charismaSpell, metaCtx: {}, stats: { ...CLERIC, abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Charisma', bonus: 5 }] }, expr: '2d8 + 5' },
            // Never-executed-guard survivor (:45): bonus-less ability returns
            // undefined, so MOD is NOT substituted and the literal reaches the dice.
            { spell: charismaSpell, metaCtx: {}, stats: { ...CLERIC, abilities: [{ name: 'Charisma' }] }, expr: '2d8 + MOD' },
            // No abilities at all -> mod 0 substituted (:28).
            { spell: modSpell(LADDER_LOW), metaCtx: {}, stats: { ...CLERIC, spellAbilities: undefined, abilities: undefined }, expr: '2d8 + 0' },
        ];
        for (const { spell, metaCtx, stats, expr } of rows) {
            clearCalls();
            getCombatContext.mockResolvedValue(singleParty);
            seedStore({ Ally1: 10 });
            rollExpression.mockImplementation(seedDice([{ total: 8, rolls: [4, 4] }]));

            const result = await triggerPrayerOfHealing(spell, metaCtx, stats, CAMPAIGN_NAME, MAP_NAME);

            expect(rollExpression).toHaveBeenCalledTimes(1);
            expect(rollExpression).toHaveBeenCalledWith(expr);
            expect(result.formula).toBe(expr);
        }
    });

    it('selects targets: caster excluded, cap 5 by disk truth, distance-sorted with stable ties, placedItems fallback, null pos ranks first, affiliation-blind', async () => {
        const ctx = {
            players: [
                { name: 'Cleric', gridX: 1, gridY: 1 },
                { name: 'Ogre', gridX: 2, gridY: 2 }, // affiliation-blind: still a valid target
                { name: 'Ally1', gridX: 2, gridY: 1 },
                { name: 'Ally2', gridX: 2, gridY: 2 },
                { name: 'Ally4', gridX: 4, gridY: 1 },
                { name: 'Ally5', gridX: 5, gridY: 1 },
                { name: 'Ally6', gridX: 6, gridY: 1 },
                { name: 'Ally7', gridX: 10, gridY: 1 }, // 45ft > 30ft => range-filtered (:94)
            ],
            creatures: [
                { name: 'Cleric', maxHp: 60 }, // excluded by name (:82)
                { name: 'Ogre', maxHp: 50 },
                { name: 'Ally1', maxHp: 50 },
                { name: 'Ally2', maxHp: 50 },
                { name: 'Ally3', maxHp: 50 }, // no player row — placedItems fallback (:73)
                { name: 'Ally4', maxHp: 50 },
                { name: 'Ally5', maxHp: 50 },
                { name: 'Ally6', maxHp: 50 },
                { name: 'Ally7', maxHp: 50 },
                { name: 'Ghost', maxHp: 50 }, // no position anywhere — quirk row
            ],
            placedItems: [{ name: 'Ally3', gridX: 3, gridY: 1 }],
            round: 7,
        };
        getCombatContext.mockResolvedValue(ctx);
        const reads = seedStore(Object.fromEntries(
            ['Ogre', 'Ally1', 'Ally2', 'Ally3', 'Ally4', 'Ally5', 'Ally6', 'Ghost'].map(n => [n, 10]),
        ));
        rollExpression.mockImplementation(seedDice(Array.from({ length: 5 }, () => ({ total: 8, rolls: [4, 4] }))));

        const result = await triggerPrayerOfHealing(SPELL_2024, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);

        // Ghost sorts FIRST: null dist coerces to 0 by :95's numeric comparator.
        expect(result.targets.map(t => t.targetName)).toEqual(['Ghost', 'Ally1', 'Ogre', 'Ally2', 'Ally3']);
        expect(result.totalHealed).toBe(40);
        // 2024 disk cap of FIVE (.results lane pins the 5e twin's six).
        expect(result.targets).toHaveLength(5);
        expect(rollExpression).toHaveBeenCalledTimes(5); // dice queue drained — a 6th would THROW
        // Read order census: latch (:116) precedes HP (:122) per kept target.
        expect(reads).toEqual([
            ['Ghost', LATCH], ['Ghost', HP],
            ['Ally1', LATCH], ['Ally1', HP],
            ['Ogre', LATCH], ['Ogre', HP],
            ['Ally2', LATCH], ['Ally2', HP],
            ['Ally3', LATCH], ['Ally3', HP],
        ]);
        expect(setRuntimeBatch).toHaveBeenCalledTimes(5);
        expect(setRuntimeBatch.mock.calls.every(c => c[1][LATCH] === 7)).toBe(true);

        // Caster WITHOUT a grid position: range filter + sort are bypassed
        // entirely (:83-84) — first five creatures in list order, and
        // getDistanceFeet must never fire.
        clearCalls();
        getDistanceFeet.mockImplementation(() => {
            throw new Error('distance must not be measured for an unpositioned caster');
        });
        getCombatContext.mockResolvedValue({
            players: [{ name: 'Cleric' }],
            creatures: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'].map(n => ({ name: n, maxHp: 50 })),
            placedItems: [],
            round: 1,
        });
        seedStore(Object.fromEntries(['A1', 'A2', 'A3', 'A4', 'A5'].map(n => [n, 10])));
        rollExpression.mockImplementation(seedDice(Array.from({ length: 5 }, () => ({ total: 8, rolls: [4, 4] }))));

        const unpositioned = await triggerPrayerOfHealing(SPELL_2024, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);
        expect(unpositioned.targets.map(t => t.targetName)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
        expect(getDistanceFeet).not.toHaveBeenCalled();
    });

    it('measures range from the spell: explicit range keeps a 50ft ally, absent range defaults to 30ft and empties the board', async () => {
        const farParty = {
            players: [{ name: 'Cleric', gridX: 1, gridY: 1 }, { name: 'FarAlly', gridX: 11, gridY: 1 }],
            creatures: [{ name: 'FarAlly', maxHp: 50 }],
            placedItems: [],
            round: 1,
        };
        // '60 feet' honored: FarAlly sits at exactly 50ft (10 cells x 5ft).
        clearCalls();
        rangeToFeet.mockReturnValue(60);
        getCombatContext.mockResolvedValue(farParty);
        seedStore({ FarAlly: 10 });
        rollExpression.mockImplementation(seedDice([{ total: 8, rolls: [4, 4] }]));

        const wide = await triggerPrayerOfHealing(modSpell(LADDER_LOW, { range: '60 feet' }), {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);
        expect(rangeToFeet).toHaveBeenCalledWith('60 feet');
        expect(wide.targets.map(t => t.targetName)).toEqual(['FarAlly']);

        // No range field -> '30 feet' default (:183) and the same ally falls off.
        clearCalls();
        rangeToFeet.mockReturnValue(30);
        getCombatContext.mockResolvedValue(farParty);

        const dry = await triggerPrayerOfHealing(modSpell(LADDER_LOW, { range: undefined }), {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);
        expect(rangeToFeet).toHaveBeenCalledWith('30 feet');
        expect(dry).toEqual({ noTargets: true });
        expect(rollExpression).not.toHaveBeenCalled();
    });

    it('2024 consume side: clamp arithmetic + byte-exact latch batch, short-rest logs, hp rows and advisory', async () => {
        // Ally1 clamped (room 5), Ally2 full-HP (heal 0 but STILL latched —
        // :135 is not gated on actualHeal; zero-heal stamp quirk), Ally3 raw.
        const ctx = buildParty([['Cleric', 60], ['Ally1', 50], ['Ally2', 30], ['Ally3', 40]], 7);
        getCombatContext.mockResolvedValue(ctx);
        const reads = seedStore({ Ally1: 45, Ally2: 30, Ally3: 10 });
        rollExpression.mockImplementation(seedDice([
            { total: 8, rolls: [3, 5] },
            { total: 8, rolls: [4, 4] },
            { total: 8, rolls: [2, 6] },
        ]));

        const result = await triggerPrayerOfHealing(SPELL_2024, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);

        expect(Object.keys(result)).toEqual(['targets', 'formula', 'totalHealed', 'rolls', 'rawTotal']);
        expect(result).toEqual({
            targets: [
                { targetName: 'Ally1', healAmount: 5, rolls: [3, 5], rawTotal: 8 },
                { targetName: 'Ally2', healAmount: 0, rolls: [4, 4], rawTotal: 8 },
                { targetName: 'Ally3', healAmount: 8, rolls: [2, 6], rawTotal: 8 },
            ],
            formula: '2d8',
            totalHealed: 13,
            rolls: [3, 5, 4, 4, 2, 6],
            rawTotal: 24,
        });
        expect(reads).toEqual([
            ['Ally1', LATCH], ['Ally1', HP],
            ['Ally2', LATCH], ['Ally2', HP],
            ['Ally3', LATCH], ['Ally3', HP],
        ]);
        // min(roll+bonus, maxHp-current) (:128-129): zero-heal skips apply.
        expect(applyHealingToTarget.mock.calls).toEqual([
            [ctx, 'Ally1', 5, CAMPAIGN_NAME],
            [ctx, 'Ally3', 8, CAMPAIGN_NAME],
        ]);
        // ONE merged batch per enforced target incl. full-HP Ally2; stamp is the
        // round counter (7, never a wall clock); every SHORT_REST_RESOURCES key
        // re-armed to null (latch:42-45) — consume-side stamp bytes (#1311 pair).
        expect(setRuntimeBatch.mock.calls).toEqual([
            ['Ally1', batchUpdates(7), CAMPAIGN_NAME],
            ['Ally2', batchUpdates(7), CAMPAIGN_NAME],
            ['Ally3', batchUpdates(7), CAMPAIGN_NAME],
        ]);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        // Full log-call-set: per target short-rest byte BEFORE hp byte (:136/:141),
        // then one range advisory from finalizePrayerPostCast (:208).
        expect(addEntry.mock.calls).toEqual([
            [CAMPAIGN_NAME, shortRestLog('Ally1')],
            [CAMPAIGN_NAME, hpLog('Ally1', 5, 50, 50)],
            [CAMPAIGN_NAME, shortRestLog('Ally2')],
            [CAMPAIGN_NAME, hpLog('Ally2', 0, 30, 30)],
            [CAMPAIGN_NAME, shortRestLog('Ally3')],
            [CAMPAIGN_NAME, hpLog('Ally3', 8, 18, 40)],
            [CAMPAIGN_NAME, advisoryLog(['Ally1', 'Ally2', 'Ally3'])],
        ]);
        expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
        expect(window.dispatchEvent.mock.calls[0][0].type).toBe('combat-summary-updated');
    });

    it('enforcement case-gate splits the twins, and skipped targets roll-and-stamp nothing', async () => {
        // Phase A — 2024, Ally1 latched: refused BEFORE maxHp/HP reads (the
        // strict store has NO Ally1 HP seed: reaching :122 would THROW).
        const ctx = buildParty([['Cleric', 60], ['Ally1', 50], ['Ally2', 50], ['Ally3', 50]], 1);
        clearCalls();
        getCombatContext.mockResolvedValue(ctx);
        const reads = seedStore({ Ally2: 10, Ally3: 10 }, { latched: ['Ally1'] });
        rollExpression.mockImplementation(seedDice([
            { total: 8, rolls: [4, 4] },
            { total: 8, rolls: [2, 6] },
        ]));

        const refused = await triggerPrayerOfHealing(SPELL_2024, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);

        expect(refused.targets.map(t => t.targetName)).toEqual(['Ally2', 'Ally3']);
        expect(reads).toEqual([
            ['Ally1', LATCH],
            ['Ally2', LATCH], ['Ally2', HP],
            ['Ally3', LATCH], ['Ally3', HP],
        ]);
        expect(rollExpression).toHaveBeenCalledTimes(2);
        expect(addEntry.mock.calls).toEqual([
            [CAMPAIGN_NAME, refuseLog('Ally1')],
            [CAMPAIGN_NAME, shortRestLog('Ally2')],
            [CAMPAIGN_NAME, hpLog('Ally2', 8, 18, 50)],
            [CAMPAIGN_NAME, shortRestLog('Ally3')],
            [CAMPAIGN_NAME, hpLog('Ally3', 8, 18, 50)],
            [CAMPAIGN_NAME, advisoryLog(['Ally2', 'Ally3'])],
        ]);
        expect(setRuntimeBatch.mock.calls.map(c => c[0])).toEqual(['Ally2', 'Ally3']);

        // Phase B — same board, 5e twin: the strict store now THROWS on any
        // latch read, so a clean pass proves enforcementEnabled()===false (:54).
        // (Outcome-shape/FH bytes stay with .results — gate direction only.)
        clearCalls();
        seedStore({ Ally1: 10, Ally2: 10, Ally3: 10 }, { allowLatch: false });
        rollExpression.mockImplementation(seedDice(Array.from({ length: 3 }, () => ({ total: 8, rolls: [4, 4] }))));

        const twin = await triggerPrayerOfHealing(SPELL_5E, {}, { ...CLERIC, rules: '5e' }, CAMPAIGN_NAME, MAP_NAME);

        expect(twin.targets.map(t => t.targetName)).toEqual(['Ally1', 'Ally2', 'Ally3']);
        expect(setRuntimeBatch).not.toHaveBeenCalled();
        expect(addEntry.mock.calls.every(c => c[1].type === 'hp_change')).toBe(true);

        // Phase C — null roll (:126) skips per-target with ZERO stamp; missing
        // round falls back to :194 '|| 1' (still a round counter, never a clock).
        clearCalls();
        getCombatContext.mockResolvedValue({
            players: [{ name: 'Cleric', gridX: 1, gridY: 1 }, { name: 'Ally1', gridX: 2, gridY: 1 }, { name: 'Ally2', gridX: 3, gridY: 1 }],
            creatures: [{ name: 'Ally1', maxHp: 50 }, { name: 'Ally2', maxHp: 50 }],
            placedItems: [],
        });
        seedStore({ Ally1: 10, Ally2: 10 });
        rollExpression.mockImplementation(seedDice([null, { total: 8, rolls: [4, 4] }]));

        const rolled = await triggerPrayerOfHealing(SPELL_2024, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);

        expect(rollExpression).toHaveBeenCalledTimes(2); // per-target skip, loop continues
        expect(rolled.targets.map(t => t.targetName)).toEqual(['Ally2']);
        expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
        expect(setRuntimeBatch).toHaveBeenCalledWith('Ally2', batchUpdates(1), CAMPAIGN_NAME);
        expect(addEntry.mock.calls.map(c => c[1].automationType)).toEqual([
            'short_rest_benefit_applied', undefined, 'prayer_of_healing_range_advisory',
        ]);
        expect(addEntry.mock.calls.every(c => c[1].characterName !== 'Ally1' && c[1].targetName !== 'Ally1')).toBe(true);
    });

    it('maxHp fallback chain (:121): caster-stats leak clamps a maxHp-less ally, then 0, then empty-store', async () => {
        const leakBoard = () => ({
            players: [{ name: 'Cleric', gridX: 1, gridY: 1 }, { name: 'NoHpAlly', gridX: 2, gridY: 1 }],
            creatures: [{ name: 'NoHpAlly' }], // no maxHp — the :121 producer path
            placedItems: [],
            round: 1,
        });

        // Phase A — SOURCE BUG service:121 (reported, pinned as-is): the fallback
        // reads the CASTER's hitPoints, so an 8-HP cleric silently caps another
        // party member's heal at room 5. Flips-if-fixed: target-derived ceiling.
        clearCalls();
        getCombatContext.mockResolvedValue(leakBoard());
        seedStore({ NoHpAlly: 3 });
        rollExpression.mockImplementation(seedDice([{ total: 8, rolls: [5, 3] }]));

        const leaked = await triggerPrayerOfHealing(SPELL_2024, {}, { ...CLERIC, hitPoints: 8 }, CAMPAIGN_NAME, MAP_NAME);

        expect(leaked.targets).toEqual([{ targetName: 'NoHpAlly', healAmount: 5, rolls: [5, 3], rawTotal: 8 }]);
        expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'NoHpAlly', 5, CAMPAIGN_NAME);
        expect(addEntry.mock.calls.filter(c => c[1].type === 'hp_change').map(c => c[1].maxHp)).toEqual([8]);

        // Phase B — nothing anywhere: maxHp 0 => negative clamp arithmetic
        // healamount -3 leaks into the row + hp_change delta byte, but the
        // :131 >0 gate silently skips the apply.
        clearCalls();
        getCombatContext.mockResolvedValue(leakBoard());
        seedStore({ NoHpAlly: 3 });
        rollExpression.mockImplementation(seedDice([{ total: 8, rolls: [5, 3] }]));

        const zero = await triggerPrayerOfHealing(SPELL_2024, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);

        expect(zero.targets).toEqual([{ targetName: 'NoHpAlly', healAmount: -3, rolls: [5, 3], rawTotal: 8 }]);
        expect(zero.totalHealed).toBe(-3);
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(addEntry.mock.calls.filter(c => c[1].type === 'hp_change').map(c => c[1])).toEqual([hpLog('NoHpAlly', -3, 0, 0)]);

        // Phase C — stored '' (:123 dead-side): treated as "at max" => heal 0,
        // no apply, latch still stamped (zero-heal-stamp quirk again).
        clearCalls();
        getCombatContext.mockResolvedValue(buildParty([['Cleric', 60], ['Ally1', 50]], 1));
        seedStore({ Ally1: '' });
        rollExpression.mockImplementation(seedDice([{ total: 8, rolls: [4, 4] }]));

        const empty = await triggerPrayerOfHealing(SPELL_2024, {}, CLERIC, CAMPAIGN_NAME, MAP_NAME);

        expect(empty.targets).toEqual([{ targetName: 'Ally1', healAmount: 0, rolls: [4, 4], rawTotal: 8 }]);
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(setRuntimeBatch).toHaveBeenCalledWith('Ally1', batchUpdates(1), CAMPAIGN_NAME);
    });
});
