import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
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

// ── Imports ────────────────────────────────────────────────────

import { handle, applyRiderOption } from './attackRiderHandler.js';
import * as useRuntimeState from '../../../../hooks/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 3,
    proficiencyBonus: 2,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Giant Crusher',
    automation: {
      type: 'attack_rider',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('attackRiderHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return popup when options is empty', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ options: [] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe(action.name);
    expect(result.payload.automationType).toBe('attack_rider');
  });

  it('should return modal when options exist AND chooseOne is true', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Option A' }],
      chooseOne: true,
    });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('attackRider');
  });

  it('should return modal when options exist AND maxEffects > 1', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Option A' }, { name: 'Option B' }],
      maxEffects: 2,
    });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('attackRider');
  });

  it('should return popup when options exist but chooseOne is false and maxEffects <= 1', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Option A' }],
      chooseOne: false,
      maxEffects: 1,
    });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
  });

  it('should include targetName in modal payload when combat context has a target', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Option A' }],
      chooseOne: true,
    });

    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBe('Goblin');
  });

  it('should include null targetName in modal payload when no combat context', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Option A' }],
      chooseOne: true,
    });

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBeNull();
  });

  it('should call addEntry with correct ability_use data', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ options: [] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: ps.name,
      abilityName: action.name,
      description: `${action.name} used`,
    });
  });

  it('should call addEntry with target name in description when target exists', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ options: [] });

    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: ps.name,
      abilityName: action.name,
      description: `${action.name} used against Orc`,
    });
  });

  it('should call addEntry without target name when no target', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ options: [] });

    damageUtils.getCombatContext.mockResolvedValue(null);

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: ps.name,
      abilityName: action.name,
      description: `${action.name} used`,
    });
  });
});

describe('attackRiderHandler.applyRiderOption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no options match the given names', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Option A' }, { name: 'Option B' }],
    });

    const result = await applyRiderOption(action, ps, campaignName, 'Target', ['Nonexistent']);

    expect(result).toBeNull();
  });

  it('should return null when optionNames is empty array', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Option A' }],
    });

    const result = await applyRiderOption(action, ps, campaignName, 'Target', []);

    expect(result).toBeNull();
  });

  it('should handle single option name as string (not array)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Option A', effect: 'push_15ft' }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', 'Option A');

    expect(result).not.toBeNull();
    expect(result.type).toBe('popup');
  });

  it('should handle optionNames as array of strings', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [
        { name: 'Option A', effect: 'push_15ft' },
        { name: 'Option B', effect: 'speed_reduction' },
      ],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', ['Option A', 'Option B']);

    expect(result).not.toBeNull();
    expect(result.type).toBe('popup');
  });

  it('should call setRuntimeValue to clear pendingRiderChoice', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Option A', effect: 'push_15ft' }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    await applyRiderOption(action, ps, campaignName, 'Target', 'Option A');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'pendingRiderChoice',
      null,
      campaignName,
    );
  });

  it('should return single popup when one option chosen', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Option A', effect: 'push_15ft' }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', 'Option A');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
  });

  it('should return combined popup when multiple options chosen', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [
        { name: 'Push', effect: 'push_15ft' },
        { name: 'Slow', effect: 'speed_reduction' },
      ],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', ['Push', 'Slow']);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Applied to Target:');
    expect(result.payload.description).toContain('Push');
    expect(result.payload.description).toContain('Slow');
  });

  it('should include effect descriptions for disadvantage_on_next_save', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Cursed Strike', effect: 'disadvantage_on_next_save' }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', 'Cursed Strike');

    expect(result.payload.description).toContain('target has Disadvantage on the next saving throw it makes');
  });

  it('should include effect descriptions for noOpportunityAttacks', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Controlled Push', noOpportunityAttacks: true }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', 'Controlled Push');

    expect(result.payload.description).toContain('target cannot make Opportunity Attacks until the start of your next turn');
  });

  it('should include effect descriptions for next_attack_advantage with value', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Blessed Strike', effect: 'next_attack_advantage', value: 7 }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', 'Blessed Strike');

    expect(result.payload.description).toContain('the next attack against Target gains +7');
  });

  it('should include effect descriptions for push_15ft', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [
        { name: 'Shove', effect: 'push_15ft' },
        { name: 'Slow', effect: 'speed_reduction' },
      ],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', ['Shove', 'Slow']);

    expect(result.payload.description).toContain('target pushed 15 ft away');
  });

  it('should include effect descriptions for speed_reduction', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [
        { name: 'Shove', effect: 'push_15ft' },
        { name: 'Weakening Touch', effect: 'speed_reduction' },
      ],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', ['Shove', 'Weakening Touch']);

    expect(result.payload.description).toContain('target Speed reduced by 15 ft');
  });
});

describe('attackRiderHandler.applyRiderEffect (via applyRiderOption)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return "no target selected" popup when targetName is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Option A', effect: 'push_15ft' }],
    });

    const result = await applyRiderOption(action, ps, campaignName, null, 'Option A');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No target selected');
    expect(result.payload.description).toContain('effect noted for manual application');
  });

  it('should store effect in targetEffects runtime state when targetName exists', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Push', effect: 'push_15ft' }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    await applyRiderOption(action, ps, campaignName, 'Target', 'Push');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      campaignName,
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Target',
          source: action.name,
          option: 'Push',
          effect: 'push_15ft',
        }),
      ]),
      campaignName,
    );
  });

  it('should call setRuntimeValue with updated effects array', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Push', effect: 'push_15ft' }],
    });

    const existingEffects = [
      { target: 'OldTarget', effect: 'speed_reduction' },
    ];
    useRuntimeState.getRuntimeValue.mockReturnValue(existingEffects);

    await applyRiderOption(action, ps, campaignName, 'Target', 'Push');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      campaignName,
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({ target: 'OldTarget' }),
        expect.objectContaining({ target: 'Target', effect: 'push_15ft' }),
      ]),
      campaignName,
    );
  });

  it('should include noOpportunityAttacks in effect description popup', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Controlled Push', noOpportunityAttacks: true }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', 'Controlled Push');

    expect(result.payload.description).toContain('target cannot make Opportunity Attacks until the start of your next turn');
  });

  it('should include disadvantage_on_next_save in effect description popup', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Cursed Strike', effect: 'disadvantage_on_next_save' }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', 'Cursed Strike');

    expect(result.payload.description).toContain('target has Disadvantage on the next saving throw it makes');
  });

  it('should include next_attack_advantage with custom value in popup', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Blessed Strike', effect: 'next_attack_advantage', value: 7 }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const result = await applyRiderOption(action, ps, campaignName, 'Target', 'Blessed Strike');

    expect(result.payload.description).toContain('the next attack against Target gains +7');
  });
});
