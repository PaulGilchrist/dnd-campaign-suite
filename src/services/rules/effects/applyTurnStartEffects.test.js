import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn(),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
}));

import { applyTurnStartEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

describe('applyTurnStartEffects', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockReset();
    setRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((name, prop, _campaign) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('returns early when activeName is null', () => {
    applyTurnStartEffects(null, { turnStartEffects: [], targetEffects: [] }, 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when playerStats is null', () => {
    applyTurnStartEffects('TestCharacter', null, 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when playerStats has no turnStartEffects', () => {
    applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('grants hasInspiration when turnStartEffects contains heroic_inspiration and not already set', () => {
    getRuntimeValue.mockImplementation((name, prop, _campaign) => {
      if (prop === 'hasInspiration') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'heroic_inspiration', name: 'Heroic Warrior' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'hasInspiration',
      true,
      'TestCampaign'
    );
  });

  it('does NOT grant hasInspiration when already set to true', () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'hasInspiration') return true;
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'heroic_inspiration', name: 'Heroic Warrior' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does NOT grant hasInspiration when already set to false (falsy but not yet granted)', () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'hasInspiration') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'heroic_inspiration', name: 'Heroic Warrior' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'hasInspiration',
      true,
      'TestCampaign'
    );
  });

  it('ignores unknown effect types', () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'hasInspiration') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'unknown_effect', name: 'Some Feature' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles multiple turn start effects, only applies heroic_inspiration', () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'hasInspiration') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [
        { type: 'heroic_inspiration', name: 'Heroic Warrior' },
        { type: 'unknown_effect', name: 'Some Feature' }
      ]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'hasInspiration',
      true,
      'TestCampaign'
    );
  });

  it('removes conditions at turn start when condition_removal effect is present', () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeConditions') return ['charmed', 'poisoned', 'blinded'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'condition_removal',
        name: 'Self-Restoration',
        conditions: ['charmed', 'frightened', 'poisoned']
      }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'activeConditions',
      ['blinded'],
      'TestCampaign'
    );
  });

  it('does not call setRuntimeValue when no matching conditions to remove', () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeConditions') return ['blinded', 'grappled'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'condition_removal',
        name: 'Self-Restoration',
        conditions: ['charmed', 'frightened', 'poisoned']
      }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles case-insensitive condition matching', () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeConditions') return ['CHARMED', 'Poisoned', 'Blinded'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'condition_removal',
        name: 'Self-Restoration',
        conditions: ['charmed', 'frightened', 'poisoned']
      }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'activeConditions',
      ['Blinded'],
      'TestCampaign'
    );
  });

  it('handles empty activeConditions array', () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeConditions') return [];
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'condition_removal',
        name: 'Self-Restoration',
        conditions: ['charmed', 'frightened', 'poisoned']
      }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles null activeConditions', () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeConditions') return [];
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'condition_removal',
        name: 'Self-Restoration',
        conditions: ['charmed', 'frightened', 'poisoned']
      }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  describe('umbral_sight', () => {
    it('applies invisible condition when in darkness and not already invisible', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'umbralSightDarknessActive') return true;
        if (prop === 'activeConditions') return ['fatigued'];
        if (prop === 'targetEffects') return [];
      if (prop === 'targetEffects') return [];
      return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'umbral_sight',
          name: 'Umbral Sight',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['fatigued', 'invisible'],
        'TestCampaign'
      );
    });

    it('removes invisible condition when not in darkness and currently invisible', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'umbralSightDarknessActive') return false;
        if (prop === 'activeConditions') return ['fatigued', 'invisible'];
        if (prop === 'targetEffects') return [];
      if (prop === 'targetEffects') return [];
      return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'umbral_sight',
          name: 'Umbral Sight',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['fatigued'],
        'TestCampaign'
      );
    });

    it('does nothing when in darkness and already invisible', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'umbralSightDarknessActive') return true;
        if (prop === 'activeConditions') return ['fatigued', 'invisible'];
        if (prop === 'targetEffects') return [];
      if (prop === 'targetEffects') return [];
      return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'umbral_sight',
          name: 'Umbral Sight',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does nothing when not in darkness and not invisible', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'umbralSightDarknessActive') return false;
        if (prop === 'activeConditions') return ['fatigued'];
        if (prop === 'targetEffects') return [];
      if (prop === 'targetEffects') return [];
      return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'umbral_sight',
          name: 'Umbral Sight',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('handles null activeConditions', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'umbralSightDarknessActive') return true;
        if (prop === 'activeConditions') return [];
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'umbral_sight',
          name: 'Umbral Sight',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['invisible'],
        'TestCampaign'
      );
    });
  });

  describe('inner_radiance_turn_start', () => {
    it('returns early when no turnStartEffects', () => {
      applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('handles null activeBuffs gracefully', async () => {
      getRuntimeValue.mockImplementation((name, prop, _campaign) => {
        if (prop === 'activeBuffs') return null;
        if (prop === 'targetEffects') return [];
      if (prop === 'targetEffects') return [];
      return null;
      });
      getCombatSummary.mockReturnValue(null);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'inner_radiance_turn_start',
          name: 'Inner Radiance',
          damageExpression: 'proficiency_bonus',
          damageType: 'Radiant',
          range: '10_ft',
        }],
        proficiency: 2,
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('regenerate turn-start healing', () => {
    it('checks regenerateActive when regenerateActive is true', () => {
      getRuntimeValue.mockImplementation((name, prop, _campaign) => {
        if (name === 'Target' && prop === 'regenerateActive') return true;
        if (name === 'Target' && prop === 'currentHitPoints') return 10;
        if (name === 'Target' && prop === 'hitPoints') return 20;
        if (prop === 'targetEffects') return [];
        return undefined;
      });
      setRuntimeValue.mockResolvedValue(undefined);

      applyTurnStartEffects('Target', { turnStartEffects: [] }, 'TestCampaign');

      expect(getRuntimeValue).toHaveBeenCalledWith('Target', 'regenerateActive', 'TestCampaign');
    });

    it('does not check regenerateActive when turnStartEffects is empty', () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'targetEffects') return [];
        return undefined;
      });
      setRuntimeValue.mockResolvedValue(undefined);

      applyTurnStartEffects('Target', { turnStartEffects: [] }, 'TestCampaign');

      expect(getRuntimeValue).toHaveBeenCalledWith('Target', 'regenerateActive', 'TestCampaign');
    });
  });
});
