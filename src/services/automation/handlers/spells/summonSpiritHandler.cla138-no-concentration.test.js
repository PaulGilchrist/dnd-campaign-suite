// @maintained-by-ai
// CLA-138 FIX-LANE (no-concentration lock) — Fey Reinforcements' arm-time
// "Skip Concentration" choice rides the modified-spell stamp (_noConcentrationChoice)
// set by spellPreparationService (producer lane: spellPreparationService.cla138).
// Fix commit 7f73b4a1b reverted-bug surface in summonSpiritHandler:
//   A) noConcentration ignored the stamp → caster wrongly concentrated on the
//      free cast; killed by NOT-stamped + marker + label pins in test 1.
//   B) the no-Conc branch clocked only Create Thrall → an unstamped-channel
//      no-Conc summon never despawned; killed by the exact addExpiration pin.
//   C) cast label had no free-cast/no-Concentration prose; killed by the
//      full-string log pin.
// Test 2 is the differential CONTROL (unstamped default path): a future
// "always no-Concentration" over-application mutation dies here (control, not
// a CLA-138 kill — main-lane precedent keeps it, SP-092 kept-all house rule).
// Trio split (claimed honestly, siblings read read-only):
//   cla138 (this file)   = _noConcentrationChoice stamp lane ONLY.
//   mao-huge-slam #1977  = MA-0284/0285 byte-clean data locks + resolveMonsterActions fold consumers (zero concentration content).
//   main #1978           = orchestration: handle/modal, SP-015/114 AC-HP ladder, CLA-066 Create Thrall rider, CLA-252 phantasmal, SP-005 refusal/uniqueness, Fey chooser concentration default.
// findSteedSummon consumer lane (CLA-130, 8/8) already closed on this handler — distinct fix, not re-absorbed here.
// Marker target pins the SP-005 numbered displayName: getNextUniqueMonsterName
// always suffixes the sequence ("… 1" while combatSummary holds only the caster);
// the cast label carries the raw variant.name.
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const CAMPAIGN = 'test-campaign';
const CASTER = 'FeyRanger';
const VARIANT = 'Fey Spirit (Trickster)';

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

describe('CLA-138 summonSpirit honors runtime no-Concentration choice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.dispatchEvent = vi.fn();
        const store = { targetEffects: [] };
        getRuntimeValue.mockImplementation((entity, key) => (key in store && entity === 'campaign' ? store[key] : null));
        setRuntimeValue.mockImplementation((entity, key, value) => { store[key] = value; });
        getCombatSummary.mockReturnValue({
            creatures: [{ name: CASTER, initiative: '15', initiativeBonus: 3, concentration: null }],
        });
        loadMonsters.mockResolvedValue([feySpiritTrickster]);
    });

    it('_noConcentrationChoice: NO caster concentration, rounds:10 expiry clock, free-cast + 1-minute log', async () => {
        // Spell shape mirrors the spellPreparationService CLA-138 stamp exactly.
        const action = summonFeyAction(
            { concentration: false, duration: '1 minute', _noConcentrationChoice: true },
            { freeCastUsed: true }
        );

        const result = await confirmSummonSpirit(action, rangerStats(), CAMPAIGN, VARIANT);

        expect(result.type).toBe('popup');
        expect(result.payload.automationType).toBe('summon_spirit');

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
            rounds: 10,
        });

        // Exact-key pin: one targetEffects write carrying the 1_minute marker.
        const teWrites = setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teWrites).toHaveLength(1);
        expect(teWrites[0][2]).toEqual([{
            target: `${VARIANT} 1`, source: CASTER, effect: 'summoned', summonSource: 'spell', duration: '1_minute',
        }]);

        // Bug C kill: full-string own-composition label (payment truth + clock truth).
        const summonLogs = summonLogCalls();
        expect(summonLogs).toHaveLength(1);
        expect(summonLogs[0][1].description).toBe(
            `${CASTER} casts Summon Fey (free cast — no spell slot consumed), summoning ${VARIANT} (30/30 HP) — does not require Concentration (duration 1 minute).`
        );
        expect(summonLogs[0][1].description).not.toContain('slot level');
        // Popup echo carries the SAME cast label (runtime + log parity).
        expect(result.logEntries[0].description).toBe(summonLogs[0][1].description);

        // No-side-effect guard: CLA-138 free cast is not the CLA-066 thrall lane —
        // no create_thrall_applied prose, no thrall temp HP writes.
        expect(addEntry.mock.calls.some(c => c[1].automationType === 'create_thrall_applied')).toBe(false);
    });

    it('_noConcentrationChoice with a finite disk duration: clock scales from the stamped duration, never a fabricated default (#351(b) arm)', async () => {
        // fix#351(b) counter-arm: with the `|| 10` fallback deleted, FINITE
        // durations must still clock exactly — CLA-334 recipe minutes×10 /
        // hours×600. An unparseable-or-instantaneous spell must produce NO
        // clock (loud refuse), while this 10-minute stamped shape produces 100.
        const action = summonFeyAction(
            { concentration: false, duration: 'Up to 10 minutes', _noConcentrationChoice: true },
            { freeCastUsed: true }
        );

        const result = await confirmSummonSpirit(action, rangerStats(), CAMPAIGN, VARIANT);

        expect(result.type).toBe('popup');
        expect(addConcentration).not.toHaveBeenCalled();
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: CASTER,
            targetName: CASTER,
            effects: despawnEffects,
            campaignName: CAMPAIGN,
            rounds: 100, // 'Up to 10 minutes' → 10 × 10 (CLA-334), NOT the dead ||10
        });
    });

    it('_noConcentrationChoice with an instantaneous stamped duration: ZERO clock, summon stays clock-free (#351(b) guard)', async () => {
        // The guard-leg: even a stamped-choice cast whose duration text reads
        // 'Instantaneous' must NOT inherit a fabricated clock — same RAW law
        // that keeps Find Steed despawn-free.
        const action = summonFeyAction(
            { concentration: false, duration: 'Instantaneous', _noConcentrationChoice: true },
            { freeCastUsed: true }
        );

        const result = await confirmSummonSpirit(action, rangerStats(), CAMPAIGN, VARIANT);

        expect(result.type).toBe('popup');
        expect(addConcentration).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('default (no stamp): concentration stamped, spell-duration expiry clock, slot log', async () => {
        // Differential CONTROL (passes pre-fix too, by design): keeps the
        // unstamped lane byte-identical and kills "always no-Concentration"
        // over-application of the CLA-138 fix.
        const action = summonFeyAction({}, { slotConsumed: true });

        await confirmSummonSpirit(action, rangerStats(), CAMPAIGN, VARIANT);

        expect(addConcentration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: CASTER,
            targetName: CASTER,
            effects: despawnEffects,
            campaignName: CAMPAIGN,
            rounds: 600,
        });

        const summonLogs = summonLogCalls();
        expect(summonLogs).toHaveLength(1);
        expect(summonLogs[0][1].description).toBe(
            `${CASTER} casts Summon Fey (slot level 4), summoning ${VARIANT} (30/30 HP).`
        );
        expect(summonLogs[0][1].description).not.toContain('free cast');
        expect(summonLogs[0][1].description).not.toContain('does not require Concentration');

        const teWrites = setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teWrites[0][2][0].duration).toBe('concentration');
    });
});
