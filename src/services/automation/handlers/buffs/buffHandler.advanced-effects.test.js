// @maintained-by-ai
// Generic buff lane contract for buffHandler.handle: willing-target resolution,
// toggle popup copy, temp-HP side effects, invisible/see_invisibility/haste
// branches, and adrenaline restore. Fully mocked and deterministic.
// Wild Shape lives in buffHandler.wild-shape.test.js; long-rest flight in
// buffHandler.draconic-flight.test.js; use-gating in buffHandler.psychic-veil.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
  isBuffActive: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../class-cleric-paladin/vowOfEnmityHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => {
  const evaluateAutoExpression = vi.fn()
  return {
    evaluateAutoExpression,
    resolveNumericExpression: (...args) => evaluateAutoExpression(...args),
  }
});

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

vi.mock('./tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

import { handle, restoreAdrenalineRushUses } from './buffHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../encounters/combatData.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as tempHpService from './tempHpService.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Test Buff',
    automation: {
      type: 'buff',
      ...automation,
    },
  };
}

describe('buffHandler.handle - advanced effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
  });

  describe('Target resolution', () => {
    it('uses target name from getTargetFromAttacker when target is willing_creature and combatSummary exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ target: 'willing_creature' });
      combatData.getCombatSummary.mockReturnValue({ enemies: [] });
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'AllyTarget' });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        action.automation,
        campaignName,
        'AllyTarget'
      );
    });

    it('falls back to playerStats.name when combatSummary is null for willing_creature target', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ target: 'willing_creature' });
      combatData.getCombatSummary.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        action.automation,
        campaignName,
        ps.name
      );
    });

    it('falls back to playerStats.name when getTargetFromAttacker returns null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ target: 'willing_creature' });
      combatData.getCombatSummary.mockReturnValue({ enemies: [] });
      damageUtils.getTargetFromAttacker.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        action.automation,
        campaignName,
        ps.name
      );
    });
  });

  describe('Buff toggling', () => {
    it('calls toggleBuff with correct arguments and returns activated description', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'buff' });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        action.automation,
        campaignName,
        ps.name
      );
      expect(result.payload.description).toBe('Test Buff activated on yourself (10 min)');
    });

    it('returns toggled OFF description when wasActive is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'buff' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('Test Buff toggled OFF');
    });

    it('uses auto.duration in description when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'buff', duration: '1 hour' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('Test Buff activated on yourself (1 hour)');
    });
  });

  describe('Temp HP on buff activation', () => {
    it('calls setTempHp when buff was not active and tempHpExpression evaluates to a positive number', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ tempHpExpression: '2d4+3' });
      automationService.evaluateAutoExpression.mockReturnValue(7);

      await handle(action, ps, campaignName, null);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('2d4+3', ps);
      expect(tempHpService.setTempHp).toHaveBeenCalledWith(ps.name, 7, campaignName);
    });

    it('does not call setTempHp when buff was already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ tempHpExpression: '2d4+3' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      automationService.evaluateAutoExpression.mockReturnValue(7);

      await handle(action, ps, campaignName, null);

      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    });

    it('does not call setTempHp when tempHpExpression is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      await handle(action, ps, campaignName, null);

      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    });

    it.each([
      ['zero', 0],
      ['a negative number', -3],
      ['a non-number', null],
    ])('does not call setTempHp when expression evaluates to %s', async (_label, value) => {
      const ps = makePlayerStats();
      const action = makeAction({ tempHpExpression: '1d2' });
      automationService.evaluateAutoExpression.mockReturnValue(value);

      await handle(action, ps, campaignName, null);

      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    });
  });

  describe('Wild Shape (shape_shift)', () => {
    // OFF-leg cleanup and the 0-uses refusal gate are locked in
    // buffHandler.wild-shape.test.js (CLA-391 + Archdruid lane) — this only
    // pins the ON-leg payload echo: the chooser popup must hand the modal the
    // same action/playerStats/campaign references.
    it('returns wild_shape_select popup echoing action, playerStats and campaign when activating with uses available', async () => {
      const ps = makePlayerStats({
        level: 7,
        class: { major: { name: 'Druid' }, subclass: { name: 'Circle of the Moon' }, class_levels: [{ level: 7, wild_shape: 2 }] },
      });
      const action = makeAction({ effect: 'shape_shift' });
      runtimeState.getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('wild_shape_select');
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(ps);
      expect(result.payload.campaignName).toBe(campaignName);
    });
  });

  describe('Invisible effect', () => {
    it('adds invisible to activeConditions and sets tracking when activating', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        ['invisible'],
        campaignName
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        `_activeInvisibility_${ps.name}`,
        ps.name,
        campaignName
      );
    });

    it('removes invisible from activeConditions and clears the tracking key when deactivating', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      runtimeState.getRuntimeValue.mockReturnValue(['bleeding', 'invisible', 'poisoned']);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        ['bleeding', 'poisoned'],
        campaignName
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        `_activeInvisibility_${ps.name}`,
        null,
        campaignName
      );
    });

    it('does not modify activeConditions when deactivating but invisible is not in the list', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      runtimeState.getRuntimeValue.mockReturnValue(['bleeding', 'poisoned']);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        expect.anything(),
        campaignName
      );
    });
  });

  describe('See Invisibility effect', () => {
    it('logs activation when wasActive is false', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'see_invisibility' });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: ps.name,
          abilityName: 'Test Buff',
          description: expect.stringContaining('See Invisibility activated'),
        })
      );
    });

    it('logs deactivation when wasActive is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'see_invisibility' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: ps.name,
          abilityName: 'Test Buff',
          description: expect.stringContaining('deactivated See Invisibility'),
        })
      );
    });
  });

  describe('Haste effect', () => {
    it('adds expiration when activating', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'haste' });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: ps.name, targetName: ps.name, effects: expect.arrayContaining([expect.objectContaining({ type: 'remove_active_buff' })]), campaignName });
    });

    it('removes speed_zero from activeConditions when deactivating', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'haste' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      runtimeState.getRuntimeValue.mockReturnValue(['speed_zero', 'blinded']);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        ['blinded'],
        campaignName
      );
    });

    it('does not modify activeConditions when speed_zero is not present on deactivation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'haste' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      runtimeState.getRuntimeValue.mockReturnValue(['blinded']);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        expect.anything(),
        campaignName
      );
    });
  });

  describe('Null/undefined safety', () => {
    it('throws when action is undefined', async () => {
      const ps = makePlayerStats();
      await expect(handle(undefined, ps, campaignName, null)).rejects.toThrow();
    });

    it('throws when playerStats is undefined', async () => {
      const action = makeAction();
      await expect(handle(action, undefined, campaignName, null)).rejects.toThrow();
    });
  });

  describe('restoreAdrenalineRushUses', () => {
    it('sets adrenalineRushUses to null for the given player', () => {
      restoreAdrenalineRushUses('TestHero', campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'adrenalineRushUses',
        null,
        campaignName
      );
    });
  });
});
