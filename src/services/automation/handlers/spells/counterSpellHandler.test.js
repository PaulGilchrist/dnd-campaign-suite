// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './counterSpellHandler.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

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
    name: 'Counterspell',
    automation: {
      type: 'counterspell',
      saveType: 'CON',
      ...automation,
    },
  };
}

function makeCombatContext(overrides = {}) {
  return {
    creatures: [
      { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7, targetName: 'Orc' },
      { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
      { name: 'TestCaster', gridX: 5, gridY: 10 },
    ],
    players: [
      { name: 'TestCaster', gridX: 5, gridY: 10 },
    ],
    placedItems: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('counterSpellHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Counterspell');
      expect(result.payload.description).toContain('requires an active combat');
      expect(result.payload.description).toContain('Select a creature in combat');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should return popup when combat context has no creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue({ creatures: [] });
      getTargetFromAttacker.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('requires a target');
    });
  });

  describe('target validation', () => {
    it('should return popup when no target is found', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Counterspell');
      expect(result.payload.description).toContain('requires a target');
      expect(result.payload.description).toContain('Select a creature in combat');
    });

    it('should pass combat context and player name to getTargetFromAttacker', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      expect(getTargetFromAttacker).toHaveBeenCalledWith(
        expect.objectContaining({ creatures: expect.any(Array) }),
        'TestCaster',
      );
    });
  });

  describe('successful counterspell', () => {
    it('should return popup with save prompt info', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-1' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Counterspell');
      expect(result.payload.targetName).toBe('Goblin');
      expect(result.payload.description).toContain('Goblin must make a CON saving throw');
      expect(result.payload.description).toContain('DC 15');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should call buildSaveDc with action automation and playerStats', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-2' });

      await handle(action, ps, campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
    });

    it('should call createSaveListener with correct config', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Bugbear' });
      buildSaveDc.mockReturnValue(14);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-3' });

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Bugbear',
        saveType: 'CON',
        saveDc: 14,
      });
    });

    it('should call addEntry with ability_use type', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Hobgoblin' });
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-4' });

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Counterspell',
        description: 'Counterspell triggered — Hobgoblin must make CON save (DC 16)',
        promptId: 'test-prompt-4',
      });
    });

    it('should add save-result event listener', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Kobold' });
      buildSaveDc.mockReturnValue(12);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-5' });

      await handle(action, ps, campaignName, null);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'save-result',
        expect.any(Function),
      );
      addEventListenerSpy.mockRestore();
    });

    it('should use custom saveType from automation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'WIS' });

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-6' });

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 15,
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Counterspell',
        description: 'Counterspell triggered — Goblin must make WIS save (DC 15)',
        promptId: 'test-prompt-6',
      });
    });

    it('should use action.name when provided', async () => {
      const ps = makePlayerStats();
      const action = { name: 'My Counterspell', automation: { type: 'counterspell', saveType: 'CON' } };

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-7' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('My Counterspell');
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'My Counterspell',
        description: 'My Counterspell triggered — Goblin must make CON save (DC 15)',
        promptId: 'test-prompt-7',
      });
    });
  });

  describe('save result handling', () => {
    it('should log save_result entry on failed save', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'save-test-prompt' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'save-test-prompt',
          success: false,
        },
      });

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-counterspell',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'CON',
        success: false,
        description: 'Goblin failed CON save. Goblin\'s spell is countered and wasted.',
      });
      addEventListenerSpy.mockRestore();
    });

    it('should log save_result entry on successful save', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
      buildSaveDc.mockReturnValue(14);
      createSaveListener.mockReturnValue({ promptId: 'save-test-prompt-2' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'save-test-prompt-2',
          success: true,
        },
      });

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-counterspell',
        targetName: 'Orc',
        saveDc: 14,
        saveType: 'CON',
        success: true,
        description: 'Orc succeeded on CON save. Counterspell fails to counter the spell.',
      });
      addEventListenerSpy.mockRestore();
    });

    it('should ignore save-result events with different promptId', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'correct-prompt' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'wrong-prompt',
          success: false,
        },
      });

      const saveResultCalls = addEntry.mock.calls.filter(
        call => call[1]?.type === 'save_result',
      );
      expect(saveResultCalls.length).toBe(0);
      addEventListenerSpy.mockRestore();
    });

    it('should remove event listener after handling save result', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'remove-test-prompt' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'remove-test-prompt',
          success: false,
        },
      });

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'save-result',
        savedCallback,
      );
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('automation passthrough', () => {
    it('should include automation object in popup payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ customField: 'customValue' });

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-8' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automation).toEqual({
        type: 'counterspell',
        saveType: 'CON',
        customField: 'customValue',
      });
    });
  });

  describe('spell_breaker passive', () => {
    async function runSpellBreakerTest(config) {
      const {
        ps,
        action,
        runtimeValue,
        mockPromptId,
        eventSuccess,
        expectRestore,
      } = config;

      getRuntimeValue.mockReturnValue(runtimeValue);

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: mockPromptId });

      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      await handle(action, ps, campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: mockPromptId,
          success: eventSuccess,
        },
      });

      if (expectRestore) {
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestCaster',
          'spell_slots_level_3',
          expectRestore,
          campaignName,
        );
      } else {
        expect(setRuntimeValue).not.toHaveBeenCalled();
      }

      addEventListenerSpy.mockRestore();
    }

    it('should restore a spell slot when spell_breaker passive succeeds on Counterspell', async () => {
      await runSpellBreakerTest({
        ps: makePlayerStats({
          automation: {
            passives: [
              { type: 'spell_breaker', slotRetentionSpells: ['Counterspell'] },
            ],
          },
        }),
        action: makeAction(),
        runtimeValue: 3,
        mockPromptId: 'spellbreaker-prompt',
        eventSuccess: true,
        expectRestore: 4,
      });
    });

    it('should not restore a spell slot when spell_breaker passive is missing', async () => {
      await runSpellBreakerTest({
        ps: makePlayerStats(),
        action: makeAction(),
        runtimeValue: 3,
        mockPromptId: 'nospellbreaker-prompt',
        eventSuccess: true,
        expectRestore: false,
      });
    });

    it('should not restore a spell slot when spell_breaker does not include Counterspell', async () => {
      await runSpellBreakerTest({
        ps: makePlayerStats({
          automation: {
            passives: [
              { type: 'spell_breaker', slotRetentionSpells: ['Shield'] },
            ],
          },
        }),
        action: makeAction(),
        runtimeValue: 3,
        mockPromptId: 'partialmatch-prompt',
        eventSuccess: true,
        expectRestore: false,
      });
    });

    it('should not restore a spell slot on failed save even with spell_breaker', async () => {
      await runSpellBreakerTest({
        ps: makePlayerStats({
          automation: {
            passives: [
              { type: 'spell_breaker', slotRetentionSpells: ['Counterspell'] },
            ],
          },
        }),
        action: makeAction(),
        runtimeValue: 3,
        mockPromptId: 'failspellbreaker-prompt',
        eventSuccess: false,
        expectRestore: false,
      });
    });

    it('should not restore a spell slot when slot value is null', async () => {
      await runSpellBreakerTest({
        ps: makePlayerStats({
          automation: {
            passives: [
              { type: 'spell_breaker', slotRetentionSpells: ['Counterspell'] },
            ],
          },
        }),
        action: makeAction(),
        runtimeValue: null,
        mockPromptId: 'nullslot-prompt',
        eventSuccess: true,
        expectRestore: false,
      });
    });
  });
});
