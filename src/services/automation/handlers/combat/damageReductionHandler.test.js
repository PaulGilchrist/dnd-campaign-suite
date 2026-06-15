import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../combat/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

import { handle } from './damageReductionHandler.js';
import * as automationService from '../../../combat/automationService.js';
import * as logService from '../../../ui/logService.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Kazuki',
    level: 3,
    class: { name: 'Monk' },
    abilities: [],
    ...overrides,
  };
}

function makeAction(automation = {}, overrides = {}) {
  return {
    name: 'Slow Fall',
    automation: {
      type: 'damage_reduction',
      reductionExpression: '5 * monk level',
      trigger: 'falling',
      reaction: true,
      casting_time: '1 reaction',
      ...automation,
    },
    ...overrides,
  };
}

function resetMocks() {
  automationService.evaluateAutoExpression.mockClear().mockReset();
  logService.addEntry.mockClear().mockResolvedValue({});
}

beforeEach(() => resetMocks());

describe('handle', () => {
  it('evaluates the reduction expression and returns a popup', async () => {
    automationService.evaluateAutoExpression.mockReturnValue(15);
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith(
      '5 * monk level', ps
    );
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Slow Fall',
        automationType: 'damage_reduction',
        description: 'Slow Fall: Reduce damage by <strong>15</strong>. Trigger: falling.',
        automation: action.automation,
      },
    });
  });

  it('logs the ability use in the party log', async () => {
    automationService.evaluateAutoExpression.mockReturnValue(15);
    const action = makeAction();
    const ps = makePlayerStats();

    await handle(action, ps, campaignName);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'Kazuki',
      abilityName: 'Slow Fall',
      description: 'Kazuki used Slow Fall to reduce damage by 15.',
    });
  });

  it('handles dice expressions (string result)', async () => {
    automationService.evaluateAutoExpression.mockReturnValue('1d10 + 3');
    const action = makeAction({ reductionExpression: '1d10 + DEX modifier' });
    const ps = makePlayerStats({ abilities: [{ name: 'Dexterity', score: 16 }] });

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('1d10 + 3');
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'Kazuki',
      abilityName: 'Slow Fall',
      description: 'Kazuki used Slow Fall to reduce damage by 1d10 + 3.',
    });
  });

  it('handles null/undefined evaluateAutoExpression gracefully', async () => {
    automationService.evaluateAutoExpression.mockReturnValue(null);
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('5 * monk level');
    expect(logService.addEntry).toHaveBeenCalled();
  });

  it('includes trigger in the popup description', async () => {
    automationService.evaluateAutoExpression.mockReturnValue(15);
    const action = makeAction({ trigger: 'falling' });
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('Trigger: falling');
  });

  it('omits trigger line when trigger is empty', async () => {
    automationService.evaluateAutoExpression.mockReturnValue(15);
    const action = makeAction({ trigger: '' });
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).not.toContain('Trigger:');
  });

  it('blocks when requiresShieldOrWeapon is true and no shield/weapon equipped', async () => {
    const action = makeAction({
      type: 'damage_reduction',
      reductionExpression: '1d10 + proficiency_bonus',
      trigger: 'creature_hits_ally_within_5ft',
      reaction: true,
      requiresShieldOrWeapon: true,
      casting_time: '1 reaction',
    });
    const ps = makePlayerStats({
      inventory: { equipped: [] },
      equipment: [],
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('must be holding a Shield or a Simple or Martial weapon');
    expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
  });

  it('allows when requiresShieldOrWeapon is true and shield is equipped', async () => {
    automationService.evaluateAutoExpression.mockReturnValue(12);
    const action = makeAction({
      type: 'damage_reduction',
      reductionExpression: '1d10 + proficiency_bonus',
      trigger: 'creature_hits_ally_within_5ft',
      reaction: true,
      requiresShieldOrWeapon: true,
      casting_time: '1 reaction',
    });
    const ps = makePlayerStats({
      inventory: { equipped: ['Shield'] },
      equipment: [{ name: 'Shield', equipment_category: 'Shield' }],
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Reduce damage by <strong>12</strong>');
    expect(automationService.evaluateAutoExpression).toHaveBeenCalled();
  });

  it('allows when requiresShieldOrWeapon is true and martial weapon is equipped', async () => {
    automationService.evaluateAutoExpression.mockReturnValue(12);
    const action = makeAction({
      type: 'damage_reduction',
      reductionExpression: '1d10 + proficiency_bonus',
      trigger: 'creature_hits_ally_within_5ft',
      reaction: true,
      requiresShieldOrWeapon: true,
      casting_time: '1 reaction',
    });
    const ps = makePlayerStats({
      inventory: { equipped: ['Longsword'] },
      equipment: [{ name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee' }],
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Reduce damage by <strong>12</strong>');
    expect(automationService.evaluateAutoExpression).toHaveBeenCalled();
  });

  it('allows when requiresShieldOrWeapon is true and simple weapon is equipped', async () => {
    automationService.evaluateAutoExpression.mockReturnValue(12);
    const action = makeAction({
      type: 'damage_reduction',
      reductionExpression: '1d10 + proficiency_bonus',
      trigger: 'creature_hits_ally_within_5ft',
      reaction: true,
      requiresShieldOrWeapon: true,
      casting_time: '1 reaction',
    });
    const ps = makePlayerStats({
      inventory: { equipped: ['Dart'] },
      equipment: [{ name: 'Dart', equipment_category: 'Weapon', weapon_range: 'Ranged' }],
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Reduce damage by <strong>12</strong>');
  });

  it('does not check shield/weapon when requiresShieldOrWeapon is false', async () => {
    automationService.evaluateAutoExpression.mockReturnValue(15);
    const action = makeAction({ requiresShieldOrWeapon: false });
    const ps = makePlayerStats({
      inventory: { equipped: [] },
      equipment: [],
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Reduce damage by <strong>15</strong>');
  });

  it('handles magic shield (+1 Shield)', async () => {
    automationService.evaluateAutoExpression.mockReturnValue(12);
    const action = makeAction({
      type: 'damage_reduction',
      reductionExpression: '1d10 + proficiency_bonus',
      trigger: 'creature_hits_ally_within_5ft',
      reaction: true,
      requiresShieldOrWeapon: true,
      casting_time: '1 reaction',
    });
    const ps = makePlayerStats({
      inventory: { equipped: ['+1 Shield'] },
      equipment: [{ name: 'Shield', equipment_category: 'Shield' }],
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Reduce damage by <strong>12</strong>');
  });
});
