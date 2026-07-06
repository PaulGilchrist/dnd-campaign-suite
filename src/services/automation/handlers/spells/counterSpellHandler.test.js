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

  describe('validation', () => {
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

    it('should support custom saveType and action name', async () => {
      const ps = makePlayerStats();
      const action = { name: 'My Counterspell', automation: { type: 'counterspell', saveType: 'WIS' } };

      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'custom-prompt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('My Counterspell');
      expect(result.payload.targetName).toBe('Goblin');
      expect(result.payload.description).toContain('Goblin must make a WIS saving throw');
      expect(result.payload.description).toContain('DC 15');
      expect(result.payload.automation).toEqual(action.automation);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'My Counterspell',
        description: 'My Counterspell triggered — Goblin must make WIS save (DC 15)',
        promptId: 'custom-prompt',
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
  });

  describe('spell_breaker passive', () => {
    it('should restore a spell slot on successful save when spell_breaker passive includes Counterspell', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const ps = makePlayerStats({
        automation: {
          passives: [
            { type: 'spell_breaker', slotRetentionSpells: ['Counterspell'] },
          ],
        },
      });

      getRuntimeValue.mockReturnValue(3);
      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'spellbreaker-prompt' });

      await handle(makeAction(), ps, campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'spellbreaker-prompt',
          success: true,
        },
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'spell_slots_level_3',
        4,
        campaignName,
      );
      addEventListenerSpy.mockRestore();
    });

    it('should not restore a spell slot when spell_breaker passive is missing', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getRuntimeValue.mockReturnValue(3);
      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'nospellbreaker-prompt' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'nospellbreaker-prompt',
          success: true,
        },
      });

      expect(setRuntimeValue).not.toHaveBeenCalled();
      addEventListenerSpy.mockRestore();
    });

    it('should not restore a spell slot when passive excludes Counterspell', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getRuntimeValue.mockReturnValue(3);
      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'partialmatch-prompt' });

      await handle(makeAction(), makePlayerStats({
        automation: {
          passives: [
            { type: 'spell_breaker', slotRetentionSpells: ['Shield'] },
          ],
        },
      }), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'partialmatch-prompt',
          success: true,
        },
      });

      expect(setRuntimeValue).not.toHaveBeenCalled();
      addEventListenerSpy.mockRestore();
    });

    it('should not restore a spell slot on failed save even with spell_breaker', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getRuntimeValue.mockReturnValue(3);
      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'failspellbreaker-prompt' });

      await handle(makeAction(), makePlayerStats({
        automation: {
          passives: [
            { type: 'spell_breaker', slotRetentionSpells: ['Counterspell'] },
          ],
        },
      }), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'failspellbreaker-prompt',
          success: false,
        },
      });

      expect(setRuntimeValue).not.toHaveBeenCalled();
      addEventListenerSpy.mockRestore();
    });

    it('should not restore a spell slot when slot value is null', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getRuntimeValue.mockReturnValue(null);
      getCombatContext.mockResolvedValue(makeCombatContext());
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'nullslot-prompt' });

      await handle(makeAction(), makePlayerStats({
        automation: {
          passives: [
            { type: 'spell_breaker', slotRetentionSpells: ['Counterspell'] },
          ],
        },
      }), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'nullslot-prompt',
          success: true,
        },
      });

      expect(setRuntimeValue).not.toHaveBeenCalled();
      addEventListenerSpy.mockRestore();
    });
  });
});
