// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { resolveMassFear } from './massFearHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as logService from '../../../ui/logService.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    proficiency: 3,
    abilities: [
      { name: 'INT', modifier: 4 },
      { name: 'WIS', modifier: 2 },
    ],
    ...overrides,
  };
}

function makeCombatSummary(creatures) {
  return { creatures, players: [], placedItems: [] };
}

// ── Tests ──────────────────────────────────────────────────────

describe('massFearHandler.resolveMassFear - popup summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(14);
    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      return { promptId: 'mass-fear-prompt', promise: Promise.resolve({ success: false }) };
    });
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    expirations.addExpiration.mockReturnValue(undefined);
  });

  it('returns popup with summary when creatures are affected', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    const result = await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 14, saveType: 'WIS', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('1 creature(s) affected');
    expect(result.payload.description).toContain('Goblin');
  });

  it('returns popup with summary when some creatures save', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    rangeCheck.isWithinRange.mockResolvedValue(true);
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    expirations.addExpiration.mockReturnValue(undefined);

    let callIndex = 0;
    const results = [false, true];

    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      const idx = callIndex++;
      return {
        promptId: `prompt-${idx}`,
        promise: Promise.resolve({ success: results[idx] }),
      };
    });

    const result = await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 14, saveType: 'WIS', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('1 creature(s) affected');
  });

  it('returns popup with "No creatures affected" when all save', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      return { promptId: 'mass-fear-prompt', promise: Promise.resolve({ success: true }) };
    });

    const result = await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 14, saveType: 'WIS', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    expect(result.payload.description).toContain('No creatures affected');
  });

  it('logs final summary as ability_use entry', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 14, saveType: 'WIS', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    const summaryCalls = logService.addEntry.mock.calls.filter(
      call => call[1]?.type === 'ability_use' && call[1]?.description?.includes('creature(s)'),
    );
    expect(summaryCalls.length).toBeGreaterThan(0);
  });

  it('returns popup payload with automation_info type', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    const result = await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 14, saveType: 'WIS', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Mass Fear');
  });
});

describe('massFearHandler.resolveMassFear - option defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      return { promptId: 'mass-fear-prompt', promise: Promise.resolve({ success: true }) };
    });
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    expirations.addExpiration.mockReturnValue(undefined);
  });

  it('uses option.saveAbility when saveDc is "ability"', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 'ability', saveAbility: 'CON', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
      expect.objectContaining({ saveDc: 'ability', saveAbility: 'CON' }),
      expect.any(Object),
    );
  });

  it('defaults saveAbility to WIS when saveDc is "ability"', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 'ability', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
      expect.objectContaining({ saveDc: 'ability', saveAbility: 'WIS' }),
      expect.any(Object),
    );
  });

  it('defaults saveAbility to WIS in auto object when saveDc is "ability"', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 'ability' },
          playerStats: makePlayerStats(),
      });

    expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
      expect.objectContaining({ saveAbility: 'WIS' }),
      expect.any(Object),
    );
  });

  it('uses option.saveAbility as default in auto object', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveAbility: 'CON' },
          playerStats: makePlayerStats(),
      });

    expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
      expect.objectContaining({ saveAbility: 'CON' }),
      expect.any(Object),
    );
  });

  it('capitalizes condition label in log description', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 14, saveType: 'WIS', condition: 'charmed', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: 'Mass Fear',
      description: expect.stringContaining('Charmed'),
      promptId: 'mass-fear-prompt',
    });
  });

  it('uses default condition label "Frightened"', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 14, saveType: 'WIS', range: '20_ft' },
          playerStats: makePlayerStats(),
      });

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: 'Mass Fear',
      description: expect.stringContaining('Frightened'),
      promptId: 'mass-fear-prompt',
    });
  });
});

describe('massFearHandler.resolveMassFear - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      return { promptId: 'mass-fear-prompt', promise: Promise.resolve({ success: true }) };
    });
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    expirations.addExpiration.mockReturnValue(undefined);
  });

  it('handles empty string range by falling back to default 10', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    const mockFn = vi.fn().mockResolvedValue(true);
    rangeCheck.isWithinRange.mockImplementation(mockFn);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 13, range: '' },
          playerStats: makePlayerStats(),
      });

    // '' || '10_ft' → '10_ft' → parseInt('10', 10) = 10
    expect(mockFn).toHaveBeenCalledWith('Goblin', 'Orc', 10);
  });

  it('handles option with no saveDc property', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: {},
          playerStats: makePlayerStats(),
      });

    expect(savePrompt.buildSaveDc).toHaveBeenCalled();
  });

  it('handles option with no range property', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);
    const mockFn = vi.fn().mockResolvedValue(true);
    rangeCheck.isWithinRange.mockImplementation(mockFn);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 13 },
          playerStats: makePlayerStats(),
      });

    expect(mockFn).toHaveBeenCalledWith('Goblin', 'Orc', 10);
  });

  it('handles single creature (just the caster)', async () => {
    const cs = makeCombatSummary([
      { name: 'TestCaster', type: 'player' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    const result = await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: null,
          option: { saveDc: 13 },
          playerStats: makePlayerStats(),
      });

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No targets in range.');
  });

  it('handles single creature (just the primary target)', async () => {
    const cs = makeCombatSummary([
      { name: 'Goblin', type: 'monster' },
    ]);
    damageUtils.getCombatContext.mockResolvedValue(cs);

    await resolveMassFear({
          campaignName,
          casterName: 'TestCaster',
          primaryTargetName: 'Goblin',
          option: { saveDc: 13 },
          playerStats: makePlayerStats(),
      });

    expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin', saveType: 'WIS', saveDc: 13, dcSuccess: 'none', condition: 'frightened',
    });
  });
});
