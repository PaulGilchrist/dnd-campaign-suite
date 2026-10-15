// @maintained-by-ai
// Lane: save-prompt emission config + saveResults processing (condition writes,
// dedupe, expiration, mixed results) for resolveMassFear.
// Sibling lanes: massFearHandler.test.js owns handle() + target selection;
// massFearHandler.summary.test.js owns popup summary text + buildSaveDc/option
// defaults (its 'handles single creature (just the primary target)' pins the
// defaulted createSaveListener config). Fully mocked, deterministic, turn-based.
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

function resolve(option) {
  return resolveMassFear({
    campaignName,
    casterName: 'TestCaster',
    primaryTargetName: 'Goblin',
    option: { saveDc: 14, range: '20_ft', ...option },
    playerStats: makePlayerStats(),
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('massFearHandler.resolveMassFear - save prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(14);
    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      return { promptId: 'mass-fear-prompt', promise: Promise.resolve({ success: true }) };
    });
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    expirations.addExpiration.mockReturnValue(undefined);
  });

  it('creates save listeners for each target', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    rangeCheck.isWithinRange.mockResolvedValue(true);

    await resolve({ saveType: 'WIS' });

    expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
    expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(1, campaignName, {
      targetName: 'Goblin', saveType: 'WIS', saveDc: 14, dcSuccess: 'none', condition: 'frightened',
    });
    expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(2, campaignName, {
      targetName: 'Orc', saveType: 'WIS', saveDc: 14, dcSuccess: 'none', condition: 'frightened',
    });
  });

  // Option → save-listener config passthrough. Defaulted config (WIS/frightened)
  // is pinned above and by summary lane's single-target exact config pin.
  it.each([
    ['saveType', { saveType: 'CON' }, 'CON', 'frightened'],
    ['condition', { condition: 'charmed' }, 'WIS', 'charmed'],
  ])('passes custom %s through to save listener config', async (_field, override, saveType, condition) => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolve(override);

    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin', saveType, saveDc: 14, dcSuccess: 'none', condition,
    });
  });

  it('logs ability_use for each target with promptId', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    rangeCheck.isWithinRange.mockResolvedValue(true);

    await resolve({ saveType: 'WIS' });

    // 2 target log entries + 1 summary log entry = 3 total
    expect(logService.addEntry).toHaveBeenCalledTimes(3);
    expect(logService.addEntry).toHaveBeenNthCalledWith(1, campaignName, {
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: 'Mass Fear',
      description: 'TestCaster uses Mass Fear! Goblin must make a WIS save (DC 14) or become Frightened.',
      promptId: 'mass-fear-prompt',
    });
    expect(logService.addEntry).toHaveBeenNthCalledWith(2, campaignName, {
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: 'Mass Fear',
      description: 'TestCaster uses Mass Fear! Orc must make a WIS save (DC 14) or become Frightened.',
      promptId: 'mass-fear-prompt',
    });
  });

  it('uses custom ability name in log entry', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolve({ saveType: 'WIS', name: "Tasha's Hideous Laughter" });

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: "Tasha's Hideous Laughter",
      description: 'TestCaster uses Mass Fear! Goblin must make a WIS save (DC 14) or become Frightened.',
      promptId: 'mass-fear-prompt',
    });
  });
});

describe('massFearHandler.resolveMassFear - save results (failed saves)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(14);
    // Default: all saves fail
    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      return { promptId: 'mass-fear-prompt', promise: Promise.resolve({ success: false }) };
    });
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    expirations.addExpiration.mockReturnValue(undefined);
  });

  it('applies frightened condition when save fails', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolve({ saveType: 'WIS' });

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin', 'activeConditions', ['frightened'], campaignName,
    );
  });

  it('appends condition to existing activeConditions', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    runtimeState.getRuntimeValue.mockReturnValueOnce(['prone', 'blinded']);

    await resolve({ saveType: 'WIS' });

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin', 'activeConditions', ['prone', 'blinded', 'frightened'], campaignName,
    );
  });

  it('removes duplicate condition if already present', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    runtimeState.getRuntimeValue.mockReturnValueOnce(['frightened', 'blinded']);

    await resolve({ saveType: 'WIS' });

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin', 'activeConditions', ['blinded', 'frightened'], campaignName,
    );
  });

  it('adds expiration on failed save', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolve({ saveType: 'WIS' });

    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'Goblin', effects: [{ type: 'condition', condition: 'frightened' }], campaignName });
  });

  it('handles mixed results using per-call mocks', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
      { name: 'Skeleton', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    rangeCheck.isWithinRange.mockResolvedValue(true);

    let callIndex = 0;
    const results = [false, true, false]; // Goblin fails, Orc succeeds, Skeleton fails

    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      const idx = callIndex++;
      return {
        promptId: `prompt-${idx}`,
        promise: Promise.resolve({ success: results[idx] }),
      };
    });

    await resolve({ saveType: 'WIS' });

    // Goblin and Skeleton fail: frightened applied + expiration, exactly once each
    const conditionWrites = runtimeState.setRuntimeValue.mock.calls.filter(
      call => call[1] === 'activeConditions',
    );
    expect(conditionWrites.map(call => call[0])).toEqual(['Goblin', 'Skeleton']);
    expect(conditionWrites.every(call => call[2].join() === 'frightened')).toBe(true);

    // Orc saved: no condition write, no expiration
    expect(expirations.addExpiration.mock.calls.map(call => call[0].targetName)).toEqual(['Goblin', 'Skeleton']);
  });
});
