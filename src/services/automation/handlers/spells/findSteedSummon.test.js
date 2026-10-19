// @maintained-by-ai
// CLA-130 defect(b) lane — Find Steed cast must produce a combatant tracker card +
// a `summons` log row + a `Summoned (source)` te — never a silent log-only cast.
// Lane mechanics are owned by summonSpiritHandler.test.js (SP-015/SP-114 AC/HP
// scaling, SP-005 unpaid guard + multi-cast uniqueness, chooser-confirm plumbing,
// CLA-252 phantasmal) — not re-proven here with steed data. This file owns the
// Find Steed DATA bytes routed through that lane:
//   2024 → single-variant Otherworldly Steed, auto-summon: AC 12 + slot, HP 20 +
//          10/lv above 2 (automation.baseLevel/hpPerLevelAbove + block flag).
//   5e   → six-form chooser, statistics of the chosen form verbatim (scale:false).
// Summon seams: real stats pulled from monsters.json via loadMonsters, consumers-
// exact (#755/#844); te written exactly once per spawn with exact payload (#825);
// ONE addExpiration (§38) — its current rounds:10 fallback on an INSTANTaneous
// summon is a flagged source defect, pinned honestly below; concentration policy
// byte: Find Steed is Instantaneous/non-Concentration (#app) — addConcentration
// never fires, te label '1_minute' is a documented display residual; log exact
// bytes, zero noise (#829); refusal guard zero-write (#936).
// old→new map: 2024 routing + block bytes + index cross-check → D1; 5e routing →
// D2; full-cast payload → C1; slot ladder → C2; chooser picker → B1 (grew the
// pre-confirm zero-write falsifier); unpaid-slot guard → S1 (grew to FULL
// zero-write: te/storage/concentration/expiry/te-channel all untouched — the
// byte-identical refusal branch mechanics per se are SP-005-owned in
// summonSpiritHandler.test.js; S1 only adds the Find Steed zero-write falsifier).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells2024 from '../../../../../public/data/2024/spells.json' with { type: 'json' };
import spells5e from '../../../../../public/data/spells.json' with { type: 'json' };
import realMonsters from '../../../../../public/data/monsters.json' with { type: 'json' };

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    __esModule: true,
    default: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../buffs/tempHpService.js', () => ({
    setTempHpOnKey: vi.fn(),
}));

vi.mock('../../../encounters/encounterToInitiative.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getMonsterSaveBonuses: vi.fn(() => ({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 })),
    };
});

import { handle, confirmSummonSpirit } from './summonSpiritHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const CAMPAIGN = 'test-campaign';

const findSteed2024 = spells2024.find(s => s.index === 'find-steed');
const findSteed5e = spells5e.find(s => s.index === 'find-steed');

function paladinStats(overrides = {}) {
    return {
        name: 'ElderPaladin',
        level: 20,
        proficiency: 6,
        abilities: [{ name: 'Charisma', bonus: 4 }],
        spellAbilities: { toHit: 11, saveDc: 19, modifier: 5 },
        ...overrides,
    };
}

function actionFor(spellRow, overrides = {}) {
    return {
        name: 'Find Steed',
        automation: spellRow.automation,
        spell: { ...spellRow },
        ...overrides,
    };
}

describe('CLA-130 Find Steed summon lane (defect b)', () => {
    let store;
    let combatSummary;

    beforeEach(() => {
        vi.clearAllMocks();
        store = { targetEffects: [] };
        getRuntimeValue.mockImplementation((_entity, key) => (key in store ? store[key] : null));
        setRuntimeValue.mockImplementation((_entity, key, value) => { store[key] = value; });
        combatSummary = {
            creatures: [{ name: 'ElderPaladin', initiative: '15', initiativeBonus: 3 }],
        };
        getCombatSummary.mockReturnValue(combatSummary);
        loadMonsters.mockResolvedValue(realMonsters);
    });

    describe('data routing (both rulesets)', () => {
        it('D1: 2024 Find Steed routes single-variant to the real Otherworldly Steed block', () => {
            const auto = findSteed2024.automation;
            expect(auto.type).toBe('summon_spirit');
            expect(auto.typeLabel).toBe('Otherworldly Steed');
            expect(auto.variants).toHaveLength(1);
            // Ladder data consumed by the lane at cast time (AC flag lives on the block).
            expect(auto.baseLevel).toBe(2);
            expect(auto.hpPerLevelAbove).toBe(10);
            expect(auto.noConcentration).toBe(true);
            // RAW duration policy byte: Instantaneous, non-Concentration.
            expect(findSteed2024.duration).toBe('Instantaneous');
            expect(findSteed2024.concentration).toBeFalsy();

            const steed = realMonsters.find(m => m.index === auto.variants[0].monsterIndex);
            expect(steed, 'monsters.json missing otherworldly-steed').toBeTruthy();
            expect(steed.armor_class).toBe(12);
            expect(steed.armor_class_scales_with_slot).toBe(true); // "AC 12 + spell level"
            expect(steed.hit_points).toBe(20);
            expect(steed.ability_scores.int).toBe(6); // intelligent mount
            const hooves = steed.actions.find(a => a.name === 'Hooves');
            expect(hooves.attack_bonus).toBeNull(); // caster spell-attack fold (MA-0286 row)
            expect(hooves.damage_dice_primary).toBe('1d8+4');
        });

        it('D2: 5e Find Steed routes six RAW forms through the chooser, un-scaled, real blocks', () => {
            const auto = findSteed5e.automation;
            expect(auto.type).toBe('summon_spirit');
            expect(auto.scale).toBe(false); // statistics of the chosen form
            expect(auto.noConcentration).toBe(true);
            expect(findSteed5e.duration).toBe('Instantaneous');
            expect(findSteed5e.concentration).toBeFalsy();
            expect(auto.variants.map(v => v.name))
                .toEqual(['Warhorse', 'Riding Horse', 'Mastiff', 'Pony', 'Camel', 'Elk']);
            // Every variant resolves to a REAL monsters.json block — no roster stubs.
            for (const v of auto.variants) {
                expect(realMonsters.find(m => m.index === v.monsterIndex),
                    `monsters.json missing ${v.monsterIndex}`).toBeTruthy();
            }
        });
    });

    describe('cast lane (CLA-130 defect b regression)', () => {
        it('C1: 2024 cast auto-summons the Otherworldly Steed — combatant + te + summons log, never log-only', async () => {
            const action = actionFor(findSteed2024, { metaCtx: { slotLevel: 2, freeCastUsed: true } });

            const result = await handle(action, paladinStats(), CAMPAIGN);

            // Auto-summon: single variant bypasses the chooser and spawns immediately.
            // SP-005 unique-name-first: every summon carries a numeric suffix ('Name 1').
            expect(result).toMatchObject({
                type: 'popup',
                payload: {
                    automationType: 'summon_spirit',
                    description: 'ElderPaladin casts Find Steed, summoning Otherworldly Steed. It acts right after ElderPaladin.',
                },
            });

            const steed = combatSummary.creatures.find(c => c.name === 'Otherworldly Steed 1');
            expect(steed, 'CLA-130(b): summon must spawn a combatant, not just log').toBeTruthy();
            expect(steed.ac).toBe(14);              // block AC 12 + slot 2
            expect(steed.maxHp).toBe(20);           // base 20 + 10×(2−2)
            expect(steed.currentHp).toBe(20);
            expect(steed.initiative).toBe('14.9');  // caster 15 − 0.1…
            expect(combatSummary.creatures.map(c => c.name))
                .toEqual(['ElderPaladin', 'Otherworldly Steed 1']); // …and sorted right after
            expect(steed.summonedBy).toBe('ElderPaladin');
            expect(steed.summonSource).toBe('spell');
            expect(steed.monsterIndex).toBe('otherworldly-steed');
            // Caster-fold lane (§86): null attack_bonus backfills spell attack +11.
            expect(steed.actions.find(a => a.name === 'Hooves').attack_bonus).toBe(11);

            // te written exactly once, exact payload (#825). '1_minute' label is the
            // documented display residual of the shared lane (zero duration consumers).
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
                target: 'Otherworldly Steed 1',
                source: 'ElderPaladin',
                effect: 'summoned',
                summonSource: 'spell',
                duration: '1_minute',
            }], CAMPAIGN);

            // Non-Concentration RAW: addConcentration must never fire (steed survives
            // a Long Rest). ONE expiry clock (§38) — but rounds:10 is a FLAGGED SOURCE
            // DEFECT: 'Instantaneous' has no round duration, the lane's `|| 10`
            // fallback despawns the steed after 10 rounds. Pinned honestly so a fix
            // (or worsening) lands here.
            expect(addConcentration).not.toHaveBeenCalled();
            expect(addExpiration).toHaveBeenCalledTimes(1);
            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'ElderPaladin',
                targetName: 'ElderPaladin',
                effects: [{ type: 'remove_summoned_creatures', spell: 'Find Steed' }],
                campaignName: CAMPAIGN,
                rounds: 10,
            });

            // summons log: exact payload, zero noise (#829).
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry.mock.calls[0][0]).toBe(CAMPAIGN);
            expect(addEntry.mock.calls[0][1]).toEqual({
                type: 'summons',
                characterName: 'ElderPaladin',
                summonName: 'Otherworldly Steed',
                description: 'ElderPaladin casts Find Steed (slot level 2), summoning Otherworldly Steed (20/20 HP).',
                summonedCreatures: ['Otherworldly Steed 1'],
                timestamp: expect.any(Number),
            });
        });

        it('C2: slot ladder pays out — lv5 cast spawns AC 17 / HP 50 with a slot-level 5 log', async () => {
            const action = actionFor(findSteed2024, { metaCtx: { slotLevel: 5, freeCastUsed: true } });

            await handle(action, paladinStats(), CAMPAIGN);

            const steed = combatSummary.creatures.find(c => c.name === 'Otherworldly Steed 1');
            expect(steed.ac).toBe(12 + 5);           // armor_class_scales_with_slot
            expect(steed.maxHp).toBe(20 + 10 * (5 - 2)); // hpPerLevelAbove above baseLevel 2
            expect(addEntry.mock.calls[0][1].description)
                .toBe('ElderPaladin casts Find Steed (slot level 5), summoning Otherworldly Steed (50/50 HP).');
        });

        it('B1: 5e cast opens the chooser — zero writes until confirm spawns the chosen form verbatim', async () => {
            const action = actionFor(findSteed5e, { metaCtx: { slotLevel: 2, freeCastUsed: true } });

            const modal = await handle(action, paladinStats(), CAMPAIGN);
            expect(modal).toMatchObject({
                type: 'modal',
                modalName: 'summonSpirit',
                payload: { campaignName: CAMPAIGN },
            });
            // Multi-variant must NOT auto-summon (zero writes pre-choice, #936).
            expect(combatSummary.creatures).toHaveLength(1);
            expect(addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();

            const result = await confirmSummonSpirit(action, paladinStats(), CAMPAIGN, 'Warhorse');
            expect(result.type).toBe('popup');

            const warhorse = combatSummary.creatures.find(c => c.name === 'Warhorse 1');
            expect(warhorse).toBeTruthy();
            expect(warhorse.ac).toBe(11);    // scale:false — block bytes verbatim
            expect(warhorse.maxHp).toBe(19);
            expect(warhorse.summonedBy).toBe('ElderPaladin');

            expect(store.targetEffects).toEqual([{
                target: 'Warhorse 1',
                source: 'ElderPaladin',
                effect: 'summoned',
                summonSource: 'spell',
                duration: '1_minute',
            }]);
            expect(addConcentration).not.toHaveBeenCalled();

            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry.mock.calls[0][1]).toMatchObject({
                type: 'summons',
                characterName: 'ElderPaladin',
                summonName: 'Otherworldly Steed', // typeLabel rides the lane, not the form
                description: 'ElderPaladin casts Find Steed (slot level 2), summoning Warhorse (19/19 HP).',
                summonedCreatures: ['Warhorse 1'],
            });
        });

        it('S1: unpaid-slot cast refuses with ZERO writes and a summon_refused log (#936 zero-write)', async () => {
            const action = actionFor(findSteed2024, { metaCtx: { slotLevel: 2, slotConsumed: false } });

            const result = await handle(action, paladinStats(), CAMPAIGN);

            expect(result).toMatchObject({
                type: 'popup',
                payload: { description: 'No spell slot available at level 2 — Find Steed summon refused.' },
            });
            expect(combatSummary.creatures).toHaveLength(1); // caster only — zero spawn
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(addConcentration).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry.mock.calls[0][1]).toMatchObject({
                type: 'automation',
                automationType: 'summon_refused',
                characterName: 'ElderPaladin',
            });
        });
    });
});
