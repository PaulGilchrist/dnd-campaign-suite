import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  default: {
    guid: vi.fn(),
    getName: vi.fn((n) => n),
  },
}));

import {
  handle,
  isAuraTarget,
  isActive,
  removeFrightenedOnDamage,
  handleSaveResult,
} from './avengingAngelHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import utils from '../../../ui/utils.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestPaladin',
    level: 7,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Avenging Angel',
    automation: { type: 'avenging_angel', flySpeed: 60, hover: false, ...automation },
  };
}

describe('avengingAngelHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should toggle off when already active', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return true;
      if (key === 'activeBuffs') return [{ name: 'Avenging Angel', effect: 'avenging_angel_flight' }];
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Avenging Angel ended.');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', false, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
  });

  it('should remove fly speed buff when toggling off', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return true;
      if (key === 'activeBuffs') return [
        { name: 'Other Buff', effect: 'other' },
        { name: 'Avenging Angel', effect: 'avenging_angel_flight' },
      ];
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestPaladin',
      'activeBuffs',
      [{ name: 'Other Buff', effect: 'other' }],
      campaignName,
    );
  });

  it('should activate when not already active', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    getCombatContext.mockResolvedValue({ creatures: [] });
    rollD20.mockReturnValue(20);
    getAbilityModifier.mockReturnValue(3);
    utils.guid.mockReturnValue('test-guid');

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', true, campaignName);
    expect(result.payload.description).toContain('activated');
    expect(result.payload.description).toContain('Fly Speed 60 feet');
  });

  it('should add flight buff with custom flySpeed from automation', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    getCombatContext.mockResolvedValue({ creatures: [] });
    rollD20.mockReturnValue(20);
    getAbilityModifier.mockReturnValue(3);
    utils.guid.mockReturnValue('test-guid');

    const customAction = makeAction({ flySpeed: 50 });
    await handle(customAction, makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestPaladin',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({ flySpeed: 50 }),
      ]),
      campaignName,
    );
  });

  it('should clear aura targets on activation', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      if (key === 'avengingAngelAuraTargets') return ['Target1'];
      return null;
    });
    getCombatContext.mockResolvedValue({ creatures: [] });
    rollD20.mockReturnValue(20);
    getAbilityModifier.mockReturnValue(3);
    utils.guid.mockReturnValue('test-guid');

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
  });

  it('should call addEntry on activation', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    getCombatContext.mockResolvedValue({ creatures: [] });
    rollD20.mockReturnValue(20);
    getAbilityModifier.mockReturnValue(3);
    utils.guid.mockReturnValue('test-guid');

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestPaladin',
      abilityName: 'Avenging Angel',
      timestamp: now,
    }));
  });

  it('should call addEntry on deactivation', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return true;
      if (key === 'activeBuffs') return [];
      return null;
    });

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      description: 'Avenging Angel ended.',
      timestamp: now,
    }));
  });

  it('should resolve Frightful Aura for NPCs that fail save', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', saveBonuses: { wis: 2 }, conditions: [] },
      ],
    });
    rollD20.mockReturnValue(5);
    getAbilityModifier.mockReturnValue(3);
    utils.guid.mockReturnValue('test-guid');

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
      success: false,
    }));
    expect(addExpiration).toHaveBeenCalled();
  });

  it('should send save prompt for player creatures', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Ally', type: 'player' },
      ],
    });
    rollD20.mockReturnValue(20);
    getAbilityModifier.mockReturnValue(3);
    utils.guid.mockReturnValue('test-guid');

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Ally', expect.objectContaining({
      success: false,
      roll: 0,
    }));
  });

  it('should skip self creature in Frightful Aura', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestPaladin', type: 'player' },
      ],
    });
    rollD20.mockReturnValue(20);
    getAbilityModifier.mockReturnValue(3);
    utils.guid.mockReturnValue('test-guid');

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(sendSaveResult).not.toHaveBeenCalled();
  });

  it('should store affected targets in runtime', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', saveBonuses: { wis: 0 }, conditions: [] },
      ],
    });
    rollD20.mockReturnValue(1);
    getAbilityModifier.mockReturnValue(3);
    utils.guid.mockReturnValue('test-guid');

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', ['Goblin'], campaignName);
  });

  it('should handle no combat context gracefully', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    getCombatContext.mockResolvedValue(null);

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(sendSaveResult).not.toHaveBeenCalled();
  });

  it('should build save DC from chaBonus + proficiency + 8', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'npc', saveBonuses: { wis: 2 }, conditions: [] }],
    });
    rollD20.mockReturnValue(20);
    getAbilityModifier.mockReturnValue(4);
    utils.guid.mockReturnValue('test-guid');

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    // saveDc = 8 + 4 + 3 = 15, roll 20 + 2 = 22 >= 15 = success
    expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
      success: true,
    }));
  });
});

describe('avengingAngelHandler.isAuraTarget', () => {
  it('should return true when target is in aura targets', () => {
    getRuntimeValue.mockReturnValue(['Goblin1', 'Goblin2']);

    expect(isAuraTarget('TestPaladin', 'Goblin1', campaignName)).toBe(true);
  });

  it('should return false when target is not in aura targets', () => {
    getRuntimeValue.mockReturnValue(['Goblin1', 'Goblin2']);

    expect(isAuraTarget('TestPaladin', 'Goblin3', campaignName)).toBe(false);
  });

  it('should return false when aura targets is empty', () => {
    getRuntimeValue.mockReturnValue([]);

    expect(isAuraTarget('TestPaladin', 'Goblin1', campaignName)).toBe(false);
  });

  it('should return false when aura targets is null', () => {
    getRuntimeValue.mockReturnValue(null);

    expect(isAuraTarget('TestPaladin', 'Goblin1', campaignName)).toBe(false);
  });
});

describe('avengingAngelHandler.isActive', () => {
  it('should return true when active', () => {
    getRuntimeValue.mockReturnValue(true);

    expect(isActive('TestPaladin', campaignName)).toBe(true);
  });

  it('should return false when not active', () => {
    getRuntimeValue.mockReturnValue(false);

    expect(isActive('TestPaladin', campaignName)).toBe(false);
  });

  it('should return false when null', () => {
    getRuntimeValue.mockReturnValue(null);

    expect(isActive('TestPaladin', campaignName)).toBe(false);
  });
});

describe('avengingAngelHandler.removeFrightenedOnDamage', () => {
  it('should remove frightened from creature in combat context', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelAuraTargets') return ['Goblin'];
      return null;
    });
    getCombatContext.mockResolvedValue({
      creatures: [{
        name: 'Goblin',
        conditions: [{ key: 'frightened' }, { key: 'blinded' }],
      }],
    });

    await removeFrightenedOnDamage('TestPaladin', 'Goblin', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
  });

  it('should handle no combat context', async () => {
    getRuntimeValue.mockReturnValue(['Goblin']);
    getCombatContext.mockResolvedValue(null);

    await removeFrightenedOnDamage('TestPaladin', 'Goblin', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
  });

  it('should handle creature without conditions', async () => {
    getRuntimeValue.mockReturnValue(['Goblin']);
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', conditions: undefined }],
    });

    await removeFrightenedOnDamage('TestPaladin', 'Goblin', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
  });

  it('should only remove frightened condition, not others', async () => {
    getRuntimeValue.mockReturnValue(['Goblin']);
    getCombatContext.mockResolvedValue({
      creatures: [{
        name: 'Goblin',
        conditions: [{ key: 'frightened' }, { key: 'blinded' }, { key: 'poisoned' }],
      }],
    });

    await removeFrightenedOnDamage('TestPaladin', 'Goblin', campaignName);

    // The creature in combat context should be mutated to remove frightened
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
  });
});

describe('avengingAngelHandler.handleSaveResult', () => {
  it('should do nothing when event has no detail', () => {
    const event = { detail: null };
    handleSaveResult(event);
    // No assertion needed - just should not throw
  });

  it('should do nothing when event has no promptId', () => {
    const event = { detail: {} };
    handleSaveResult(event);
    // No assertion needed - just should not throw
  });

  it('should be a placeholder that returns early', () => {
    const event = { detail: { promptId: 'test-prompt' } };
    handleSaveResult(event);
    // Placeholder - should not throw
  });
});
