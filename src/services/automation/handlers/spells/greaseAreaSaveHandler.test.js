import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, processGreaseAreaSave } from './greaseAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Intelligence', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Grease',
    automation: {
      type: 'grease_area_save',
      saveType: 'DEX',
      conditionInflicted: 'Prone',
      size: '10-foot',
      duration: '1_minute',
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'TestWizard', type: 'player', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
  placedItems: [],
};

// ── Tests ──────────────────────────────────────────────────────

describe('greaseAreaSaveHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic handling', () => {
    it('returns modal with setCondition', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      const result = await handle(action, ps, campaignName, 'test-map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
    });

    it('uses default saveType of DEX', async () => {
      const action = makeAction({ saveType: undefined });
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);

      await handle(action, ps, campaignName, null);

      expect(savePrompt.buildSaveDc).toHaveBeenCalled();
    });

    it('uses custom saveType from automation', async () => {
      const action = makeAction({ saveType: 'CON' });
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);

      await handle(action, ps, campaignName, null);

      expect(savePrompt.buildSaveDc).toHaveBeenCalled();
    });

    it('uses custom conditionInflicted', async () => {
      const action = makeAction({ conditionInflicted: 'Blinded' });
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      const result = await handle(action, ps, campaignName, 'test-map');

      expect(result.payload.conditionName).toBe('Blinded');
    });

    it('defaults conditionInflicted to Prone', async () => {
      const action = makeAction({ conditionInflicted: undefined });
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      const result = await handle(action, ps, campaignName, 'test-map');

      expect(result.payload.conditionName).toBe('Prone');
    });
  });

  describe('area radius calculation', () => {
    it('parses 10-foot size correctly', async () => {
      const action = makeAction({ size: '10-foot' });
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      const result = await handle(action, ps, campaignName, 'test-map');

      expect(result.payload.rangeFeet).toBe(10);
    });

    it('parses 15-foot size correctly', async () => {
      const action = makeAction({ size: '15-foot' });
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      const result = await handle(action, ps, campaignName, 'test-map');

      expect(result.payload.rangeFeet).toBe(15);
    });

    it('defaults to 10 when size is invalid', async () => {
      const action = makeAction({ size: 'invalid' });
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      const result = await handle(action, ps, campaignName, 'test-map');

      expect(result.payload.rangeFeet).toBe(10);
    });
  });

  describe('tracking and expiration', () => {
    it('stores grease tracking data', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      await handle(action, ps, campaignName, 'test-map');

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_grease_TestWizard',
        expect.objectContaining({
          caster: 'TestWizard',
          saveDc: 13,
          saveType: 'DEX',
          condition: 'Prone',
          radius: 10,
          mapName: 'test-map',
          campaignName: 'TestCampaign',
        }),
        campaignName,
      );
    });

    it('sets expiration for 1_minute duration', async () => {
      const action = makeAction({ duration: '1_minute' });
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      await handle(action, ps, campaignName, 'test-map');

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestWizard',
        'TestWizard',
        [{ type: 'remove_grease_area', greaseKey: '_grease_TestWizard' }],
        campaignName,
        10,
      );
    });

    it('sets expiration for round-based duration', async () => {
      const action = makeAction({ duration: '3_rounds' });
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      await handle(action, ps, campaignName, 'test-map');

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestWizard',
        'TestWizard',
        expect.any(Array),
        campaignName,
        3,
      );
    });

    it('does not set expiration when duration is not recognized', async () => {
      const action = makeAction({ duration: 'unknown' });
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      await handle(action, ps, campaignName, 'test-map');

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('does not set expiration when duration is empty', async () => {
      const action = makeAction({ duration: '' });
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      await handle(action, ps, campaignName, 'test-map');

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('map handling', () => {
    it('does not load map data when mapName is null', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);

      await handle(action, ps, campaignName, null);

      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('handles map load failure gracefully', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockRejectedValue(new Error('not found'));

      await expect(handle(action, ps, campaignName, 'bad-map')).resolves.toBeDefined();
    });

    it('stores null center when caster not found on map', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({ players: [] });

      await handle(action, ps, campaignName, 'test-map');

      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        c => c[1].includes('_grease_'),
      );
      expect(trackingCall[2].center).toBeNull();
    });
  });

  describe('log entries', () => {
    it('calls addEntry with ability_use type', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });

      await handle(action, ps, campaignName, 'test-map');

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestWizard',
          abilityName: 'Grease',
          description: expect.stringContaining('DEX save DC 13'),
        }),
      );
    });

    it('catches and swallows addEntry errors', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      });
      logService.addEntry.mockRejectedValue(new Error('network'));

      await expect(handle(action, ps, campaignName, 'test-map')).resolves.toBeDefined();
    });
  });
});

describe('greaseAreaSaveHandler.processGreaseAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no tracking data', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(null);

    const result = await processGreaseAreaSave('TestWizard', 'Goblin', campaignName, 'test-map');

    expect(result).toBeNull();
  });

  it('returns null when no center in tracking', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue({
      caster: 'TestWizard',
      center: null,
      saveDc: 13,
    });

    const result = await processGreaseAreaSave('TestWizard', 'Goblin', campaignName, 'test-map');

    expect(result).toBeNull();
  });

  it('returns null when no mapName', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue({
      caster: 'TestWizard',
      center: { gridX: 5, gridY: 10 },
      saveDc: 13,
    });

    const result = await processGreaseAreaSave('TestWizard', 'Goblin', campaignName, null);

    expect(result).toBeNull();
  });

  it('returns null when target not found on map', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue({
      caster: 'TestWizard',
      center: { gridX: 5, gridY: 10 },
      saveDc: 13,
    });
    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      placedItems: [],
    });

    const result = await processGreaseAreaSave('TestWizard', 'Unknown', campaignName, 'test-map');

    expect(result).toBeNull();
  });

  it('returns null when target outside area', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue({
      caster: 'TestWizard',
      center: { gridX: 5, gridY: 10 },
      saveDc: 13,
      saveType: 'DEX',
      condition: 'Prone',
      radius: 10,
    });
    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      placedItems: [{ name: 'Goblin', gridX: 50, gridY: 50 }],
    });
    rangeValidation.getDistanceFeet.mockReturnValue(200);

    const result = await processGreaseAreaSave('TestWizard', 'Goblin', campaignName, 'test-map');

    expect(result).toBeNull();
  });

  it('returns null when target is already prone', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key.includes('_grease_')) {
        return {
          caster: 'TestWizard',
          center: { gridX: 5, gridY: 10 },
          saveDc: 13,
          saveType: 'DEX',
          condition: 'Prone',
          radius: 10,
        };
      }
      if (key === 'activeConditions') return ['prone'];
      return null;
    });
    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
    });
    rangeValidation.getDistanceFeet.mockReturnValue(5);

    const result = await processGreaseAreaSave('TestWizard', 'Goblin', campaignName, 'test-map');

    expect(result).toBeNull();
  });

  it('returns null when player is immune to condition', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key.includes('_grease_')) {
        return {
          caster: 'TestWizard',
          center: { gridX: 5, gridY: 10 },
          saveDc: 13,
          saveType: 'DEX',
          condition: 'Prone',
          radius: 10,
        };
      }
      if (key === 'activeConditions') return [];
      if (key === 'computedStats') return { immunities: ['prone'] };
      return null;
    });
    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'TestWizard', gridX: 5, gridY: 10 },
        { name: 'Goblin', gridX: 6, gridY: 10 },
      ],
      placedItems: [],
    });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'player' }],
    });
    automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);
    rangeValidation.getDistanceFeet.mockReturnValue(5);

    const result = await processGreaseAreaSave('TestWizard', 'Goblin', campaignName, 'test-map');

    expect(result).toBeNull();
    expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalled();
  });

  it('returns popup on failed save', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key.includes('_grease_')) {
        return {
          caster: 'TestWizard',
          center: { gridX: 5, gridY: 10 },
          saveDc: 13,
          saveType: 'DEX',
          condition: 'Prone',
          radius: 10,
        };
      }
      if (key === 'activeConditions') return [];
      return null;
    });
    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
    });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    rangeValidation.getDistanceFeet.mockReturnValue(5);

    // Mock the dynamic import's createSaveListener
    const mockPromise = Promise.resolve({ success: false });
    vi.doMock('../../common/savePrompt.js', () => ({
      createSaveListener: () => ({
        promptId: 'grease-save-prompt',
        promise: mockPromise,
      }),
    }));

    const result = await processGreaseAreaSave('TestWizard', 'Goblin', campaignName, 'test-map');

    expect(result).not.toBeNull();
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('failed');
  });

  it('returns popup on successful save', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key.includes('_grease_')) {
        return {
          caster: 'TestWizard',
          center: { gridX: 5, gridY: 10 },
          saveDc: 13,
          saveType: 'DEX',
          condition: 'Prone',
          radius: 10,
        };
      }
      if (key === 'activeConditions') return [];
      return null;
    });
    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
    });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    rangeValidation.getDistanceFeet.mockReturnValue(5);

    vi.doMock('../../common/savePrompt.js', () => ({
      createSaveListener: () => ({
        promptId: 'grease-save-success',
        promise: Promise.resolve({ success: true }),
      }),
    }));

    const result = await processGreaseAreaSave('TestWizard', 'Goblin', campaignName, 'test-map');

    expect(result).not.toBeNull();
    expect(result.payload.description).toContain('succeeded');
  });

  it('catches and returns null on error', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue({
      caster: 'TestWizard',
      center: { gridX: 5, gridY: 10 },
      saveDc: 13,
    });
    mapsService.loadMapData.mockRejectedValue(new Error('map not found'));

    const result = await processGreaseAreaSave('TestWizard', 'Goblin', campaignName, 'test-map');

    expect(result).toBeNull();
  });

  it('sets activeConditions on failed save for prone', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key.includes('_grease_')) {
        return {
          caster: 'TestWizard',
          center: { gridX: 5, gridY: 10 },
          saveDc: 13,
          saveType: 'DEX',
          condition: 'Prone',
          radius: 10,
        };
      }
      if (key === 'activeConditions') return [];
      return null;
    });
    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'TestWizard', gridX: 5, gridY: 10 }],
      placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
    });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    rangeValidation.getDistanceFeet.mockReturnValue(5);

    vi.doMock('../../common/savePrompt.js', () => ({
      createSaveListener: () => ({
        promptId: 'grease-cond-prompt',
        promise: Promise.resolve({ success: false }),
      }),
    }));

    await processGreaseAreaSave('TestWizard', 'Goblin', campaignName, 'test-map');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      expect.arrayContaining(['prone']),
      campaignName,
    );
  });
});
