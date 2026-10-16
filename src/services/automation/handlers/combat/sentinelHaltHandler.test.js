// @maintained-by-ai
// Pure handler contract: deterministic output from mocked damageUtils/logService/runtimeStore deps.
// Pins FT-101 Sentinel(Halt) lane registered in automation/index.js HANDLER_MAP (sentinel).
// te write is pinned as setRuntimeValue delegation with the exact speed_zero effect object;
// targetEffectDefinitions.test.js owns registry internals.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './sentinelHaltHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestFighter',
    level: 5,
    ...overrides,
  };
}

// MERGES overrides (name / automation fields), never replaces wholesale.
function makeAction(overrides = {}) {
  const { automation, ...rest } = overrides;
  return {
    name: 'Sentinel - Halt',
    ...rest,
    automation: { type: 'sentinel', ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'TestFighter', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestFighter', gridX: 5, gridY: 10 }],
  placedItems: [],
};

function mockTarget(name) {
  damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
  damageUtils.getTargetFromAttacker.mockReturnValue(name ? { name } : null);
}

// ── Tests ──────────────────────────────────────────────────────

describe('sentinelHaltHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('halts the auto-target: full popup string, appends exact speed_zero te, logs ability_use against target', async () => {
    const action = makeAction();
    const ps = makePlayerStats();
    mockTarget('Goblin');
    const existing = { target: 'Goblin', effect: 'multiattack_defense' };
    useRuntimeState.getRuntimeValue.mockReturnValue([existing]);

    // 4th arg (mapName) is unused by the handler — pass a value to pin it is ignored.
    const result = await handle(action, ps, campaignName, 'IgnoredMap');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Sentinel - Halt');
    expect(result.payload.description).toBe("Goblin's Speed is reduced to 0 for the rest of the current turn.");
    expect(result.payload.automation).toBe(action.automation);
    expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
    // Delegation-only pin: exact effect object appended AFTER existing effects (never replaced).
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
      existing,
      {
        target: 'Goblin',
        source: 'TestFighter',
        option: 'Halt',
        effect: 'speed_zero',
        value: null,
        duration: 'end_of_turn',
      },
    ], campaignName);
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestFighter',
        abilityName: 'Sentinel - Halt',
        description: 'Sentinel - Halt used against Goblin',
      }),
    );
  });

  it('propagates custom action.name and automation.duration through popup payload and te write', async () => {
    const action = makeAction({ name: 'Custom Halt', automation: { duration: 'end_of_round' } });
    const ps = makePlayerStats();
    mockTarget('Orc');
    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.name).toBe('Custom Halt');
    expect(result.payload.description).toBe("Orc's Speed is reduced to 0 for the rest of the current turn.");
    const effectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
    expect(effectsCall[2]).toEqual([
      {
        target: 'Orc',
        source: 'TestFighter',
        option: 'Halt',
        effect: 'speed_zero',
        value: null,
        duration: 'end_of_round',
      },
    ]);
  });

  it('still returns popup and writes speed_zero when addEntry rejects (log failure is non-fatal)', async () => {
    const action = makeAction();
    const ps = makePlayerStats();
    mockTarget('Goblin');
    useRuntimeState.getRuntimeValue.mockReturnValue([]);
    logService.addEntry.mockRejectedValueOnce(new Error('log error'));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe("Goblin's Speed is reduced to 0 for the rest of the current turn.");
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
      expect.objectContaining({ target: 'Goblin', effect: 'speed_zero' }),
    ], campaignName);
  });

  it('returns manual-application popup with action.name, logs without target, and never touches targetEffects when no target', async () => {
    const ps = makePlayerStats();

    // Combat context null: must not even query the attacker's target.
    const action = makeAction({ name: 'Custom Halt' });
    damageUtils.getCombatContext.mockResolvedValue(null);
    let result = await handle(action, ps, campaignName, null);
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Custom Halt');
    expect(result.payload.description).toBe('Custom Halt — <i>No target selected — effect noted for manual application.</i>');
    expect(result.payload.automation).toBe(action.automation);
    expect(damageUtils.getTargetFromAttacker).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({ description: 'Custom Halt used' }),
    );

    // getTargetFromAttacker returns null, then an object without a name.
    vi.clearAllMocks();
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    for (const noTarget of [null, {}]) {
      damageUtils.getTargetFromAttacker.mockReturnValue(noTarget);
      result = await handle(action, ps, campaignName, null);
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    }
    expect(logService.addEntry.mock.calls.at(-1)[1].description).toBe('Custom Halt used');
  });
});
