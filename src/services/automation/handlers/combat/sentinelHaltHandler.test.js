// @cleaned-by-ai
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

  describe('successful halt with target', () => {
    it('returns popup with speed reduction description', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe("Goblin's Speed is reduced to 0 for the rest of the current turn.");
      expect(result.payload.automation).toBe(action.automation);
    });

    it('uses custom action name in popup description and payload', async () => {
      const action = { name: 'Custom Halt', automation: { type: 'sentinel_halt' } };
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe("Orc's Speed is reduced to 0 for the rest of the current turn.");
      expect(result.payload.name).toBe('Custom Halt');
    });

    it('logs the ability use with target name', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestFighter',
          abilityName: 'Sentinel - Halt',
          description: 'Sentinel - Halt used against Orc',
        }),
      );
    });

    it('sets targetEffects with correct effect object', async () => {
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
            source: 'TestFighter',
            option: 'Halt',
            effect: 'speed_zero',
            value: null,
            duration: 'end_of_turn',
          }),
        ]),
        campaignName,
      );
    });

    it('appends to existing targetEffects without replacing', async () => {
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
      expect(effectsCall).toBeDefined();
      expect(effectsCall[2].length).toBe(2);
      expect(effectsCall[2][0].effect).toBe('multiattack_defense');
      expect(effectsCall[2][1].option).toBe('Halt');
    });

    it('uses custom duration from automation config', async () => {
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
  });

  describe('no target scenarios', () => {
    it('returns info popup when no target is available', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      // null context
      damageUtils.getCombatContext.mockResolvedValue(null);
      let result = await handle(action, ps, campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');

      // undefined context
      damageUtils.getCombatContext.mockResolvedValue(undefined);
      result = await handle(action, ps, campaignName, null);
      expect(result.payload.description).toContain('No target selected');

      // getTargetFromAttacker returns null
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue(null);
      result = await handle(action, ps, campaignName, null);
      expect(result.payload.description).toContain('No target selected');

      // getTargetFromAttacker returns object without name
      damageUtils.getTargetFromAttacker.mockReturnValue({});
      result = await handle(action, ps, campaignName, null);
      expect(result.payload.description).toContain('No target selected');
    });

    it('uses action.name in popup when no target', async () => {
      const action = { name: 'Custom Halt', automation: { type: 'sentinel_halt' } };
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Custom Halt');
      expect(result.payload.description).toContain('Custom Halt');
    });

    it('logs the ability use without target name', async () => {
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

    it('does not call setRuntimeValue when no target', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(null);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
