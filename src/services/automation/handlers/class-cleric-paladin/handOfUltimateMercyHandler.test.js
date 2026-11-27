// @maintained-by-ai 2026-11-26
// Deterministic unit coverage for handOfUltimateMercyHandler.handle — all external
// services mocked. This lane owns the HANDLER WIRING: the focus cost/fallback
// chain, 0-HP gate, dice-expression selection (default/custom/maximized), the ONE
// merged death-state batch, write/storage/log censuses, the audit maxHp source
// chain, the in-sheet chooser and its commit refusals. The shared revive
// primitives (resolveReviveTargetHp absent-HP law, stripUnconsciousOnRevive
// predicate) are service-tested in src/services/shared/reviveTargetHp.test.js;
// the chooser host/modal consumption in useCharActionsAutomation.houm-chooser
// and HandOfUltimateMercyModal tests. Every refusal lane pins its exact popup
// AND a zero-spend census (no writes, no roll, no log row).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  hasHealingMaximization: vi.fn(),
  resolveDiceExpression: vi.fn((expr) => expr),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './handOfUltimateMercyHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as logPoster from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import * as automationService from '../../../combat/automation/automationService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 5,
    class: { class_levels: [{ level: 5, focus_points: 10 }] },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Hand of Ultimate Mercy',
    automation: { resourceCostAmount: 5, healExpression: '4d10', ...automation },
  };
}

// Exact infoPopup shape — refusals and successes are pinned full-frame.
function expectedPopup(description, automation) {
  return {
    type: 'popup',
    payload: { type: 'automation_info', name: 'Hand of Ultimate Mercy', description, automation },
  };
}

// Runtime-store router: FP on caster, HP + max + conditions on any target name.
function mockRuntime({ fp = 5, hp = 0, conditions = [], maxHp = null } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'focusPoints') return fp;
    if (key === 'currentHitPoints') return hp;
    if (key === 'activeConditions') return conditions;
    if (key === 'hitPoints') return maxHp;
    return null;
  });
}

function mockRoll(total) {
  diceRoller.rollExpression.mockReturnValue({ total, rolls: [total] });
}

function mockPlayerTarget(name = 'DownedAlly', csMaxHp = undefined) {
  resolveTarget.mockResolvedValue({ target: { name, type: 'player', maxHp: csMaxHp } });
}

function setupSuccessPath(healAmount = 12, targetName = 'DownedAlly', maxHp = 112) {
  mockRuntime({ maxHp });
  mockRoll(healAmount);
  mockPlayerTarget(targetName);
}

function setupNpcTarget(name = 'Goblin', conditions = []) {
  const cs = { creatures: [{ name, type: 'npc', currentHp: 0 }] };
  mockRuntime({ conditions });
  resolveTarget.mockResolvedValue({ target: cs.creatures[0], cs });
  return cs;
}

// Per-name HP router for the chooser/filter lanes: `currentHitPoints`/`hitPoints`
// resolve BY NAME (names absent from the maps read null → the bucket-canonical
// row fallback kicks in), everything else mirrors mockRuntime.
function mockRuntimeByName({ fp = 5, hpByName = {}, maxHpByName = {}, conditions = [] } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'focusPoints') return fp;
    if (key === 'currentHitPoints') return hpByName[name] ?? null;
    if (key === 'hitPoints') return maxHpByName[name] ?? null;
    if (key === 'activeConditions') return conditions;
    return null;
  });
}

// Mixed board: caster + a bucket-0 player whose cs row still reads 45 (stale
// row — bucket is canonical), a living player whose cs row reads 12 under a
// 30-HP bucket, and a bucket-less npc corpse resolved from its row.
function makeMixedBoard() {
  return {
    creatures: [
      { name: 'TestCleric', type: 'player', currentHp: 50, maxHp: 112 },
      { name: 'CorpseAlly', type: 'player', currentHp: 45, maxHp: 90 },
      { name: 'LivingAlly', type: 'player', currentHp: 12, maxHp: 40 },
      { name: 'DeadRug', type: 'npc', currentHp: 0, maxHp: 21 },
    ],
  };
}

function makeMixedBuckets() {
  return {
    hpByName: { TestCleric: 50, CorpseAlly: 0, LivingAlly: 30 },
    maxHpByName: { TestCleric: 112, CorpseAlly: 90, LivingAlly: 40 },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('handOfUltimateMercyHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Every refusal face in the family: exact popup + zero-spend census.
  const zeroSpend = () => {
    expect(resolveTarget).not.toHaveBeenCalled();
    expect(getCombatContext).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(logPoster.addEntry).not.toHaveBeenCalled();
  };

  describe('Focus point cost and fallback chain', () => {
    it.each([
      { title: 'reads the runtime bucket', fp: 2, need: 5, have: 2 },
      { title: 'falls back to _trackedResources when the bucket is null', fp: null, tracked: 3, need: 5, have: 3 },
      { title: 'falls back to class-level focus_points when bucket and tracked are absent', fp: null, noTracked: true, need: 12, have: 10 },
      { title: 'honours a custom resourceCostAmount', fp: 4, need: 7, have: 4 },
      { title: 'defaults the cost to 5 when resourceCostAmount is missing', fp: 4, stripCost: true, need: 5, have: 4 },
    ])('$title', async (tc) => {
      mockRuntime({ fp: tc.fp });
      let stats = makePlayerStats();
      if (tc.tracked !== undefined) {
        stats = makePlayerStats({
          class: { class_levels: [] },
          _trackedResources: { focusPoints: { current: tc.tracked } },
        });
      }
      if (tc.noTracked) stats = makePlayerStats({ _trackedResources: undefined });
      const action = tc.stripCost
        ? { name: 'Hand of Ultimate Mercy', automation: {} }
        : makeAction({ resourceCostAmount: tc.need });

      const result = await handle(action, stats, campaignName, null);

      expect(result).toEqual(expectedPopup(
        `Not enough Focus Points. Need ${tc.need}, have ${tc.have}.`,
        action.automation,
      ));
      zeroSpend();
    });
  });

  describe('0-HP gate refusals (armed target)', () => {
    it.each([
      {
        title: 'player target above 0 bucket HP',
        setup: () => {
          mockRuntime({ hp: 5, conditions: ['unconscious'] });
          mockPlayerTarget('DownedAlly');
        },
        name: 'DownedAlly',
      },
      {
        title: 'npc target above 0 row HP',
        setup: () => {
          mockRuntime();
          resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc', currentHp: 3 } });
        },
        name: 'Goblin',
      },
    ])('refuses zero-spend when a $title (no chooser detour, no condition reads)', async (tc) => {
      tc.setup();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual(expectedPopup(`${tc.name} is not at 0 Hit Points.`, makeAction().automation));
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(logPoster.addEntry).not.toHaveBeenCalled();
      // The refusal precedes any strip/cure probe: an armed living target must
      // never read (let alone rewrite) the condition bucket.
      expect(getCombatContext).not.toHaveBeenCalled();
      const condReads = useRuntimeState.getRuntimeValue.mock.calls
        .filter(([, key]) => key === 'activeConditions');
      expect(condReads).toEqual([]);
    });

    it('refuses when no target is armed and no combat board exists', async () => {
      mockRuntime();
      resolveTarget.mockResolvedValue(null);
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual(expectedPopup('Select a target in combat first.', makeAction().automation));
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logPoster.addEntry).not.toHaveBeenCalled();
    });

    it.each([
      {
        title: 'player bucket currentHitPoints null',
        setup: () => {
          mockRuntime({ hp: null });
          mockPlayerTarget('DownedAlly');
        },
        name: 'DownedAlly',
      },
      {
        title: 'npc row currentHp null',
        setup: () => {
          mockRuntime();
          resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc', currentHp: null }, cs: { creatures: [] } });
        },
        name: 'Goblin',
      },
    ])('treats $title as a corpse (shared absent-HP law) and resurrects', async (tc) => {
      tc.setup();
      mockRoll(10);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual(expectedPopup(
        `TestCleric uses Hand of Ultimate Mercy on ${tc.name}. Returns to life with 10 HP. Expended 5 Focus Points.`,
        makeAction().automation,
      ));
    });
  });

  describe('Dice rolling', () => {
    it('a failed roll refuses zero-spend BEFORE the focus payment', async () => {
      mockRuntime();
      mockPlayerTarget();
      diceRoller.rollExpression.mockReturnValue(null);

      const action = makeAction();
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual(expectedPopup('Failed to roll healing dice.', action.automation));
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(logPoster.addEntry).not.toHaveBeenCalled();
    });

    it.each([
      { title: 'a custom healExpression from automation', makeActionFn: () => makeAction({ healExpression: '6d8' }), expression: '6d8' },
      { title: '4d10 when none is specified', makeActionFn: () => ({ name: 'Hand of Ultimate Mercy', automation: { resourceCostAmount: 5 } }), expression: '4d10' },
    ])('rolls $title', async (tc) => {
      setupSuccessPath(15);

      await handle(tc.makeActionFn(), makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
      expect(diceRoller.rollExpression).toHaveBeenCalledWith(tc.expression);
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
    });

    it('routes to rollExpressionMaximized when the caster has healing maximization', async () => {
      setupSuccessPath();
      automationService.hasHealingMaximization.mockReturnValue(true);
      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 40, rolls: [10, 10, 10, 10] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('4d10');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('TestCleric uses Hand of Ultimate Mercy on DownedAlly. Returns to life with 40 HP. Expended 5 Focus Points.');
    });
  });

  // The full armed-player commit contract in one census: focus −5, the ONE
  // merged CLA-092 death-state batch (bug-houm-resurrection-leaves-isdead-stuck
  // — HP must never ride a separate single-key write), exactly one
  // hp_change/resurrection:true audit row (log-family parity 2026-11-14: the
  // exact field set every other revive/heal writer commits, isHealing per the
  // sign-stamp law), the two refresh events in order, and no chooser detour.
  // `prone` in the bucket proves a non-stripped, non-cureable condition keeps
  // the batch at its exact four keys.
  it('commits an armed player corpse: merged batch, focus −5, one resurrection log row, events, success popup', async () => {
    mockRuntime({ maxHp: 112, conditions: ['prone'] });
    mockRoll(12);
    mockPlayerTarget();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    const action = makeAction();
    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toEqual(expectedPopup(
      'TestCleric uses Hand of Ultimate Mercy on DownedAlly. Returns to life with 12 HP. Expended 5 Focus Points.',
      action.automation,
    ));
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'focusPoints', 0, campaignName);
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith('DownedAlly', {
      currentHitPoints: 12,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
      isDead: 0,
    }, campaignName);
    expect(storage.set).not.toHaveBeenCalled();
    expect(logPoster.addEntry).toHaveBeenCalledTimes(1);
    expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'hp_change',
      characterName: 'TestCleric',
      targetName: 'DownedAlly',
      delta: 12,
      currentHp: 12,
      maxHp: 112,
      isHealing: true,
      sourceName: 'TestCleric',
      note: 'Hand of Ultimate Mercy',
      timestamp: now,
      resurrection: true,
    });
    expect(dispatchSpy.mock.calls.map(([e]) => e.type)).toEqual([
      'focus-points-updated',
      'combat-summary-updated',
    ]);
    expect(getCombatContext).not.toHaveBeenCalled();
    dispatchSpy.mockRestore();
    dateSpy.mockRestore();
  });

  describe('NPC target commit', () => {
    it('mutates and persists the summary row (CLA-160), skips player writes, logs with the row maxHp', async () => {
      mockRuntime();
      mockRoll(24);
      const cs = { creatures: [{ name: 'Animated Rug of Smothering 1', type: 'npc', currentHp: 0, maxHp: 21 }] };
      resolveTarget.mockResolvedValue({ target: cs.creatures[0], cs });
      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

      const action = makeAction();
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual(expectedPopup(
        'TestCleric uses Hand of Ultimate Mercy on Animated Rug of Smothering 1. Returns to life with 24 HP. Expended 5 Focus Points.',
        action.automation,
      ));
      expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
      expect(storage.set).toHaveBeenCalledTimes(1);
      const [key, savedCs, savedCampaign] = storage.set.mock.calls[0];
      expect(key).toBe('combatSummary');
      expect(savedCs).toBe(cs);
      expect(savedCs.creatures.find(c => c.name === 'Animated Rug of Smothering 1').currentHp).toBe(24);
      expect(savedCampaign).toBe(campaignName);
      expect(logPoster.addEntry).toHaveBeenCalledTimes(1);
      expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        characterName: 'TestCleric',
        targetName: 'Animated Rug of Smothering 1',
        delta: 24,
        currentHp: 24,
        maxHp: 21,
        isHealing: true,
        sourceName: 'TestCleric',
        note: 'Hand of Ultimate Mercy',
        timestamp: now,
        resurrection: true,
      });
      dateSpy.mockRestore();
    });

    it('skips the storage write when the npc target has no combatSummary', async () => {
      mockRuntime();
      mockRoll(8);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc', currentHp: 0 } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Returns to life with 8 HP');
      expect(storage.set).not.toHaveBeenCalled();
    });
  });

  describe('Condition curing', () => {
    it.each([
      {
        title: 'cures the default list and names them in the popup',
        setup: () => { mockRuntime({ maxHp: 112, conditions: ['Blinded', 'Poisoned', 'Frightened'] }); mockPlayerTarget(); },
        automation: {},
        target: 'DownedAlly',
        write: ['Frightened'],
        suffix: ' Also removed: Blinded, Poisoned.',
      },
      {
        title: 'honours a custom cureConditions list',
        setup: () => { mockRuntime({ maxHp: 112, conditions: ['Blinded', 'Deafened', 'Frightened'] }); mockPlayerTarget(); },
        automation: { cureConditions: ['Blinded'] },
        target: 'DownedAlly',
        write: ['Deafened', 'Frightened'],
        suffix: ' Also removed: Blinded.',
      },
      {
        title: 'matches case-insensitively',
        setup: () => { mockRuntime({ maxHp: 112, conditions: ['blinded', 'POISONED'] }); mockPlayerTarget(); },
        automation: {},
        target: 'DownedAlly',
        write: [],
        suffix: ' Also removed: Blinded, Poisoned.',
      },
      {
        title: 'an absent condition bucket writes nothing and adds no cure message',
        setup: () => { mockRuntime({ maxHp: 112, conditions: null }); mockPlayerTarget(); },
        automation: {},
        target: 'DownedAlly',
        write: null,
        suffix: '',
      },
      {
        title: 'cures monster buckets through the runtime store too',
        setup: () => { setupNpcTarget('Goblin', ['Blinded', 'Poisoned']); },
        automation: {},
        target: 'Goblin',
        write: [],
        suffix: ' Also removed: Blinded, Poisoned.',
      },
    ])('$title', async (tc) => {
      mockRoll(5);
      tc.setup();

      const result = await handle(makeAction(tc.automation), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        `TestCleric uses Hand of Ultimate Mercy on ${tc.target}. Returns to life with 5 HP. Expended 5 Focus Points.${tc.suffix}`,
      );
      if (tc.write === null) {
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
          tc.target, 'activeConditions', expect.anything(), campaignName);
      } else {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          tc.target, 'activeConditions', tc.write, campaignName);
      }
      // Curing never spawns extra audit rows: the commit stays a one-row lane.
      expect(logPoster.addEntry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Audit row sign-stamp', () => {
    it('stamps isHealing:false on a zero-delta commit (sign-stamp law, never literal true)', async () => {
      mockRuntime();
      diceRoller.rollExpression.mockReturnValue({ total: 0, rolls: [] });
      mockPlayerTarget();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const [, entry] = logPoster.addEntry.mock.calls[0];
      expect(entry.type).toBe('hp_change');
      expect(entry.delta).toBe(0);
      expect(entry.isHealing).toBe(false);
      expect(entry.resurrection).toBe(true);
    });
  });

  // Backlog 2026-11-14 NP improve (HoUoM in-sheet target chooser): with no
  // armed combatSummary target the sheet row opens the SHARED SecondaryTargetModal
  // lane (modal result consumed by useCharActionsAutomation's modalMap — host
  // wiring pinned in useCharActionsAutomation.houm-chooser.test.js) instead of
  // refusing and forcing an Initiative detour — filtered to board targets
  // whose BUCKET currentHitPoints is 0.
  describe('In-sheet corpse chooser (no armed target)', () => {
    it('opens the chooser filtered to bucket-0 board targets, excluding the caster, zero-spend', async () => {
      mockRuntimeByName(makeMixedBuckets());
      resolveTarget.mockResolvedValue(null);
      getCombatContext.mockResolvedValue(makeMixedBoard());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('handOfUltimateMercy');
      // Bucket-canonical filter: CorpseAlly (bucket 0 under a stale 45 row) and
      // DeadRug (bucket-less npc, row 0) are offered; LivingAlly (bucket 30
      // above a stale 12 row) is NOT; the caster is never offered.
      expect(result.payload.creatureTargets.map(t => t.name)).toEqual(['CorpseAlly', 'DeadRug']);
      expect(result.payload.creatureTargets[0]).toMatchObject({ name: 'CorpseAlly', type: 'player', currentHp: 0, maxHp: 90 });
      expect(result.payload.creatureTargets[1]).toMatchObject({ name: 'DeadRug', type: 'npc', currentHp: 0, maxHp: 21 });
      expect(result.payload.featureName).toBe('Hand of Ultimate Mercy');
      expect(result.payload.casterName).toBe('TestCleric');
      expect(result.payload.costAmount).toBe(5);
      expect(typeof result.payload.confirmResurrect).toBe('function');
      // Opening the chooser spends NOTHING.
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(logPoster.addEntry).not.toHaveBeenCalled();
    });

    it('refuses zero-spend with a board that has no bucket-0 targets instead of opening an empty chooser', async () => {
      mockRuntimeByName({
        hpByName: { TestCleric: 50, CorpseAlly: 45, LivingAlly: 30 },
        maxHpByName: { TestCleric: 112, CorpseAlly: 90, LivingAlly: 40 },
      });
      resolveTarget.mockResolvedValue(null);
      const board = makeMixedBoard();
      board.creatures.find(c => c.name === 'DeadRug').currentHp = 5;
      getCombatContext.mockResolvedValue(board);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual(expectedPopup('No target at 0 Hit Points.', makeAction().automation));
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(logPoster.addEntry).not.toHaveBeenCalled();
    });

    describe('confirmResurrect (picker commit)', () => {
      async function openChooser({ fp = 5, hpByName } = {}) {
        mockRuntimeByName({ fp, hpByName: hpByName || makeMixedBuckets().hpByName, maxHpByName: makeMixedBuckets().maxHpByName });
        resolveTarget.mockResolvedValue(null);
        getCombatContext.mockResolvedValue(makeMixedBoard());
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        return result.payload.confirmResurrect;
      }

      it('preserves the landed commit contract exactly: batch write, focus −5, one resurrection hp_change row, success popup', async () => {
        const confirmResurrect = await openChooser();
        mockRoll(31);
        // Commit resolves the row cache-first (SSE-adopted combatData cache).
        getCombatSummary.mockReturnValue(makeMixedBoard());

        const result = await confirmResurrect('CorpseAlly');

        expect(result.refusal).toBeUndefined();
        expect(result.popup).toEqual({
          type: 'automation_info',
          name: 'Hand of Ultimate Mercy',
          description: 'TestCleric uses Hand of Ultimate Mercy on CorpseAlly. Returns to life with 31 HP. Expended 5 Focus Points.',
          automation: expect.any(Object),
        });
        expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledTimes(1);
        expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith('CorpseAlly', {
          currentHitPoints: 31,
          deathSaves: [false, false, false],
          deathFailures: [false, false, false],
          isDead: 0,
        }, campaignName);
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'focusPoints', 0, campaignName);
        expect(logPoster.addEntry).toHaveBeenCalledTimes(1);
        const [, entry] = logPoster.addEntry.mock.calls[0];
        expect(entry).toEqual({
          type: 'hp_change',
          characterName: 'TestCleric',
          targetName: 'CorpseAlly',
          delta: 31,
          currentHp: 31,
          maxHp: 90,
          isHealing: true,
          sourceName: 'TestCleric',
          note: 'Hand of Ultimate Mercy',
          timestamp: expect.any(Number),
          resurrection: true,
        });
      });

      it('refuses a corpse revived mid-dwell with an inline note and zero spend', async () => {
        const confirmResurrect = await openChooser();
        getCombatSummary.mockReturnValue(makeMixedBoard());
        // Mid-dwell echo heals the corpse back to life before the commit click.
        useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
          if (key === 'focusPoints') return 5;
          if (key === 'currentHitPoints') return name === 'CorpseAlly' ? 45 : 30;
          return null;
        });

        const result = await confirmResurrect('CorpseAlly');

        expect(result.refusal).toBe('CorpseAlly is not at 0 Hit Points.');
        expect(result.popup).toBeUndefined();
        expect(diceRoller.rollExpression).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
        expect(logPoster.addEntry).not.toHaveBeenCalled();
      });

      it('refuses zero-spend when the focus pool drained mid-dwell', async () => {
        const confirmResurrect = await openChooser();
        getCombatSummary.mockReturnValue(makeMixedBoard());
        // Re-read at commit sees the drained pool (gateMonkHealCommit precedent).
        useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
          if (key === 'focusPoints') return 2;
          if (key === 'currentHitPoints') return name === 'CorpseAlly' ? 0 : 30;
          return null;
        });

        const result = await confirmResurrect('CorpseAlly');

        expect(result.refusal).toBe('Not enough Focus Points. Need 5, have 2.');
        expect(diceRoller.rollExpression).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logPoster.addEntry).not.toHaveBeenCalled();
      });

      it('refuses a name that left the combat board mid-dwell with zero spend', async () => {
        const confirmResurrect = await openChooser();
        getCombatSummary.mockReturnValue({ creatures: [] });
        getCombatContext.mockResolvedValue({ creatures: [] });

        const result = await confirmResurrect('VanishedAlly');

        expect(result.refusal).toBe('VanishedAlly is no longer on the combat board. No Focus Points spent.');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logPoster.addEntry).not.toHaveBeenCalled();
      });
    });
  });

  // Backlog 2026-11-14: thin-echo evict honesty for the audit frame. A thin
  // full-store POST echo-REPLACEs the mirror and EVICTS its hitPoints, and the
  // select-baked combat-summary rows can sit at a stale 1/1 (App.jsx re-seed
  // bakes `|| 1`) — the old bucket→row-only chain then silently framed
  // maxHp:1 on a real 112-max resurrection. The commit must fall through to the
  // loaded character data (computedStats.hitPoints — the exact value
  // seedCharacterRuntimeData seeds the bucket hitPoints from), and only reach
  // the combat-summary row (loudly) when BOTH live sources are gone.
  describe('Audit maxHp source (thin-echo evict law)', () => {
    // Caster tab state per AC1's rig: bucket has NO hitPoints (evicted), the cs
    // row is the stale select-baked 1/1, the loaded character data holds the
    // true 112.
    const EVICTED_BUCKETS = { hpByName: { TestCleric: 50, CorpseAlly: 0 }, maxHpByName: {} };
    const STALE_ROW_BOARD = {
      creatures: [
        { name: 'TestCleric', type: 'player', currentHp: 50, maxHp: 112 },
        { name: 'CorpseAlly', type: 'player', currentHp: 1, maxHp: 1 },
      ],
    };
    const LOADED_CHARACTERS = [{ name: 'CorpseAlly', computedStats: { hitPoints: 112 } }];

    it('armed-direct lane: frames the true char-file max (112), not the stale row (1), on a thinned bucket', async () => {
      mockRuntimeByName(EVICTED_BUCKETS);
      mockRoll(31);
      const cs = STALE_ROW_BOARD;
      resolveTarget.mockResolvedValue({ target: cs.creatures[1], cs });

      await handle(makeAction(), makePlayerStats(), campaignName, null, LOADED_CHARACTERS);

      const [, entry] = logPoster.addEntry.mock.calls[0];
      expect(entry.maxHp).toBe(112);
    });

    it('picker commit lane: forwards the character data so the frame survives (112, not the stale 1)', async () => {
      mockRuntimeByName(EVICTED_BUCKETS);
      resolveTarget.mockResolvedValue(null);
      getCombatContext.mockResolvedValue(STALE_ROW_BOARD);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null, LOADED_CHARACTERS);
      expect(result.modalName).toBe('handOfUltimateMercy');
      mockRoll(31);
      getCombatSummary.mockReturnValue(STALE_ROW_BOARD);

      const committed = await result.payload.confirmResurrect('CorpseAlly');

      expect(committed.refusal).toBeUndefined();
      const [, entry] = logPoster.addEntry.mock.calls[0];
      expect(entry.maxHp).toBe(112);
    });

    it('bucket live max still beats the character data when the mirror holds hitPoints', async () => {
      mockRuntimeByName({
        hpByName: { TestCleric: 50, CorpseAlly: 0 },
        maxHpByName: { TestCleric: 112, CorpseAlly: 90 },
      });
      mockRoll(12);
      resolveTarget.mockResolvedValue({ target: STALE_ROW_BOARD.creatures[1], cs: STALE_ROW_BOARD });

      await handle(makeAction(), makePlayerStats(), campaignName, null, LOADED_CHARACTERS);

      const [, entry] = logPoster.addEntry.mock.calls[0];
      expect(entry.maxHp).toBe(90);
    });

    it('last-resort combat-summary frame is LOUD (console.error), never a silent stale fallback', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRuntimeByName(EVICTED_BUCKETS);
      mockRoll(12);
      // No character data for the target at all — only the stale row remains.
      resolveTarget.mockResolvedValue({ target: STALE_ROW_BOARD.creatures[1], cs: STALE_ROW_BOARD });

      await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      const [, entry] = logPoster.addEntry.mock.calls[0];
      expect(entry.maxHp).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CorpseAlly has no bucket hitPoints'));
      errorSpy.mockRestore();
    });
  });
});

// ── Death→life crossing `unconscious` strip (improve 2026-11-15, QY backlog) ──
// Handler wiring only — the strip predicate itself is service-tested in
// src/services/shared/reviveTargetHp.test.js. Here: the strip folds into the
// ONE merged resurrection batch (never a second victim POST), the later cure
// leg reads the stripped mirror so nothing re-echoes `unconscious`, and
// monster crossings get their own only-when-shed bucket write.
describe('handOfUltimateMercyHandler — revive-crossing condition strip', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Stateful mirror: getRuntimeValue reads the store, setRuntimeBatch/
  // setRuntimeValue write it — so the LATER cureConditionsFor read observes
  // the stripped array exactly like a live client mirror does.
  function mockRuntimeStateful({ fp = 10, conditions = [] } = {}) {
    const store = {
      TestCleric: { focusPoints: fp },
      DownedAlly: { currentHitPoints: 0, hitPoints: 112, activeConditions: [...conditions] },
    };
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => store[name]?.[key] ?? null);
    useRuntimeState.setRuntimeBatch.mockImplementation((name, props) => {
      store[name] = { ...(store[name] || {}), ...props };
    });
    useRuntimeState.setRuntimeValue.mockImplementation((name, key, value) => {
      store[name] = { ...(store[name] || {}), [key]: value };
    });
    return store;
  }

  it('corpse with unconscious+poisoned+prone: batch sheds unconscious (prone rides), cure leg reads the stripped mirror, nothing ever re-echoes unconscious', async () => {
    const store = mockRuntimeStateful({ conditions: ['unconscious', 'poisoned', 'prone'] });
    mockRoll(12);
    mockPlayerTarget();

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    // ONE merged batch carries the stripped snapshot (unconscious gone, prone
    // and the still-cureable poisoned ride through) — never a second write.
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeBatch).toHaveBeenCalledWith('DownedAlly', {
      currentHitPoints: 12,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
      isDead: 0,
      activeConditions: ['poisoned', 'prone'],
    }, campaignName);
    // …the cure leg then writes the CURED array…
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'DownedAlly', 'activeConditions', ['prone'], campaignName);
    // …and NOTHING ever wrote an array containing unconscious: final mirror truth:
    expect(store.DownedAlly.activeConditions).toEqual(['prone']);
    const arrays = [
      ...useRuntimeState.setRuntimeBatch.mock.calls.map(([, props]) => props.activeConditions),
      ...useRuntimeState.setRuntimeValue.mock.calls
        .filter(([, key]) => key === 'activeConditions').map(([, , value]) => value),
    ].filter(Array.isArray);
    expect(arrays.every(a => !a.some(c => String(c).toLowerCase() === 'unconscious'))).toBe(true);
  });

  it('monster corpse crossing: summary row persisted, sheds unconscious via its own bucket write', async () => {
    mockRuntime({ conditions: ['unconscious', 'prone'] });
    mockRoll(12);
    const cs = { creatures: [{ name: 'Goblin', type: 'npc', currentHp: 0 }] };
    resolveTarget.mockResolvedValue({ target: cs.creatures[0], cs });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(useRuntimeState.setRuntimeBatch).not.toHaveBeenCalled();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin', 'activeConditions', ['prone'], campaignName);
  });
});
