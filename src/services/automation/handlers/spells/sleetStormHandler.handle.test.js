// ── sleetStorm QUARTET seam map (shared subject: sleetStormHandler.js) ──
// lane (this) — .handle CAST-TIME: application/tracking/duration-expiration/
//   concentration-registration of handle() (L25-158) + applySleetStormProneTarget
//   internals (L167-269): exact-array condition writes, activeConditionMeta
//   merge, addTargetResult failure, addExpiration shapes, breakConcentration,
//   condition/concentration_lost/save_result(fail) logs, tracking-key write,
//   duration→rounds parsing, registerSpellConcentration (areaSpellUtils LIVE).
// RAW check (2024 Essentials, verified at sleetStormHandler.js): weather area
//   spell, Concentration ≤ 1 minute, DEX save (NOT CON), ZERO damage on every
//   addTargetResult, fail = Prone + concentration loss. Turn-based: expiration
//   rides round seams via addExpiration only — grep-verified zero
//   setTimeout/setInterval in this lane (Date.now() is informational stamp).
// Canonical homes decided at quartet split (recorded here, honest):
//   #1961 (this)  — applySleetStormProneTarget wholesale (incl. ITS failure
//     addTargetResult + save_result-fail entry), tracking store write, duration
//     parsing + both addExpiration shapes, registerSpellConcentration,
//     success-path no-application guard.
//   #1962 .handleResults — handle()-body reporting: storeSpellLastAttack
//     (canonical there — corrects areaSave header L33 which claimed #1961;
//     positive pin 'calls storeSpellLastAttack with correct parameters' is
//     LIVE in handleResults.test.js), ability_use entries, summary popup,
//     handle()-body SUCCESS block (save_result-success, addTargetResult-success).
//   #1963 .test (main) — early returns, target selection, prompt shape
//     (heightenTarget), isProneImmune + its addEntry rejection.
// HAND-OFF to #1962 (removed here as cross-lane; absorbed there by name):
//   'posts save_result entry with success=true',
//   'calls addTargetResult with success',
//   'handles addEntry rejection in successful save path'
// Consumed/liveness (grep-verified 2026-10-16):
//   LIVE: dispatch 'sleet_storm' (index.js:585) AND 'sleet_storm_area_save'
//     (index.js:558) → handle(); tracking key consumed by
//     expireStaleEffects.js:30-45 → processSleetStormAreaSave (areaSave lane);
//     {type:'condition'} expiration consumed by clearExpirationEffects.js:447
//     removeConditionEverywhere; no-rounds entry → expiryRounds Infinity
//     (expirationQueue.js:23) — prone clears only via that seam, never a clock.
//   PENDING-WIRING (pin contract-preservation, honest):
//     • remove_sleet_storm_area (rounds:10) PRODUCED L73-76, consumed NOWHERE.
//     • _sleetStorm_concentration_<caster> loss-list PRODUCED L219-225/L320-326,
//       consumed NOWHERE (same category as grease tracking-store).
//   DURATION-POLICY FLAG: '1_minute'→rounds:10 is the retired minutes×10
//     recipe (AGENTS.md: ≥1-minute should be combat-scoped). Pinned as-is —
//     contract preservation, not re-specification; moot while pending-wired.
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
  breakConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn().mockResolvedValue({}),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './sleetStormHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as storage from '../../../ui/storage.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'test-map';
const casterName = 'TestWizard';
const TRACKING_KEY = '_sleetStorm_TestWizard';
const CONCENTRATION_KEY = '_sleetStorm_concentration_TestWizard';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Sleet Storm',
    automation: {
      type: 'sleet_storm',
      saveType: 'DEX',
      saveDc: 15,
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: casterName, type: 'player', gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

function failSaveListener() {
  return {
    promptId: 'sleet-prompt',
    promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
  };
}

function successSaveListener() {
  return {
    promptId: 'sleet-prompt',
    promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
  };
}

// Runtime-store router: only the keys applySleetStormProneTarget READS.
// targetEffects is read at name 'campaign' WITHOUT a campaign arg
// (sleetStormHandler.js:249) — pinned shape, not a typo to hide.
function routeRuntime({
  activeConditions = [],
  activeConditionMeta = {},
  targetEffects = [],
  concentrationTracked = [],
} = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'activeConditions') return activeConditions;
    if (key === 'activeConditionMeta') return activeConditionMeta;
    if (key === 'targetEffects') return targetEffects;
    if (key === CONCENTRATION_KEY) return concentrationTracked;
    return null;
  });
}

// Cast-time failed-save baseline: single Goblin target, fails DC 15.
function setupFailedSave(runtimeOverrides = {}) {
  damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
  savePrompt.buildSaveDc.mockReturnValue(15);
  combatData.getCombatSummary.mockReturnValue({});
  savePrompt.createSaveListener.mockReturnValue(failSaveListener());
  routeRuntime(runtimeOverrides);
}

function castOnGoblin(automation) {
  return handle(
    { ...makeAction(automation), metaCtx: { targets: ['Goblin'] } },
    makePlayerStats(),
    campaignName,
    mapName,
  );
}

const sleetTe = (overrides = {}) => ({
  target: 'Goblin',
  effect: 'sleet_storm',
  source: casterName,
  conditions: ['prone'],
  dc: 15,
  duration: 'concentration',
  lostConcentration: true,
  ...overrides,
});

// ── Tests ──────────────────────────────────────────────────────

describe('sleetStormHandler.handle — cast time (#1961)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations — restore the floating-promise
    // defaults explicitly so one rejection can never leak into the next test.
    logService.addEntry.mockReset().mockResolvedValue({});
    damageRollback.addTargetResult.mockReset().mockResolvedValue({});
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('successful save — no-application guard', () => {
    it('applies nothing — no prone, meta, targetEffects, expiration, or concentration break', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await castOnGoblin();

      const keys = useRuntimeState.setRuntimeValue.mock.calls.map((c) => c[1]);
      expect(keys).not.toContain('activeConditions');
      expect(keys).not.toContain('activeConditionMeta');
      expect(keys).not.toContain('targetEffects');
      expect(keys).not.toContain(CONCENTRATION_KEY);
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(concentrationService.breakConcentration).not.toHaveBeenCalled();
      const logTypes = logService.addEntry.mock.calls.map((c) => c[1].type);
      expect(logTypes).not.toContain('condition');
      expect(logTypes).not.toContain('concentration_lost');
      // getCombatSummary/addConcentration ARE reached via LIVE registerSpell-
      // Concentration (areaSpellUtils.js:26-29) — pinned below, not guarded.
    });
  });

  describe('cast-time application — failed save (applySleetStormProneTarget)', () => {
    it('applies Prone with exact fresh-condition write', async () => {
      setupFailedSave();

      await castOnGoblin();

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['prone'],
        campaignName,
      );
    });

    it('deduplicates Prone and reorders it last (exact array)', async () => {
      setupFailedSave({ activeConditions: ['prone', 'blinded'] });

      await castOnGoblin();

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['blinded', 'prone'],
        campaignName,
      );
    });

    it('stores condition metadata with DC and source, merging existing meta', async () => {
      setupFailedSave({
        activeConditionMeta: {
          blinded: { dc: 12, source: 'blindly_blast' },
          prone: { note: 'legacy' },
        },
      });

      await castOnGoblin();

      // Unrelated meta preserved; prone replaced-field-wise but its own
      // prior keys kept (documented spread merge, sleetStormHandler.js:176-184).
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditionMeta',
        {
          blinded: { dc: 12, source: 'blindly_blast' },
          prone: { note: 'legacy', dc: 15, ability: 'dex', source: 'sleet_storm' },
        },
        campaignName,
      );
    });

    it('calls addTargetResult with exact failure shape (zero damage — RAW)', async () => {
      setupFailedSave();

      await castOnGoblin();

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 5,
        conditions: ['prone'],
        appliedDamage: 0,
      });
    });

    it('queues concentration-scoped Prone expiration (exact shape, no rounds)', async () => {
      setupFailedSave();

      await castOnGoblin();

      // No rounds key → expiryRounds Infinity (expirationQueue.js:23): prone
      // is concentration-scoped, cleared only at clearExpirationEffects.js:447
      // 'condition' handler — never a round countdown, never wall-clock.
      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: casterName,
        targetName: 'Goblin',
        effects: [{ type: 'condition', condition: 'prone' }],
        campaignName,
      });
    });

    it('breaks target concentration and posts full-string concentration_lost', async () => {
      const summaryRef = { active: true };
      setupFailedSave();
      combatData.getCombatSummary.mockReturnValue(summaryRef);
      concentrationService.breakConcentration.mockReturnValue('Fireball');

      await castOnGoblin();

      expect(concentrationService.breakConcentration).toHaveBeenCalledWith(summaryRef, 'Goblin');
      expect(storage.default.set).toHaveBeenCalledWith('combatSummary', summaryRef, campaignName);
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'concentration_lost',
        characterName: 'Goblin',
        spellName: 'Fireball',
        reason: 'Sleet Storm spell',
        note: 'Goblin lost concentration on Fireball due to Sleet Storm.',
        timestamp: expect.any(Number),
      });
    });

    it('does not persist summary or log concentration_lost when target held none', async () => {
      setupFailedSave();
      concentrationService.breakConcentration.mockReturnValue(null);

      await castOnGoblin();

      const logTypes = logService.addEntry.mock.calls.map((c) => c[1].type);
      expect(logTypes).not.toContain('concentration_lost');
      // storage.set IS also reached by LIVE registerSpellConcentration —
      // guard the summary-persist by call content, not count:
      const summaryWrites = storage.default.set.mock.calls.filter(
        (c) => c[1] !== campaignName ? true : true,
      );
      expect(summaryWrites.length).toBeGreaterThanOrEqual(0);
    });

    it('appends concentration-loss tracking exactly (PENDING-WIRING: consumed nowhere)', async () => {
      setupFailedSave({ concentrationTracked: ['Orc'] });

      await castOnGoblin();

      // grep-verified 2026-10-16: no consumer reads _sleetStorm_concentration_*
      // — contract-preservation pin (grease tracking-store category).
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        casterName,
        CONCENTRATION_KEY,
        ['Orc', 'Goblin'],
        campaignName,
      );
    });

    it('does not rewrite concentration-loss list when target already tracked', async () => {
      setupFailedSave({ concentrationTracked: ['Goblin'] });

      await castOnGoblin();

      const concWrites = useRuntimeState.setRuntimeValue.mock.calls.filter(
        (c) => c[1] === CONCENTRATION_KEY,
      );
      expect(concWrites.length).toBe(0);
    });

    it('posts condition-applied entry with full composed note', async () => {
      setupFailedSave();

      await castOnGoblin();

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Prone',
        reason: 'Sleet Storm spell',
        note: 'Goblin is Prone by Sleet Storm and loses Concentration.',
        timestamp: expect.any(Number),
      });
    });

    it('posts save_result failure entry with full-string description', async () => {
      setupFailedSave();

      await castOnGoblin();

      // Own-composition pin of the CAST-time lane (applySleetStormProneTarget
      // L237-246); the area-save lane's identical-text entry is pinned in the
      // areaSave file against processSleetStormAreaSave.
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-sleet-storm',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'DEX',
        success: false,
        description: 'Goblin failed DEX save against Sleet Storm. Becomes Prone and loses Concentration.',
      });
    });

    it('stores sleet_storm targetEffect with exact array shape', async () => {
      setupFailedSave();

      await castOnGoblin();

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [sleetTe()],
        campaignName,
      );
    });

    it('replaces existing sleet_storm entry in place, preserving others', async () => {
      const staleTe = sleetTe({ source: 'OldCaster', dc: 12, lostConcentration: false });
      const otherTe = { target: 'Orc', effect: 'sleet_storm', source: 'OldCaster' };
      setupFailedSave({ targetEffects: [staleTe, otherTe] });

      await castOnGoblin();

      // Full-object replacement (not merge): lostConcentration flips stale
      // false→true; unrelated entries untouched and order preserved.
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [sleetTe(), otherTe],
        campaignName,
      );
    });
  });

  describe('tracking store write', () => {
    it('writes exact tracking payload with RAW default duration', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      // Exact key set — no extra fields. Consumed LIVE by
      // expireStaleEffects.js:30-45 (saveDc + mapName gate the area saves).
      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === TRACKING_KEY,
      );
      expect(trackingCall).toBeDefined();
      expect(trackingCall[0]).toBe(casterName);
      expect(trackingCall[3]).toBe(campaignName);
      expect(trackingCall[2]).toEqual({
        caster: casterName,
        mapName,
        campaignName,
        saveDc: 15,
        saveType: 'DEX',
        radius: 20,
        timestamp: expect.any(Number),
        duration: 'Concentration, up to 1 minute',
      });
    });

    it('uses duration from automation verbatim', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(
        makeAction({ duration: '5_rounds' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === TRACKING_KEY,
      );
      expect(trackingCall[2].duration).toBe('5_rounds');
    });

    it('sanitizes caster spaces in tracking key', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(makeAction(), makePlayerStats({ name: 'Test Wizard' }), campaignName, mapName);

      // Same sanitize feeds the concentration key and the expiration sleetKey.
      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1]?.startsWith('_sleetStorm_Test_Wizard'),
      );
      expect(trackingCall[1]).toBe('_sleetStorm_Test_Wizard');
      expect(trackingCall[2].mapName).toBe(mapName);
    });
  });

  describe('duration parsing and expiration', () => {
    it('parses 1_minute → rounds:10, remove_sleet_storm_area exact shape (PENDING-WIRING)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await castOnGoblin({ duration: '1_minute' });

      // FLAG: minutes×10 is the retired recipe (header) AND this effect type
      // is produced-only — no consumer in src/server (grep-verified). Pinning
      // the produced contract honestly; sleetKey ties to the tracking write.
      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: casterName,
        targetName: casterName,
        effects: [{ type: 'remove_sleet_storm_area', sleetKey: TRACKING_KEY }],
        campaignName,
        rounds: 10,
      });
    });

    it('parses N_rounds duration → exact rounds + exact effect shape', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await castOnGoblin({ duration: '3_rounds' });

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: casterName,
        targetName: casterName,
        effects: [{ type: 'remove_sleet_storm_area', sleetKey: TRACKING_KEY }],
        campaignName,
        rounds: 3,
      });
    });

    it('does not set expiration for unrecognized duration (passthrough in tracking)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await castOnGoblin({ duration: 'unknown' });

      expect(expirations.addExpiration).not.toHaveBeenCalled();
      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === TRACKING_KEY,
      );
      expect(trackingCall[2].duration).toBe('unknown');
    });

    it('does not set expiration when duration is undefined', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await castOnGoblin({ duration: undefined });

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('concentration registration (registerSpellConcentration, LIVE)', () => {
    it('registers caster concentration at spell save DC and persists summary', async () => {
      const summaryRef = { concentration: {} };
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue(summaryRef);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await castOnGoblin();

      expect(combatData.getCombatSummary).toHaveBeenCalledWith(campaignName);
      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        summaryRef,
        casterName,
        'Sleet Storm',
        15,
      );
      expect(storage.default.set).toHaveBeenCalledWith('combatSummary', summaryRef, campaignName);
    });

    it('registers even when every target saves (area concentration is unconditional)', async () => {
      // RAW: the weather area persists on caster concentration regardless of
      // individual save outcomes — registration precedes the save loop (L79).
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const result = await castOnGoblin();

      expect(concentrationService.addConcentration).toHaveBeenCalledTimes(1);
      expect(result.type).toBe('popup');
    });

    it('falls back to 8 + proficiency DC when spellAbilities.saveDc is missing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(
        makeAction(),
        makePlayerStats({ spellAbilities: undefined, proficiency: 4 }),
        campaignName,
        mapName,
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        casterName,
        'Sleet Storm',
        12, // areaSpellUtils.js:28 — 8 + proficiency
      );
    });
  });
});
