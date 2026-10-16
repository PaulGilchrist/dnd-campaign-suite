// @maintained-by-ai
// Lane: target selection (targetNames inclusion/exclusion, caster exclusion,
// no-creature / caster-only popups) and range parsing + default range 10 for
// resolveMassFear. The handle() export was deleted from coverage as dead — it
// has zero production importers (mass_fear routes via attackRiderHandler:728
// → resolveMassFear, pinned in attackRiderHandler.test.js; stalkersFlurry.js
// also calls resolveMassFear directly).
// Sibling lanes: massFearHandler.summary.test.js owns popup summary text +
// buildSaveDc/saveAbility/condition defaults + default ability name "Mass Fear";
// massFearHandler.saveResults.test.js owns save-listener config + saveResults
// processing (full-string default target-log, condition writes, custom-name log).
// Fully mocked, deterministic, turn-based.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
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

// ── Imports ────────────────────────────────────────────────────

import { resolveMassFear } from './massFearHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as logService from '../../../ui/logService.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    proficiency: 3,
    abilities: [
      { name: 'INT', modifier: 4 },
      { name: 'WIS', modifier: 2 },
    ],
    ...overrides,
  };
}

function makeCombatSummary(creatures) {
  return { creatures, players: [], placedItems: [] };
}

// ── Tests ──────────────────────────────────────────────────────

describe('massFearHandler.resolveMassFear - no creatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
  });

  it('returns popup when combat context is null', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 13 },
          playerStats: makePlayerStats(),
      });

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('No creatures in combat.');
  });

  it('returns popup when creatures array is empty', async () => {
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([]));

    const result = await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 13 },
          playerStats: makePlayerStats(),
      });

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No creatures in combat.');
  });

  it('uses custom ability name when provided', async () => {
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([]));

    const result = await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 13, name: "Tasha's Hideous Laughter" },
          playerStats: makePlayerStats(),
      });

    expect(result.payload.name).toBe("Tasha's Hideous Laughter");
  });
});

describe('massFearHandler.resolveMassFear - target selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
    // Return a resolved promise so the save loop completes immediately
    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      return { promptId: 'mass-fear-prompt', promise: Promise.resolve({ success: true }) };
    });
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    expirations.addExpiration.mockReturnValue(undefined);
  });

  it('excludes the caster from targets', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 13, saveType: 'WIS', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    const calls = savePrompt.createSaveListener.mock.calls;
    const targetNames = calls.map(c => c[1].targetName);
    expect(targetNames).toContain('Goblin');
    expect(targetNames).not.toContain('TestCaster');
  });

  it('includes the primary target even without range check', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    rangeCheck.isWithinRange.mockResolvedValue(false);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 13, saveType: 'WIS', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    const calls = savePrompt.createSaveListener.mock.calls;
    const targetNames = calls.map(c => c[1].targetName);
    expect(targetNames).toContain('Goblin');
  });

  it('includes creatures in range of primary target', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
      { name: 'Skeleton', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    rangeCheck.isWithinRange.mockImplementation(async (from, to) => {
      if (from === 'Goblin' && to === 'Orc') return true;
      if (from === 'Goblin' && to === 'Skeleton') return false;
      return true;
    });

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 13, saveType: 'WIS', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    const calls = savePrompt.createSaveListener.mock.calls;
    const targetNames = calls.map(c => c[1].targetName);
    expect(targetNames).toContain('Goblin');
    expect(targetNames).toContain('Orc');
    expect(targetNames).not.toContain('Skeleton');
  });

  it('includes all non-caster creatures when no primary target', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: null,
          option: { saveDc: 13, saveType: 'WIS', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    const calls = savePrompt.createSaveListener.mock.calls;
    const targetNames = calls.map(c => c[1].targetName);
    expect(targetNames).toContain('Goblin');
    expect(targetNames).toContain('Orc');
    expect(targetNames).not.toContain('TestCaster');
  });

  it('includes all non-caster creatures when primary target not found in combat', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'NonExistent',
          option: { saveDc: 13, saveType: 'WIS', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    const calls = savePrompt.createSaveListener.mock.calls;
    const targetNames = calls.map(c => c[1].targetName);
    expect(targetNames).toContain('Goblin');
    expect(targetNames).toContain('Orc');
    expect(targetNames).not.toContain('TestCaster');
  });

  it('returns popup when only the caster exists (no targets)', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    // With only the caster, targets = [] (caster excluded)
    const result = await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: null,
          option: { saveDc: 13, saveType: 'WIS' },
          playerStats: makePlayerStats(),
      });

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('No targets in range.');
  });

  it('parses range from string format "30_ft"', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    const mockFn = vi.fn().mockResolvedValue(true);
    rangeCheck.isWithinRange.mockImplementation(mockFn);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 13, saveType: 'WIS', range: '30_ft' },
          playerStats: makePlayerStats(),
      });

    expect(mockFn).toHaveBeenCalledWith('Goblin', 'Orc', 30);
  });

  it('defaults range to 10 when not specified', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    const mockFn = vi.fn().mockResolvedValue(true);
    rangeCheck.isWithinRange.mockImplementation(mockFn);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 13, saveType: 'WIS' },
          playerStats: makePlayerStats(),
      });

    expect(mockFn).toHaveBeenCalledWith('Goblin', 'Orc', 10);
  });
});
