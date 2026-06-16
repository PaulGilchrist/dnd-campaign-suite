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
      { name: 'Magic Missile', level: 1, casting_time: 'Action', range: '120 ft', description: 'Three darts' },
      { name: 'Shield', level: 1, casting_time: '1 Action', range: 'Self', description: 'Armor' },
      { name: 'Web', level: 2, casting_time: 'Action', range: '60 ft', description: 'Spidersilk' },
      { name: 'Burning Hands', level: 1, casting_time: 'Bonus Action', range: 'Self', description: 'Fire' },
      { name: 'Fireball', level: 3, casting_time: 'Action', range: '150 ft', description: 'Explosion' },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('spellMastery');
    expect(result.payload.level1Options).toEqual(['Magic Missile', 'Shield']);
    expect(result.payload.level2Options).toEqual(['Web']);
    expect(result.payload.currentLevel1).toBeNull();
    expect(result.payload.currentLevel2).toBeNull();
  });

  it('should filter out spells with casting time that is not an action', async () => {
    const mockSpells = [
      { name: 'Reaction Spell', level: 1, casting_time: 'Reaction', range: '', description: '' },
      { name: 'Bonus Action Spell', level: 1, casting_time: '1 Bonus Action', range: '', description: '' },
      { name: 'Good Spell', level: 1, casting_time: 'Action', range: '', description: '' },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.level1Options).toEqual(['Good Spell']);
  });

  it('should filter out spells outside level 1-2', async () => {
    const mockSpells = [
      { name: 'Cantrip', level: 0, casting_time: 'Action', range: '', description: '' },
      { name: 'Level 3 Spell', level: 3, casting_time: 'Action', range: '', description: '' },
      { name: 'Level 5 Spell', level: 5, casting_time: 'Action', range: '', description: '' },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No level 1 or 2 spells with casting time of an action available.');
  });

  it('should return popup when no eligible spells', async () => {
    loadSpells.mockResolvedValue([]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No level 1 or 2 spells with casting time of an action available.');
  });

  it('should load spells with rules from playerStats', async () => {
    const mockSpells = [{ name: 'Test', level: 1, casting_time: 'Action', range: '', description: '' }];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    await handle(makeAction(), makePlayerStats({ rules: '5e' }), campaignName, null);

    expect(loadSpells).toHaveBeenCalledWith('5e');
  });

  it('should include optionDetails for all eligible spells', async () => {
    const mockSpells = [
      { name: 'Magic Missile', level: 1, casting_time: 'Action', range: '120 ft', description: 'Three darts', damage: '3d4+1' },
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
      { name: 'Missing Casting Time', level: 1, casting_time: 'Action', range: '', description: '' },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.optionDetails['Missing Casting Time'].casting_time).toBe('Action');
  });

  it('should handle missing range by defaulting to empty', async () => {
    const mockSpells = [
      { name: 'Missing Range', level: 1, casting_time: 'Action', description: '' },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.optionDetails['Missing Range'].range).toBe('');
  });

  it('should handle missing description by defaulting to empty', async () => {
    const mockSpells = [
      { name: 'Missing Desc', level: 1, casting_time: 'Action', range: '' },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.optionDetails['Missing Desc'].description).toBe('');
  });

  it('should handle missing damage by defaulting to null', async () => {
    const mockSpells = [
      { name: 'No Damage', level: 1, casting_time: 'Action', range: '' },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.optionDetails['No Damage'].damage).toBeNull();
  });

  it('should return currentLevel1 and currentLevel2 from runtime', async () => {
    const mockSpells = [{ name: 'Magic Missile', level: 1, casting_time: 'Action', range: '', description: '' }];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === '_Spell_Mastery_level1') return 'Magic Missile';
      if (key === '_Spell_Mastery_level2') return 'Web';
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.currentLevel1).toBe('Magic Missile');
    expect(result.payload.currentLevel2).toBe('Web');
  });

  it('should not include level 0 spells', async () => {
    const mockSpells = [
      { name: 'Cantrip', level: 0, casting_time: 'Action', range: '', description: '' },
    ];
    loadSpells.mockResolvedValue(mockSpells);
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No level 1 or 2 spells with casting time of an action available.');
  });
});

describe('spellMasteryHandler.onSpellMasterySelected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when level1 is missing', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, null, 'Web');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Both a level 1 and level 2 spell must be selected.');
  });

  it('should return error when level2 is missing', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Both a level 1 and level 2 spell must be selected.');
  });

  it('should return error when both are empty strings', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, '', '');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Both a level 1 and level 2 spell must be selected.');
  });

  it('should set runtime values for selected spells', async () => {
    const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Web');

    expect(result.type).toBe('popup');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Spell_Mastery_level1', 'Magic Missile', campaignName, true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Spell_Mastery_level2', 'Web', campaignName, true);
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
