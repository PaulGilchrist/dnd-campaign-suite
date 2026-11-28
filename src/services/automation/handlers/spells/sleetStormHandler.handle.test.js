// @maintained-by-ai 2026-11-27 — IMPROVE-AND-TRIM pass: 24→14 cases (failed-save application tests merged into one ordered full write/addExpiration/log census; *Once summary chains → counter-based persistent reads; success-leg pins folded into the no-application guard; duration-verbatim legs folded into the tracking/duration pins; undefined-duration same-branch twin removed; frozen Date.now literal timestamps; DISTINCTIVE contradicted fixture DCs (buildSaveDc 17 vs spellAbilities 13 vs automation 8) and automation saveType 'CON' vs hardcoded 'DEX' bytes to prove derivation; header line refs re-verified vs current bytes; #1822 minutes×10 honest-bytes cite placed)
// ── sleetStorm QUARTET seam map (shared subject: sleetStormHandler.js) ──
// lane (this) — #1961 .handle CAST-TIME: application/tracking/duration-
//   expiration/concentration-registration of handle() (L25-158) +
//   applySleetStormProneTarget internals (L167-269): exact-array condition
//   writes, activeConditionMeta merge, addTargetResult failure, addExpiration
//   shapes, breakConcentration, condition/concentration_lost/save_result(fail)
//   logs, tracking-key write, duration→rounds parsing,
//   registerSpellConcentration (areaSpellUtils.js:25-34 LIVE).
// RAW check (2024 Essentials, verified at sleetStormHandler.js): weather area
//   spell, Concentration ≤ 1 minute, DEX save (NOT CON), ZERO damage on every
//   addTargetResult, fail = Prone + concentration loss. Turn-based: expiration
//   rides round seams via addExpiration only — grep-verified zero
//   setTimeout/setInterval in this lane (Date.now() is an informational stamp,
//   frozen here to pin honest bytes; never a game timer).
// Canonical homes decided at quartet split (recorded here, honest):
//   #1961 (this)  — applySleetStormProneTarget wholesale (incl. ITS failure
//     addTargetResult + save_result-fail entry), tracking store write, duration
//     parsing + both addExpiration shapes, registerSpellConcentration,
//     success-path no-application guard.
//   #1962 .handleResults — handle()-body reporting: storeSpellLastAttack
//     (canonical there — corrects areaSave header claim of #1961), ability_use
//     entries, summary popup, handle()-body SUCCESS block (save_result-success,
//     addTargetResult-success). NOT pinned positively here.
//   #1963 .test (main) — early returns, target selection, prompt shape
//     (heightenTarget), isProneImmune + its addEntry rejection.
// Consumed/liveness (re-verified 2026-11-27 vs current bytes):
//   LIVE: dispatch 'sleet_storm' (index.js:585) AND 'sleet_storm_area_save'
//     (index.js:558) → handle(); tracking key consumed by
//     expireStaleEffects.js:42-57 → processSleetStormAreaSave (areaSave lane);
//     {type:'condition'} expiration consumed by clearExpirationEffects.js
//     EXPIRATION_HANDLERS 'condition' (:557 → removeConditionWithExpiryLog;
//     header previously cited a drifted :447/removeConditionEverywhere pair);
//     no-rounds entry → expiryRounds Infinity (expirationQueue.js:23) — prone
//     clears only via that seam, never a clock.
//   WIRED (2026-11-19, owner "WIRE IT"): remove_sleet_storm_area PRODUCED
//     L72-76 → consumed by clearExpirationEffects.js:599 (nulls the
//     `_sleetStorm_<caster>` zone tracking; pinned by
//     clearExpirationEffects.grease-sleet-zone-expiry.test.js).
//   PENDING-WIRING (pin contract-preservation, honest):
//     • _sleetStorm_concentration_<caster> loss-list PRODUCED L219-225/
//       L328-334, consumed NOWHERE (unchanged by the zone-clock wiring).
// DURATION POLICY (#1822 owner-pending divergence, per #1891 carry): the
//   '1_minute'→10 rounds minutes×10 encoding (sleetStormHandler.js:64-70) is
//   the retired recipe — AGENTS.md canon: ≥1-minute durations are combat-
//   scoped (cleared by new initiative/short/long rest), never a minutes×10
//   countdown. Pinned as HONEST BYTES with the cite at the pin site; the
//   grease twin (#1922, source :106-112) carries the family's first face with
//   byte-distinct wording — sleet's face stays separately pinned. Source not
//   fixed here; contract preservation, not re-specification.
// PROSE/SAVE-TYPE verdict (#1892 carry, handle-lane side): handle() HARDCODES
//   'DEX' everywhere — storeSpellLastAttack :45, tracking write :57,
//   createSaveListener :103, save_result logs :135/:243 — it never reads
//   action.automation.saveType. Fixtures contradict it (automation.saveType:
//   'CON') so the pins prove the hardcode, not a passthrough; consistent with
//   the areaSave lane's derived-only-saveDc verdict (:57's stored saveType is
//   written by this same hardcode, so prod bytes agree). No NEW divergence.
// Arity (per #1878): setRuntimeValue writes ARE 4-arg with campaignName
//   threaded — every write pin below matches the full source call. The
//   targetEffects READ (sleetStormHandler.js:249) is 2-arg at name 'campaign'
//   — pinned shape, not a typo to hide.
// Mocks note: rangeCheck/automationImmunities are handle-dormant here
//   (isWithinRange/playerIsImmuneToCondition run only in the areaSave lane,
//   sleetStormHandler.js:271-310) — the factories isolate import side effects
//   only; factory keys audited vs disk exports (savePrompt.js:35/:245,
//   damageUtils getCombatContext, damageRollback.js:164/:212,
//   concentrationService export block :527+, storage default :220).
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
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
  addTargetResult: vi.fn(),
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

// Frozen wall clock: Date.now() here is write-metadata only (tracking/log
// timestamps), never a game timer — freezing pins the honest full bytes.
const FROZEN_NOW = 1700000000000;

// DISTINCTIVE DC triangle (run2#1902 lesson: default-fixture pins survive
// hardcoded-shape mutants): buildSaveDc's OUTPUT (17) differs from the
// registration DC read off spellAbilities (13) and from the inert
// automation.saveDc (8). Every `dc: 17` pin below therefore proves the
// handler threads the buildSaveDc return — not a literal or a stats read.
const SAVE_DC = 17;
const SPELL_ABILITY_DC = 13;

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    spellAbilities: { saveDc: SPELL_ABILITY_DC },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Sleet Storm',
    automation: {
      type: 'sleet_storm',
      // CONTRADICTED value: source hardcodes 'DEX' at :45/:57/:103/:135/:243
      // — pins below say 'DEX' only because they are hardcoded, never read
      // from here (prose/save-type verdict, header).
      saveType: 'CON',
      saveDc: 8,
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

// Two distinct summary refs by READ ORDER (no *Once chains — persistent
// counter impl, re-baselined every test): #1 registerSpellConcentration
// (L79), #2 applySleetStormProneTarget's break read (L201). Distinct refs
// let the storage.set censuses attribute each persist to its own branch.
function stubSummaryReads(registerRead, breakRead) {
  let reads = 0;
  combatData.getCombatSummary.mockImplementation(() => (++reads === 1 ? registerRead : breakRead));
}

// Cast-time failed-save baseline: single Goblin target, fails DC 17.
function setupFailedSave(runtimeOverrides = {}) {
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
  dc: SAVE_DC,
  duration: 'concentration',
  lostConcentration: true,
  ...overrides,
});

const zoneExpiration = (rounds, caster = casterName, sleetKey = TRACKING_KEY) => ({
  attackerName: caster,
  targetName: caster,
  effects: [{ type: 'remove_sleet_storm_area', sleetKey }],
  campaignName,
  rounds,
});

const RAW_DEFAULT_DURATION = 'Concentration, up to 1 minute';

// ── Tests ──────────────────────────────────────────────────────

describe('sleetStormHandler.handle — cast time (#1961)', () => {
  beforeEach(() => {
    // restore + explicit re-baseline of EVERY overridable stub: no impl can
    // leak from one test into the next (leak-class fix, cf. grease #1922).
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    logService.addEntry.mockReset().mockResolvedValue({});
    damageRollback.addTargetResult.mockReset().mockResolvedValue({});
    damageRollback.storeSpellLastAttack.mockReset();
    damageUtils.getCombatContext.mockReset().mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReset().mockReturnValue(SAVE_DC);
    savePrompt.createSaveListener.mockReset().mockReturnValue(successSaveListener());
    useRuntimeState.getRuntimeValue.mockReset().mockReturnValue(null);
    useRuntimeState.setRuntimeValue.mockReset();
    expirations.addExpiration.mockReset();
    concentrationService.addConcentration.mockReset();
    concentrationService.breakConcentration.mockReset();
    combatData.getCombatSummary.mockReset().mockReturnValue({});
    storage.default.set.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful save — no-application guard', () => {
    it('applies nothing, yet still writes tracking and registers concentration once (area is unconditional)', async () => {
      // RAW: the weather area persists on caster concentration regardless of
      // individual save outcomes — registration precedes the save loop (L79),
      // tracking survives a full-save round (L52-61).
      const result = await castOnGoblin();

      // Exact ordered write census: the ONLY surviving write is tracking.
      expect(useRuntimeState.setRuntimeValue.mock.calls.map((c) => [c[0], c[1]])).toEqual([
        [casterName, TRACKING_KEY],
      ]);
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(concentrationService.breakConcentration).not.toHaveBeenCalled();
      const logTypes = logService.addEntry.mock.calls.map((c) => c[1].type);
      expect(logTypes).not.toContain('condition');
      expect(logTypes).not.toContain('concentration_lost');
      expect(concentrationService.addConcentration).toHaveBeenCalledTimes(1);
      expect(result.type).toBe('popup');
    });
  });

  describe('cast-time application — failed save (applySleetStormProneTarget)', () => {
    it('commits the full fresh-target application: ordered write census, addTargetResult, concentration-scoped expiration, and both logs', async () => {
      setupFailedSave();

      await castOnGoblin();

      // Ordered census of EVERY setRuntimeValue call (name+key): tracking
      // write, then condition/meta/concentration-list/targetEffects, in
      // source order, with no extra writes.
      expect(useRuntimeState.setRuntimeValue.mock.calls.map((c) => [c[0], c[1]])).toEqual([
        [casterName, TRACKING_KEY],
        ['Goblin', 'activeConditions'],
        ['Goblin', 'activeConditionMeta'],
        [casterName, CONCENTRATION_KEY],
        ['campaign', 'targetEffects'],
      ]);
      const writes = useRuntimeState.setRuntimeValue.mock.calls;
      // Fresh condition write (4-arg, campaignName threaded).
      expect(writes[1][2]).toEqual(['prone']);
      expect(writes[1][3]).toBe(campaignName);
      // Fresh meta: only the sleet prone key, dc threaded from buildSaveDc,
      // ability lowercase 'dex' distinct from the log-case 'DEX'.
      expect(writes[2][2]).toEqual({ prone: { dc: SAVE_DC, ability: 'dex', source: 'sleet_storm' } });
      // Concentration-loss tracking appended fresh (PENDING-WIRING: grep-
      // verified no consumer reads _sleetStorm_concentration_* — contract
      // preservation, grease tracking-store category).
      expect(writes[3][2]).toEqual(['Goblin']);
      expect(writes[4][2]).toEqual([sleetTe()]);

      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 5,
        conditions: ['prone'],
        appliedDamage: 0, // RAW: zero damage
      });

      // Full addExpiration census (default fixture has no auto.duration →
      // ONLY the concentration-scoped prone entry). No rounds key →
      // expiryRounds Infinity (expirationQueue.js:23): prone is
      // concentration-scoped, cleared only at clearExpirationEffects.js:557
      // — never a round countdown, never wall-clock.
      expect(expirations.addExpiration.mock.calls).toEqual([
        [
          {
            attackerName: casterName,
            targetName: 'Goblin',
            effects: [{ type: 'condition', condition: 'prone' }],
            campaignName,
          },
        ],
      ]);

      // Both failed-save logs, full shape (save_result saveType 'DEX'
      // survives the contradicted automation.saveType 'CON' fixture —
      // hardcoded bytes, :243).
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Prone',
        reason: 'Sleet Storm spell',
        note: 'Goblin is Prone by Sleet Storm and loses Concentration.',
        timestamp: FROZEN_NOW,
      });
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-sleet-storm',
        targetName: 'Goblin',
        saveDc: SAVE_DC,
        saveType: 'DEX',
        success: false,
        description: 'Goblin failed DEX save against Sleet Storm. Becomes Prone and loses Concentration.',
      });
    });

    it('merges into existing state: dedups/reorders Prone last and field-merges prone meta, preserving unrelated entries', async () => {
      setupFailedSave({
        activeConditions: ['prone', 'blinded'],
        activeConditionMeta: {
          blinded: { dc: 12, source: 'blindly_blast' },
          prone: { note: 'legacy' },
        },
      });

      await castOnGoblin();

      const conditionWrite = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeConditions',
      );
      expect(conditionWrite).toEqual([
        'Goblin',
        'activeConditions',
        ['blinded', 'prone'],
        campaignName,
      ]);
      // Unrelated meta preserved; prone replaced-field-wise but its own
      // prior keys kept (documented spread merge, sleetStormHandler.js:176-184).
      const metaWrite = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeConditionMeta',
      );
      expect(metaWrite).toEqual([
        'Goblin',
        'activeConditionMeta',
        {
          blinded: { dc: 12, source: 'blindly_blast' },
          prone: { note: 'legacy', dc: SAVE_DC, ability: 'dex', source: 'sleet_storm' },
        },
        campaignName,
      ]);
    });

    it('breaks target concentration, persists the broken summary second, and posts full-string concentration_lost', async () => {
      const registerRef = { registered: true };
      const breakRef = { active: true };
      setupFailedSave();
      stubSummaryReads(registerRef, breakRef);
      concentrationService.breakConcentration.mockReturnValue('Fireball');

      await castOnGoblin();

      expect(concentrationService.breakConcentration).toHaveBeenCalledTimes(1);
      expect(concentrationService.breakConcentration).toHaveBeenCalledWith(breakRef, 'Goblin');
      // Ordered storage.set census: registration persisted registerRef first,
      // the break branch persisted breakRef second — attributes each write.
      expect(storage.default.set.mock.calls).toEqual([
        ['combatSummary', registerRef, campaignName],
        ['combatSummary', breakRef, campaignName],
      ]);
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'concentration_lost',
        characterName: 'Goblin',
        spellName: 'Fireball',
        reason: 'Sleet Storm spell',
        note: 'Goblin lost concentration on Fireball due to Sleet Storm.',
        timestamp: FROZEN_NOW,
      });
    });

    it('does not persist summary or log concentration_lost when target held none', async () => {
      const registerRef = { registered: true };
      const breakRef = { active: true };
      setupFailedSave();
      stubSummaryReads(registerRef, breakRef);
      concentrationService.breakConcentration.mockReturnValue(null);

      await castOnGoblin();

      // Break branch taken (breakRef reached the break callee) but nothing
      // held → the ONLY summary persist is the registration lane's.
      expect(concentrationService.breakConcentration).toHaveBeenCalledWith(breakRef, 'Goblin');
      expect(storage.default.set.mock.calls).toEqual([
        ['combatSummary', registerRef, campaignName],
      ]);
      const logTypes = logService.addEntry.mock.calls.map((c) => c[1].type);
      expect(logTypes).not.toContain('concentration_lost');
    });

    it('does not rewrite concentration-loss list when target already tracked', async () => {
      setupFailedSave({ concentrationTracked: ['Goblin'] });

      await castOnGoblin();

      const concWrites = useRuntimeState.setRuntimeValue.mock.calls.filter(
        (c) => c[1] === CONCENTRATION_KEY,
      );
      expect(concWrites.length).toBe(0);
    });

    it('replaces existing sleet_storm entry in place, preserving others and order', async () => {
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
    it('writes the exact tracking payload: hardcoded DEX, buildSaveDc-threaded DC, RAW default duration, frozen timestamp', async () => {
      await castOnGoblin();

      // Exact key set — no extra fields. Consumed LIVE by
      // expireStaleEffects.js:42-57 (saveDc + mapName gate the area saves).
      // saveType:'DEX' here survives the contradicted automation 'CON'
      // (hardcoded :57); saveDc 17 is the buildSaveDc output, distinguishable
      // from automation.saveDc 8 and spellAbilities.saveDc 13.
      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === TRACKING_KEY,
      );
      expect(trackingCall).toEqual([
        casterName,
        TRACKING_KEY,
        {
          caster: casterName,
          mapName,
          campaignName,
          saveDc: SAVE_DC,
          saveType: 'DEX',
          radius: 20, // 20-foot-radius cylinder, hardcoded :58
          timestamp: FROZEN_NOW,
          duration: RAW_DEFAULT_DURATION,
        },
        campaignName,
      ]);
    });

    it('sanitizes caster spaces consistently across tracking key, concentration key, and expiration sleetKey', async () => {
      setupFailedSave();

      await handle(
        { ...makeAction({ duration: '3_rounds' }), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats({ name: 'Test Wizard' }),
        campaignName,
        mapName,
      );

      // All three sanitize consumers (_sleetStorm_<k>, _sleetStorm_-
      // concentration_<k>, expiration sleetKey) must agree byte-for-byte.
      expect(useRuntimeState.setRuntimeValue.mock.calls.map((c) => [c[0], c[1]])).toEqual([
        ['Test Wizard', '_sleetStorm_Test_Wizard'],
        ['Goblin', 'activeConditions'],
        ['Goblin', 'activeConditionMeta'],
        ['Test Wizard', '_sleetStorm_concentration_Test_Wizard'],
        ['campaign', 'targetEffects'],
      ]);
      expect(expirations.addExpiration).toHaveBeenCalledWith(
        zoneExpiration(3, 'Test Wizard', '_sleetStorm_Test_Wizard'),
      );
      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === '_sleetStorm_Test_Wizard',
      );
      expect(trackingCall[2].mapName).toBe(mapName);
    });
  });

  describe('duration parsing and expiration', () => {
    it("pins the sleet '1_minute'→rounds:10 minutes×10 encoding as honest bytes", async () => {
      // HONEST-BYTES PIN — owner-pending divergence #1822 (carried via #1891
      // → #1892/#1902): sleetStormHandler.js:64-70 still encodes '1_minute'
      // as minutes×10 → rounds 10. Repo canon (AGENTS.md) says ≥1-minute
      // durations are combat-scoped — last the whole combat, cleared by new
      // initiative/short rest/long rest, never a ×10 countdown. Pinned
      // verbatim so any change trips here first; the grease twin's :106-112
      // face is worded separately (#1922) — family distinct-bytes discipline.
      // Source NOT fixed here.
      await castOnGoblin({ duration: '1_minute' });

      // Full addExpiration census: the WIRED remove_sleet_storm_area entry
      // (consumed since 2026-11-19 by clearExpirationEffects.js:599; sleetKey
      // ties to the tracking write). Success save → prone-condition entry
      // never queued, so this is the ONLY expiration.
      expect(expirations.addExpiration.mock.calls).toEqual([[zoneExpiration(10)]]);
      // Verbatim passthrough leg: tracking stores the automation string as-is.
      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === TRACKING_KEY,
      );
      expect(trackingCall[2].duration).toBe('1_minute');
    });

    it('parses N_round durations → one remove_sleet_storm_area expiration per cast, exact rounds in order', async () => {
      await castOnGoblin({ duration: '3_rounds' });
      await castOnGoblin({ duration: '1_rounds' });

      expect(expirations.addExpiration.mock.calls).toEqual([
        [zoneExpiration(3)],
        [zoneExpiration(1)],
      ]);
    });

    it('arms no expiration for unrecognized duration; tracking keeps it verbatim', async () => {
      await castOnGoblin({ duration: 'unknown' });

      // Undefined/absent duration rides the SAME no-match branch — its
      // default-'Concentration, up to 1 minute' tracking leg is pinned in the
      // full-shape tracking test (same-branch twin removed this pass).
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === TRACKING_KEY,
      );
      expect(trackingCall[2].duration).toBe('unknown');
    });
  });

  describe('concentration registration (registerSpellConcentration, LIVE)', () => {
    it('registers caster concentration off spellAbilities.saveDc (not buildSaveDc) and persists summary', async () => {
      const summaryRef = { concentration: {} };
      combatData.getCombatSummary.mockReturnValue(summaryRef);

      await castOnGoblin();

      expect(combatData.getCombatSummary).toHaveBeenCalledWith(campaignName);
      // DC 13 = spellAbilities.saveDc, distinct from SAVE_DC 17: proves the
      // registration DC derives from stats (areaSpellUtils.js:28), never the
      // save prompt's buildSaveDc output.
      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        summaryRef,
        casterName,
        'Sleet Storm',
        SPELL_ABILITY_DC,
      );
      expect(storage.default.set.mock.calls).toEqual([
        ['combatSummary', summaryRef, campaignName],
      ]);
    });

    it('falls back to 8 + proficiency DC when spellAbilities.saveDc is missing', async () => {
      const summaryRef = { concentration: {} };
      combatData.getCombatSummary.mockReturnValue(summaryRef);

      await handle(
        makeAction(),
        makePlayerStats({ spellAbilities: undefined, proficiency: 4 }),
        campaignName,
        mapName,
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        summaryRef,
        casterName,
        'Sleet Storm',
        12, // areaSpellUtils.js:28 — 8 + proficiency
      );
    });
  });
});
