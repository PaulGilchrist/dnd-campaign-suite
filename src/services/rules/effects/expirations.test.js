import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 5),
  getActiveCreatureName: vi.fn(() => 'TestCharacter'),
  getCombatSummary: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 10),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
}));

import { applyTurnStartEffects, addExpiration, clearAllExpirationEffects, expireStaleEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, getCurrentCombatRound, getActiveCreatureName } from '../../encounters/combatData.js';


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

  describe('umbral_sight', () => {
    it('applies invisible condition when in darkness and not already invisible', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'umbralSightDarknessActive') return true;
        if (prop === 'activeConditions') return ['fatigued'];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
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
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
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
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
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
        return undefined;
      });
      setRuntimeValue.mockResolvedValue(undefined);

      applyTurnStartEffects('Target', { turnStartEffects: [] }, 'TestCampaign');

      expect(getRuntimeValue).toHaveBeenCalledWith('Target', 'regenerateActive', 'TestCampaign');
    });
  });
});

describe('addExpiration', () => {
  beforeEach(() => resetMocks());

  it('adds an expiration entry to the attacker runtime store', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'pendingExpirations') return [];
      return null;
    });

    addExpiration('Caster', 'Target', [{ type: 'stunned' }], 'TestCampaign', 3);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Caster',
      'pendingExpirations',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Target',
          expiryRounds: 3,
        })
      ]),
      'TestCampaign'
    );
  });

  it('uses default expiryRounds of 1 when not provided', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'pendingExpirations') return [];
      return null;
    });

    addExpiration('Caster', 'Target', [{ type: 'stunned' }], 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Caster',
      'pendingExpirations',
      expect.arrayContaining([
        expect.objectContaining({ expiryRounds: 1 })
      ]),
      'TestCampaign'
    );
  });

  it('appends to existing expiration list', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'pendingExpirations') return [{ target: 'ExistingTarget', expiryRounds: 2 }];
      return null;
    });

    addExpiration('Caster', 'NewTarget', [{ type: 'blinded' }], 'TestCampaign', 5);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Caster',
      'pendingExpirations',
      expect.arrayContaining([
        expect.objectContaining({ target: 'ExistingTarget' }),
        expect.objectContaining({ target: 'NewTarget' })
      ]),
      'TestCampaign'
    );
  });

  it('uses getCurrentCombatRound for appliedRound', () => {
    getCurrentCombatRound.mockReturnValue(10);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'pendingExpirations') return [];
      return null;
    });

    addExpiration('Caster', 'Target', [{ type: 'stunned' }], 'TestCampaign', 3);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Caster',
      'pendingExpirations',
      expect.arrayContaining([
        expect.objectContaining({ appliedRound: 10 })
      ]),
      'TestCampaign'
    );
  });
});

describe('clearAllExpirationEffects', () => {
  beforeEach(() => resetMocks());

  it('clears activeBuffs for the character', () => {
    clearAllExpirationEffects('TestCharacter', 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'activeBuffs',
      [],
      'TestCampaign'
    );
  });

  it('clears mantleOfMajestyActive for the character', () => {
    clearAllExpirationEffects('TestCharacter', 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'mantleOfMajestyActive',
      null,
      'TestCampaign'
    );
  });

  it('clears pending expirations from the character', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'pendingExpirations') return [{ target: 'Target', effects: [], appliedRound: 1, expiryRounds: 1 }];
      return null;
    });

    clearAllExpirationEffects('TestCharacter', 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'pendingExpirations',
      [],
      'TestCampaign'
    );
  });

  it('returns early when characterName is null', () => {
    clearAllExpirationEffects(null, 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when campaignName is null', () => {
    clearAllExpirationEffects('TestCharacter', null);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('expireStaleEffects', () => {
  beforeEach(() => resetMocks());

  it('returns early when activeName is null', () => {
    getActiveCreatureName.mockReturnValue(null);
    expireStaleEffects('TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('skips creatures not matching activeName', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'OtherCreature' },
        { name: 'ActiveCreature' },
      ],
    });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'pendingExpirations') return [];
      return null;
    });

    expireStaleEffects('TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('clears expired entries and keeps non-expired', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCurrentCombatRound.mockReturnValue(10);
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'ActiveCreature' }],
    });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'pendingExpirations') {
        return [
          { target: 'ExpiredTarget', effects: [{ type: 'stunned' }], appliedRound: 5, expiryRounds: 3 },
          { target: 'ValidTarget', effects: [{ type: 'blinded' }], appliedRound: 8, expiryRounds: 3 },
        ];
      }
      return null;
    });

    expireStaleEffects('TestCampaign');

    // Expired entry (round 5 + 3 = 8, current round 10 >= 8) should be cleared
    // Valid entry (round 8 + 3 = 11, current round 10 < 11) should be kept
    const calls = setRuntimeValue.mock.calls.filter(c => c[1] === 'pendingExpirations');
    expect(calls.length).toBeGreaterThan(0);
    const keptEntry = calls[0][2].find(e => e.target === 'ValidTarget');
    expect(keptEntry).toBeDefined();
  });

  it('handles empty pendingExpirations list', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'ActiveCreature' }],
    });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'pendingExpirations') return [];
      return null;
    });

    expireStaleEffects('TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles null combatSummary gracefully', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCombatSummary.mockReturnValue(null);
    expireStaleEffects('TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles missing creatures array in combatSummary', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCombatSummary.mockReturnValue({});
    expireStaleEffects('TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
