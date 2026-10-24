// @maintained-by-ai
/**
 * healService lane — fixed-amount PRODUCER for 'Heal' (lv6), live export.
 *
 * LIVE-vs-DEAD (#1370 method): triggerHeal has a production caller —
 * useSimpleSpellHandlers.js runHeal at :102 (imported at :17), forwarding
 * {name, spell, level} + {targetName}. Caller-side tuples are NOT pinned here —
 * useSpellMetamagicFlow.complex-handlers.charm-heal.test.js and
 * confirm-payloads.test.js own those. Single export, nothing dead.
 *
 * Producer vs forwarder: this lane builds the heal amount itself — parseInt
 * ladder over heal_at_slot_level plus additive bonus stacking via
 * resolveHealingBonusesWithDetails (healService.js:49-60, :117-123). It never
 * calls resolveHealExpression, so dice-expression ownership (#1278
 * spellDamageUtils.test.js:173-194 — VERBATIM:
 * resolveHealExpression(disk5e('Healing Word'), 1, 5) === '1d4+5') does not
 * apply: the disk 'Heal' rows carry static numeric literals only and this
 * lane owns that ladder end-to-end.
 *
 * DISK DETERMINATION (both rulesets read programmatically below):
 *  5e   'Heal': regain 70 HP; ends blindness, deafness, and any DISEASES;
 *       no effect on CONSTRUCTS OR UNDEAD; +10 per slot above 6th.
 *  2024 'Heal': 70 HP; status_effects ['Blinded','Deafened','Poisoned'].
 *  Both: heal_at_slot_level {6:'70',7:'80',8:'90',9:'100'} — parity pinned.
 *  NOT 10+d10 — the steering's d10 recollection is not disk canon.
 *
 * SOURCE BUGS REPORTED (not fixed here):
 *  - healService.js:8 hardcoded remove-list has 'poisoned' but the 5e disk
 *    ends DISEASES (2024 semantics): 5e casts clear Poisoned and never Disease.
 *  - healService.js:32-41 over-log (FIXED fix#337S #1372): the log loop now
*    names ONLY conditions the target actually had (candidate-order canonical
*    names); phantom never-stored names can no longer land. Rows A/B/D flipped.
 *  - no undead/construct exclusion gate anywhere despite the 5e disk text —
 *    undead get healed; current behavior pinned in the undead row.
 *  - healService.js:52 vs :148 asymmetry: unknown slot heals at the
 *    highest-key tier (100) while result.formula reports '70'. Quirk pinned.
 *  - healService.js:65 vs :69 null-guard asymmetry on the canonical HP pair
 *    (hitPoints/currentHitPoints, #1371): maxHp falls back only on
 *    null/undefined (??), currentHp additionally rejects ''. Both pinned.
 *
 * Store machine-proof: strict fake permits exactly hitPoints /
 * currentHitPoints / activeConditions at CAMPAIGN and throws on any other
 * read; per-row read ORDER asserted. skipSync POSITION audit: the single
 * write is setRuntimeValue(target,'activeConditions',next,campaign) — a
 * 4-tuple; setRuntimeValue (useRuntimeState.js:78) has no skipSync param and
 * this lane never calls setRuntimeObject, so no SSE-echo path exists here.
 * applyHealingToTarget's return value is ignored by the source (:126) — only
 * its call tuple is pinned. markFortifiedHealthUsed: not imported here.
 *
 * Family-class scan, honest: prof||0 + level||1 coercion into the bonus ctx
 * pinned (#1365 class); :0-chains are those plus spell.level||6; no
 * latch/once-per-rest pair; no never-executed guards beyond the gaps listed
 * above — otherwise zero-clean. No clocks: duration is Instantaneous on disk
 * both rulesets; Date.now() stamps log payloads only — fake timers freeze
 * every timestamp at 0; nothing schedules anything; no stored expiry number.
 * PRESERVED-CITED-BY: none — no src file cites healService.test.js (grep).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerHeal } from './healService.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

// ── Mocks (module boundaries only) ────────────────────────────

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
    resolveHealingBonusesWithDetails: vi.fn(),
}));

import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { resolveHealingBonusesWithDetails } from '../../combat/automation/automationService.js';

// ── Canon helpers ─────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';

function diskRow(spells, name) {
    const spell = spells.find(s => s.name === name);
    if (!spell) throw new Error(`spell missing from disk: ${name}`);
    return spell;
}
const heal5e = diskRow(spells5e, 'Heal');
const heal2024 = diskRow(spells2024, 'Heal');

const playerStats = { name: 'TestCaster', proficiency: 4, level: 5 };

let combatCtx;
let store;
let reads;
let dispatchSpy;
let consoleSpy;

function seed(entity, key, value) {
    store.set(`${entity}|${key}|${CAMPAIGN}`, value);
}

function logsOfType(type) {
    return addEntry.mock.calls.filter(c => c[1].type === type).map(c => c[1]);
}

function popupCall() {
    const hit = dispatchSpy.mock.calls.find(c => c[0]?.type === 'healing-popup');
    return hit ? hit[0] : undefined;
}

const ALLOWED_KEYS = ['hitPoints', 'currentHitPoints', 'activeConditions'];

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // explicit re-seed every test: monster Target at 30/100, no stored conditions,
    // zero healing bonuses.
    reads = [];
    store = new Map([['Target|activeConditions|' + CAMPAIGN, []]]);
    getRuntimeValue.mockImplementation((entity, key, campaign) => {
        if (!ALLOWED_KEYS.includes(key)) {
            throw new Error(`unexpected store key read: ${key} (heal reads only ${ALLOWED_KEYS.join('/')})`);
        }
        if (campaign !== CAMPAIGN) {
            throw new Error(`unexpected store read campaign: ${campaign}`);
        }
        reads.push(key);
        return store.get(`${entity}|${key}|${campaign}`);
    });
    combatCtx = { creatures: [{ name: 'Target', type: 'npc', currentHp: 30, maxHp: 100 }] };
    getCombatContext.mockResolvedValue(combatCtx);
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('healService.triggerHeal', () => {
    it.each([
        ['real-disk near-miss Healing Word', diskRow(spells5e, 'Healing Word'), 'Target'],
        ['real-disk near-miss Cure Wounds', diskRow(spells5e, 'Cure Wounds'), 'Target'],
        ['real-disk near-miss Mass Heal', diskRow(spells5e, 'Mass Heal'), 'Target'],
        ['lowercase name heal (case-sensitive gate)', { name: 'heal' }, 'Target'],
        ['missing name', {}, 'Target'],
        ['null name', { name: null }, 'Target'],
        ['targetName undefined', heal5e, undefined],
        ['targetName empty string', heal5e, ''],
    ])('returns null for %s and touches nothing downstream', async (_label, spell, targetName) => {
        const result = await triggerHeal(spell, { targetName }, playerStats, CAMPAIGN, null);
        expect(result).toBeNull();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(reads).toEqual([]);
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it.each([
        ['null combat context', null],
        ['target not found in combatSummary (exact-name match)', { creatures: [{ name: 'OtherCreature', currentHp: 10, maxHp: 50 }] }],
    ])('returns null without healing or dispatching when %s', async (_label, ctx) => {
        getCombatContext.mockResolvedValue(ctx);
        const result = await triggerHeal(heal5e, { targetName: 'Target' }, playerStats, CAMPAIGN, null);
        expect(result).toBeNull();
        expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('main path (disk 5e row, slot 6, npc 30/100): exact tuples, envelopes, events, identity pins', async () => {
        const result = await triggerHeal(heal5e, { targetName: 'Target' }, playerStats, CAMPAIGN, null);

        const [statsArg, ctxArg] = resolveHealingBonusesWithDetails.mock.calls[0];
        expect(statsArg).toBe(playerStats);
        expect(ctxArg).toEqual({ prof: 4, level: 5, slotLevel: 6, campaignName: CAMPAIGN });
        expect(applyHealingToTarget).toHaveBeenCalledWith(combatCtx, 'Target', 70, CAMPAIGN);
        expect(setRuntimeValue).not.toHaveBeenCalled();

        expect(logsOfType('hp_change')).toEqual([{
            type: 'hp_change',
            targetName: 'Target',
            delta: 70,
            currentHp: 100,
            maxHp: 100,
            isHealing: true,
            sourceName: 'TestCaster',
            note: 'Heal',
            formula: '70',
            bonusDetails: undefined,
            timestamp: 0,
        }]);

        expect(result).toEqual({
            targetName: 'Target',
            healAmount: 70,
            formula: '70',
            rolls: [],
            rawTotal: 70,
            bonusHeal: 0,
            bonusDetails: [],
        });

        const events = dispatchSpy.mock.calls.map(c => c[0]);
        expect(events.map(e => e.type)).toEqual(['combat-summary-updated', 'healing-popup']);
        expect(events[1].detail).toEqual({
            targetName: 'Target',
            sourceName: 'TestCaster',
            healingName: 'Heal',
            rollInfo: '',
            maximizeHealingDice: false,
            popupText: 'Heal on Target: Regained 70 HP',
        });
    });

    it('upcast disk lv7 + bonus composition: ladder 80, Bless 10 stacks to 90, log formula exact', async () => {
        resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 10, details: [{ name: 'Bless', amount: 10 }] });
        combatCtx.creatures = [{ name: 'Target', type: 'npc', currentHp: 10, maxHp: 100 }];

        const result = await triggerHeal({ ...heal2024, level: 7 }, { targetName: 'Target' }, playerStats, CAMPAIGN, null);

        expect(resolveHealingBonusesWithDetails.mock.calls[0][1]).toEqual({ prof: 4, level: 5, slotLevel: 7, campaignName: CAMPAIGN });
        expect(applyHealingToTarget).toHaveBeenCalledWith(combatCtx, 'Target', 90, CAMPAIGN);
        expect(logsOfType('hp_change')[0]).toMatchObject({ formula: '80 + (10 Bless)', delta: 90, currentHp: 100, maxHp: 100 });
        expect(result).toEqual({
            targetName: 'Target',
            healAmount: 90,
            formula: '80',
            rolls: [],
            rawTotal: 90,
            bonusHeal: 10,
            bonusDetails: [{ name: 'Bless', amount: 10 }],
        });
        expect(popupCall().detail.popupText).toBe('Heal on Target: Regained 90 HP');
    });

    it.each([
        ['slot 10 not on the disk table: base falls back to highest tier 100 but result.formula reports the 70 quirk (healService.js:52 vs :148)', { ...heal5e, level: 10 }, 200, 0, 100, '70', '70'],
        ['spell with no heal_at_slot_level at all: hardcoded 70 default', { name: 'Heal', level: 6 }, 100, 30, 70, '70', '70'],
    ])('base-amount fallbacks — %s', async (_label, spell, maxHp, currentHp, expectedHeal, expectedResultFormula, expectedLogFormula) => {
        combatCtx.creatures = [{ name: 'Target', type: 'npc', currentHp, maxHp }];

        const result = await triggerHeal(spell, { targetName: 'Target' }, playerStats, CAMPAIGN, null);

        expect(applyHealingToTarget).toHaveBeenCalledWith(combatCtx, 'Target', expectedHeal, CAMPAIGN);
        expect(result.healAmount).toBe(expectedHeal);
        expect(result.formula).toBe(expectedResultFormula);
        expect(logsOfType('hp_change')[0].formula).toBe(expectedLogFormula);
    });

    it('rejects with exact Error and exact-prefix console.error when the slot literal is non-numeric (synthetic row; disk is always numeric), before any store read', async () => {
        const spell = { ...heal5e, heal_at_slot_level: { 6: 'seventy' } };

        await expect(triggerHeal(spell, { targetName: 'Target' }, playerStats, CAMPAIGN, null))
            .rejects.toThrow('heal_at_slot_level expression must be a valid number for heal spell');

        expect(consoleSpy).toHaveBeenCalledWith('[heal] triggerHeal: heal_at_slot_level expression is not a valid number:', 'seventy');
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(reads).toEqual([]);
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('coerces prof||0 and level||1 into the bonus context when playerStats omits them', async () => {
        await triggerHeal(heal5e, { targetName: 'Target' }, { name: 'TestCaster' }, CAMPAIGN, null);

        expect(resolveHealingBonusesWithDetails).toHaveBeenCalledWith(
            { name: 'TestCaster' },
            { prof: 0, level: 1, slotLevel: 6, campaignName: CAMPAIGN },
        );
    });

    it.each([
        // label, spell, stored conditions, creature HP, expectWrite (null = no write), expectLogged, expectApply
        ['A: 5e default hardcoded list — only Blinded stored, only Blinded logged (fix#337S flipped the over-log quirk; Deafened/Poisoned phantom names never land)',
            heal5e, ['Blinded', 'Prone'], [30, 100], ['Prone'], ['Blinded'], 70],
        ['B: 2024 disk status_effects drive the removal list — stored Deafened logged; never-stored Blinded/Poisoned omitted',
            heal2024, ['Deafened', 'Charmed'], [30, 100], ['Charmed'], ['Deafened'], 70],
        ['C: no matching conditions — zero writes, zero condition logs',
            heal5e, ['Prone', 'Restrained'], [30, 100], null, [], 70],
        ['D: target at full HP — no healing applied yet Blinded is still cleared (condition removal is outside the actualHeal>0 gate) and the log names only the real removal',
            heal5e, ['Blinded'], [100, 100], [], ['Blinded'], null],
    ])('condition removal — %s', async (_label, spell, stored, [currentHp, maxHp], expectWrite, expectLogged, expectApply) => {
        combatCtx.creatures = [{ name: 'Target', type: 'npc', currentHp, maxHp }];
        seed('Target', 'activeConditions', stored);

        await triggerHeal(spell, { targetName: 'Target' }, playerStats, CAMPAIGN, null);

        if (expectWrite === null) {
            expect(setRuntimeValue).not.toHaveBeenCalled();
        } else {
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('Target', 'activeConditions', expectWrite, CAMPAIGN);
        }
        expect(logsOfType('condition')).toEqual(expectLogged.map(condition => ({
            type: 'condition',
            action: 'removed',
            characterName: 'Target',
            condition,
            reason: 'Heal',
            timestamp: 0,
        })));
        if (expectApply === null) {
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            // popup and log now agree — both name only ACTUALLY-stored removals (fix#337S)
            expect(popupCall().detail.popupText).toBe('Heal on Target: Already at full HP Also removed: Blinded.');
        } else {
            expect(applyHealingToTarget).toHaveBeenCalledWith(combatCtx, 'Target', expectApply, CAMPAIGN);
        }
    });

    it('anti-phantom pin (fix#337S #1372): stored-only removal logs — Prone-only target produces zero condition logs', async () => {
        combatCtx.creatures = [{ name: 'Target', type: 'npc', currentHp: 30, maxHp: 100 }];
        seed('Target', 'activeConditions', ['Prone']);

        await triggerHeal(heal5e, { targetName: 'Target' }, playerStats, CAMPAIGN, null);

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(logsOfType('condition')).toEqual([]);
    });

    it.each([
        // label, creature, store seeds, expectApply (null = not called), expectTriple
        ['A: player full-deficit — runtime hitPoints 122 beats combatSummary stub maxHp:1, heal 70 lands under cap',
            { name: 'Target', type: 'player', currentHp: 1, maxHp: 1 }, { hitPoints: 122, currentHitPoints: 50 }, 70, { delta: 70, currentHp: 120, maxHp: 122 }],
        ['B: player capped at runtime deficit 79-75',
            { name: 'Target', type: 'player', currentHp: 1, maxHp: 1 }, { hitPoints: 79, currentHitPoints: 75 }, 4, { delta: 4, currentHp: 79, maxHp: 79 }],
        ['C: player zero-deficit — never negative, popup reports full HP, no hp_change log',
            { name: 'Target', type: 'player', currentHp: 1, maxHp: 1 }, { hitPoints: 122, currentHitPoints: 122 }, null, null],
        ['D: currentHitPoints empty string falls back to creature stub (the :69-vs-:65 guard asymmetry)',
            { name: 'Target', type: 'player', currentHp: 1, maxHp: 1 }, { hitPoints: 50, currentHitPoints: '' }, 49, { delta: 49, currentHp: 50, maxHp: 50 }],
        ['E: monster keeps combatSummary HP (runtime hitPoints never read)',
            { name: 'Animated Rug of Smothering 1', type: 'npc', currentHp: 16, maxHp: 27 }, {}, 11, { delta: 11, currentHp: 27, maxHp: 27 }],
    ])('SP-060 HP resolution — %s', async (_label, creature, seeds, expectApply, expectTriple) => {
        combatCtx.creatures = [creature];
        Object.entries(seeds).forEach(([key, value]) => seed(creature.name, key, value));

        const result = await triggerHeal(heal5e, { targetName: creature.name }, playerStats, CAMPAIGN, null);

        if (expectApply === null) {
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(logsOfType('hp_change')).toEqual([]);
            expect(result.healAmount).toBe(0);
            expect(result.rawTotal).toBe(0);
            expect(popupCall().detail.popupText).toBe(`Heal on ${creature.name}: Already at full HP`);
            expect(popupCall().detail.popupText).not.toMatch(/-/);
        } else {
            expect(applyHealingToTarget).toHaveBeenCalledWith(combatCtx, creature.name, expectApply, CAMPAIGN);
            expect(result.healAmount).toBe(expectApply);
            expect(logsOfType('hp_change')[0]).toMatchObject(expectTriple);
        }
        const expectedReads = creature.type === 'player'
            ? ['hitPoints', 'currentHitPoints', 'activeConditions']
            : ['currentHitPoints', 'activeConditions'];
        expect(reads).toEqual(expectedReads);
    });

    it('undead/construct exclusion from the 5e disk description is NOT implemented — undead are healed (reported gap; pinning current behavior)', async () => {
        combatCtx.creatures = [{ name: 'Target', type: 'undead', currentHp: 30, maxHp: 100 }];

        const result = await triggerHeal(heal5e, { targetName: 'Target' }, playerStats, CAMPAIGN, null);

        expect(applyHealingToTarget).toHaveBeenCalledWith(combatCtx, 'Target', 70, CAMPAIGN);
        expect(result.healAmount).toBe(70);
    });
});
