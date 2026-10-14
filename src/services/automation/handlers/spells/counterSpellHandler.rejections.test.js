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
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
  rollbackSpellEffects: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './counterSpellHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { findLastAttack, rollbackSpellEffects } from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

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
      { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
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

function makeLastAttack(overrides = {}) {
  return {
    attackEvent: {
      attackerName: 'Goblin',
      targetName: 'TestCaster',
      damageFormula: '3d6',
      damageName: 'Fire Bolt',
      attackName: 'Fire Bolt',
      saveType: null,
      ...overrides.attackEvent,
    },
    attackerName: 'Goblin',
    targetName: 'TestCaster',
    primaryDamage: 9,
    secondaryDamage: 0,
    totalDamage: 9,
    damageTypes: ['Fire'],
    statusEffects: null,
    affectedTargets: ['TestCaster'],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('counterSpellHandler.errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addEntry rejection handling', () => {
    it('should not throw when initial addEntry rejects', async () => {
      const addEntryReject = vi.fn(() => Promise.reject(new Error('db error')));
      vi.mocked(addEntry).mockImplementation(addEntryReject);

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'reject-prompt-1' });

      const ps = makePlayerStats();
      const action = makeAction();

      await expect(handle(action, ps, campaignName, null)).resolves.not.toThrow();
    });

    it('should not throw when failed-save addEntry rejects', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const addEntryReject = vi.fn(() => Promise.reject(new Error('db error')));
      vi.mocked(addEntry).mockImplementation(addEntryReject);

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue({
        attackEvent: {
          attackerName: 'Goblin',
          targetName: 'TestCaster',
          damageFormula: '3d6',
          damageName: 'Fire Bolt',
          attackName: 'Fire Bolt',
          primaryDamage: 9,
          secondaryDamage: 0,
          affectedTargets: ['TestCaster'],
          statusEffects: null,
        },
        attackerName: 'Goblin',
        targetName: 'TestCaster',
        primaryDamage: 9,
        secondaryDamage: 0,
        totalDamage: 9,
        damageTypes: ['Fire'],
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'reject-fail-prompt' });
      rollbackSpellEffects.mockResolvedValue({
        targetsHealed: 1,
        conditionsRemoved: [],
        effectsRemoved: 0,
        damageHealed: 9,
        logDescription: "Goblin's spell 'Fire Bolt' was countered — 9 HP healed, no conditions to remove, no target effects to clear on TestCaster.",
      });

      const ps = makePlayerStats();
      const action = makeAction();

      await expect(handle(action, ps, campaignName, null)).resolves.not.toThrow();

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'reject-fail-prompt',
          success: false,
        },
      });

      await new Promise(r => setTimeout(r, 10));
      addEventListenerSpy.mockRestore();
    });

    it('should not throw when success save addEntry rejects', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const addEntryReject = vi.fn(() => Promise.reject(new Error('db error')));
      vi.mocked(addEntry).mockImplementation(addEntryReject);

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'reject-success-prompt' });

      const ps = makePlayerStats();
      const action = makeAction();

      await expect(handle(action, ps, campaignName, null)).resolves.not.toThrow();

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'reject-success-prompt',
          success: true,
        },
      });

      await new Promise(r => setTimeout(r, 10));
      addEventListenerSpy.mockRestore();
    });
  });

  describe('spell slot restoration edge cases', () => {
    it('should not restore slot when getRuntimeValue returns null', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getRuntimeValue.mockReturnValue(null);
      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'nullslots-prompt' });

      const ps = makePlayerStats({
        automation: {
          passives: [
            { type: 'spell_breaker', slotRetentionSpells: ['Counterspell'] },
          ],
        },
      });

      await handle(makeAction(), ps, campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'nullslots-prompt',
          success: true,
        },
      });

      expect(setRuntimeValue).not.toHaveBeenCalledWith(expect.any(String), expect.stringContaining('spell_slots_level_'), expect.any(Number), campaignName);
      addEventListenerSpy.mockRestore();
    });

    it('should not restore slot when getRuntimeValue returns undefined', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getRuntimeValue.mockReturnValue(undefined);
      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'undefslots-prompt' });

      const ps = makePlayerStats({
        automation: {
          passives: [
            { type: 'spell_breaker', slotRetentionSpells: ['Counterspell'] },
          ],
        },
      });

      await handle(makeAction(), ps, campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'undefslots-prompt',
          success: true,
        },
      });

      expect(setRuntimeValue).not.toHaveBeenCalledWith(expect.any(String), expect.stringContaining('spell_slots_level_'), expect.any(Number), campaignName);
      addEventListenerSpy.mockRestore();
    });

    it('should not restore slot when currentSlots is negative', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getRuntimeValue.mockReturnValue(-1);
      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'negslots-prompt' });

      const ps = makePlayerStats({
        automation: {
          passives: [
            { type: 'spell_breaker', slotRetentionSpells: ['Counterspell'] },
          ],
        },
      });

      await handle(makeAction(), ps, campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'negslots-prompt',
          success: true,
        },
      });

      expect(setRuntimeValue).not.toHaveBeenCalledWith(expect.any(String), expect.stringContaining('spell_slots_level_'), expect.any(Number), campaignName);
      addEventListenerSpy.mockRestore();
    });
  });
});
