import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/useRuntimeState.js', () => ({
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
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
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
  });

  it('returns early when activeName is null', () => {
    applyTurnStartEffects(null, { turnStartEffects: [] }, 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when playerStats is null', () => {
    applyTurnStartEffects('TestCharacter', null, 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when playerStats has no turnStartEffects', () => {
    applyTurnStartEffects('TestCharacter', {}, 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('grants hasInspiration when turnStartEffects contains heroic_inspiration and not already set', () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'hasInspiration') return false;
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
      if (prop === 'activeConditions') return null;
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
        if (prop === 'activeConditions') return null;
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
});
