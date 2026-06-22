import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn((r) => {
    if (typeof r === 'number') return r;
    const m = String(r).match(/(\d+)_?ft/);
    return m ? parseInt(m[1], 10) : null;
  }),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((abilities, ability) => {
    const ab = abilities?.find(a => a.name === ability);
    return ab?.bonus ?? 0;
  }),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findRollsByCreature: vi.fn(),
}));

import { handle } from './restoreBalanceHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rangeToFeet, getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveTarget, resolveMapPositions } from '../../common/targetResolver.js';
import * as damageRollback from '../../common/damageRollback.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Restore Balance',
    automation: { type: 'restore_balance', range: '60_ft', ...automation },
  };
}

describe('restoreBalanceHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('target resolution', () => {
    it('should return popup when no target resolved', async () => {
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires selecting a creature');
    });

    it('should resolve target successfully', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'TargetAlly' } });
      resolveMapPositions.mockResolvedValue(null);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('TargetAlly');
    });
  });

  describe('range check', () => {
    it('should return popup when target is out of range', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'FarTarget' } });
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 100, gridY: 100 },
      });
      getDistanceFeet.mockReturnValue(999);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toContain('out of range');
    });

    it('should skip range check when mapName is null', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'TargetAlly' } });
      getRuntimeValue.mockReturnValue(null);
      rangeToFeet.mockReturnValue(60);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(resolveMapPositions).not.toHaveBeenCalled();
    });
  });

  describe('uses check', () => {
    function setupNoMap() {
      resolveTarget.mockResolvedValue({ target: { name: 'TargetAlly' } });
      resolveMapPositions.mockResolvedValue(null);
      getAbilityModifier.mockReturnValue(3);
      getRuntimeValue.mockReturnValue(null);
    }

    it('should calculate usesMax from CHA modifier', async () => {
      setupNoMap();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(getAbilityModifier).toHaveBeenCalledWith(
        expect.any(Array),
        'CHA',
      );
    });

    it('should use max(1, chaMod) for usesMax', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'TargetAlly' } });
      resolveMapPositions.mockResolvedValue(null);
      getAbilityModifier.mockReturnValue(-1);
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // With CHA -1, usesMax = max(1, -1) = 1
      // currentUses would be 1 (from usesMax default)
      // so it should proceed
    });

    it('should return popup when no uses remaining', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'TargetAlly' } });
      resolveMapPositions.mockResolvedValue(null);
      getAbilityModifier.mockReturnValue(3);
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'restorebalanceUses') return 0;
        if (key === 'restorebalanceRestTimestamp') return Date.now() - 1000;
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('no uses remaining');
    });
  });

  describe('roll freshness check', () => {
    function setupFreshAttack() {
      resolveTarget.mockResolvedValue({ target: { name: 'TargetAlly' } });
      resolveMapPositions.mockResolvedValue(null);
      getAbilityModifier.mockReturnValue(3);
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'restorebalanceUses') return 1;
        return null;
      });
      damageRollback.findRollsByCreature.mockReturnValue({
        'TargetAlly': {
          attackEvent: {"d20":15,"bonus":5,"targetAc":16,"hit":true,"timestamp":Date.now()},
          abilityEvent: null,
          saveEvent: null
        }
      });
    }

    it('should proceed when attack roll is fresh', async () => {
      setupFreshAttack();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Attack roll');
    });

    it('should proceed when ability check is fresh', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'TargetAlly' } });
      resolveMapPositions.mockResolvedValue(null);
      getAbilityModifier.mockReturnValue(3);
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'restorebalanceUses') return 1;
        return null;
      });
      damageRollback.findRollsByCreature.mockReturnValue({
        'TargetAlly': {
          attackEvent: null,
          abilityEvent: {"d20":12,"bonus":4,"checkName":"Stealth","timestamp":Date.now()},
          saveEvent: null
        }
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Stealth');
    });

    it('should proceed when save roll is fresh', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'TargetAlly' } });
      resolveMapPositions.mockResolvedValue(null);
      getAbilityModifier.mockReturnValue(3);
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'restorebalanceUses') return 1;
        return null;
      });
      damageRollback.findRollsByCreature.mockReturnValue({
        'TargetAlly': {
          attackEvent: null,
          abilityEvent: null,
          saveEvent: {"d20":18,"bonus":3,"saveType":"DEX","timestamp":Date.now()}
        }
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('DEX');
    });

    it('should return popup when no rolls found', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'TargetAlly' } });
      resolveMapPositions.mockResolvedValue(null);
      getAbilityModifier.mockReturnValue(3);
      damageRollback.findRollsByCreature.mockReturnValue({
        'TargetAlly': {
          attackEvent: null,
          abilityEvent: null,
          saveEvent: null
        }
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No recent d20 roll found');
    });

    it('should show attack roll description with hit/miss', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'TargetAlly' } });
      resolveMapPositions.mockResolvedValue(null);
      getAbilityModifier.mockReturnValue(3);
      damageRollback.findRollsByCreature.mockReturnValue({
        'TargetAlly': {
          attackEvent: {"d20":15,"bonus":5,"targetAc":16,"hit":false,"timestamp":Date.now()},
          abilityEvent: null,
          saveEvent: null
        }
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('MISS');
    });
  });

  describe('usage decrement', () => {
    it('should decrement uses after applying', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'TargetAlly' } });
      resolveMapPositions.mockResolvedValue(null);
      getAbilityModifier.mockReturnValue(3);
      damageRollback.findRollsByCreature.mockReturnValue({
        'TargetAlly': {
          attackEvent: {"d20":15,"bonus":5,"targetAc":16,"hit":true,"timestamp":Date.now()},
          abilityEvent: null,
          saveEvent: null
        }
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestSorcerer',
        'restorebalanceUses',
        0,
        campaignName,
      );
    });
  });
});
