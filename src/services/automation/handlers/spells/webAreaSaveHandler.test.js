import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));

import { handle, processWebAreaSave } from './webAreaSaveHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { playerIsImmuneToCondition } from '../../../combat/automation/automationImmunities.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Web',
    automation: { type: 'web', saveType: 'DEX', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

describe('webAreaSaveHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return modal with setCondition', async () => {
    getCombatContext.mockResolvedValue(baseCombatContext);
    buildSaveDc.mockReturnValue(15);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('setCondition');
    expect(result.payload.conditionName).toBe('restrained');
    expect(result.payload.saveType).toBe('DEX');
    expect(result.payload.saveDc).toBe(15);
    expect(result.payload.rangeFeet).toBe(20);
    expect(result.payload.durationRounds).toBe(60);
  });

  it('should store tracking data with map position', async () => {
    getCombatContext.mockResolvedValue(baseCombatContext);
    buildSaveDc.mockReturnValue(15);

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCaster',
      '_web_TestCaster',
      expect.objectContaining({
        caster: 'TestCaster',
        saveDc: 15,
        saveType: 'DEX',
        radius: 20,
        mapName,
        campaignName,
      }),
      campaignName,
    );
  });

  it('should default saveType to DEX when not specified', async () => {
    getCombatContext.mockResolvedValue(baseCombatContext);
    buildSaveDc.mockReturnValue(10);

    const result = await handle(
      { name: 'Web', automation: { type: 'web', saveDc: 10 } },
      makePlayerStats(),
      campaignName,
      mapName,
    );

    expect(result.payload.saveType).toBe('DEX');
  });
});

describe('webAreaSaveHandler.processWebAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no tracking exists', async () => {
    getRuntimeValue.mockReturnValue(null);
    const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);
    expect(result).toBeNull();
  });

  it('should return null when tracking has no saveDc', async () => {
    getRuntimeValue.mockReturnValue({ caster: 'TestCaster' });
    const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);
    expect(result).toBeNull();
  });

  it('should return null when target is already restrained', async () => {
    getRuntimeValue.mockImplementation((caster, key) => {
      if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'DEX' };
      if (key === 'activeConditions') return ['Restrained'];
      return null;
    });
    const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);
    expect(result).toBeNull();
  });

  it('should return null when target is immune to restrained', async () => {
    getRuntimeValue.mockImplementation((caster, key) => {
      if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'DEX' };
      if (key === 'activeConditions') return [];
      return null;
    });
    playerIsImmuneToCondition.mockReturnValue(true);
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'player', computedStats: {} }],
    });

    const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);
    expect(result).toBeNull();
    expect(createSaveListener).not.toHaveBeenCalled();
  });

  it('should trigger save when target is not restrained and not immune', async () => {
    getRuntimeValue.mockImplementation((caster, key) => {
      if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'DEX' };
      if (key === 'activeConditions') return [];
      return null;
    });
    playerIsImmuneToCondition.mockReturnValue(false);
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'player', computedStats: {} }],
    });
    createSaveListener.mockReturnValue({
      promptId: 'web-save',
      promise: Promise.resolve({ success: false }),
    });

    const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'DEX',
      saveDc: 15,
    });
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('failed');
  });

  it('should apply restrained condition on failed save', async () => {
    getRuntimeValue.mockImplementation((caster, key) => {
      if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'DEX' };
      if (key === 'activeConditions') return [];
      return null;
    });
    playerIsImmuneToCondition.mockReturnValue(false);
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'player', computedStats: {} }],
    });
    createSaveListener.mockReturnValue({
      promptId: 'web-fail',
      promise: Promise.resolve({ success: false }),
    });

    await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      expect.arrayContaining(['restrained']),
      campaignName,
    );
  });

  it('should succeed when target is not a player type', async () => {
    getRuntimeValue.mockImplementation((caster, key) => {
      if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'DEX' };
      if (key === 'activeConditions') return [];
      return null;
    });
    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    createSaveListener.mockReturnValue({
      promptId: 'web-monster',
      promise: Promise.resolve({ success: true }),
    });

    const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, mapName);

    expect(result.payload.description).toContain('succeeded');
  });
});
