// truePolymorph HEXAD lane #1981 — handler main handle(): GATES + SAVE FLOW.
// Owns (truePolymorphHandler.js):
//   • combat-context gate (:225-235) and target gates (:239-248, :260-267)
//   • gateTruePolymorphTarget (:77-99) — the ALREADY-TRANSFORMED / 0HP / shapechanger
//     refusals. Honest half-pin: this is the HANDLER's gate half; CharSheet's
//     handleTruePolymorphConfirm calls confirmTruePolymorphTransform directly and
//     BYPASSES it (service-side clobber pinned in #1986).
//   • runTransformationSave (:101-154) — save prompt opts, promptId log, save_result
//     logs, resist refusal, addTargetResult-on-resist shape.
//   • ally skip (:206-207) and refusal logging (:68-75).
// NOT owned here (see #1980 seam map header):
//   • popup payload SHAPES per mode — canonical in #1980 (.handleModes). This lane
//     pins gate OUTCOMES only: which refusal string fires, or that the flow reached
//     the builder popup (payload.type), never the builder's key table.
//   • maxCR math — canonical in #1982 (.ResolveMaxCR). Delegation route pinned at
//     #1980; the wasted-await on object_into_creature (:215→:163 discard) is flagged
//     and pinned there. NOT re-pinned here.
//   • concentration/targetEffects/summary WRITES — live in the service (#1983/#1986).
//     Handler verified at source: ZERO game-state writes. The only write-shaped call
//     is addTargetResult, and only on save RESIST (:121). Purity guard pinned below.
// Flags honored: maxCR wasted-await (no :215 compute pins); arity — real
// getRuntimeValue is 2-arg, handler passes an ignored 3rd arg, mocks ignore arg 3;
// no timers — captured save promise only (concentration/Infinity, combat-scoped).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn((auto) => auto.saveDc || 15),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(), // purity guard: handler must never call this
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

// Mirrors prod utils.getName exactly (identity with 'Unknown' guard).
vi.mock('../../../ui/utils.js', () => ({
  default: { getName: vi.fn((fullName) => fullName || 'Unknown') },
}));

import { handle } from './truePolymorphHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addTargetResult } from '../../common/damageRollback.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import { addEntry } from '../../../ui/logService.js';
import utils from '../../../ui/utils.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';
const SPELL = { name: 'True Polymorph', level: 9 };

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }], // prod shape: ARRAY
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

// Prod-shaped action (applyTruePolymorph service :53-64 composes the same keys).
// Keys explicit — no leaked fixture noise.
function makeAction({ mode, truePolymorphTarget, omitSaveDc = false, metamagicHeighten = false } = {}) {
  return {
    name: 'True Polymorph',
    automation: {
      type: 'true_polymorph',
      saveType: 'WIS',
      ...(omitSaveDc ? {} : { saveDc: 15 }),
      ...(mode ? { mode } : {}),
    },
    spell: SPELL,
    spellSlotLevel: 9,
    metaCtx: {
      ...(truePolymorphTarget ? { truePolymorphTarget } : {}),
      ...(metamagicHeighten ? { metamagicHeighten: true } : {}),
    },
  };
}

function makeCreature(overrides) {
  return { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [], ...overrides };
}

const baseCombatContext = {
  creatures: [makeCreature({}), { name: casterName, type: 'player' }],
};

// Mocks ignore the ignored 3rd campaignName arg of getRuntimeValue (arity flag).
function setupMocks({ targetEffects = [], allies = [], saveResult = { success: false } } = {}) {
  getCombatContext.mockResolvedValue(baseCombatContext);
  getAllyList.mockReturnValue(allies);
  getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: 1 });
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return targetEffects;
    return null; // real store returns null for missing keys
  });
  createSaveListener.mockReturnValue({
    promptId: 'tpolymorph-prompt',
    promise: Promise.resolve(saveResult),
  });
}

// ---- assertion helpers (own-composition: refusalPopup :57-66, refusal log :68-75) ----

function expectRefusal(result, description) {
  expect(result).toEqual({
    type: 'popup',
    payload: { type: 'automation_info', name: 'True Polymorph', description },
  });
}

const logEntries = (type, match) =>
  addEntry.mock.calls
    .map(([, entry]) => entry)
    .filter((e) => e && e.type === type && (!match || e.description.includes(match)));

describe('truePolymorphHandler.handle — gates, save flow, refusals (#1981 handler lane)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat-context gate (:225-235)', () => {
    it('refuses when combat context has no creatures — full-string, no downstream calls', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expectRefusal(result, 'No creatures in combat. True Polymorph has no effect.');
      expect(getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('refuses when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expectRefusal(result, 'No creatures in combat. True Polymorph has no effect.');
    });
  });

  describe('target gates (:239-248, :260-267)', () => {
    it('refuses with "No target selected" when no truePolymorphTarget and mode is not object_into_creature', async () => {
      setupMocks();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expectRefusal(result, 'No target selected. True Polymorph has no effect.');
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(getMonsterData).not.toHaveBeenCalled();
    });

    it('object_into_creature without a target bypasses both target gates — pure builder path', async () => {
      setupMocks();

      const result = await handle(makeAction({ mode: 'object_into_creature' }), makePlayerStats(), campaignName, null);

      // Gate bypass is the pin here (#1980 owns the popup shape this returns):
      // no refusal, no ally resolution, no save prompt, no CR delegation.
      expect(result.payload.type).not.toBe('automation_info');
      expect(result.payload.description).toBeUndefined();
      expect(getAllyList).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(getMonsterData).not.toHaveBeenCalled();
    });

    it('refuses with "No valid target" when target name is not in combat (non-object mode)', async () => {
      setupMocks();

      const result = await handle(makeAction({ truePolymorphTarget: 'NonExistent' }), makePlayerStats(), campaignName, null);

      expectRefusal(result, 'No valid target for True Polymorph.');
      // This fallback path is silent — refusal logging belongs to gateTruePolymorphTarget only.
      expect(addEntry).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('already-transformed gate (:78-86 — handler half of the gate)', () => {
    // Honest scope: handle() refuses re-transform; CharSheet's confirm flow calls
    // confirmTruePolymorphTransform directly and BYPASSES this gate (#1986).
    it('refuses re-transform on a target with an existing true_polymorph effect, and logs the refusal', async () => {
      setupMocks({ targetEffects: [{ target: targetName, effect: 'true_polymorph', source: casterName }] });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, 'Goblin is already transformed.');
      expect(logEntries('ability_use')).toEqual([
        {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'True Polymorph',
          description: 'TestCaster casts True Polymorph on Goblin, but Goblin is already transformed.',
        },
      ]);
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('polymorph effect also trips the gate', async () => {
      setupMocks({ targetEffects: [{ target: targetName, effect: 'polymorph', source: casterName }] });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, 'Goblin is already transformed.');
    });

    it('object_transform effect also trips the gate', async () => {
      setupMocks({ targetEffects: [{ target: targetName, effect: 'object_transform', source: casterName }] });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, 'Goblin is already transformed.');
    });

    it('matches array-shaped te.target on its first entry', async () => {
      setupMocks({
        targetEffects: [{ target: [targetName, 'extra'], effect: 'true_polymorph', source: casterName }],
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, 'Goblin is already transformed.');
    });

    it('does NOT trip on non-transform forms or other targets — gate passes to save prompt', async () => {
      setupMocks({
        targetEffects: [
          { target: targetName, effect: 'burning', source: casterName }, // real registry te, not a transform
          { target: 'Someone Else', effect: 'true_polymorph', source: casterName },
        ],
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('true_polymorph_select'); // reached builder (shape is #1980)
      expect(logEntries('ability_use', 'already transformed')).toEqual([]);
      expect(createSaveListener).toHaveBeenCalled();
    });

    it('gate precedence: already-transformed wins over 0HP and shapechanger, and refuses exactly once', async () => {
      setupMocks({ targetEffects: [{ target: targetName, effect: 'polymorph', source: casterName }] });
      getCombatContext.mockResolvedValue({
        creatures: [
          makeCreature({ currentHp: 0, traits: [{ name: 'Shapechanger' }] }),
          { name: casterName, type: 'player' },
        ],
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, 'Goblin is already transformed.');
      expect(logEntries('ability_use')).toHaveLength(1); // :78 checked before :88 before :93
    });
  });

  describe('0-hit-points gate (:88-91)', () => {
    const ZERO_HP = 'True Polymorph has no effect on a creature with 0 hit points.';

    it('refuses a monster at currentHp 0 — runs before ally resolution and save', async () => {
      setupMocks();
      getCombatContext.mockResolvedValue({
        creatures: [makeCreature({ currentHp: 0 }), { name: casterName, type: 'player' }],
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, ZERO_HP);
      expect(logEntries('ability_use')).toEqual([
        {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'True Polymorph',
          description: "TestCaster casts True Polymorph on Goblin, but a creature with 0 hit points can't be transformed.",
        },
      ]);
      expect(getAllyList).not.toHaveBeenCalled(); // gate precedes ally check (:203 vs :206)
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('refuses via hit_points.current = 0 creature shape (fallback chain)', async () => {
      setupMocks();
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', hit_points: { current: 0, max: 7 }, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, ZERO_HP);
    });

    it('player target: runtime-store numeric wins over creature currentHp', async () => {
      setupMocks();
      getCombatContext.mockResolvedValue({
        creatures: [makeCreature({ type: 'player', currentHp: 5 }), { name: casterName, type: 'player' }],
      });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === targetName && subKey === 'currentHitPoints') return 0;
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return null;
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, ZERO_HP);
    });

    it('player target: non-number runtime value falls back to creature currentHp', async () => {
      setupMocks();
      getCombatContext.mockResolvedValue({
        creatures: [makeCreature({ type: 'player', currentHp: 0 }), { name: casterName, type: 'player' }],
      });
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === targetName && subKey === 'currentHitPoints') return 'invalid';
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return null;
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, ZERO_HP);
    });
  });

  describe('shapechanger gate (:93-96)', () => {
    const NOT_SHAPECHANGER = 'True Polymorph has no effect on a shapechanger.';

    it('refuses on traits-name Shapechanger and logs the refusal', async () => {
      setupMocks();
      getCombatContext.mockResolvedValue({
        creatures: [makeCreature({ traits: [{ name: 'Shapechanger' }] }), { name: casterName, type: 'player' }],
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, NOT_SHAPECHANGER);
      expect(logEntries('ability_use')).toEqual([
        {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'True Polymorph',
          description: 'TestCaster casts True Polymorph on Goblin, but shapechangers are unaffected.',
        },
      ]);
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('refuses on special_abilities-name Shapechanger', async () => {
      setupMocks();
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, special_abilities: [{ name: 'Shapechanger' }] },
          { name: casterName, type: 'player' },
        ],
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, NOT_SHAPECHANGER);
    });

    it('refuses on exact monsterType Shapechanger', async () => {
      setupMocks();
      getCombatContext.mockResolvedValue({
        creatures: [makeCreature({ type: 'npc', monsterType: 'Shapechanger' }), { name: casterName, type: 'player' }],
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, NOT_SHAPECHANGER);
    });

    it('refuses on monsterType substring (Were-Shapechanger) — substring branch, not exact-match branch', async () => {
      setupMocks();
      getCombatContext.mockResolvedValue({
        creatures: [makeCreature({ type: 'npc', monsterType: 'Were-Shapechanger' }), { name: casterName, type: 'player' }],
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, NOT_SHAPECHANGER);
    });

    it('refuses on type_tags shapechanger tag', async () => {
      setupMocks();
      getCombatContext.mockResolvedValue({
        creatures: [makeCreature({ type: 'monstrosity', type_tags: ['shapechanger'] }), { name: casterName, type: 'player' }],
      });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, NOT_SHAPECHANGER);
    });
  });

  describe('non-ally save flow (:101-154)', () => {
    it('failed save: exact prompt opts, promptId-tagged cast log, reaches builder popup — ZERO writes', async () => {
      setupMocks({ saveResult: { success: false, roll: 5, total: 6 } });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      // Prompt options composed at :102-108 — strict pin of own composition.
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: false,
      });
      expect(logEntries('ability_use', 'must make a WIS save')).toEqual([
        {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'True Polymorph',
          description: 'TestCaster casts True Polymorph on Goblin! Goblin must make a WIS save (DC 15) or be transformed.',
          promptId: 'tpolymorph-prompt',
        },
      ]);
      expect(result.payload.type).toBe('true_polymorph_select'); // gate outcome; shape is #1980
      // Purity guard: transformation writes are the service's job (#1983/#1986).
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addTargetResult).not.toHaveBeenCalled();
    });

    it('failed save logs exactly one strict save_result entry', async () => {
      setupMocks({ saveResult: { success: false, roll: 5, total: 6 } });

      await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(
        addEntry.mock.calls.map(([, e]) => e).filter((e) => e?.rollType === 'save-polymorph'),
      ).toEqual([
        {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-polymorph',
          targetName,
          saveDc: 15,
          saveType: 'WIS',
          success: false,
          description: 'Goblin failed WIS save against True Polymorph and is transformed.',
        },
      ]);
    });

    it('successful save: resist refusal + strict addTargetResult + strict save_result, builder never reached', async () => {
      setupMocks({ saveResult: { success: true, roll: 15, total: 20 } });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expectRefusal(result, 'Goblin resisted the transformation.');
      // addTargetResult is the handler's ONLY write-shaped call, resist-path only (:121).
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'success',
        roll: 15,
        total: 20,
        conditions: [],
        appliedDamage: 0,
      });
      expect(
        addEntry.mock.calls.map(([, e]) => e).filter((e) => e?.rollType === 'save-polymorph'),
      ).toEqual([
        {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-polymorph',
          targetName,
          saveDc: 15,
          saveType: 'WIS',
          success: true,
          description: 'Goblin succeeded on WIS save against True Polymorph.',
        },
      ]);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('resist with missing roll/total defaults them to 0 in addTargetResult', async () => {
      setupMocks({ saveResult: { success: true } });

      await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('metamagicHeighten sends disadvantage: true on the save prompt', async () => {
      setupMocks();

      await handle(
        makeAction({ truePolymorphTarget: targetName, metamagicHeighten: true }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ disadvantage: true }),
      );
    });

    it('DC is sourced from buildSaveDc(auto, playerStats), threaded into the prompt', async () => {
      buildSaveDc.mockReturnValue(18);
      setupMocks();
      const action = makeAction({ truePolymorphTarget: targetName, omitSaveDc: true });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, expect.objectContaining({ name: casterName }));
      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ saveDc: 18 }),
      );
    });
  });

  describe('ally skip (:206-207)', () => {
    it('ally target skips the save entirely and builds the select popup', async () => {
      setupMocks({ allies: [casterName, targetName] });

      const result = await handle(makeAction({ truePolymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('true_polymorph_select');
      expect(getAllyList).toHaveBeenCalledWith(casterName);
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled(); // ally path logs nothing (refusal logging only)
    });

    it('ally matching runs through utils.getName (identity, same as prod)', async () => {
      setupMocks({ allies: [casterName, 'Goblin the Brave'] });
      getCombatContext.mockResolvedValue({
        creatures: [makeCreature({ name: 'Goblin the Brave' }), { name: casterName, type: 'player' }],
      });

      const result = await handle(makeAction({ truePolymorphTarget: 'Goblin the Brave' }), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('true_polymorph_select');
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(utils.getName).toHaveBeenCalledWith('Goblin the Brave');
    });
  });

  describe('gates are mode-agnostic', () => {
    it('object_into_creature with a RESOLVED target still runs the gate — already-transformed refuses', async () => {
      // #1980 pins mode-routing shapes; this pins that no mode skips gateTruePolymorphTarget.
      setupMocks({ targetEffects: [{ target: targetName, effect: 'object_transform', source: casterName }] });

      const result = await handle(
        makeAction({ mode: 'object_into_creature', truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expectRefusal(result, 'Goblin is already transformed.');
      expect(createSaveListener).not.toHaveBeenCalled();
    });
  });
});
