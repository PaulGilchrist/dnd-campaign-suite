// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── CAST-TIME immunity gate (bug-stinking-cloud-cast-applies-poison-to-immune-creature) ─
// handle()'s per-target gate runs the SAME chain the turn-start sweep runs
// (stinkingCloudTargetImmune): cs-row Poison DAMAGE immunity (monster rows) OR,
// for players, playerIsImmuneToCondition against the roster-resolved PlayerStats
// (`characters.find(...) → computedStats || character`, the 8c314c468
// expireStaleEffects.resolveTargetStats / sleepService.playerSleepImmunity idiom
// threaded as handle()'s 5th argument). Pre-fix the cast lane consulted ONLY the
// cs-row weaknessesAndResistivities — a monster-data field the minimal PC stub
// rows never carry — so a 2024 Circle-of-the-Land Druid (Nature's Ward
// land_resistance → conditionImmunity 'poisoned') was prompted and Poisoned at
// cast while the SAME engine's turn-start sweep skipped it.
// Pins: immune PC → NO save prompt armed, NO activeConditions/targetEffects
// writes, honest immune log row + popup tally; non-immune PC → prompt armed and
// a failed save still poisons (adjacent behavior); monster cs-row Poison damage
// immunity unchanged; an unthreaded roster NEVER fabricates immunity (the
// creature is prompted, never silently skipped).
// Mock rationale: automationImmunities is REAL (unmocked) — a mock-fed immunity
// gate would not catch the data-starved-gate class this bug is (CLA-119
// doctrine); the real chain walks immunities + allFeatures land_resistance.
// targetEffectDefinitions REAL (registerTargetEffect writes through the mocked
// runtime store). Everything else mirrors stinkingCloudHandler.test.js.
// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
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

import { handle } from './stinkingCloudHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

const campaignName = 'test-campaign';
const DRUID = 'FixtureLandDruid';

function makeCaster() {
  return { name: 'TestWizard', level: 20 };
}

function makeAction() {
  return {
    name: 'Stinking Cloud',
    automation: { type: 'stinking_cloud', saveDc: 19, saveType: 'CON' },
    metaCtx: { targets: [DRUID] },
  };
}

// Minimal PC stub row — exactly what change-data combatSummary carries for
// players (name/type/currentHp/maxHp): NO weaknessesAndResistivities field,
// which is what starved the pre-fix cast gate.
const druidCsRow = { name: DRUID, type: 'player', currentHp: 1, maxHp: 1 };
const druidCombat = { creatures: [druidCsRow] };

// Engine-derived 2024 Circle of the Land immunity carrier (public/data/2024/
// classes.json → Nature's Ward): land_resistance automation on allFeatures.
function landDruidRosterRow() {
  return {
    name: DRUID,
    computedStats: {
      name: DRUID,
      immunities: ['poisoned'],
      allFeatures: [{
        name: "Nature's Ward",
        automation: { type: 'land_resistance', conditionImmunity: 'poisoned', casting_time: 'passive' },
      }],
    },
  };
}

function notImmuneRosterRow() {
  return { name: DRUID, computedStats: { name: DRUID, immunities: [], allFeatures: [] } };
}

function failedSave() {
  createSaveListener.mockReturnValue({
    promptId: 'druid-prompt',
    promise: Promise.resolve({ success: false, roll: 3, total: 10 }),
  });
}

function emptyStore() {
  getRuntimeValue.mockImplementation(() => []);
}

function noImmuneWritesForDruid() {
  const conditionWrites = setRuntimeValue.mock.calls.filter(
    call => call[0] === DRUID && call[1] === 'activeConditions'
  );
  expect(conditionWrites).toEqual([]);
  const teWrites = setRuntimeValue.mock.calls.filter(
    call => call[0] === 'campaign' && call[1] === 'targetEffects'
  );
  expect(teWrites).toEqual([]);
}

describe('stinkingCloudHandler cast-time immunity gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildSaveDc.mockReturnValue(19);
    getCombatSummary.mockReturnValue(null);
    addEntry.mockResolvedValue(undefined);
    getCombatContext.mockResolvedValue(druidCombat);
  });

  describe('immune PC (the bug)', () => {
    it('never arms a save prompt for a roster-immune player and writes no condition/te rows', async () => {
      emptyStore();
      failedSave(); // falsifier: if the gate failed, this failure would poison the Druid

      const result = await handle(makeAction(), makeCaster(), campaignName, null, [landDruidRosterRow()]);

      expect(createSaveListener).not.toHaveBeenCalled();
      noImmuneWritesForDruid();
      expect(result.payload.description).toContain('1 creature(s) immune');
      expect(result.payload.description).not.toContain('Poisoned');
    });

    it('logs the honest immune skip row (every automation logs when triggered)', async () => {
      emptyStore();

      await handle(makeAction(), makeCaster(), campaignName, null, [landDruidRosterRow()]);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestWizard',
        abilityName: 'Stinking Cloud',
        description: `${DRUID} is immune to Stinking Cloud (Poison immunity).`,
      });
      const conditionRows = addEntry.mock.calls
        .map(([, entry]) => entry)
        .filter(e => e.type === 'condition' || (e.type === 'save_result' && e.targetName === DRUID));
      expect(conditionRows).toEqual([]);
    });

    it('resolves the roster row WITHOUT a computedStats wrapper (computedStats || character fallback)', async () => {
      emptyStore();
      failedSave();
      const bareRow = { name: DRUID, immunities: ['poisoned'], allFeatures: [] };

      await handle(makeAction(), makeCaster(), campaignName, null, [bareRow]);

      expect(createSaveListener).not.toHaveBeenCalled();
      noImmuneWritesForDruid();
    });
  });

  describe('adjacent behavior', () => {
    it('a non-immune PC is still prompted and a failed save still applies Poisoned', async () => {
      emptyStore();
      failedSave();

      const result = await handle(makeAction(), makeCaster(), campaignName, null, [notImmuneRosterRow()]);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: DRUID,
        saveType: 'CON',
        saveDc: 19,
        dcSuccess: 'none',
        disadvantage: false,
      });
      expect(setRuntimeValue).toHaveBeenCalledWith(DRUID, 'activeConditions', ['poisoned'], campaignName);
      expect(result.payload.description).toContain('is Poisoned');
    });

    it('a monster cs row with Poison DAMAGE immunity still skips (pre-existing lane unchanged)', async () => {
      emptyStore();
      failedSave();
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Thug 1', type: 'npc', weaknessesAndResistivities: { immunities: ['poison'] } }],
      });

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: ['Thug 1'] } },
        makeCaster(), campaignName, null, []
      );

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('immune');
    });

    it('an unthreaded roster never fabricates immunity — the player is still prompted', async () => {
      emptyStore();
      failedSave();

      // characters undefined (lane without the 5th arg) and characters [] must
      // both behave byte-identically: no stats ⇒ no immunity ⇒ prompt armed.
      await handle(makeAction(), makeCaster(), campaignName, null);
      expect(createSaveListener).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      buildSaveDc.mockReturnValue(19);
      getCombatContext.mockResolvedValue(druidCombat);
      emptyStore();
      failedSave();
      await handle(makeAction(), makeCaster(), campaignName, null, []);
      expect(createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('mixed target list: immune PC skipped, the rest still save (per-target gate)', async () => {
      emptyStore();
      failedSave();
      getCombatContext.mockResolvedValue({
        creatures: [
          druidCsRow,
          { name: 'FeyRanger', type: 'player', currentHp: 1, maxHp: 1 },
        ],
      });

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: [DRUID, 'FeyRanger'] } },
        makeCaster(), campaignName, null,
        [landDruidRosterRow(), notImmuneRosterRow()]
      );

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName: 'FeyRanger' }));
      expect(result.payload.description).toContain('1 creature(s) immune');
    });
  });
});
