// @maintained-by-ai
// SP-128 cast lane: expeditiousRetreatService.triggerExpeditiousRetreat body.
// Owns "cast stamp + grant flag" (delegated VERBATIM by dashHandler.test.js:5-6
// "cast stamp + grant flag → rules/features/expeditiousRetreatService.test.js"
// and turnStartEffects.expeditious-retreat-dash-offer.test.js:12-13, and named
// "cast lane expeditiousRetreatService" by concentrationService.sp128-er-purge.test.js:15).
// Pinned here, byte-exact: name gate (early-return BEFORE any lookup), concentration
// stamp + DC formula, persisted grant flag write (literal 'expeditiousRetreatActive' —
// consumers inline-duplicate this string: turnStartEffects.js:607, dashHandler.js:21,
// concentrationService.js:168, CharBonusActions.jsx:731; the exported ER_* constants
// have NO repo importer, so tests pin literals, not exports, as the wire contract),
// turnStartEffects offer append (dedupe + non-array sanitize), spell log, popup envelope.
// Writes are 4-arg cast-origin POSTs (no skipSync — by design, service.js:33-36: no te
// marker; the persisted flag is authoritative). Disk canon: spells.json + 2024/spells.json
// both "Expeditious Retreat", level 1, concentration, up to 10 min → combat-scoped flag,
// NO wall-clock duration stored by this service (#no-timers). Outside-combat cast still
// stamps the grant (#cs-null leg). Dash execution → dashHandler lane; re-offer seam →
// turnStartEffects offer lane; purge → sp128-er-purge lane.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    triggerExpeditiousRetreat,
    ER_ACTIVE_FLAG,
    ER_DASH_USED_ROUND_KEY,
    ER_TURN_START_OFFER_TYPE,
} from './expeditiousRetreatService.js';

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { getCombatSummary } from '../../encounters/combatData.js';
import { addConcentration } from '../../combat/concentration/concentrationService.js';
import { addEntry } from '../../ui/logService.js';
import storage from '../../ui/storage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'TestCampaign';
const MAP = 'testMap';
const CASTER = 'Wizard';
const SPELL_ARGS = { name: 'Expeditious Retreat', level: 1 };

function cast(stats = { name: CASTER, proficiency: 2, abilities: { CON: { bonus: 0 } } }) {
    return triggerExpeditiousRetreat(SPELL_ARGS, {}, stats, CAMPAIGN, MAP);
}

describe('expeditiousRetreatService.triggerExpeditiousRetreat', () => {
    let cs;
    let dispatchSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        // explicit re-seed (clearAllMocks preserves implementations from prior tests)
        cs = { creatures: [{ name: CASTER }] };
        getCombatSummary.mockReturnValue(cs);
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockResolvedValue(undefined);
        addEntry.mockResolvedValue({});
        dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    });

    afterEach(() => {
        dispatchSpy.mockRestore();
    });

    it('casts in-combat: stamps concentration, grant flag, offer, log, popup — exact bytes', async () => {
        const result = await triggerExpeditiousRetreat(
            { name: 'ExpEdItIoUs ReTrEaT' }, {}, { name: CASTER, proficiency: 2, abilities: { CON: { bonus: 0 } } }, CAMPAIGN, MAP,
        );

        // exported constants are the same bytes consumers inline-duplicate
        expect(ER_ACTIVE_FLAG).toBe('expeditiousRetreatActive');
        expect(ER_DASH_USED_ROUND_KEY).toBe('_Expeditious_Retreat_dash_usedRound');
        expect(ER_TURN_START_OFFER_TYPE).toBe('expeditious_retreat_dash_offer');

        expect(addConcentration).toHaveBeenCalledWith(cs, CASTER, 'Expeditious Retreat', 10);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN);
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        expect(dispatchSpy.mock.calls[0][0]).toEqual(expect.objectContaining({ type: 'combat-summary-updated' }));

        // ordered, exact grant writes: flag true FIRST, then offer append onto empty store;
        // 4-arg cast-origin writes (no skipSync) — asserted by exact-arity toEqual above
        expect(setRuntimeValue.mock.calls).toEqual([
            [CASTER, 'expeditiousRetreatActive', true, CAMPAIGN],
            [CASTER, 'turnStartEffects', [{ type: 'expeditious_retreat_dash_offer' }], CAMPAIGN],
        ]);

        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'spell',
            characterName: CASTER,
            targetName: CASTER,
            spellName: 'Expeditious Retreat',
            spellLevel: 1,
            description: 'Wizard casts Expeditious Retreat on themself. They can take the Dash action as a bonus action on each of their turns until concentration breaks.',
            timestamp: expect.any(Number),
        });

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Expeditious Retreat',
                automationType: 'expeditious_retreat',
                description: '<b>Expeditious Retreat</b><br/>Wizard has <b>Concentration</b> — can take the Dash action as a bonus action on each of their turns. A <b>Dash (Expeditious Retreat)</b> row is now offered in your Bonus Actions on every turn until the spell ends.',
            },
        });
    });

    describe('name gate (zero side effects, early-return before lookups)', () => {
        it.each([
            [{ name: 'Blur' }, 'real disk near name (spells.json)'],
            [{ name: 'expeditious retreats' }, 'plural near-miss'],
            [{ name: 'not expeditious retreat' }, 'superstring'],
            [{}, 'no name property'],
        ])('returns null and touches nothing for %s (%s)', async (spell) => {
            const result = await triggerExpeditiousRetreat(spell, {}, { name: CASTER, proficiency: 2, abilities: { CON: { bonus: 0 } } }, CAMPAIGN, MAP);

            expect(result).toBeNull();
            expect(getCombatSummary).not.toHaveBeenCalled();
            expect(addConcentration).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(dispatchSpy).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('concentration DC formula: 8 + (proficiency || 2) + (abilities?.CON?.bonus ?? 0)', () => {
        it.each([
            ['prof+CON both flow', { proficiency: 2, abilities: { CON: { bonus: 3 } } }, 13],
            ['prof 0 falsy → || defaults to 2 (quirk: silent)', { proficiency: 0, abilities: { CON: { bonus: 0 } } }, 10],
            ['abilities missing → ?. short-circuits, ?? defaults CON 0', { abilities: undefined }, 10],
        ])('%s → DC %i', async (_label, statsPatch, expectedDc) => {
            await cast({ name: CASTER, ...statsPatch });

            expect(addConcentration).toHaveBeenCalledWith(cs, CASTER, 'Expeditious Retreat', expectedDc);
        });
    });

    it('outside combat (no combatSummary): skips concentration lane but STILL stamps grant + logs + returns popup', async () => {
        getCombatSummary.mockReturnValue(null);

        const result = await cast();

        expect(addConcentration).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(dispatchSpy).not.toHaveBeenCalled();
        // the grant stamp does NOT depend on combat state
        expect(setRuntimeValue.mock.calls).toEqual([
            [CASTER, 'expeditiousRetreatActive', true, CAMPAIGN],
            [CASTER, 'turnStartEffects', [{ type: 'expeditious_retreat_dash_offer' }], CAMPAIGN],
        ]);
        expect(addEntry).toHaveBeenCalled();
        expect(result).not.toBeNull();
        expect(result.type).toBe('popup');
    });

    it('offer append: dedupes existing offer entry (tolerating null/junk entries); sanitizes non-array stored value', async () => {
        getRuntimeValue.mockImplementation((_n, key) =>
            key === 'turnStartEffects'
                ? [{ type: 'steady_aim_clear' }, null, { type: 'expeditious_retreat_dash_offer' }]
                : null,
        );

        await cast();

        // no second offer write; flag stamp still the only write
        expect(setRuntimeValue.mock.calls).toEqual([
            [CASTER, 'expeditiousRetreatActive', true, CAMPAIGN],
        ]);

        // non-array garbage stored value → replaced with a fresh one-offer array
        setRuntimeValue.mockClear();
        getRuntimeValue.mockReturnValue('oops');

        await cast();

        expect(setRuntimeValue.mock.calls).toEqual([
            [CASTER, 'expeditiousRetreatActive', true, CAMPAIGN],
            [CASTER, 'turnStartEffects', [{ type: 'expeditious_retreat_dash_offer' }], CAMPAIGN],
        ]);
    });

    it('log rejection is swallowed with exact console.error prefix; cast still completes', async () => {
        const consoleErrSpy = vi.spyOn(console, 'error');
        addEntry.mockRejectedValue(new Error('DB error'));

        const result = await cast();

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(consoleErrSpy).toHaveBeenCalledWith('[expeditiousRetreat] Error logging:', new Error('DB error'));
        consoleErrSpy.mockRestore();
    });
});
