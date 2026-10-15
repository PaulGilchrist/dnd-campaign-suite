// @maintained-by-ai
// Unit lane for handle()'s activation state machine: already-active guard, rest-use
// tracking, level-5 spell slot consumption, flight-buff writes (default, custom,
// carry-over, null fallback, dedupe) on both activation paths, aura-target reset,
// and resilience to addEntry rejection / missing combat context.
// Frightful aura population via handle() lives in avengingAngelHandler.frightfulAura.test.js;
// pure readers isAuraTarget()/isActive() and damage cleanup have sibling suites.
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

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn().mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve({ success: false, roll: 12, total: 15 }),
  }),
  buildSaveDc: vi.fn().mockReturnValue(14),
}));

import { handle } from './avengingAngelHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import utils from '../../../ui/utils.js';

const campaignName = 'test-campaign';

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

describe('avengingAngelHandler.handle - activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return popup and NOT change state when already active', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return true;
      if (key === 'activeBuffs') return [
        { name: 'Other Buff', effect: 'other' },
        { name: 'Avenging Angel', effect: 'avenging_angel_flight' },
      ];
      if (key === 'avengingAngelAuraTargets') return ['Target1'];
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Avenging Angel is already active.');
    expect(result.payload.automationType).toBe('avenging_angel');
    expect(result.payload.automation).toEqual(makeAction().automation);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('should consume a level 5 spell slot and reactivate when already used this rest period', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'avengingAngelRestUsed') return true;
      if (key === 'spell_slots_level_5') return 2;
      if (key === 'activeBuffs') return [];
      return null;
    });
    utils.guid.mockReturnValue('test-guid');

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Avenging Angel activated by expending a level 5 spell slot!');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'spell_slots_level_5', 1, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', true, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestPaladin',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({ effect: 'avenging_angel_flight', flySpeed: 60, hover: false }),
      ]),
      campaignName,
    );
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestPaladin',
      abilityName: 'Avenging Angel',
      description: 'TestPaladin reactivated Avenging Angel by expending a level 5 spell slot.',
    }));
  });

  it('should show cannot be used popup when already used and no level 5 slots available', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'avengingAngelRestUsed') return true;
      if (key === 'spell_slots_level_5') return 0;
      if (key === 'activeBuffs') return [];
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Avenging Angel cannot be used again until a long rest or level 5 spell slot becomes available.');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('should set restUsed flag and all state on first use', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    utils.guid.mockReturnValue('test-guid');

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
    expect(result.payload.description).toContain('Fly Speed 60 feet');
    expect(result.payload.description).toContain('hover');
    expect(result.payload.description).toContain('Frightful Aura');
    expect(result.payload.automationType).toBe('avenging_angel');
    expect(result.payload.automation).toEqual(makeAction().automation);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', true, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelRestUsed', true, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestPaladin',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({ flySpeed: 60, hover: false }),
      ]),
      campaignName,
    );
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelAuraTargets', [], campaignName);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestPaladin',
      abilityName: 'Avenging Angel',
      description: 'Avenging Angel activated — Flight 60 ft (hover), Frightful Aura active for 10 minutes.',
    }));
  });

  it('should use custom flySpeed and hover from automation', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    utils.guid.mockReturnValue('test-guid');

    const customAction = makeAction({ flySpeed: 50, hover: true });
    await handle(customAction, makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestPaladin',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({ flySpeed: 50, hover: true }),
      ]),
      campaignName,
    );
  });

  it('should add existing buffs alongside the new flight buff', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [{ name: 'Divine Shield', effect: 'divine_shield' }];
      return null;
    });
    utils.guid.mockReturnValue('test-guid');

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestPaladin',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({ name: 'Divine Shield', effect: 'divine_shield' }),
        expect.objectContaining({ effect: 'avenging_angel_flight' }),
      ]),
      campaignName,
    );
  });

  it('should handle null activeBuffs gracefully', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return null;
      return null;
    });
    utils.guid.mockReturnValue('test-guid');

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestPaladin',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({ effect: 'avenging_angel_flight' }),
      ]),
      campaignName,
    );
  });

  it('should not add duplicate buff when Avenging Angel already in activeBuffs (first use path)', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [{ name: 'Avenging Angel', effect: 'avenging_angel_flight' }];
      return null;
    });
    utils.guid.mockReturnValue('test-guid');

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestPaladin',
      'activeBuffs',
      [{ name: 'Avenging Angel', effect: 'avenging_angel_flight' }],
      campaignName,
    );
  });

  it('should not duplicate buff when Avenging Angel already in activeBuffs (spell slot reactivation)', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'avengingAngelRestUsed') return true;
      if (key === 'spell_slots_level_5') return 1;
      if (key === 'activeBuffs') return [{ name: 'Avenging Angel', effect: 'avenging_angel_flight' }];
      return null;
    });
    utils.guid.mockReturnValue('test-guid');

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestPaladin',
      'activeBuffs',
      [{ name: 'Avenging Angel', effect: 'avenging_angel_flight' }],
      campaignName,
    );
  });

  it('should still activate and return popup when addEntry rejects (first use path)', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    utils.guid.mockReturnValue('test-guid');
    addEntry.mockRejectedValueOnce(new Error('disk error'));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', true, campaignName);
  });

  it('should still reactivate and return popup when addEntry rejects (spell-slot path)', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'avengingAngelRestUsed') return true;
      if (key === 'spell_slots_level_5') return 1;
      if (key === 'activeBuffs') return [];
      return null;
    });
    utils.guid.mockReturnValue('test-guid');
    addEntry.mockRejectedValueOnce(new Error('disk error'));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('expending a level 5 spell slot');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'avengingAngelActive', true, campaignName);
  });

  // The null-context operand is implicitly exercised by every other test here
  // (getCombatContext is left unmocked, resolving to undefined). This pins the
  // distinct second operand of the guard: a context object without creatures.
  it('should complete activation when combat context exists but has no creatures', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });
    utils.guid.mockReturnValue('test-guid');
    getCombatContext.mockResolvedValue({ creatures: undefined });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestPaladin',
      abilityName: 'Avenging Angel',
      description: 'Avenging Angel activated — Flight 60 ft (hover), Frightful Aura active for 10 minutes.',
    }));
  });
});
