// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as combatData from '../../../../services/encounters/combatData.js';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyDamageTypeChoice } from './damageTypeModifierHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestFighter',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Empowered Strikes',
    automation: {
      type: 'damage_type_modifier',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('damageTypeModifierHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    combatData.setCombatSummaryCache(null);
  });

  describe('handle', () => {
    it('returns modal with action, playerStats, and campaignName when options are present', async () => {
      const action = makeAction({
        options: [
          { name: 'Thunder', damageType: 'Thunder' },
          { name: 'Lightning', damageType: 'Lightning' },
        ],
      });
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'damageTypeModifier',
        payload: {
          action,
          playerStats: ps,
          campaignName,
        },
      });
    });

    it('returns modal when there is exactly one option', async () => {
      const action = makeAction({
        options: [{ name: 'Thunder', damageType: 'Thunder' }],
      });
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('damageTypeModifier');
    });

    it('returns info popup when options array is empty', async () => {
      const action = makeAction({ options: [] });
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Empowered Strikes',
          automationType: 'damage_type_modifier',
          description: 'Empowered Strikes ready. The next eligible Unarmed Strike will use your chosen damage type.',
          automation: { type: 'damage_type_modifier', options: [] },
        },
      });
    });

    it('returns info popup when options is undefined', async () => {
      const action = makeAction({ options: undefined });
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('returns info popup when automation.options is missing entirely', async () => {
      const action = { name: 'Empowered Strikes', automation: { type: 'damage_type_modifier' } };
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('logs ability_use on invocation regardless of options', async () => {
      const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
      const ps = makePlayerStats();

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestFighter',
          abilityName: 'Empowered Strikes',
          description: expect.stringContaining('Empowered Strikes'),
        }),
      );
    });

    it('does not throw when addEntry rejects', async () => {
      const action = makeAction({ options: [] });
      const ps = makePlayerStats();
      logService.addEntry.mockRejectedValue(new Error('network'));

      await expect(handle(action, ps, campaignName, null)).resolves.toBeDefined();
    });
  });

  describe('applyDamageTypeChoice', () => {
    it('returns null and makes no side effects when chosen option is not found', async () => {
      const action = makeAction({
        options: [
          { name: 'Thunder', damageType: 'Thunder' },
          { name: 'Lightning', damageType: 'Lightning' },
        ],
      });
      const ps = makePlayerStats();

      const result = await applyDamageTypeChoice(action, ps, campaignName, 'Fire');

      expect(result).toBeNull();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('sets damage type and usedRound runtime values for valid option', async () => {
      const action = makeAction({
        options: [
          { name: 'Thunder', damageType: 'Thunder' },
          { name: 'Lightning', damageType: 'Lightning' },
        ],
      });
      const ps = makePlayerStats();

      await applyDamageTypeChoice(action, ps, campaignName, 'Thunder');

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestFighter',
        'empoweredStrikesDamageType',
        'Thunder',
        campaignName,
      );

      const usedRoundCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        c => c[1].includes('usedRound'),
      );
      expect(usedRoundCall).toBeDefined();
      expect(usedRoundCall[0]).toBe('TestFighter');
      expect(usedRoundCall[1]).toBe('_Empowered_Strikes_usedRound');
    });

    it('returns popup with correct structure and description', async () => {
      const action = makeAction({
        options: [{ name: 'Thunder', damageType: 'Thunder' }],
      });
      const ps = makePlayerStats();

      const result = await applyDamageTypeChoice(action, ps, campaignName, 'Thunder');

      expect(result).not.toBeNull();
      expect(result.type).toBe('popup');
      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Empowered Strikes',
        automationType: 'damage_type_modifier',
        description: 'Damage type set to Thunder for your next Unarmed Strike.',
        automation: { type: 'damage_type_modifier', options: [{ name: 'Thunder', damageType: 'Thunder' }] },
      });
    });

    it('logs ability_use with chosen damage type in description', async () => {
      const action = makeAction({
        options: [{ name: 'Lightning', damageType: 'Lightning' }],
      });
      const ps = makePlayerStats();

      await applyDamageTypeChoice(action, ps, campaignName, 'Lightning');

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestFighter',
          abilityName: 'Empowered Strikes',
          description: 'Empowered Strikes — damage type set to Lightning',
        }),
      );
    });

    it('does not throw when addEntry rejects after successful choice', async () => {
      const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
      const ps = makePlayerStats();
      logService.addEntry.mockRejectedValue(new Error('network'));

      const result = await applyDamageTypeChoice(action, ps, campaignName, 'Thunder');

      expect(result).not.toBeNull();
      expect(result.type).toBe('popup');
    });

    it('uses current combat round from cache for usedRound value', async () => {
      const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
      const ps = makePlayerStats();

      combatData.setCombatSummaryCache({ round: 5 });

      await applyDamageTypeChoice(action, ps, campaignName, 'Thunder');

      const usedRoundCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        c => c[1].includes('usedRound'),
      );
      expect(usedRoundCall[2]).toBe(5);
    });

    it('defaults to round 1 when no combat summary in cache', async () => {
      const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
      const ps = makePlayerStats();

      combatData.setCombatSummaryCache(null);

      await applyDamageTypeChoice(action, ps, campaignName, 'Thunder');

      const usedRoundCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        c => c[1].includes('usedRound'),
      );
      expect(usedRoundCall[2]).toBe(1);
    });

    it('uses playerStats name for runtime keys', async () => {
      const action = makeAction({ options: [{ name: 'Fire', damageType: 'Fire' }] });
      const ps = makePlayerStats({ name: 'RogueNine' });

      await applyDamageTypeChoice(action, ps, campaignName, 'Fire');

      const calls = useRuntimeState.setRuntimeValue.mock.calls;
      expect(calls[0][0]).toBe('RogueNine');
      expect(calls[1][0]).toBe('RogueNine');
      expect(calls[1][1]).toBe('_Empowered_Strikes_usedRound');
    });

    it('uses campaignName for all runtime calls', async () => {
      const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
      const ps = makePlayerStats();

      await applyDamageTypeChoice(action, ps, 'OtherCampaign', 'Thunder');

      const calls = useRuntimeState.setRuntimeValue.mock.calls;
      expect(calls[0][3]).toBe('OtherCampaign');
      expect(calls[1][3]).toBe('OtherCampaign');
    });

    it('calls addEntry with correct campaignName', async () => {
      const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
      const ps = makePlayerStats();

      await applyDamageTypeChoice(action, ps, 'OtherCampaign', 'Thunder');

      expect(logService.addEntry).toHaveBeenCalledWith(
        'OtherCampaign',
        expect.any(Object),
      );
    });
  });
});
