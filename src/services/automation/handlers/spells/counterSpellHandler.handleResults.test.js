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

describe('counterSpellHandler.handleSaveResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('save result handling', () => {
    it('should log save_result and rollback on failed save', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

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
      createSaveListener.mockReturnValue({ promptId: 'save-test-prompt' });
      rollbackSpellEffects.mockResolvedValue({
        targetsHealed: 1,
        conditionsRemoved: [{ targetName: 'TestCaster', condition: 'burning' }],
        effectsRemoved: 2,
        damageHealed: 9,
        logDescription: "Goblin's spell 'Fire Bolt' was countered — 9 HP healed, 1 condition(s) removed, 2 target effect(s) cleared on TestCaster.",
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'save-test-prompt',
          success: false,
        },
      });

      // Wait for async addEntry calls to complete
      await new Promise(r => setTimeout(r, 10));

      expect(rollbackSpellEffects).toHaveBeenCalledWith(
        expect.objectContaining({
          attackerName: 'Goblin',
          targetName: 'TestCaster',
          damageFormula: '3d6',
          damageName: 'Fire Bolt',
        }),
        campaignName,
        'Counterspell',
        expect.objectContaining({ creatures: expect.any(Array) }),
      );

      // First call was ability_use for the counter triggered, second is save_result
      const saveResultCall = addEntry.mock.calls.find(
        call => call[1]?.type === 'save_result' && call[1]?.success === false
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-counterspell',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'CON',
        success: false,
        description: 'Goblin failed CON save. Counterspell counters \'Fire Bolt\'!',
      });

      // Third call should be the ability_use log for the rollback
      const abilityUseCall = addEntry.mock.calls.find(
        call => call[1]?.type === 'ability_use' && call[1]?.description?.includes('was countered')
      );
      expect(abilityUseCall).toBeDefined();
      expect(abilityUseCall[1]).toEqual({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Counterspell',
        description: "Goblin's spell 'Fire Bolt' was countered — 9 HP healed, 1 condition(s) removed, 2 target effect(s) cleared on TestCaster.",
      });

      addEventListenerSpy.mockRestore();
    });

    it('should log save_result on successful save', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
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
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'CON',
        success: true,
        description: 'Goblin succeeded on CON save. Counterspell fails to counter \'Fire Bolt\'.',
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
      findLastAttack.mockResolvedValue(makeLastAttack());
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
      findLastAttack.mockResolvedValue(makeLastAttack());
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

      expect(setRuntimeValue).not.toHaveBeenCalledWith(expect.any(String), expect.stringContaining('spell_slots_level_'), expect.any(Number), campaignName);
      addEventListenerSpy.mockRestore();
    });

    it('should not restore a spell slot on failed save even with spell_breaker', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getRuntimeValue.mockReturnValue(3);
      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'failspellbreaker-prompt' });
      rollbackSpellEffects.mockResolvedValue({
        targetsHealed: 0,
        conditionsRemoved: [],
        effectsRemoved: 0,
        damageHealed: 0,
        logDescription: '',
      });

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

      expect(setRuntimeValue).not.toHaveBeenCalledWith(expect.any(String), expect.stringContaining('spell_slots_level_'), expect.any(Number), campaignName);
      addEventListenerSpy.mockRestore();
    });
  });

  describe('AoE spell handling', () => {
    it('should use affectedTargets from lastAttack for rollback', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue({
        attackEvent: {
          attackerName: 'Goblin',
          targetName: 'TestCaster',
          damageFormula: '3d6',
          damageName: 'Fireball',
          attackName: 'Fireball',
          saveType: 'DEX',
          saveDc: 14,
          saveResult: 'failure',
          primaryDamage: 9,
          secondaryDamage: 0,
          affectedTargets: ['TestCaster', 'Orc'],
          statusEffects: ['burning'],
        },
        attackerName: 'Goblin',
        targetName: 'TestCaster',
        primaryDamage: 9,
        secondaryDamage: 0,
        totalDamage: 9,
        damageTypes: ['Fire'],
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'aoe-prompt' });
      rollbackSpellEffects.mockResolvedValue({
        targetsHealed: 2,
        conditionsRemoved: [],
        effectsRemoved: 0,
        damageHealed: 18,
        logDescription: "Goblin's spell 'Fireball' was countered — 18 HP healed, no conditions to remove, no target effects to clear on TestCaster, Orc.",
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'aoe-prompt',
          success: false,
        },
      });

      expect(rollbackSpellEffects).toHaveBeenCalledWith(
        expect.objectContaining({
          affectedTargets: ['TestCaster', 'Orc'],
          damageName: 'Fireball',
        }),
        campaignName,
        'Counterspell',
        expect.objectContaining({ creatures: expect.any(Array) }),
      );

      addEventListenerSpy.mockRestore();
    });
  });

  describe('handleSaveResult early return', () => {
    it('should ignore events with mismatched promptId', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'correct-prompt' });
      rollbackSpellEffects.mockResolvedValue({
        targetsHealed: 0,
        conditionsRemoved: [],
        effectsRemoved: 0,
        damageHealed: 0,
        logDescription: '',
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const savedCallback = addEventListenerSpy.mock.calls[0][1];
      savedCallback({
        detail: {
          promptId: 'wrong-prompt',
          success: false,
        },
      });

      await new Promise(r => setTimeout(r, 10));

      expect(rollbackSpellEffects).not.toHaveBeenCalled();
      addEventListenerSpy.mockRestore();
    });
  });
});
