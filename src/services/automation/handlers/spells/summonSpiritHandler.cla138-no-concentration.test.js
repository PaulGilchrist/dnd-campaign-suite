// @maintained-by-ai 2026-11-27
// CLA-138 FIX-LANE (#1976-IMPROVE-AND-TRIM 2026-11-27) — Fey Reinforcements'
// arm-time "Skip Concentration" choice rides the modified-spell stamp
// (_noConcentrationChoice) produced by spellPreparationService.cla138. This
// file owns the STAMP lane ONLY: the stamped cast's zero-concentration write,
// the no-Conc expiry-clock legs (finite scales minutes×10, 'Instantaneous'
// = ZERO clock, unparseable = LOUD :377 console.error refusal, no fabricated
// default — fix#351(b) deleted the `|| 10`), and the free-cast log-label
// face. Fix commit 7f73b4a1b reverted-bug surface:
//   A) noConcentration ignored the stamp → caster wrongly concentrated on the
//      free cast; killed by NOT-stamped + marker + label pins in test 1.
//   B) the no-Conc branch clocked only Create Thrall → an unstamped-channel
//      no-Conc summon never despawned; killed by the exact addExpiration pin.
//   C) cast label had no free-cast/no-Concentration prose; killed by the
//      full-string log pin.
// The last test is the differential CONTROL (unstamped default path): a
// future "always no-Concentration" over-application mutation dies here
// (control, not a CLA-138 kill — SP-092 kept-all house rule).
// TIMESTAMP CENSUS (#1930-verified outlets): the addEntry('summons') leg and
// the returned result.logEntries BOTH stamp Date.now() — pinned full-shape
// under a frozen NOW with runtime/log byte-parity. The popup payload carries
// NO timestamp — pinned by exact toEqual without one.
// DURATION POLICY: minutes×10/hours×600 (CLA-334 recipe) pinned as HONEST
// source bytes per OWNER-PENDING #1822 (>=1min durations are combat-scoped
// canon; precedent grease #1902 / sleet #1903), not as endorsed policy. The
// marker/label '1_minute' literals are the CLA-138 producer contract (the
// stamp implies 1 minute); the synthetic off-contract durations below pin
// current bytes around that literal.
// Trio split (siblings read read-only):
//   cla138 (this file) = _noConcentrationChoice stamp lane ONLY, including
//     the loud :377 unparseable-duration no-clock refusal. The SILENT
//     :355 rounds:undefined concentration-path asymmetry stays pinned NOT by
//     main's policy — not restamped here.
//   mao #1977 = MA-0284/0285 byte-clean data locks + resolveMonsterActions
//     fold consumers (zero concentration content).
//   main #1978 = orchestration: handle/modal, SP-015/114 AC-HP ladder,
//     CLA-066 Create Thrall rider, CLA-252 phantasmal, SP-005 refusal/
//     uniqueness. Per #1930's cross-file note, the SP-120 Fey chooser
//     concentration default is folded into main's census tests (still
//     covered there — this header's wording updated per that note).
// findSteedSummon consumer lane (CLA-130, 8/8) already closed on this
// handler — distinct fix, not re-absorbed here.
// Marker pins the SP-005 numbered displayName: getNextUniqueMonsterName
// always suffixes the sequence ("… 1" while combatSummary holds only the
// caster); the cast label carries the raw variant.name.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { confirmSummonSpirit } from './summonSpiritHandler.js';

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
    default: { get: vi.fn(), set: vi.fn().mockResolvedValue({}) },
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

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { setTempHpOnKey } from '../buffs/tempHpService.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'FeyRanger';
const VARIANT = 'Fey Spirit (Trickster)';
const DISPLAY = `${VARIANT} 1`; // SP-005 numbered displayName
const NOW = 1_735_000_000_000; // frozen sentinel: stamps ALL Date.now() outlets

const feySpiritTrickster = {
    index: 'fey-spirit-trickster', name: VARIANT, type: 'fey',
    armor_class: 12, hit_points: 30, damage_resistances: [], damage_immunities: [], immunities: [],
    saving_throws: {}, actions: [], reactions: [],
};

function rangerStats() {
    return {
        name: CASTER,
        level: 17,
        proficiency: 6,
        abilities: [{ name: 'Wisdom', bonus: 4 }, { name: 'Charisma', bonus: 0 }],
        spellAbilities: { toHit: 13, saveDc: 17, modifier: 4 },
    };
}

function summonFeyAction(spellOverrides = {}, metaCtx = {}) {
    return {
        name: 'Summon Fey',
        automation: {
            type: 'summon_spirit',
            typeLabel: 'Fey Spirit',
            baseLevel: 4,
            hpPerLevelAbove: 10,
            variants: [{ name: VARIANT, monsterIndex: 'fey-spirit-trickster' }],
        },
        spell: {
            level: 4,
            concentration: true,
            duration: 'Concentration, up to 1 hour',
            ...spellOverrides,
        },
        metaCtx,
    };
}

const despawnEffects = [{ type: 'remove_summoned_creatures', spell: 'Summon Fey' }];

function summonLogCalls() {
    return addEntry.mock.calls.filter(c => c[1].type === 'summons');
}

// CLA-138 label face (buildSummonCastLabel): free-cast pay truth + no-Conc
// prose with the producer-contract '1 minute' literal.
const CLA138_LABEL = `${CASTER} casts Summon Fey (free cast — no spell slot consumed), summoning ${VARIANT} (30/30 HP) — does not require Concentration (duration 1 minute).`;

function teWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects');
}

describe('CLA-138 summonSpirit honors runtime no-Concentration choice', () => {
    let combatFixture;
    let dateSpy;
    let consoleSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        dateSpy = vi.spyOn(Date, 'now').mockReturnValue(NOW);
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        window.dispatchEvent = vi.fn();
        const store = { targetEffects: [] };
        getRuntimeValue.mockImplementation((entity, key) => (key in store && entity === 'campaign' ? store[key] : null));
        setRuntimeValue.mockImplementation((entity, key, value) => { store[key] = value; });
        combatFixture = {
            creatures: [{ name: CASTER, initiative: '15', initiativeBonus: 3, concentration: null }],
        };
        getCombatSummary.mockReturnValue(combatFixture);
        loadMonsters.mockResolvedValue([feySpiritTrickster]);
    });

    afterEach(() => {
        dateSpy.mockRestore();
        consoleSpy.mockRestore();
    });

    it('_noConcentrationChoice: NO caster concentration, one rounds:10 clock, full-shape popup + runtime/log-parity free-cast log', async () => {
        // Spell shape mirrors the spellPreparationService CLA-138 stamp exactly.
        const action = summonFeyAction(
            { concentration: false, duration: '1 minute', _noConcentrationChoice: true },
            { freeCastUsed: true }
        );

        const result = await confirmSummonSpirit(action, rangerStats(), CAMPAIGN, VARIANT);

        // Full-shape popup (no timestamp — popup outlets carry none).
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Summon Fey',
                automationType: 'summon_spirit',
                description: `${CASTER} casts Summon Fey, summoning ${VARIANT}. It acts right after ${CASTER}.`,
                automation: action.automation,
            },
            logEntries: [{
                type: 'summons',
                characterName: CASTER,
                summonName: 'Fey Spirit',
                description: CLA138_LABEL,
                summonedCreatures: [DISPLAY],
                timestamp: NOW,
            }],
        });

        // Bug A kill: the stamp alone must drop the caster concentration write.
        expect(addConcentration).not.toHaveBeenCalled();

        // Bug B kill: ONE hard expiry clock with the full CLA-138 payload
        // (§38 one-clock rule; pre-fix, only createThrall got a clock here).
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: CASTER,
            targetName: CASTER,
            effects: despawnEffects,
            campaignName: CAMPAIGN,
            rounds: 10, // '1 minute' → 1 × 10 (CLA-334; #1822 honest bytes)
        });

        // Exact-key pin: one targetEffects write carrying the 1_minute marker.
        expect(teWrites()).toHaveLength(1);
        expect(teWrites()[0][2]).toEqual([
            { target: DISPLAY, source: CASTER, effect: 'summoned', summonSource: 'spell', duration: '1_minute' },
        ]);

        // Bug C kill: full-shape own-composition log entry under the frozen
        // NOW (payment truth + clock truth + SP-005 numbered summon name).
        const summonLogs = summonLogCalls();
        expect(summonLogs).toHaveLength(1);
        expect(summonLogs[0][1]).toEqual({
            type: 'summons',
            characterName: CASTER,
            summonName: 'Fey Spirit',
            description: CLA138_LABEL,
            summonedCreatures: [DISPLAY],
            timestamp: NOW,
        });

        // No-side-effect guard: CLA-138 free cast is not the CLA-066 thrall lane —
        // no create_thrall_applied prose, no thrall temp HP writes.
        expect(addEntry.mock.calls.some(c => c[1].automationType === 'create_thrall_applied')).toBe(false);
        expect(setTempHpOnKey).not.toHaveBeenCalled();
    });

    it('_noConcentrationChoice with a finite stamped duration: clock scales from the duration (minutes×10), never a fabricated default (#351(b) arm)', async () => {
        // fix#351(b) counter-arm: with the `|| 10` fallback deleted, FINITE
        // durations must still clock exactly — CLA-334 recipe minutes×10.
        // An unparseable-or-instantaneous spell must produce NO clock, while
        // this 10-minute stamped shape produces 100 (#1822 honest bytes).
        const action = summonFeyAction(
            { concentration: false, duration: 'Up to 10 minutes', _noConcentrationChoice: true },
            { freeCastUsed: true }
        );

        await confirmSummonSpirit(action, rangerStats(), CAMPAIGN, VARIANT);

        expect(addConcentration).not.toHaveBeenCalled();
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: CASTER,
            targetName: CASTER,
            effects: despawnEffects,
            campaignName: CAMPAIGN,
            rounds: 100, // 'Up to 10 minutes' → 10 × 10, NOT the dead ||10
        });
        // Contradicted-bytes pin: the marker literal stays '1_minute' (CLA-138
        // producer contract) even while the clock reads 10 minutes — the clock
        // and the marker are independent writes; neither borrows the other.
        expect(teWrites()).toHaveLength(1);
        expect(teWrites()[0][2]).toEqual([
            { target: DISPLAY, source: CASTER, effect: 'summoned', summonSource: 'spell', duration: '1_minute' },
        ]);
    });

    it('_noConcentrationChoice with an instantaneous stamped duration: ZERO clock, board still commits (#351(b) guard)', async () => {
        // The guard-leg: even a stamped-choice cast whose duration text reads
        // 'Instantaneous' must NOT inherit a fabricated clock — same RAW law
        // that keeps Find Steed despawn-free — yet the summon itself still
        // lands (popup, marker).
        const action = summonFeyAction(
            { concentration: false, duration: 'Instantaneous', _noConcentrationChoice: true },
            { freeCastUsed: true }
        );

        const result = await confirmSummonSpirit(action, rangerStats(), CAMPAIGN, VARIANT);

        expect(result.type).toBe('popup');
        expect(addConcentration).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(teWrites()).toHaveLength(1);
        expect(teWrites()[0][2]).toEqual([
            { target: DISPLAY, source: CASTER, effect: 'summoned', summonSource: 'spell', duration: '1_minute' },
        ]);
    });

    it('_noConcentrationChoice with an unparseable stamped duration: LOUD :377 refusal, no clock, no fabricated default (fix#351(b))', async () => {
        // The loud seam: an unparseable, NON-instantaneous duration on the
        // no-Conc lane must console.error the exact verdict and clock NOTHING
        // (the deleted `|| 10` must not resurrect) while the summon itself
        // still commits. The SILENT :355 concentration-path counterpart stays
        // unpinned by main's policy — this is a different seam.
        const action = summonFeyAction(
            { concentration: false, duration: 'Until dispelled', _noConcentrationChoice: true },
            { freeCastUsed: true }
        );

        const result = await confirmSummonSpirit(action, rangerStats(), CAMPAIGN, VARIANT);

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith(
            '[summonSpiritHandler] Unparseable no-Concentration summon duration "Until dispelled" for Summon Fey — expiry clock refused, no fabricated default'
        );
        expect(result.type).toBe('popup');
        expect(addConcentration).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(teWrites()).toHaveLength(1);
    });

    it('default (no stamp): concentration written, hours×600 expiry clock, slot log', async () => {
        // Differential CONTROL (passes pre-fix too, by design): keeps the
        // unstamped lane byte-identical and kills "always no-Concentration"
        // over-application of the CLA-138 fix.
        const action = summonFeyAction({}, { slotConsumed: true });

        await confirmSummonSpirit(action, rangerStats(), CAMPAIGN, VARIANT);

        // Exact args incl. combatSummary REFERENCE IDENTITY (arg swaps die).
        expect(addConcentration).toHaveBeenCalledTimes(1);
        expect(addConcentration).toHaveBeenCalledWith(combatFixture, CASTER, 'Summon Fey', 17);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: CASTER,
            targetName: CASTER,
            effects: despawnEffects,
            campaignName: CAMPAIGN,
            rounds: 600, // 'Concentration, up to 1 hour' → 1 × 600 (#1822 honest bytes)
        });

        const summonLogs = summonLogCalls();
        expect(summonLogs).toHaveLength(1);
        expect(summonLogs[0][1]).toEqual({
            type: 'summons',
            characterName: CASTER,
            summonName: 'Fey Spirit',
            description: `${CASTER} casts Summon Fey (slot level 4), summoning ${VARIANT} (30/30 HP).`,
            summonedCreatures: [DISPLAY],
            timestamp: NOW,
        });

        expect(teWrites()).toHaveLength(1);
        expect(teWrites()[0][2]).toEqual([
            { target: DISPLAY, source: CASTER, effect: 'summoned', summonSource: 'spell', duration: 'concentration' },
        ]);
    });
});
