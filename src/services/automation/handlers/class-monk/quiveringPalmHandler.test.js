// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyShockwave, applyRelease } from './quiveringPalmHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestMonk',
    level: 17,
    proficiencyBonus: 6,
    proficiency: 6,
    abilities: [
      { name: 'Strength', bonus: 2 },
      { name: 'Wisdom', bonus: 3 },
      { name: 'Dexterity', bonus: 2 },
    ],
    class: {
      class_levels: [{ level: 17, focus_points: 4 }],
    },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Quivering Palm',
    automation: {
      type: 'quivering_palm',
      casting_time: 'passive',
      cost: { amount: 3, resource: 'kiPoints' },
      trigger: 'action',
      damageExpression: '10d10',
      damageType: 'Necrotic',
      ...automation,
    },
  };
}

// ── Tests: handle() ───────────────────────────────────────────

describe('quiveringPalmHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('first click — setting vibrations', () => {
    it('returns a popup when vibrations are successfully set', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({
        lastAttack: {
          attackerName: 'TestMonk',
          attackName: 'Unarmed Strike',
          saveResult: 'success',
        },
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      getRuntimeValue.mockImplementation((_a, b, _c) => {
        if (_a === campaignName && b === 'quivering_palm') return null;
        if (b === 'kiPoints') return 5;
        return undefined;
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Quivering Palm set in Goblin');
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestMonk',
        abilityName: 'Quivering Palm',
      }));
    });

    it('returns a modal when vibrations already active on another target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      getRuntimeValue.mockImplementation((_a, b, _c) => {
        if (_a === campaignName && b === 'quivering_palm') return 'Ogre';
        return undefined;
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('quiveringPalm');
      expect(result.payload.targetName).toBe('Ogre');
      expect(result.payload.isRelease).toBe(false);
    });

    it('returns a popup when last attack was not made by the monk', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({
        lastAttack: { attackerName: 'Goblin', attackName: 'Longsword' },
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      getRuntimeValue.mockImplementation((_a, b, _c) => {
        if (_a === campaignName && b === 'quivering_palm') return null;
        return undefined;
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Last attack was not made by you');
    });

    it('returns a popup when last attack was not an Unarmed Strike', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({
        lastAttack: {
          attackerName: 'TestMonk',
          attackName: 'Longsword',
          total: 15,
          targetAc: 12,
        },
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      getRuntimeValue.mockImplementation((_a, b, _c) => {
        if (_a === campaignName && b === 'quivering_palm') return null;
        return undefined;
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Unarmed Strike');
    });

    it('returns a popup when last Unarmed Strike did not hit', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({
        lastAttack: {
          attackerName: 'TestMonk',
          attackName: 'Unarmed Strike',
          total: 8,
          targetAc: 15,
        },
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      getRuntimeValue.mockImplementation((_a, b, _c) => {
        if (_a === campaignName && b === 'quivering_palm') return null;
        return undefined;
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('did not hit');
    });

    it('returns a popup when not enough resources', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({
        lastAttack: {
          attackerName: 'TestMonk',
          attackName: 'Unarmed Strike',
          saveResult: 'success',
        },
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      getRuntimeValue.mockImplementation((_a, b, _c) => {
        if (_a === campaignName && b === 'quivering_palm') return null;
        if (b === 'kiPoints') return 1;
        return undefined;
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Not enough');
    });
  });

  describe('second click — vibrations already active', () => {
    it('returns a modal for release/shockwave choice', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      getRuntimeValue.mockImplementation((_a, b, _c) => {
        if (_a === campaignName && b === 'quivering_palm') return 'Goblin';
        return undefined;
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('quiveringPalm');
      expect(result.payload.targetName).toBe('Goblin');
      expect(result.payload.isRelease).toBe(false);
    });
  });
});

// ── Tests: applyShockwave() ────────────────────────────────────

describe('quiveringPalmHandler.applyShockwave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a popup with save listener and damage on failed save', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        roll: 8,
        saveBonus: 2,
        total: 10,
        success: false,
      }),
    });
    rollExpression.mockReturnValue({ total: 55 });
    applyDamageToTarget.mockReturnValue({ finalDamage: 55 });

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('Failure');
    expect(result.payload.description).toContain('55 Force damage');
    expect(setRuntimeValue).toHaveBeenCalledWith(campaignName, 'quivering_palm', null, campaignName);
  });

  it('returns half damage on successful save', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        roll: 18,
        saveBonus: 2,
        total: 20,
        success: true,
      }),
    });
    rollExpression.mockReturnValue({ total: 50 });
    applyDamageToTarget.mockReturnValue({ finalDamage: 25 });

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.payload.description).toContain('Success');
    expect(result.payload.description).toContain('25 Force damage');
  });
});

// ── Tests: applyRelease() ──────────────────────────────────────

describe('quiveringPalmHandler.applyRelease', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a popup confirming harmless release', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    const result = await applyRelease(action, ps, campaignName, 'Goblin');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('harmlessly');
    expect(setRuntimeValue).toHaveBeenCalledWith(campaignName, 'quivering_palm', null, campaignName);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      description: expect.stringContaining('released the vibrations harmlessly'),
    }));
  });
});
