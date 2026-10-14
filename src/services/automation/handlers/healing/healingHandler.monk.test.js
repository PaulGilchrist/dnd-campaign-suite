import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../../character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(),
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  resolveHealingBonuses: vi.fn(),
  resolveHealingBonusesWithDetails: vi.fn(),
  markFortifiedHealthUsed: vi.fn(),
  hasHealingMaximization: vi.fn(),
  hasHealingMaximizationForTarget: vi.fn(),
  hasRerollHealingOnes: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/restRules.js', () => ({
  getHitDieSize: vi.fn(),
  computeHitDieRecovery: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './healingHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as automationService from '../../../combat/automation/automationService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHealer',
    level: 5,
    proficiency: 3,
    currentHitPoints: 10,
    maxHitPoints: 20,
    abilities: [{ name: 'Wisdom', bonus: 2 }],
    ...overrides,
  };
}

function makeMonkAction(automation = {}) {
  return {
    name: 'Hand of Healing',
    automation: {
      type: 'self_healing',
      healExpression: 'martial_arts_die + WIS',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler monk healing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
    automationService.resolveHealingBonuses.mockReturnValue(0);
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 5 });
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });
  });

  describe('monk healing (martial_arts_die + WIS)', () => {
    it('should return handOfHealing modal when expression includes martial_arts_die and WIS', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 3 }],
      });
      const action = makeMonkAction();

      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('handOfHealing');
      expect(result.payload.monkName).toBe('TestHealer');
      expect(result.payload.bonus).toBe(3);
    });

    it('should use martialArtsDie from class features or default to 4', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
      });
      const action = makeMonkAction();

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 8 });
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toContain('1d8');
    });

    it('should default martialArtsDie to 4 when class features returns null', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
      });
      const action = {
        name: 'Hand of Healing',
        automation: {
          type: 'self_healing',
          healExpression: 'martial_arts_die + WIS',
        },
      };

      classFeatures.getClassFeatures.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toContain('1d4');
    });

    it('should include bonus in formula when resolveHealingBonuses > 0', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 3 }],
      });
      const action = makeMonkAction();

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [{ name: 'Disciple of Life', amount: 2 }] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toContain('+ 2');
      expect(result.payload.bonus).toBe(5);
    });

    it('should include targetName and HP info in modal payload', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
      });
      const action = makeMonkAction();

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 18, maxHp: 20, actualHeal: 8 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe('TestHealer');
      expect(result.payload.targetCurrentHp).toBe(18);
      expect(result.payload.targetMaxHp).toBe(20);
    });

    it('should use targetName from resolveTarget when isSelf is false', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 3 }],
      });
      const action = {
        name: 'Hand of Healing',
        automation: {
          type: 'other_healing',
          healExpression: 'martial_arts_die + WIS',
        },
      };

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.targetName).toBe('Ally');
    });

    it('should fallback to player name when resolveTarget returns null for monk healing', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 3 }],
      });
      const action = {
        name: 'Hand of Healing',
        automation: {
          type: 'other_healing',
          healExpression: 'martial_arts_die + WIS',
        },
      };

      targetResolver.resolveTarget.mockResolvedValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe('TestHealer');
    });
  });

  // ── Physician's Touch ────────────────────────────────────────

  describe("Physician's Touch feature", () => {
    it('should include hasPhysiciansTouch in modal payload when feature exists', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
        specialActions: [{ name: "Physician's Touch" }],
      });
      const action = makeMonkAction({ healExpression: 'martial_arts_die + WIS' });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.hasPhysiciansTouch).toBe(true);
    });
  });
});
