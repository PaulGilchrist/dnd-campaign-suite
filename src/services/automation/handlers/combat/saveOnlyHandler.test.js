// @maintained-by-ai
// saveOnlyHandler (dispatched as automation type `save_only` from
// src/services/automation/index.js — distinct from saveAttackHandler).
// Deterministic unit contract: popup shape, save-prompt delegation, and the
// window 'save-result' listener's success/fail effect writes.
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

// Unique promptId per test: handle() registers a window listener that lives
// until it sees ITS OWN promptId, so a shared id would leak listeners across
// tests (every stale listener firing on every later matching dispatch).
let promptCounter = 0;

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
  savePrompt.createSaveListener.mockImplementation((_campaignName, _config) => {
    // Real contract (savePrompt.js:105-145): returns { promptId, promise } —
    // the old stub handed back promptId WITHOUT the promise the real service
    // mints (a one-shot 'save-result' listener routed BY its own promptId,
    // savePrompt.js:121-131). Ids stay unique-per-mint here (already true);
    // the added promise self-resolves+removes exactly like the real seam so
    // any future consumer awaiting it behaves as in prod.
    const promptId = `save-guid-${++promptCounter}`;
    const promise = new Promise((resolve) => {
      const handleSaveResult = (event) => {
        if (event.detail.promptId !== promptId) return;
        window.removeEventListener('save-result', handleSaveResult);
        resolve(event.detail);
      };
      window.addEventListener('save-result', handleSaveResult);
    });
    return { promptId, promise };
  });
  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  runtimeState.getRuntimeValue.mockReturnValue(undefined);
  runtimeState.setRuntimeValue.mockResolvedValue(undefined);
  logService.addEntry.mockResolvedValue({});
  expirations.addExpiration.mockReturnValue(undefined);
}

// Dispatches against the promptId issued by the most recent handle() call.
function dispatchSaveResult(success) {
  const { promptId } = savePrompt.createSaveListener.mock.results.at(-1).value;
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: { promptId, success },
  }));
}

// ── Tests: handle - popup return value ─────────────────────────

describe('saveOnlyHandler.handle - popup return value', () => {
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

  it('uses custom saveType in popup description and save listener', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'WIS' });

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('WIS saving throw');
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'WIS',
      saveDc: 14,
    });
  });

  it('uses player name as target when resolveTarget returns null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });
    targetResolver.resolveTarget.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.targetName).toBe('TestHero');
  });
});

// ── Tests: handle - dispatch wiring ────────────────────────────

describe('saveOnlyHandler.handle - dispatch wiring', () => {
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

  it('adds an ability_use log entry with correct details', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestHero',
      abilityName: 'Stunning Strike',
      description: 'Stunning Strike triggered — target Goblin must make CON save (DC 14)',
      promptId: savePrompt.createSaveListener.mock.results.at(-1).value.promptId,
    });
  });
});

// ── Tests: handle - save result (success path) ─────────────────

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

  // CLA-342 regression: the success branch must write the canonical key
  // consumed by CharSheet.conditionEffects ('stunned_speedHalved'), not a
  // timestamped dead key.
  it('writes canonical stunned_speedHalved key (no timestamped dead keys)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);
    dispatchSaveResult(true);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'stunned_speedHalved',
      true,
      campaignName,
    );
    const deadKeys = runtimeState.setRuntimeValue.mock.calls.filter(
      (call) => /_\d{13}$/.test(String(call[1])),
    );
    expect(deadKeys).toHaveLength(0);
  });

  it('records advantage_on_target on the attacker', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);
    dispatchSaveResult(true);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      '_advantageOn_Goblin',
      ['Goblin'],
      campaignName,
    );
  });

  it('adds expiration for success effects', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);
    dispatchSaveResult(true);

    expect(expirations.addExpiration).toHaveBeenCalledWith({
      attackerName: ps.name,
      targetName: 'Goblin',
      effects: [
        { type: 'stunned', condition: 'speed_halved' },
        { type: 'advantage_on_target' },
      ],
      campaignName,
      rounds: undefined,
      expireOnCreatureName: 'Goblin',
    });
  });

  it('adds a save_result log entry on success', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);
    dispatchSaveResult(true);

    const successEntry = logService.addEntry.mock.calls.find(
      (call) => call[1]?.type === 'save_result' && call[1]?.success === true,
    );
    expect(successEntry).toBeDefined();
    expect(successEntry[1].targetName).toBe('Goblin');
    expect(successEntry[1].saveDc).toBe(14);
  });
});

// ── Tests: handle - save result (fail path) ────────────────────

describe('saveOnlyHandler.handle - save result fail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('adds condition to activeConditions on failure', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);
    dispatchSaveResult(false);

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
    dispatchSaveResult(false);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['prone', 'blinded', 'stunned'],
      campaignName,
    );
  });

  it('adds expiration with fail effects on failure', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);
    dispatchSaveResult(false);

    expect(expirations.addExpiration).toHaveBeenCalledWith({
      attackerName: ps.name,
      targetName: 'Goblin',
      effects: [{ type: 'stunned', condition: 'stunned' }],
      campaignName,
      rounds: undefined,
      expireOnCreatureName: 'Goblin',
    });
  });

  it('adds a save_result log entry on failure', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'CON' });

    await handle(action, ps, campaignName, mapName);
    dispatchSaveResult(false);

    const failEntry = logService.addEntry.mock.calls.find(
      (call) => call[1]?.type === 'save_result' && call[1]?.success === false,
    );
    expect(failEntry).toBeDefined();
    expect(failEntry[1].targetName).toBe('Goblin');
    expect(failEntry[1].success).toBe(false);
  });
});

// ── Tests: handle - custom effects ─────────────────────────────

describe('saveOnlyHandler.handle - custom effects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  it('uses custom success effect conditions as runtime keys', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      saveType: 'CON',
      effects: {
        success: [{ type: 'speed_halved', condition: 'custom_slow' }],
        fail: [{ type: 'charmed', condition: 'charmed' }],
      },
    });

    await handle(action, ps, campaignName, mapName);
    dispatchSaveResult(true);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'stunned_custom_slow',
      true,
      campaignName,
    );
  });

  it('applies custom fail condition via effects.fail (Color Spray scenario)', async () => {
    const ps = makePlayerStats();
    const action = {
      name: 'Color Spray',
      automation: {
        type: 'save_only',
        saveType: 'CON',
        effects: {
          fail: [{ type: 'blinded', condition: 'blinded' }],
        },
      },
    };

    await handle(action, ps, campaignName, mapName);
    dispatchSaveResult(false);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['blinded'],
      campaignName,
    );
  });
});
