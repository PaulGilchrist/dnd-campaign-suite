import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, confirmTeleport, clearExtendedFlag, isExtendedAvailable } from './tempTeleportHandler.js';
import * as useRuntimeState from '../../../../hooks/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Misty Step',
    automation: {
      type: 'teleport',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('tempTeleportHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('should return modal with modalName teleport', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('teleport');
    });

    it('should include action, playerStats, and campaignName in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(ps);
      expect(result.payload.campaignName).toBe(campaignName);
    });
  });

  describe('confirmTeleport', () => {
    it('should use auto.distance when useExtended is false', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ distance: '120 ft' });

      const result = await confirmTeleport(action, ps, campaignName, false);

      expect(result.payload.description).toContain('Teleported 120 ft');
    });

    it('should use auto.extendedDistance when useExtended is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ distance: '60 ft', extendedDistance: '300 ft' });

      const result = await confirmTeleport(action, ps, campaignName, true);

      expect(result.payload.description).toContain('Teleported 300 ft');
    });

    it('should fallback to 60 ft when auto.distance is missing and not extended', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      const result = await confirmTeleport(action, ps, campaignName, false);

      expect(result.payload.description).toContain('Teleported 60 ft');
    });

    it('should fallback to 150 ft when auto.extendedDistance is missing and extended', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ extendedDistance: undefined });

      const result = await confirmTeleport(action, ps, campaignName, true);

      expect(result.payload.description).toContain('Teleported 150 ft');
    });

    it('should call setRuntimeValue with _teleportExtendedUsed=true when useExtended is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      await confirmTeleport(action, ps, campaignName, true);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        '_teleportExtendedUsed',
        true,
        campaignName,
      );
    });

    it('should NOT call setRuntimeValue when useExtended is false', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      await confirmTeleport(action, ps, campaignName, false);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return swap description when auto.effect is teleport_swap_with_illusion', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'teleport_swap_with_illusion' });

      const result = await confirmTeleport(action, ps, campaignName, false);

      expect(result.payload.description).toBe(`${action.name}: Swapped places with your illusion.`);
    });

    it('should return teleport description for non-swap effects', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'teleport_other' });

      const result = await confirmTeleport(action, ps, campaignName, false);

      expect(result.payload.description).toContain('Teleported');
      expect(result.payload.description).not.toContain('Swapped places');
    });

    it('should include ally count in description when useExtended, bringAllies, and allyCount > 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ bringAllies: true, allyCount: 3 });

      const result = await confirmTeleport(action, ps, campaignName, true);

      expect(result.payload.description).toContain('Also brought up to 3 willing creatures');
    });

    it('should NOT include ally count when bringAllies is falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ bringAllies: false, allyCount: 3 });

      const result = await confirmTeleport(action, ps, campaignName, true);

      expect(result.payload.description).not.toContain('Also brought up to');
    });

    it('should NOT include ally count when allyCount is 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ bringAllies: true, allyCount: 0 });

      const result = await confirmTeleport(action, ps, campaignName, true);

      expect(result.payload.description).not.toContain('Also brought up to');
    });

    it('should use auto.teleportRange when set, falling back to 10 ft', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ bringAllies: true, allyCount: 2, teleportRange: '30 ft' });

      const result = await confirmTeleport(action, ps, campaignName, true);

      expect(result.payload.description).toContain('within 30 ft of your destination');
    });

    it('should fallback to 10 ft when teleportRange is not set', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ bringAllies: true, allyCount: 2 });

      const result = await confirmTeleport(action, ps, campaignName, true);

      expect(result.payload.description).toContain('within 10 ft of your destination');
    });

    it('should return popup with correct payload structure', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'teleport' });

      const result = await confirmTeleport(action, ps, campaignName, false);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.automationType).toBe(action.automation.type);
      expect(result.payload.automation).toBe(action.automation);
    });
  });

  describe('clearExtendedFlag', () => {
    it('should call setRuntimeValue with _teleportExtendedUsed=false', () => {
      const playerName = 'TestHero';

      clearExtendedFlag(playerName, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        '_teleportExtendedUsed',
        false,
        campaignName,
      );
    });
  });

  describe('isExtendedAvailable', () => {
    it('should return true when getRuntimeValue returns falsy', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = isExtendedAvailable('TestHero', campaignName);

      expect(result).toBe(true);
    });

    it('should return false when getRuntimeValue returns true', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(true);

      const result = isExtendedAvailable('TestHero', campaignName);

      expect(result).toBe(false);
    });
  });

  describe('moonlight_step_teleport', () => {
    it('should return teleport modal for moonlight_step_teleport effect', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', score: 16, bonus: 3 }],
      });
      const action = makeAction({ effect: 'moonlight_step_teleport', distance: '30 ft' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('teleport');
    });

    it('should return popup when no uses remaining for moonlight_step_teleport', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats({
        name: 'MoonDruid',
        abilities: [{ name: 'Wisdom', score: 16 }],
      });
      const action = {
        name: 'Moonlight Step',
        automation: {
          type: 'temp_buff',
          effect: 'moonlight_step_teleport',
          distance: '30 ft',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('should decrement moonlightStepUses on confirm for moonlight_step_teleport', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key, _camp) => {
        if (key === 'moonlightStepUses') return 2;
        return undefined;
      });
      const ps = makePlayerStats({
        name: 'MoonDruid',
        abilities: [{ name: 'Wisdom', score: 16 }],
      });
      const action = {
        name: 'Moonlight Step',
        automation: {
          type: 'temp_buff',
          effect: 'moonlight_step_teleport',
          distance: '30 ft',
        },
      };

      await confirmTeleport(action, ps, campaignName, false);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'MoonDruid',
        'moonlightStepUses',
        1,
        campaignName,
      );
    });

    it('should set next_attack_advantage for moonlight_step_teleport', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((target, key, _camp) => {
        if (key === 'moonlightStepUses') return 2;
        if (key === 'targetEffects') return [];
        return undefined;
      });
      const ps = makePlayerStats({
        name: 'MoonDruid',
        abilities: [{ name: 'Wisdom', score: 16 }],
      });
      const action = {
        name: 'Moonlight Step',
        automation: {
          type: 'temp_buff',
          effect: 'moonlight_step_teleport',
          distance: '30 ft',
        },
      };

      const result = await confirmTeleport(action, ps, campaignName, false);

      expect(result.payload.description).toContain('Teleported 30 ft');
    });
  });
});
