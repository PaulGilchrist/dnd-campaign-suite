import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
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

function makeAction(overrides = {}) {
  return {
    name: 'Sentinel - Halt',
    automation: { type: 'sentinel_halt', ...overrides },
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

// ── Tests ──────────────────────────────────────────────────────

describe('sentinelHaltHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns popup with target when target exists', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe("Goblin's Speed is reduced to 0 for the rest of the current turn.");
  });

  it('returns info popup when no combat context', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No target selected');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('returns info popup when no target from attacker', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No target selected');
  });

  it('calls addEntry with target name when available', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        description: 'Sentinel - Halt used against Orc',
      }),
    );
  });

  it('calls addEntry without target name when no target', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(null);

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        description: 'Sentinel - Halt used',
      }),
    );
  });

  it('sets targetEffects with Halt effect', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    await handle(action, ps, campaignName, null);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      campaignName,
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Goblin',
          source: 'Sentinel - Halt',
          option: 'Halt',
          effect: 'speed_zero',
        }),
      ]),
      campaignName,
    );
  });

  it('appends to existing targetEffects', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    useRuntimeState.getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'multiattack_defense' },
    ]);

    await handle(action, ps, campaignName, null);

    const effectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'targetEffects',
    );
    expect(effectsCall[2].length).toBe(2);
    expect(effectsCall[2][1].option).toBe('Halt');
  });

  it('uses custom duration from automation', async () => {
    const action = makeAction({ duration: 'end_of_round' });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    await handle(action, ps, campaignName, null);

    const effectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'targetEffects',
    );
    expect(effectsCall[2][0].duration).toBe('end_of_round');
  });

  it('defaults duration to end_of_turn', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    await handle(action, ps, campaignName, null);

    const effectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'targetEffects',
    );
    expect(effectsCall[2][0].duration).toBe('end_of_turn');
  });

  it('uses action.name in popup description', async () => {
    const action = { name: 'Custom Halt', automation: { type: 'sentinel_halt' } };
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain("Goblin's Speed is reduced to 0");
  });

  it('propagates addEntry errors', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    logService.addEntry.mockRejectedValue(new Error('network'));

    await expect(handle(action, ps, campaignName, null)).rejects.toThrow('network');
  });
});
