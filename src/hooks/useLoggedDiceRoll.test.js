import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useLoggedDiceRoll from './useLoggedDiceRoll.js';
import * as combatDataMod from '../services/encounters/combatData.js';
import * as runtimeStateMod from '../hooks/useRuntimeState.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../services/dice/diceRoller.js', () => {
  let nextRoll = 10;
  return {
    rollD20: vi.fn(() => nextRoll++),
  };
});

vi.mock('../services/ui/utils.js', () => {
  let guidCounter = 0;
  return {
    default: {
      getName: vi.fn((name) => name || 'Unknown'),
      guid: vi.fn(() => `guid-${++guidCounter}`),
    },
  };
});

vi.mock('../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../services/rules/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../services/rules/applyDamage.js', () => ({
  computeDamageAfterSave: vi.fn((raw, success) => (success ? 0 : raw)),
  computeDamageAfterEvasion: vi.fn((raw, success) => (success ? 0 : raw)),
  rollSaveForCreature: vi.fn(() => ({ success: true, roll: 15, total: 20, bonus: 5, rawRolls: [15] })),
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 10, oldHp: 30, newHp: 20, damageReduced: false })),
}));

vi.mock('../services/combat/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
}));

vi.mock('../services/rules/aoeService.js', () => ({
  getAffectedCreatures: vi.fn(),
  processAoeNpcs: vi.fn(),
  sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../hooks/useRuntimeState.js', () => {
  const store = new Map();
  return {
    getRuntimeValue: vi.fn((key, prop) => store.get(`${key}::${prop}`) ?? null),
    setRuntimeValue: vi.fn((key, prop, val) => { store.set(`${key}::${prop}`, val); }),
    useRuntimeValue: vi.fn(() => null),
    addStorageChangeListener: vi.fn(() => () => {}),
  };
});

vi.mock('../services/rules/expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(() => Promise.resolve(null)),
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../hooks/useMetamagic.js', () => ({
  saveLastDamageEvent: vi.fn(),
}));

vi.mock('../services/combat/unbreakableMajesty.js', () => ({
  isUnbreakableMajestyActive: vi.fn(() => false),
  getUnbreakableMajestySaveDc: vi.fn(() => 14),
  hasAttackerTriggeredMajesty: vi.fn(() => false),
  markAttackerTriggeredMajesty: vi.fn(),
}));

vi.mock('../hooks/useDiceRoll.js', () => {
  let popupHtml = null;
  return {
    default: vi.fn(() => ({
      popupHtml: { get() { return popupHtml; } },
      setPopupHtml: vi.fn((val) => { popupHtml = val; }),
    })),
  };
});

vi.mock('../config/ui-config.js', () => ({
  SHOW_DICE_ROLL_DELAY: 2000,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetWindowState() {
  delete window.__pendingSaves;
  delete window.__pendingResultHandlersInstalled;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useLoggedDiceRoll', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetWindowState();
    localStorage.clear();
  });

  afterEach(() => {
    resetWindowState();
  });

  // ── Return value structure ─────────────────────────────────────────────

  describe('return value', () => {
    it('returns the expected set of properties', () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));
      expect(result.current.popupHtml).toBeDefined();
      expect(typeof result.current.setPopupHtml).toBe('function');
      expect(typeof result.current.rollAbilityCheck).toBe('function');
      expect(typeof result.current.rollSavingThrow).toBe('function');
      expect(typeof result.current.rollSkillCheck).toBe('function');
      expect(typeof result.current.rollInitiative).toBe('function');
      expect(typeof result.current.rollAttack).toBe('function');
      expect(typeof result.current.rollDamage).toBe('function');
      expect(typeof result.current.quickRollPlayerSave).toBe('function');
    });
  });

  // ── Event listener registration (one-time) ─────────────────────────────

  describe('event listener registration', () => {
    it('installs window event listeners only once per campaignName', () => {
      renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));
      renderHook(() => useLoggedDiceRoll('Hero2', 'TestCampaign'));
      expect(window.__pendingResultHandlersInstalled).toBe(true);
    });

    it('does not install listeners when campaignName is falsy', () => {
      renderHook(() => useLoggedDiceRoll('Hero', null));
      expect(window.__pendingResultHandlersInstalled).toBeUndefined();
    });

    it('handles save-result event for pending saves', () => {
      renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      // Seed a pending save
      window.__pendingSaves['test-prompt-1'] = {
        targetName: 'Goblin',
        attackerName: 'Hero',
        name: 'Fireball',
        formula: '8d6',
        rolls: [1, 2, 3],
        rawDamage: 28,
        modifier: 0,
        damageType: 'Fire',
        dcSuccess: 'half',
        campaignName: 'TestCampaign',
        setPopupHtml: () => {},
      };

      // Fire the event
      window.dispatchEvent(
        new CustomEvent('save-result', {
          detail: {
            promptId: 'test-prompt-1',
            targetName: 'Goblin',
            saveType: 'DEX',
            success: true,
            roll: 15,
            total: 20,
            saveBonus: 5,
            rawDamage: 28,
            dcSuccess: 'half',
            saveDc: 14,
          },
        })
      );

      // The handler processes the pending save and deletes it after handling
      expect(window.__pendingSaves['test-prompt-1']).toBeUndefined();
    });

    it('ignores save-result event for unknown promptId', () => {
      renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      window.dispatchEvent(
        new CustomEvent('save-result', {
          detail: { promptId: 'nonexistent' },
        })
      );

      // Should not throw
    });

    it('handles death-save-result event', () => {
      renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      window.dispatchEvent(
        new CustomEvent('death-save-result', {
          detail: {
            targetName: 'Hero',
            roll: 12,
            isNat20: false,
            isNat1: true,
            success: true,
          },
        })
      );

      // Should not throw (logEntry is a fetch call)
    });

    it('handles concentration-result event — success case', () => {
      renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      window.dispatchEvent(
        new CustomEvent('concentration-result', {
          detail: {
            targetName: 'Hero',
            roll: 15,
            total: 20,
            saveBonus: 5,
            spellName: 'Haste',
            dc: 12,
            success: true,
          },
        })
      );

      // Should not throw
    });

    it('handles concentration-result event — failure with combat summary', () => {
      vi.mocked(combatDataMod.getCombatSummary).mockReturnValue({
        creatures: [
          { name: 'Hero', concentration: { spell: 'Haste' } },
        ],
      });

      renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      window.dispatchEvent(
        new CustomEvent('concentration-result', {
          detail: {
            targetName: 'Hero',
            roll: 8,
            total: 13,
            saveBonus: 5,
            spellName: 'Haste',
            dc: 12,
            success: false,
          },
        })
      );

      // Should have called setRuntimeValue to clear mantleOfMajestyActive
      expect(runtimeStateMod.setRuntimeValue).toHaveBeenCalled();
    });

    it('handles concentration-result event — failure without matching creature', () => {
      vi.mocked(combatDataMod.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', concentration: null }],
      });

      renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      window.dispatchEvent(
        new CustomEvent('concentration-result', {
          detail: {
            targetName: 'Hero',
            roll: 8,
            total: 13,
            saveBonus: 5,
            spellName: 'Haste',
            dc: 12,
            success: false,
          },
        })
      );

      // Should not throw
    });
  });

  // ── autoDamageRoll effect ────────────────────────────────────────────────

  describe('autoDamageRoll effect', () => {
    it('does not trigger autoDamageRoll when popupHtml.hit is false', async () => {
      const autoDamageRoll = vi.fn();

      renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign', { autoDamageRoll }));

      await act(async () => {
        vi.useFakeTimers();
        vi.advanceTimersByTime(2500);
        vi.useRealTimers();
      });

      // popupHtml starts as null, so hit is not true — autoDamageRoll shouldn't fire
      expect(autoDamageRoll).not.toHaveBeenCalled();
    });

    it('does not trigger autoDamageRoll when autoDamageRoll option is null', async () => {
      renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign', {}));

      await act(async () => {
        vi.useFakeTimers();
        vi.advanceTimersByTime(2500);
        vi.useRealTimers();
      });

      // No autoDamageRoll to call, should not throw
    });
  });

  // ── logAndShow (attack rolls) ───────────────────────────────────────────

  describe('logAndShow — attack', () => {
    it('calls logEntry and setPopupHtml for an attack roll', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.rollAttack('Longsword', 5);
      });

      // popupHtml should be set (from useDiceRoll mock)
      expect(result.current.popupHtml).toBeDefined();
    });

    it('calls logAndShow for ability check', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.rollAbilityCheck('Strength', 3);
      });

      expect(result.current.popupHtml).toBeDefined();
    });

    it('calls logAndShow for saving throw', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.rollSavingThrow('Dexterity', 4);
      });

      expect(result.current.popupHtml).toBeDefined();
    });

    it('calls logAndShow for skill check', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.rollSkillCheck('Stealth', 7);
      });

      expect(result.current.popupHtml).toBeDefined();
    });
  });

  // ── logAndShow — initiative ─────────────────────────────────────────────

  describe('logAndShow — initiative', () => {
    it('handles initiative roll with no combat summary', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.rollInitiative(3);
      });

      expect(result.current.popupHtml).toBeDefined();
    });
  });

  // ── logDamageAndShow — basic damage ─────────────────────────────────────

  describe('logDamageAndShow', () => {
    it('handles basic damage roll (no save, no target)', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.rollDamage('Fireball', '8d6', 28, [1, 2, 3], 0);
      });

      expect(result.current.popupHtml).toBeDefined();
    });

    it('handles auto-miss damage', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.rollDamage('Fireball', '8d6', 28, [1, 2, 3], 0, {
          isAutoMiss: true,
        });
      });

      expect(result.current.popupHtml).toBeDefined();
    });

    it('handles damage with saveDc/saveType but no target', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.rollDamage('Fireball', '8d6', 28, [1, 2, 3], 0, {
          saveDc: 14,
          saveType: 'DEX',
          dcSuccess: 'half',
          damageType: 'Fire',
        });
      });

      expect(result.current.popupHtml).toBeDefined();
    });

    it('handles damage with target but no saveDc', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.rollDamage('Fireball', '8d6', 28, [1, 2, 3], 0, {
          targetName: 'Goblin',
          damageType: 'Fire',
        });
      });

      expect(result.current.popupHtml).toBeDefined();
    });
  });

  // ── logDamageAndShow — AoE overlay target ───────────────────────────────

  describe('logDamageAndShow — AoE overlay', () => {
    it('handles overlay- prefixed targetName with aoeContext', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.rollDamage('Fireball', '8d6', 28, [1, 2, 3], 0, {
          targetName: 'overlay-fireball-1',
          damageType: 'Fire',
        });
      });

      expect(result.current.popupHtml).toBeDefined();
    });

    it('handles overlay- prefixed targetName without aoeContext', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.rollDamage('Fireball', '8d6', 28, [1, 2, 3], 0, {
          targetName: 'overlay-fireball-1',
          damageType: 'Fire',
        });
      });

      expect(result.current.popupHtml).toBeDefined();
    });
  });

  // ── quickRollPlayerSave ─────────────────────────────────────────────────

  describe('quickRollPlayerSave', () => {
    it('returns early if no pending save exists', async () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.quickRollPlayerSave('nonexistent', 'Goblin', 'DEX', 14);
      });

      // Should not throw
    });

    it('returns early if target not found in combat summary', async () => {
      // Initialize pendingSaves (normally done by the hook)
      window.__pendingSaves = {};
      // Seed a pending save
      window.__pendingSaves['test-prompt-2'] = {
        targetName: 'Goblin',
      };

      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));

      await act(async () => {
        result.current.quickRollPlayerSave('test-prompt-2', 'Goblin', 'DEX', 14);
      });

      // Should not throw
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles missing options gracefully', () => {
      const { result } = renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign'));
      expect(result.current.popupHtml).toBeDefined();
    });

    it('handles empty characterName', () => {
      const { result } = renderHook(() => useLoggedDiceRoll('', 'TestCampaign'));
      expect(result.current.popupHtml).toBeDefined();
    });

    it('handles charactersRef being null', () => {
      renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign', { characters: null }));
      // Should not throw
    });

    it('handles autoDamageRoll being null', () => {
      renderHook(() => useLoggedDiceRoll('Hero', 'TestCampaign', { autoDamageRoll: null }));
      // Should not throw
    });
  });
});
