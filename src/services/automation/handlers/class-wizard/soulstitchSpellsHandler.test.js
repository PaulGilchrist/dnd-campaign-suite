import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { handle, applySoulstitchSelection } from './soulstitchSpellsHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import * as logService from '../../../../services/ui/logService.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 14,
    proficiency: 6,
    class: { class_levels: [{ level: 14 }] },
    ...overrides,
  };
}

function makeAction(automation = {}, spell = {}) {
  return {
    name: 'Soulstitch Spells',
    automation: { type: 'soulstitch', ...automation },
    spell,
  };
}

describe('soulstitchSpellsHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null for non-Evocation spell', async () => {
    const action = makeAction({}, { school: 'Transmutation' });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should return null for Evocation spell without save', async () => {
    const action = makeAction({}, { school: 'Evocation', dc: null });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should return null when no combat context', async () => {
    const action = makeAction({}, { school: 'Evocation', dc: 15 });
    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should return null when combat context has no creatures', async () => {
    const action = makeAction({}, { school: 'Evocation', dc: 15 });
    damageUtils.getCombatContext.mockResolvedValue({});

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should return null when spell school comparison fails (case mismatch)', async () => {
    const action = makeAction({}, { school: 'Evocation', dc: 15, name: 'Fireball' });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin1' }],
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should get spell slot level from action.spellSlotLevel when set', async () => {
    const action = makeAction({}, { school: 'Evocation', dc: 15 });
    action.spellSlotLevel = 3;
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin1' }],
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should get spell slot level from spell.level when action.spellSlotLevel is not set', async () => {
    const action = makeAction({}, { school: 'Evocation', dc: 15, level: 2 });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin1' }],
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should exclude self from eligible targets', async () => {
    const action = makeAction({}, { school: 'Evocation', dc: 15 });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Ally1' },
        { name: 'TestWizard' },
        { name: 'Enemy1' },
      ],
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should get previously chosen creatures from runtime', async () => {
    const action = makeAction({}, { school: 'Evocation', dc: 15 });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin1' }],
    });
    useRuntimeState.getRuntimeValue.mockReturnValue(['Goblin1']);

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should default featureName to Soulstitch Spells when action.name is missing', async () => {
    const action = {
      automation: { type: 'soulstitch' },
      spell: { school: 'Evocation', dc: 15 },
    };
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin1' }],
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should get spell from action.payload.spell when action.spell is not set', async () => {
    const action = {
      name: 'Soulstitch Spells',
      automation: { type: 'soulstitch' },
      payload: { spell: { school: 'Evocation', dc: 15, name: 'Lightning Bolt' } },
    };
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin1' }],
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });

  it('should default spellName to Unknown when spell name is missing', async () => {
    const action = makeAction({}, { school: 'Evocation', dc: 15 });
    action.spell.name = undefined;
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin1' }],
    });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });
});

describe('soulstitchSpellsHandler.applySoulstitchSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return popup when no creatures selected', async () => {
    const result = await applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, []);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No creatures chosen');
  });

  it('should return popup when null selectedNames', async () => {
    const result = await applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No creatures chosen');
  });

  it('should store selected creatures in runtime with timestamp-based key', async () => {
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    const selectedNames = ['Goblin1', 'Goblin2'];

    await applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, selectedNames);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard',
      expect.stringMatching(/_Soulstitch_Spells_cast_/),
      selectedNames,
      campaignName,
    );
  });

  it('should store persistent active key', async () => {
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    const selectedNames = ['Goblin1'];

    await applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, selectedNames);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard',
      '_Soulstitch_Spells_active',
      selectedNames,
      campaignName,
    );
  });

  it('should call addEntry with ability_use', async () => {
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    const selectedNames = ['Goblin1', 'Goblin2'];

    await applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, selectedNames);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestWizard',
      abilityName: 'Soulstitch Spells',
    }));
  });

  it('should return success popup with creature names', async () => {
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    const selectedNames = ['Goblin1', 'Goblin2'];

    const result = await applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, selectedNames);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Goblin1, Goblin2');
    expect(result.payload.description).toContain('automatically succeed on saves');
  });

  it('should use custom featureName from action.name', async () => {
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    const customAction = {
      name: 'Custom Soulstitch',
      automation: { type: 'soulstitch' },
      spell: { school: 'Evocation', dc: 15 },
    };

    const result = await applySoulstitchSelection(customAction, makePlayerStats(), campaignName, ['Goblin1']);

    expect(result.payload.name).toBe('Custom Soulstitch');
    expect(result.payload.description).toContain('Custom Soulstitch');
  });

  it('should include automation in popup payload', async () => {
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, ['Goblin1']);

    expect(result.payload.automation).toEqual(makeAction().automation);
  });
});
