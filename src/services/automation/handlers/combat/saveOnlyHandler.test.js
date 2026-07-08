// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

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

// ── Imports ────────────────────────────────────────────────────

import { handle } from './saveOnlyHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';

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
    automation: { ...automation },
  };
}

function setupMocks() {
  savePrompt.buildSaveDc.mockReturnValue(14);
  savePrompt.createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  runtimeState.getRuntimeValue.mockReturnValue(undefined);
  runtimeState.setRuntimeValue.mockResolvedValue(undefined);
  logService.addEntry.mockResolvedValue({});
  expirations.addExpiration.mockReturnValue(undefined);
}

// ── Tests: handle - Return Value ───────────────────────────────

describe('saveOnlyHandler.handle - return value', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('returns a popup with automation_info type', async () => {
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
        automation: { saveType: 'CON' },
      },
    });
  });

  it('defaults saveType to CON in popup description when omitted', async () => {
    const ps = makePlayerStats();
    const action = makeAction({});

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('CON saving throw');
    expect(result.payload.description).toContain('DC 14');
  });

  it('uses player name as target when resolveTarget returns null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });
    targetResolver.resolveTarget.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.targetName).toBe('TestHero');
  });

  it('uses custom saveType in popup description', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'WIS' });

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('WIS saving throw');
  });
});

// ── Tests: handle - Side Effects ───────────────────────────────

describe('saveOnlyHandler.handle - side effects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('computes save DC and passes it to save listener', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'CON',
      saveDc: 14,
    });
  });

  it('registers a save-result event listener on the window', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    await handle(action, ps, campaignName, mapName);

    expect(addEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
    addEventListenerSpy.mockRestore();
  });

  it('adds an ability_use log entry with correct details', async () => {
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
});

// ── Tests: handle - Save Result (Success Path) ────────────────

describe('saveOnlyHandler.handle - save result success', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('ignores save-result events with non-matching promptId', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'different-prompt', success: true },
    }));

    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
  });

  it('applies success effects and adds expiration on matching success', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

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

  it('adds a save_result log entry on success', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    const successEntry = logService.addEntry.mock.calls.find(
      (call) => call[1]?.type === 'save_result' && call[1]?.success === true,
    );
    expect(successEntry).toBeDefined();
    expect(successEntry[1].targetName).toBe('Goblin');
    expect(successEntry[1].saveDc).toBe(14);
  });

  it('sets speed_halved runtime value on success', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    const speedHalvedCall = runtimeState.setRuntimeValue.mock.calls.find(
      (call) => call[1]?.includes('speed_halved'),
    );
    expect(speedHalvedCall).toBeDefined();
    expect(speedHalvedCall[2]).toBe(true);
  });
});

// ── Tests: handle - Save Result (Fail Path) ───────────────────

describe('saveOnlyHandler.handle - save result fail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('adds condition to activeConditions on failure', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

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

  it('appends condition to existing activeConditions', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });
    runtimeState.getRuntimeValue.mockReturnValue(['prone', 'blinded']);

    await handle(action, ps, campaignName, mapName);

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

  it('adds a save_result log entry on failure', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false },
    }));

    const failEntry = logService.addEntry.mock.calls.find(
      (call) => call[1]?.type === 'save_result' && call[1]?.success === false,
    );
    expect(failEntry).toBeDefined();
    expect(failEntry[1].targetName).toBe('Goblin');
    expect(failEntry[1].success).toBe(false);
  });

  it('adds expiration with fail effects on failure', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: false },
    }));

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      ps.name,
      'Goblin',
      [{ type: 'stunned', condition: 'stunned' }],
      campaignName,
    );
  });
});

// ── Tests: handle - Custom Effects ─────────────────────────────

describe('saveOnlyHandler.handle - custom effects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('uses custom success effects when provided', async () => {
    const ps = makePlayerStats();
    const customEffects = {
      success: [{ type: 'speed_halved', condition: 'custom_slow' }],
      fail: [{ type: 'charmed', condition: 'charmed' }],
    };
    const action = makeAction({ saveType: 'CON', effects: customEffects });

    await handle(action, ps, campaignName, mapName);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'prompt-123', success: true },
    }));

    const speedHalvedCall = runtimeState.setRuntimeValue.mock.calls.find(
      (call) => call[1]?.includes('custom_slow'),
    );
    expect(speedHalvedCall).toBeDefined();
    expect(speedHalvedCall[2]).toBe(true);
  });

  it('uses custom fail effects when provided', async () => {
    const ps = makePlayerStats();
    const customEffects = {
      success: [],
      fail: [{ type: 'charmed', condition: 'charmed' }],
    };
    const action = makeAction({ saveType: 'CON', effects: customEffects });

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
});

// ── Tests: handle - Edge Cases ────────────────────────────────

describe('saveOnlyHandler.handle - edge cases', () => {
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
});
