import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
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

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './friendsHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logPoster from '../../../shared/logPoster.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestBard',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Friends',
    automation: {
      type: 'friends',
      targetName: 'Goblin',
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'TestBard', type: 'player', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestBard', gridX: 5, gridY: 10 }],
  placedItems: [],
};

// ── Tests ──────────────────────────────────────────────────────

describe('friendsHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates save listener and returns popup', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'test-prompt-1',
      promise: Promise.resolve({ success: false }),
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Friends');
    expect(result.payload.targetName).toBe('Goblin');
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'WIS',
      saveDc: 13,
      dcSuccess: 'none',
    });
  });

  it('uses custom targetName from automation', async () => {
    const action = makeAction({ targetName: 'Orc' });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(14);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'test-prompt-2',
      promise: Promise.resolve({ success: false }),
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBe('Orc');
  });

  it('defaults targetName to Unknown when not in automation', async () => {
    const action = makeAction({ targetName: undefined });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'test-prompt-3',
      promise: Promise.resolve({ success: false }),
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.targetName).toBe('Unknown');
  });

  it('uses automation or empty object when automation is undefined', async () => {
    const action = { name: 'Friends', automation: undefined };
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'test-prompt-4',
      promise: Promise.resolve({ success: false }),
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('Unknown');
  });

  it('tracks active Friends in runtime state', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'test-prompt-5',
      promise: Promise.resolve({ success: false }),
    });

    await handle(action, ps, campaignName, null);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      campaignName,
      '_activeFriends_TestBard',
      'Goblin',
      campaignName,
    );
  });

  it('saves result from promise on success', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'test-prompt-6',
      promise: Promise.resolve({ success: true }),
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('succeeded on the Wisdom save');
  });

  it('saves result from promise on failure', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(13);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'test-prompt-7',
      promise: Promise.resolve({ success: false }),
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('failed the WIS save');
    expect(result.payload.description).toContain('Charmed');
  });

  describe('save success path', () => {
    it('clears active Friends tracking', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'clear-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(action, ps, campaignName, null);

      const clearCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        c => c[1] === '_activeFriends_TestBard' && c[2] === null,
      );
      expect(clearCall).toBeDefined();
    });

    it('returns popup with success message', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'success-prompt',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Friends');
      expect(result.payload.description).toContain('succeeded');
      expect(result.payload.description).not.toContain('Charmed');
    });

    it('logs save_result entry on success', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'success-log-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          success: true,
          saveType: 'WIS',
          rollType: 'save-friends',
        }),
      );
    });
  });

  describe('save failure path - NPC target', () => {
    it('applies Charmed condition to NPC creature', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'npc-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      const goblinCreature = baseCombatContext.creatures.find(c => c.name === 'Goblin');
      expect(goblinCreature.conditions).toHaveLength(1);
      expect(goblinCreature.conditions[0].key).toBe('charmed');
    });

    it('adds expiration for Charmed condition', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'exp-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestBard',
        'Goblin',
        [{ type: 'condition', condition: 'charmed' }],
        campaignName,
        2,
      );
    });

    it('posts log entry for condition application', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(13);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'log-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(action, ps, campaignName, null);

      expect(logPoster.postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Charmed',
          reason: 'Friends cantrip',
        }),
      );
    });
  });
});
