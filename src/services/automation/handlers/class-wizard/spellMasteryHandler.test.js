import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
  loadSpells: vi.fn(),
}));

import { handle, onSpellMasterySelected } from './spellMasteryHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 14,
    proficiency: 6,
    rules: '2024',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Spell Mastery',
    automation: { type: 'spell_mastery', ...automation },
  };
}

describe('spellMasteryHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return modal with eligible spells', async () => {
    const mockSpells = [
      { name: 'Magic Missile', level: 1, casting_time: 'Action', range: '120 ft', description: 'Three darts', classes: ['Sorcerer', 'Wizard'] },
      { name: 'Shield', level: 1, casting_time: '1 Action', range: 'Self', description: 'Armor', classes: ['Sorcerer', 'Wizard'] },
      { name: 'Web', level: 2, casting_time: 'Action', range: '60 ft', description: 'Spidersilk', classes: ['Wizard'] },
      { name: 'Burning Hands', level: 1, casting_time: 'Bonus Action', range: 'Self', description: 'Fire', classes: ['Sorcerer'] },
      { name: 'Fireball', level: 3, casting_time: 'Action', range: '150 ft', description: 'Explosion', classes: ['Sorcerer', 'Wizard'] },
      { name: 'Aid', level: 2, casting_time: 'Action', range: '30 ft', description: 'Boost', classes: ['Cleric', 'Paladin'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('spellMastery');
    expect(result.payload.level1Options).toEqual(['Magic Missile', 'Shield']);
    expect(result.payload.level2Options).toEqual(['Web']);
    expect(result.payload.currentLevel1).toBe('');
    expect(result.payload.currentLevel2).toBe('');
  });

  it('should filter out spells with casting time that is not an action', async () => {
    const mockSpells = [
      { name: 'Reaction Spell', level: 1, casting_time: 'Reaction', range: '', description: '', classes: ['Wizard'] },
      { name: 'Bonus Action Spell', level: 1, casting_time: '1 Bonus Action', range: '', description: '', classes: ['Wizard'] },
      { name: 'Good Spell', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Wizard'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.level1Options).toEqual(['Good Spell']);
  });

  it('should filter out spells outside level 1-2', async () => {
    const mockSpells = [
      { name: 'Cantrip', level: 0, casting_time: 'Action', range: '', description: '', classes: ['Wizard'] },
      { name: 'Level 3 Spell', level: 3, casting_time: 'Action', range: '', description: '', classes: ['Wizard'] },
      { name: 'Level 5 Spell', level: 5, casting_time: 'Action', range: '', description: '', classes: ['Wizard'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No level 1 or 2 wizard spells with casting time of an action available.');
  });

  it('should return popup when no eligible spells', async () => {
    loadSpells.mockResolvedValue([]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No level 1 or 2 wizard spells with casting time of an action available.');
  });

  it('should load spells with rules from playerStats', async () => {
    const mockSpells = [{ name: 'Test', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Wizard'] }];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    await handle(makeAction(), makePlayerStats({ rules: '5e' }), campaignName, null);

    expect(loadSpells).toHaveBeenCalledWith('5e');
  });

  it('should include optionDetails for all eligible spells', async () => {
    const mockSpells = [
      { name: 'Magic Missile', level: 1, casting_time: 'Action', range: '120 ft', description: 'Three darts', damage: '3d4+1', classes: ['Sorcerer', 'Wizard'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.optionDetails['Magic Missile']).toEqual({
      name: 'Magic Missile',
      level: 1,
      casting_time: 'Action',
      range: '120 ft',
      description: 'Three darts',
      damage: '3d4+1',
    });
  });

  it('should handle missing casting_time by defaulting to 1 action', async () => {
    const mockSpells = [
      { name: 'Missing Casting Time', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Wizard'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.optionDetails['Missing Casting Time'].casting_time).toBe('Action');
  });

  it('should handle missing range by defaulting to empty', async () => {
    const mockSpells = [
      { name: 'Missing Range', level: 1, casting_time: 'Action', description: '', classes: ['Wizard'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.optionDetails['Missing Range'].range).toBe('');
  });

  it('should handle missing description by defaulting to empty', async () => {
    const mockSpells = [
      { name: 'Missing Desc', level: 1, casting_time: 'Action', range: '', classes: ['Wizard'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.optionDetails['Missing Desc'].description).toBe('');
  });

  it('should handle missing damage by defaulting to null', async () => {
    const mockSpells = [
      { name: 'No Damage', level: 1, casting_time: 'Action', range: '', classes: ['Wizard'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.optionDetails['No Damage'].damage).toBeNull();
  });

  it('should return currentLevel1 and currentLevel2 from runtime when already selected', async () => {
    const mockSpells = [{ name: 'Magic Missile', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Wizard'] }];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'SpellMastery_level1') return 'Magic Missile';
      if (key === 'SpellMastery_level2') return 'Web';
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.payload.currentLevel1).toBe('Magic Missile');
    expect(result.payload.currentLevel2).toBe('Web');
  });

  it('should not include level 0 spells', async () => {
    const mockSpells = [
      { name: 'Cantrip', level: 0, casting_time: 'Action', range: '', description: '', classes: ['Wizard'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No level 1 or 2 wizard spells with casting time of an action available.');
  });

  it('should return modal with current selection when spells are already chosen', async () => {
    const mockSpells = [
      { name: 'Magic Missile', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Wizard'] },
      { name: 'Web', level: 2, casting_time: 'Action', range: '', description: '', classes: ['Wizard'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'SpellMastery_level1') return 'Magic Missile';
      if (key === 'SpellMastery_level2') return 'Web';
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.payload.level1Options).toEqual(['Magic Missile']);
    expect(result.payload.level2Options).toEqual(['Web']);
    expect(result.payload.currentLevel1).toBe('Magic Missile');
    expect(result.payload.currentLevel2).toBe('Web');
    expect(result.payload.optionDetails).toBeUndefined();
  });

  it('should filter out non-wizard spells like Aid (Cleric/Paladin only)', async () => {
    const mockSpells = [
      { name: 'Aid', level: 2, casting_time: 'Action', range: '30 ft', description: 'Boost HP', classes: ['Cleric', 'Paladin'] },
      { name: 'Healing Word', level: 1, casting_time: 'Bonus Action', range: '60 ft', description: 'Heal', classes: ['Cleric', 'Druid'] },
      { name: 'Magic Missile', level: 1, casting_time: 'Action', range: '120 ft', description: 'Force darts', classes: ['Sorcerer', 'Wizard'] },
      { name: 'Web', level: 2, casting_time: 'Action', range: '60 ft', description: 'Restraining web', classes: ['Wizard'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.payload.level1Options).toEqual(['Magic Missile']);
    expect(result.payload.level2Options).toEqual(['Web']);
    expect(result.payload.level1Options).not.toContain('Aid');
    expect(result.payload.level2Options).not.toContain('Aid');
  });

  it('should filter out spells where wizard is not in classes array', async () => {
    const mockSpells = [
      { name: 'Burning Hands', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Sorcerer'] },
      { name: 'Cure Wounds', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Cleric', 'Druid', 'Paladin'] },
      { name: 'Shield', level: 1, casting_time: '1 Action', range: 'Self', description: '', classes: ['Sorcerer', 'Wizard'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.level1Options).toEqual(['Shield']);
    expect(result.payload.level1Options).not.toContain('Burning Hands');
    expect(result.payload.level1Options).not.toContain('Cure Wounds');
  });

  it('should return popup when only non-wizard spells are available', async () => {
    const mockSpells = [
      { name: 'Aid', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Cleric', 'Paladin'] },
      { name: 'Healing Word', level: 2, casting_time: 'Bonus Action', range: '', description: '', classes: ['Cleric', 'Druid'] },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No level 1 or 2 wizard spells with casting time of an action available.');
  });
});

describe('spellMasteryHandler.onSpellMasterySelected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clear selection when both are null', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, null, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Spell Mastery selection cleared.');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level1', null, campaignName, true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level2', null, campaignName, true);
  });

  it('should return error when level1 is missing', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, null, 'Web');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Both a level 1 and level 2 spell must be selected, and they must be different spells.');
  });

  it('should return error when level2 is missing', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Both a level 1 and level 2 spell must be selected, and they must be different spells.');
  });

  it('should return error when both are empty strings', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, '', '');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Both a level 1 and level 2 spell must be selected, and they must be different spells.');
  });

  it('should return error when same spell is selected for both slots', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Magic Missile');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Both a level 1 and level 2 spell must be selected, and they must be different spells.');
  });

  it('should set runtime values for selected spells', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Web');

    expect(result.type).toBe('popup');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level1', 'Magic Missile', campaignName, true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level2', 'Web', campaignName, true);
  });

  it('should return success popup with spell names', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Web');

    expect(result.payload.description).toContain('Magic Missile');
    expect(result.payload.description).toContain('Web');
    expect(result.payload.description).toContain('at will');
    expect(result.payload.description).toContain('always prepared');
  });

  it('should include HTML formatting in description', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Web');

    expect(result.payload.description).toContain('<b>Magic Missile</b>');
    expect(result.payload.description).toContain('<b>Web</b>');
  });

  it('should include automation in popup payload', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Web');

    expect(result.payload.automation).toEqual(makeAction().automation);
  });

  it('should use action.name in result', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Web');

    expect(result.payload.name).toBe('Spell Mastery');
  });
});
