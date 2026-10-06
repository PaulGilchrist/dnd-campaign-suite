import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
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

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { handle } from './healingHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as automationService from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';

const monkStats = {
  name: 'Disciplined_Monk',
  rules: '2024',
  level: 20,
  proficiency: 6,
  currentHitPoints: 183,
  maxHitPoints: 183,
  abilities: [{ name: 'Wisdom', bonus: 7 }],
  specialActions: [{ name: 'Flurry of Healing and Harm' }, { name: "Physician's Touch" }],
};

const hohAction = {
  name: 'Hand of Healing',
  automation: {
    type: 'healing',
    healExpression: 'martial_arts_die + WIS modifier',
    action: 'bonus_action',
    resourceCost: 'focus_point',
  },
};

const woundedBandit = { name: 'Bandit 1', type: 'monster', currentHp: 1, maxHp: 11 };
const monkCsEntry = { name: 'Disciplined_Monk', type: 'player', currentHp: 183, maxHp: 183 };
const combatCs = { creatures: [monkCsEntry, woundedBandit], round: 1, activeCreatureName: 'Disciplined_Monk' };

describe('CLA-159 standalone Hand of Healing lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 2024 lv20 Martial Arts die is d12 (classes.json ladder verified)
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 12 });
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 100, maxHp: 183, actualHeal: 5 });
    applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 5, oldHp: 1, newHp: 6, maxHp: 11 });
  });

  it('honors the initiative-armed target (CLA-160 lane): heals it via applyHealingToTarget choke', async () => {
    targetResolver.resolveTarget.mockResolvedValue({ target: woundedBandit, cs: combatCs });
    damageUtils.getCombatContext.mockResolvedValue(combatCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    expect(result.type).toBe('modal');
    expect(result.payload.pending).toBeUndefined();
    expect(result.payload.targetName).toBe('Bandit 1');
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(combatCs, 'Bandit 1', 12, campaignName);
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      targetName: 'Bandit 1',
      actualHeal: 5,
    }));
  });

  it('presents a target picker when no armed target (CLA-163 seam): no roll, no heal before confirm', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue(combatCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    expect(result.type).toBe('modal');
    expect(result.payload.pending).toBe(true);
    expect(result.payload.creatureTargets.map(t => t.name)).toEqual(expect.arrayContaining(['Disciplined_Monk', 'Bandit 1']));
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
  });

  it('picker confirm heals the chosen wounded target with canonical d12+WIS and logs the Focus Point spend', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue(combatCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);
    const payload = await result.payload.confirmHeal('Bandit 1');

    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d12');
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(combatCs, 'Bandit 1', 12, campaignName);
    expect(payload.targetName).toBe('Bandit 1');
    expect(payload.formula).toBe('1d12 + 7');
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      targetName: 'Bandit 1',
      actualHeal: 5,
    }));
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'Disciplined_Monk',
      abilityName: 'Hand of Healing',
      description: expect.stringContaining('expended 1 Focus Point to use Hand of Healing on Bandit 1'),
    }));
  });

  it('self-heal remains selectable: picker skip heals the monk at HP cap with honest zero delta', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue(combatCs);
    applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 0, oldHp: 183, newHp: 183, maxHp: 183 });

    const result = await handle(hohAction, monkStats, campaignName, null, []);
    const payload = await result.payload.confirmHeal('Disciplined_Monk');

    expect(payload.targetName).toBe('Disciplined_Monk');
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      description: expect.stringContaining('Already at full HP'),
    }));
  });

  it('records the canonical 2024 lv20 d12 die in the formula (die axis disproved, classes.json untouched)', async () => {
    targetResolver.resolveTarget.mockResolvedValue({ target: woundedBandit, cs: combatCs });
    damageUtils.getCombatContext.mockResolvedValue(combatCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    expect(result.payload.formula).toContain('1d12');
    expect(result.payload.formula).not.toContain('1d10');
  });

  it('outside combat (no combat context) falls back to self via applyHealingDirectly', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    expect(result.type).toBe('modal');
    expect(result.payload.pending).toBeUndefined();
    expect(result.payload.targetName).toBe('Disciplined_Monk');
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
  });
});
