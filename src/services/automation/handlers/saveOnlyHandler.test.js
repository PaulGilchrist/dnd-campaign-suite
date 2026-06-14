import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './saveOnlyHandler.js';
import * as savePrompt from '../common/savePrompt.js';
import * as targetResolver from '../common/targetResolver.js';
import * as runtimeState from '../../../hooks/useRuntimeState.js';
import * as logService from '../../ui/logService.js';
import * as expirations from '../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 3,
    proficiency: 2,
    abilities: [
      { name: 'CON', modifier: 2 },
      { name: 'CHA', modifier: 3 },
    ],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Stunning Strike',
    automation: {
      ...automation,
    },
  };
}

function setupMocks() {
  savePrompt.buildSaveDc.mockReturnValue(14);
  savePrompt.createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
  targetResolver.resolveTarget.mockResolvedValue({
    target: { name: 'Goblin' },
  });
  logService.addEntry.mockReturnValue(Promise.resolve({}));
}

// ── Tests: handle - Basic Flow ────────────────────────────────

describe('saveOnlyHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('builds save DC using buildSaveDc', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
  });

  it('resolves target using resolveTarget', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    expect(targetResolver.resolveTarget).toHaveBeenCalledWith(campaignName, ps.name);
  });

  it('uses resolved target name in save listener config', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'CON',
      saveDc: 14,
    });
  });

  it('defaults saveType to CON when not provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction({});

    await handle(action, ps, campaignName, mapName);

    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'CON',
      saveDc: 14,
    });
  });

  it('uses player name as target when resolveTarget returns null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    targetResolver.resolveTarget.mockResolvedValue(null);

    await handle(action, ps, campaignName, mapName);

    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'TestHero',
      saveType: 'CON',
      saveDc: 14,
    });
  });

  it('uses player name as target when resolveTarget returns no target', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    targetResolver.resolveTarget.mockResolvedValue({});

    await handle(action, ps, campaignName, mapName);

    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'TestHero',
      saveType: 'CON',
      saveDc: 14,
    });
  });

  it('adds an ability_use log entry', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestHero',
      abilityName: 'Stunning Strike',
      description: 'Stunning Strike triggered — target Goblin must make CON save (DC 14)',
      promptId: 'prompt-123',
    });
  });

  it('adds log entry with default CON saveType when not provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction({});

    await handle(action, ps, campaignName, mapName);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestHero',
      abilityName: 'Stunning Strike',
      description: 'Stunning Strike triggered — target Goblin must make CON save (DC 14)',
      promptId: 'prompt-123',
    });
  });

  it('returns popup with automation_info payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    const result = await handle(action, ps, campaignName, mapName);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Stunning Strike',
        targetName: 'Goblin',
        description: 'Target Goblin must make a CON saving throw (DC 14).',
        automation: action.automation,
      },
    });
  });

  it('returns popup with default CON in description when saveType missing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({});

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toBe('Target Goblin must make a CON saving throw (DC 14).');
  });

  it('uses custom saveType in all outputs', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'WIS' });

    await handle(action, ps, campaignName, mapName);

    // Check createSaveListener was called with WIS
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'WIS',
      saveDc: 14,
    });

    // Check log entry uses WIS
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestHero',
      abilityName: 'Stunning Strike',
      description: 'Stunning Strike triggered — target Goblin must make WIS save (DC 14)',
      promptId: 'prompt-123',
    });

    // Check popup description uses WIS
    const result = await handle(action, ps, campaignName, mapName);
    expect(result.payload.description).toBe('Target Goblin must make a WIS saving throw (DC 14).');
  });

  it('handles resolveTarget returning null gracefully', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    targetResolver.resolveTarget.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, mapName);

    // Should still work, falling back to player name
    expect(result.type).toBe('popup');
    expect(result.payload.targetName).toBe('TestHero');
  });

  it('handles resolveTarget returning undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    targetResolver.resolveTarget.mockResolvedValue(undefined);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.targetName).toBe('TestHero');
  });
});

// ── Tests: handle - Save Result (Success Path) ────────────────

describe('saveOnlyHandler.handle - Save Result Success', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('triggers success path when save-result event fires with matching promptId', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    // Dispatch a save-result event with success
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    // Should call applySuccessEffects (which internally calls setRuntimeValue)
    expect(runtimeState.setRuntimeValue).toHaveBeenCalled();

    // Should add expiration for success effects
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      ps.name,
      'Goblin',
      [
        { type: 'stunned', condition: 'speed_halved' },
        { type: 'advantage_on_target' },
      ],
      campaignName,
    );
  });

  it('ignores save-result events with different promptId', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    // Dispatch a save-result event with a DIFFERENT promptId
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'different-prompt', success: true },
    }));

    // Should NOT have called setRuntimeValue or addExpiration
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
  });

  it('success path sets speed_halved runtime value', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    // The speed_halved effect should set a runtime value with the condition key
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      expect.stringContaining('speed_halved_'),
      true,
      campaignName,
    );
  });

  it('success path sets advantage_on_target runtime value', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    // The advantage_on_target effect should set a runtime value
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      '_advantageOn_Goblin',
      expect.arrayContaining(['Goblin']),
      campaignName,
    );
  });

  it('success path does not add duplicate advantage target', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    // Pre-seed the advantage list with Goblin already in it
    runtimeState.getRuntimeValue.mockReturnValue(['Goblin']);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    // Should NOT call setRuntimeValue for advantage since Goblin is already in the list
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'TestHero',
      '_advantageOn_Goblin',
      expect.any(Array),
      campaignName,
    );
  });

  it('success path handles empty stored advantage list', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    // Pre-seed with empty array
    runtimeState.getRuntimeValue.mockReturnValue([]);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      '_advantageOn_Goblin',
      ['Goblin'],
      campaignName,
    );
  });

  it('success path handles null stored advantage list', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    // Pre-seed with null (fallback to [])
    runtimeState.getRuntimeValue.mockReturnValue(null);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      '_advantageOn_Goblin',
      ['Goblin'],
      campaignName,
    );
  });
});

// ── Tests: handle - Save Result (Fail Path) ───────────────────

describe('saveOnlyHandler.handle - Save Result Fail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('triggers fail path when save-result event fires with success=false', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    // Dispatch a save-result event with failure
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false },
    }));

    // Should add the condition to activeConditions
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      expect.arrayContaining(['stunned']),
      campaignName,
    );

    // Should add expiration for fail effects
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      ps.name,
      'Goblin',
      [
        { type: 'stunned', condition: 'stunned' },
      ],
      campaignName,
    );
  });

  it('fail path adds condition to existing activeConditions', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    // Pre-seed existing conditions
    runtimeState.getRuntimeValue.mockReturnValue(['prone', 'blinded']);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false },
    }));

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['prone', 'blinded', 'stunned'],
      campaignName,
    );
  });

  it('fail path handles non-array storedConditions', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    // Pre-seed with a non-array value
    runtimeState.getRuntimeValue.mockReturnValue('prone');

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false },
    }));

    // Should treat non-array as empty and just add the new condition
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['stunned'],
      campaignName,
    );
  });

  it('fail path handles null storedConditions', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    // Pre-seed with null
    runtimeState.getRuntimeValue.mockReturnValue(null);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false },
    }));

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['stunned'],
      campaignName,
    );
  });

  it('fail path uses default stunned condition when effects.fail is empty', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON', effects: { fail: [] } });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false },
    }));

    // Should default to 'stunned' when effects.fail[0] is undefined
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['stunned'],
      campaignName,
    );
  });

  it('fail path uses custom condition from effects.fail', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON', effects: { fail: [{ condition: 'blinded' }] } });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false },
    }));

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['blinded'],
      campaignName,
    );
  });
});

// ── Tests: handle - Custom Effects ─────────────────────────────

describe('saveOnlyHandler.handle - Custom Effects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('uses custom effects from automation when provided', async () => {
    const ps = makePlayerStats();
    const customEffects = {
      success: [{ type: 'speed_halved', condition: 'custom_slow' }],
      fail: [{ type: 'charmed', condition: 'charmed' }],
    };
    const action = makeAction({ saveType: 'CON', effects: customEffects });

    await handle(action, ps, campaignName, mapName);

    // Trigger success path with custom effects
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    // Should use custom effects for success
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      expect.stringContaining('custom_slow_'),
      true,
      campaignName,
    );
  });
});

// ── Tests: handle - Default Effects ────────────────────────────

describe('saveOnlyHandler.handle - Default Effects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('uses Stunning Strike default effects when action name matches', async () => {
    const ps = makePlayerStats();
    const action = {
      name: 'Stunning Strike',
      automation: { saveType: 'CON' },
    };

    await handle(action, ps, campaignName, mapName);

    // Trigger success - should use Stunning Strike effects (speed_halved + advantage)
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      expect.stringContaining('speed_halved_'),
      true,
      campaignName,
    );

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      '_advantageOn_Goblin',
      expect.arrayContaining(['Goblin']),
      campaignName,
    );
  });

  it('uses generic default effects for non-Stunning Strike actions', async () => {
    const ps = makePlayerStats();
    const action = {
      name: 'Some Other Ability',
      automation: { saveType: 'CON' },
    };

    await handle(action, ps, campaignName, mapName);

    // Trigger fail - should use generic default (stunned)
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false },
    }));

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['stunned'],
      campaignName,
    );
  });
});

// ── Tests: handle - Edge Cases ────────────────────────────────

describe('saveOnlyHandler.handle - Edge Cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('handles action with empty automation object', async () => {
    const ps = makePlayerStats();
    const action = { name: 'Test', automation: {} };

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('CON saving throw');
  });

  it('handles effects with empty success array', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON', effects: { success: [], fail: [] } });

    await handle(action, ps, campaignName, mapName);

    // Trigger success with empty effects - applySuccessEffects should iterate over empty array
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    // applySuccessEffects iterates over empty array, so no setRuntimeValue for effects
    // But addExpiration is still called with hardcoded effects
    expect(expirations.addExpiration).toHaveBeenCalled();
  });

  it('handles effects with fail entry missing condition field', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON', effects: { fail: [{ type: 'stunned' }] } });

    await handle(action, ps, campaignName, mapName);

    // Trigger fail - effects.fail[0].condition is undefined, defaults to 'stunned'
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false },
    }));

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['stunned'],
      campaignName,
    );
  });

  it('handles effects with fail entry having custom condition', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON', effects: { fail: [{ type: 'charmed', condition: 'charmed' }] } });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false },
    }));

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['charmed'],
      campaignName,
    );
  });

  it('handles applySuccessEffects with unknown effect type', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON', effects: { success: [{ type: 'unknown_effect' }], fail: [] } });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    // Unknown effect type should be handled gracefully (no-op in switch)
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Goblin',
      expect.stringContaining('unknown_effect'),
      true,
      campaignName,
    );
  });
});
