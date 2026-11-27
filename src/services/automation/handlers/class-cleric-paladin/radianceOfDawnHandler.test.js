// @maintained-by-ai 2026-11-27
// Deterministic contract suite for radianceOfDawnHandler: Channel Divinity charge
// gate (zero-spend census), full-shape modal payload, level-resolved damage,
// ordered NPC save/damage/log commit censuses, player save-prompt registry + SSE
// POST bodies, persistence, and popup HTML. Dice, damage application, storage, and
// network are mocked; the real pure helpers (buildSaveDc, computeDamageAfterSave,
// normalizeSaveType) stay live. Date.now and Math.random are frozen per test. The
// charge-resolution fallback chain is owned by healingPoolHandler's
// resolveChannelDivinityCharges contract tests — this lane pins only the wiring.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let _pendingSaveRegistry = {};

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/auras/pendingSaveRegistry.js', () => ({
  registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(),
  getCombatSummary: vi.fn(),
}));

// computeDamageAfterSave + normalizeSaveType are pure — use the REAL ones;
// only the side-effecting applyDamageToTarget is mocked.
vi.mock('../../../rules/combat/applyDamage.js', async (importOriginal) => ({
  ...(await importOriginal()),
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  hasIgnoreResistance: vi.fn(),
}));

vi.mock('../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, confirmRadianceOfDawn } from './radianceOfDawnHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as pendingSaveRegistry from '../../../combat/auras/pendingSaveRegistry.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as invisibilityService from '../../../rules/features/invisibilityService.js';
import storage from '../../../ui/storage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const FROZEN_NOW = 1700000000000;

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 5,
    proficiency: 3,
    abilities: [
      { name: 'Wisdom', bonus: 2 },
      { name: 'Constitution', bonus: 2 },
    ],
    class: { class_levels: [undefined, undefined, { channel_divinity: 2 }] },
    ...overrides,
  };
}

// Fixture mirrors the real subclasses.json row: type radiance_of_dawn,
// emanation_30ft, "2d10 + cleric level" scaled up to 6d10 at high level.
function makeAction(automation = {}) {
  return {
    name: 'Radiance of the Dawn',
    automation: {
      type: 'radiance_of_dawn',
      saveDc: 'ability',
      saveAbility: 'WIS',
      saveType: 'CON',
      damage: '6d10 + cleric level',
      damageType: 'Radiant',
      shape: 'emanation_30ft',
      ...automation,
    },
  };
}

function makeCreature(name, type = 'npc', overrides = {}) {
  return {
    name,
    type,
    currentHp: 30,
    maxHp: 60,
    saveBonuses: { con: 0 },
    ...overrides,
  };
}

function seedSummary(creatures) {
  const summary = { creatures };
  combatData.loadCombatSummary.mockResolvedValue(summary);
  combatData.getCombatSummary.mockReturnValue(summary);
  return summary;
}

let dispatchSpy;

beforeEach(() => {
  vi.resetAllMocks();
  _pendingSaveRegistry = {};
  // Rejecting-mock survivors: resetAllMocks strips factory implementations,
  // so every default behavior is re-installed here.
  useRuntimeState.setRuntimeValue.mockResolvedValue();
  logService.addEntry.mockResolvedValue();
  combatData.loadCombatSummary.mockResolvedValue(null);
  combatData.getCombatSummary.mockReturnValue(null);
  pendingSaveRegistry.registerPendingSavePrompt.mockImplementation(
    (id, data) => { _pendingSaveRegistry[id] = data; },
  );
  applyDamage.applyDamageToTarget.mockImplementation(
    (cs, name, dmg) => ({ finalDamage: dmg, newHp: 30 - dmg }),
  );
  automationService.hasIgnoreResistance.mockReturnValue(false);
  diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
  vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
  // Math.random raw roll = floor(v*20)+1: 0.01→1, 0.55→12, 0.99→20.
  vi.spyOn(Math, 'random').mockReturnValue(0.55);
  dispatchSpy = vi.spyOn(window, 'dispatchEvent');
  // SSE save-prompt POSTs go through fetch — stub it so no real network.
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── handle() ───────────────────────────────────────────────────

describe('radianceOfDawnHandler.handle', () => {
  it('refuses with the exact no-charges popup and a zero-spend census when stored charges are 0', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    const action = makeAction();

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Radiance of the Dawn',
        description: 'No Channel Divinity charges remaining.',
        automation: action.automation,
      },
    });
    // Zero-spend census: no charge write, no combat read, no log, no roll.
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
    expect(combatData.loadCombatSummary.mock.calls).toEqual([]);
    expect(logService.addEntry.mock.calls).toEqual([]);
    expect(diceRoller.rollExpression.mock.calls).toEqual([]);
  });

  it('consumes exactly one charge and opens the modal with the full payload shape', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    const cs = seedSummary([makeCreature('TestCleric', 'player'), makeCreature('Goblin')]);
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName, null);

    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestCleric', 'channelDivinityCharges', 1, campaignName],
    ]);
    expect(result).toEqual({
      type: 'modal',
      modalName: 'radianceOfDawn',
      payload: {
        action,
        playerStats: ps,
        campaignName,
        // Self is excluded; the surviving creature object is passed through intact.
        creatureTargets: [cs.creatures[1]],
        saveDc: 13, // 8 + WIS 2 + prof 3 (real buildSaveDc)
        featureName: 'Radiance of the Dawn',
        saveType: 'CON',
        rangeFeet: 30, // emanation_30ft
        damageExpression: '6d10 + cleric level',
        damageType: 'Radiant',
      },
    });
  });

  it.each([
    {
      title: 'coerces a missing saveDc to the computed ability DC and defaults CON/empty-damage/Radiant/10ft',
      stats: {},
      automation: { saveDc: undefined, saveAbility: undefined, saveType: undefined, damage: undefined, damageType: undefined, shape: 'burst_20ft' },
      expect: { saveDc: 13, saveType: 'CON', damageExpression: '', damageType: 'Radiant', rangeFeet: 10 },
    },
    {
      // The CON fallback would give 8+2+3=13 here; 10 proves saveAbility was read.
      title: 'resolves the DC from saveAbility WIS, never the CON fallback',
      stats: { abilities: [{ name: 'Wisdom', bonus: -1 }, { name: 'Constitution', bonus: 2 }] },
      automation: { saveDc: undefined },
      expect: { saveDc: 10 },
    },
  ])('modal payload: $title', async ({ stats, automation, expect: exp }) => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    seedSummary([makeCreature('Goblin')]);

    const result = await handle(makeAction(automation), makePlayerStats(stats), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.payload).toMatchObject(exp);
  });

  it('opens the modal with empty creatureTargets when no combat is active', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    combatData.loadCombatSummary.mockResolvedValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.payload.creatureTargets).toEqual([]);
    expect(combatData.loadCombatSummary).toHaveBeenCalledTimes(1);
  });
});

// ── confirmRadianceOfDawn() ────────────────────────────────────

describe('radianceOfDawnHandler.confirmRadianceOfDawn', () => {
  it('refuses with the exact roll-failure popup and a zero-spend census', async () => {
    diceRoller.rollExpression.mockReturnValue(undefined);
    seedSummary([makeCreature('Goblin')]);
    const action = makeAction();

    const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Radiance of the Dawn',
        description: 'Radiance of the Dawn: Failed to roll damage.',
        automation: action.automation,
      },
    });
    expect(combatData.getCombatSummary.mock.calls).toEqual([]);
    expect(applyDamage.applyDamageToTarget.mock.calls).toEqual([]);
    expect(logService.addEntry.mock.calls).toEqual([]);
    expect(pendingSaveRegistry.registerPendingSavePrompt.mock.calls).toEqual([]);
    expect(fetch.mock.calls).toEqual([]);
    expect(storage.set.mock.calls).toEqual([]);
    expect(dispatchSpy.mock.calls).toEqual([]);
  });

  it('refuses with the exact no-combat popup and commits nothing', async () => {
    combatData.getCombatSummary.mockReturnValue(null);
    const action = makeAction();

    const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Radiance of the Dawn',
        description: 'Radiance of the Dawn: No active combat.',
        automation: action.automation,
      },
    });
    expect(applyDamage.applyDamageToTarget.mock.calls).toEqual([]);
    expect(logService.addEntry.mock.calls).toEqual([]);
    expect(storage.set.mock.calls).toEqual([]);
    expect(dispatchSpy.mock.calls).toEqual([]);
  });

  it('rolls the level-resolved expression ONCE, damages every failing NPC in order, and commits the full contract', async () => {
    Math.random.mockReturnValue(0.01); // every NPC saves raw 1
    const cs = seedSummary([makeCreature('Goblin'), makeCreature('Orc')]);
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await confirmRadianceOfDawn(action, ps, campaignName, ['Goblin', 'Orc']);

    // "cleric level" resolved to 5, whitespace stripped; rolled exactly once.
    expect(diceRoller.rollExpression.mock.calls).toEqual([['6d10+5']]);
    // Ordered per-target damage commits (real computeDamageAfterSave: failed
    // save + dcSuccess 'none' → full raw damage).
    expect(applyDamage.applyDamageToTarget.mock.calls.map(([, name, dmg]) => [name, dmg])).toEqual([
      ['Goblin', 20],
      ['Orc', 20],
    ]);
    // Invisibility ends once damage lands.
    expect(invisibilityService.endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestCleric', campaignName);
    // One full-shape save-damage log row per NPC, in target order.
    expect(logService.addEntry.mock.calls).toEqual([
      [campaignName, {
        type: 'roll',
        characterName: 'TestCleric',
        rollType: 'save-damage',
        name: 'Radiance of the Dawn',
        formula: '6d10 + cleric level',
        rolls: [10, 10],
        total: 20,
        modifier: 0,
        damageType: 'Radiant',
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 13,
        dcSuccess: 'none',
        saveResult: 'failure',
        saveRoll: 1,
        saveBonus: 0,
        saveRawRolls: [1],
        finalDamage: 20,
        note: 'combined_save_damage_roll',
        timestamp: FROZEN_NOW,
      }],
      [campaignName, expect.objectContaining({ targetName: 'Orc', rollType: 'save-damage' })],
    ]);
    // Persisted summary + one board notification.
    expect(storage.set.mock.calls).toEqual([['combatSummary', cs, campaignName]]);
    expect(dispatchSpy.mock.calls.map(([e]) => e.type)).toEqual(['combat-summary-updated']);

    // Full-shape popup: activation twin carries automationType (refusals do not).
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Radiance of the Dawn',
        automationType: 'radiance_of_dawn',
        automation: action.automation,
        results: [
          { targetName: 'Goblin', success: false, roll: 1, total: 1, saveBonus: 0, damage: 20, newHp: 10 },
          { targetName: 'Orc', success: false, roll: 1, total: 1, saveBonus: 0, damage: 20, newHp: 10 },
        ],
        description: [
          '<b>Radiance of the Dawn used!</b><br/><br/>',
          '<b>Save DC: 13</b> (CON)<br/><br/>',
          '<b>Rolls:</b> 6d10 + cleric level = 20 Radiant damage<br/><br/>',
          '<b>Goblin</b>: <span style="color: #f44336;">Failed</span> (1+0=1 vs DC 13) — full damage: 20<br/>',
          '<b>Orc</b>: <span style="color: #f44336;">Failed</span> (1+0=1 vs DC 13) — full damage: 20<br/>',
        ].join(''),
      },
    });
  });

  it('applies zero damage on a successful NPC save and never breaks invisibility', async () => {
    Math.random.mockReturnValue(0.99); // raw 20 beats DC 13
    seedSummary([makeCreature('Goblin', 'npc', { saveBonuses: { con: 5 } })]);

    const result = await confirmRadianceOfDawn(makeAction(), makePlayerStats(), campaignName, ['Goblin']);

    // Real computeDamageAfterSave(raw, success, 'none') → 0.
    expect(applyDamage.applyDamageToTarget.mock.calls).toEqual([
      [expect.any(Object), 'Goblin', 0, ['Radiant'], {
        campaignName, characters: expect.any(Array), ignoreResistance: false,
        attackerName: 'TestCleric', suppressHpLog: true,
      }],
    ]);
    expect(invisibilityService.endInvisibilityOnHostileAction.mock.calls).toEqual([]);
    expect(result.payload.results).toEqual([
      { targetName: 'Goblin', success: true, roll: 20, total: 25, saveBonus: 5, damage: 0, newHp: 30 },
    ]);
    expect(result.payload.description).toContain('(20+5=25 vs DC 13) — no damage: 0<br/>');
  });

  it('passes the ignoreResistance verdict through to damage application', async () => {
    Math.random.mockReturnValue(0.01);
    seedSummary([makeCreature('Goblin')]);
    automationService.hasIgnoreResistance.mockReturnValue(true);
    const ps = makePlayerStats();

    await confirmRadianceOfDawn(makeAction(), ps, campaignName, ['Goblin']);

    expect(automationService.hasIgnoreResistance.mock.calls).toEqual([[ps, 'Radiant']]);
    expect(applyDamage.applyDamageToTarget.mock.calls[0][4]).toMatchObject({ ignoreResistance: true });
  });

  it.each([
    { level: undefined, damage: '2d10 + cleric level', rolled: '2d10+1' },
    { level: 5, damage: '2d10', rolled: '2d10' },
  ])('resolves the damage expression: level $level, $damage → $rolled', async ({ level, damage, rolled }) => {
    seedSummary([makeCreature('Goblin')]);

    await confirmRadianceOfDawn(makeAction({ damage }), makePlayerStats({ level }), campaignName, ['Goblin']);

    expect(diceRoller.rollExpression.mock.calls).toEqual([[rolled]]);
  });

  it('pinned divergence: confirm builds the DC from raw auto, so a missing saveDc falls to 10 (buildSaveDc error path), not handle\'s 13', async () => {
    // handle() coerces `auto.saveDc || 'ability'` (radianceOfDawnHandler.js:55)
    // but confirm (line 250) passes auto raw — with the real subclasses.json row
    // (no saveDc field) the modal shows DC 13 while saves resolve vs DC 10.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Math.random.mockReturnValue(0.55); // raw 12 + 0 ≥ DC 10 → success
    seedSummary([makeCreature('Goblin')]);

    const result = await confirmRadianceOfDawn(makeAction({ saveDc: undefined }), makePlayerStats(), campaignName, ['Goblin']);

    expect(result.payload.results[0]).toMatchObject({ success: true, roll: 12, total: 12 });
    expect(result.payload.description).toContain('vs DC 10');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('no saveDc defined'));
  });

  it.each([1, 2])('registers the save prompt, POSTs the SSE body, and logs save-prompt rows for %i player target(s)', async (count) => {
    const names = Array.from({ length: count }, (_, i) => `player-${i + 1}`);
    seedSummary(names.map((n) => makeCreature(n, 'player')));

    const result = await confirmRadianceOfDawn(makeAction(), makePlayerStats(), campaignName, names);

    for (const [i, targetName] of names.entries()) {
      const promptId = `Radiance_of_the_Dawn_${targetName}_${FROZEN_NOW}`;
      // Registry holds the full deferred-damage context.
      expect(_pendingSaveRegistry[promptId]).toEqual({
        targetName,
        rawDamage: 20,
        saveDc: 13,
        saveType: 'CON',
        dcSuccess: 'none',
        damageType: 'Radiant',
        attackerName: 'TestCleric',
        name: 'Radiance of the Dawn',
        formula: '6d10 + cleric level',
        modifier: 0,
        rolls: [10, 10],
        campaignName,
        setPopupHtml: expect.any(Function),
      });
      // SSE POST carries the same contract under the target's runtime key.
      expect(fetch.mock.calls[i]).toEqual([
        `/api/campaigns/TestCampaign/savePrompt-${targetName}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            value: {
              promptId,
              targetName,
              saveType: 'CON',
              saveDc: 13,
              dcSuccess: 'none',
              damageFormula: '6d10 + cleric level',
              damageType: 'Radiant',
              sourceName: 'Radiance of the Dawn',
              rawDamage: 20,
            },
          }),
        },
      ]);
      expect(logService.addEntry.mock.calls[i]).toEqual([campaignName, expect.objectContaining({
        rollType: 'save-prompt',
        targetName,
        saveType: 'CON',
        saveDc: 13,
        timestamp: FROZEN_NOW,
      })]);
    }
    expect(logService.addEntry).toHaveBeenCalledTimes(count);
    // Players roll for themselves: no server-side damage, no invisibility break.
    expect(applyDamage.applyDamageToTarget.mock.calls).toEqual([]);
    expect(invisibilityService.endInvisibilityOnHostileAction.mock.calls).toEqual([]);
    expect(result.payload.results).toEqual([]);
    expect(result.payload.description).toContain(
      `<b>${count} player${count !== 1 ? 's' : ''} rolling saves...</b>`,
    );
  });

  it('silently skips a target missing from the combat summary but still persists the board', async () => {
    const cs = seedSummary([makeCreature('Goblin')]);

    const result = await confirmRadianceOfDawn(makeAction(), makePlayerStats(), campaignName, ['UnknownCreature']);

    expect(result.payload.results).toEqual([]);
    expect(applyDamage.applyDamageToTarget.mock.calls).toEqual([]);
    expect(logService.addEntry.mock.calls).toEqual([]);
    expect(pendingSaveRegistry.registerPendingSavePrompt.mock.calls).toEqual([]);
    expect(storage.set.mock.calls).toEqual([['combatSummary', cs, campaignName]]);
    expect(dispatchSpy.mock.calls.map(([e]) => e.type)).toEqual(['combat-summary-updated']);
  });
});
