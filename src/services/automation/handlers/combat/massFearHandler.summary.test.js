// @maintained-by-ai
// Lane: popup/summary text composition (exact strings), buildSaveDc auto-object
// saveDc/saveAbility defaults, condition-label capitalization, and the exact
// defaulted single-target createSaveListener config for resolveMassFear.
// Sibling lanes: massFearHandler.test.js owns handle() + target selection
// (incl. range parsing and the caster-only 'No targets in range.' popup);
// massFearHandler.saveResults.test.js owns save-listener config + saveResults
// processing (full-string default target-log with 'Frightened', condition writes).
// Fully mocked, deterministic, turn-based.
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

function resolve(option) {
  return resolveMassFear({
    campaignName,
    casterName: 'TestCaster',
    primaryTargetName: 'Goblin',
    option,
    playerStats: makePlayerStats(),
  });
}

function casterAnd(...creatures) {
  return makeCombatSummary([{ name: 'TestCaster', type: 'player' }, ...creatures]);
}

// ── Tests ──────────────────────────────────────────────────────

describe('massFearHandler.resolveMassFear - popup summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(14);
    // Default: all saves fail
    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      return { promptId: 'mass-fear-prompt', promise: Promise.resolve({ success: false }) };
    });
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    expirations.addExpiration.mockReturnValue(undefined);
  });

  it('returns automation_info popup with affected summary and logs it as ability_use', async () => {
    damageUtils.getCombatContext.mockResolvedValue(casterAnd({ name: 'Goblin', type: 'monster' }));

    const result = await resolve({ saveDc: 14, saveType: 'WIS', range: '20_ft' });

    expect(result.type).toBe('popup');
    expect(result.payload).toEqual({
      type: 'automation_info',
      name: 'Mass Fear',
      description: 'Mass Fear: 1 creature(s) affected — Goblin. 0 creature(s) saved.',
    });
    // Final summary log (per-target logs carry promptId; this exact-object
    // pin only matches the summary call).
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: 'Mass Fear',
      description: 'Mass Fear: 1 creature(s) affected — Goblin. 0 creature(s) saved.',
    });
  });

  it('counts saved creatures in summary when some save', async () => {
    damageUtils.getCombatContext.mockResolvedValue(casterAnd(
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
    ));
    rangeCheck.isWithinRange.mockResolvedValue(true);

    let callIndex = 0;
    const results = [false, true]; // Goblin fails, Orc saves
    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      const idx = callIndex++;
      return {
        promptId: `prompt-${idx}`,
        promise: Promise.resolve({ success: results[idx] }),
      };
    });

    const result = await resolve({ saveDc: 14, saveType: 'WIS', range: '20_ft' });

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Mass Fear: 1 creature(s) affected — Goblin. 1 creature(s) saved.');
  });

  it('reports "No creatures affected" when all save', async () => {
    damageUtils.getCombatContext.mockResolvedValue(casterAnd({ name: 'Goblin', type: 'monster' }));
    savePrompt.createSaveListener.mockImplementation((_camp, _cfg) => {
      return { promptId: 'mass-fear-prompt', promise: Promise.resolve({ success: true }) };
    });

    const result = await resolve({ saveDc: 14, saveType: 'WIS', range: '20_ft' });

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Mass Fear: No creatures affected. 1 creature(s) saved.');
  });
});

describe('massFearHandler.resolveMassFear - buildSaveDc auto object & condition label', () => {
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

  it('passes option.saveAbility through when saveDc is "ability"', async () => {
    damageUtils.getCombatContext.mockResolvedValue(casterAnd({ name: 'Goblin', type: 'monster' }));

    await resolve({ saveDc: 'ability', saveAbility: 'CON' });

    expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
      expect.objectContaining({ saveDc: 'ability', saveAbility: 'CON' }),
      expect.any(Object),
    );
  });

  it('defaults saveAbility to WIS when saveDc is "ability"', async () => {
    damageUtils.getCombatContext.mockResolvedValue(casterAnd({ name: 'Goblin', type: 'monster' }));

    await resolve({ saveDc: 'ability' });

    expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
      expect.objectContaining({ saveDc: 'ability', saveAbility: 'WIS' }),
      expect.any(Object),
    );
  });

  it('defaults saveDc to "ability" when omitted, keeping option.saveAbility', async () => {
    damageUtils.getCombatContext.mockResolvedValue(casterAnd({ name: 'Goblin', type: 'monster' }));

    await resolve({ saveAbility: 'CON' });

    expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
      expect.objectContaining({ saveDc: 'ability', saveAbility: 'CON' }),
      expect.any(Object),
    );
  });

  it('capitalizes custom condition label in target log description', async () => {
    damageUtils.getCombatContext.mockResolvedValue(casterAnd({ name: 'Goblin', type: 'monster' }));

    await resolve({ saveType: 'WIS', condition: 'charmed' });

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: 'Mass Fear',
      description: 'TestCaster uses Mass Fear! Goblin must make a WIS save (DC 13) or become Charmed.',
      promptId: 'mass-fear-prompt',
    });
  });
});

describe('massFearHandler.resolveMassFear - range fallback & single-target config', () => {
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

  it('falls back to range 10 when option.range is an empty string', async () => {
    damageUtils.getCombatContext.mockResolvedValue(casterAnd(
      { name: 'Goblin', type: 'monster' },
      { name: 'Orc', type: 'monster' },
    ));
    rangeCheck.isWithinRange.mockResolvedValue(true);

    await resolve({ range: '' });

    // '' || '10_ft' → parseInt('10', 10) = 10
    expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Goblin', 'Orc', 10);
  });

  it('sends exact defaulted config to a single primary target', async () => {
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Goblin', type: 'monster' },
    ]));

    await resolve({});

    expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin', saveType: 'WIS', saveDc: 13, dcSuccess: 'none', condition: 'frightened',
    });
  });
});
