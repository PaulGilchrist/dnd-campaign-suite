import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    casting_time: '1 Action',
    range: '150 ft.',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Return value structure ─────────────────────────────────────────────

  describe('return value', () => {
    it('returns the expected set of properties', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      expect(result.current).toHaveProperty('pendingMetamagic');
      expect(result.current).toHaveProperty('pendingMultiTarget');
      expect(result.current).toHaveProperty('pendingAid');
      expect(result.current).toHaveProperty('gateMetamagic');
      expect(result.current).toHaveProperty('handleConfirm');
      expect(result.current).toHaveProperty('handleSkip');
      expect(result.current).toHaveProperty('handleMultiTargetConfirm');
      expect(result.current).toHaveProperty('handleMultiTargetSkip');
      expect(result.current).toHaveProperty('handleAidConfirm');
      expect(result.current).toHaveProperty('handleAidSkip');
      expect(typeof result.current.gateMetamagic).toBe('function');
      expect(typeof result.current.handleConfirm).toBe('function');
      expect(typeof result.current.handleSkip).toBe('function');
    });

    it('initializes pendingMetamagic as null', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      expect(result.current.pendingMetamagic).toBeNull();
    });

    it('initializes pendingMultiTarget as null', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      expect(result.current.pendingMultiTarget).toBeNull();
    });

    it('initializes pendingAid as null', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      expect(result.current.pendingAid).toBeNull();
    });
  });

  // ── gateMetamagic — non-sorcerer path ──────────────────────────────────

  describe('gateMetamagic — non-sorcerer', () => {
    it('logs a spell entry and calls onExecute with empty context for non-sorcerer', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats({ class: { name: 'Wizard' } });
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: playerStats.name,
        spellName: spell.name,
        spellLevel: spell.level,
        castingTime: spell.casting_time,
        metamagic: [],
        spCost: 0,
        timestamp: expect.any(Number),
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {});
      expect(result.current.pendingMetamagic).toBeNull();
    });

    it('handles non-sorcerer with spell missing level (defaults to 0)', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats({ class: { name: 'Wizard' } });
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell({ level: undefined });
      act(() => {
        result.current.gateMetamagic(spell);
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: playerStats.name,
        spellName: spell.name,
        spellLevel: 0,
        castingTime: spell.casting_time,
        metamagic: [],
        spCost: 0,
        timestamp: expect.any(Number),
      });
    });

    it('handles non-sorcerer with null class', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats({ class: null });
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalled();
      expect(onExecute).toHaveBeenCalledWith(spell, {});
    });

    it('throws on null playerStats due to unguarded .name in useCallback deps', () => {
      const onExecute = vi.fn();
      expect(() => {
        renderHook(() =>
          useSpellMetamagicFlow(null, 'TestCampaign', onExecute)
        );
      }).toThrow();
    });
  });

  // ── gateMetamagic — sorcerer path ──────────────────────────────────────

  describe('gateMetamagic — sorcerer', () => {
    it('sets pendingMetamagic with spell details for a sorcerer', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      const metamagicMod = await import('./useMetamagic.js');
      expect(metamagicMod.getCurrentSorceryPoints).toHaveBeenCalledWith(playerStats.name, expect.any(Number));
      expect(metamagicMod.getMaxSorceryPoints).toHaveBeenCalledWith(playerStats);

      expect(result.current.pendingMetamagic).not.toBeNull();
      expect(result.current.pendingMetamagic.spell).toBe(spell);
      expect(result.current.pendingMetamagic.spellName).toBe(spell.name);
      expect(result.current.pendingMetamagic.spellLevel).toBe(spell.level);
      expect(result.current.pendingMetamagic.castingTime).toBe(spell.casting_time);
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('handles sorcerer with spell missing level (defaults to 0)', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell({ level: undefined });
      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(result.current.pendingMetamagic.spellLevel).toBe(0);
    });
  });

  // ── handleConfirm ──────────────────────────────────────────────────────

  describe('handleConfirm', () => {
    it('does nothing when called with no pending metamagic', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleConfirm({ totalCost: 0, options: [] });
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('does nothing when called with null result and no pending', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleConfirm(null);
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('does nothing when called with undefined result and no pending', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleConfirm(undefined);
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('spends sorcery points when totalCost > 0', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({ totalCost: 3, options: ['Empowered Spell'] });
      });

      const metamagicMod = await import('./useMetamagic.js');
      expect(metamagicMod.spendSorceryPoints).toHaveBeenCalledWith(
        playerStats.name, 3, 'TestCampaign', expect.any(Number)
      );
    });

    it('does not spend sorcery points when totalCost is 0', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({ totalCost: 0, options: [] });
      });

      const metamagicMod = await import('./useMetamagic.js');
      expect(metamagicMod.spendSorceryPoints).not.toHaveBeenCalled();
    });

    it('does not spend sorcery points when totalCost is missing', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({ options: [] });
      });

      const metamagicMod = await import('./useMetamagic.js');
      expect(metamagicMod.spendSorceryPoints).not.toHaveBeenCalled();
    });

    it('logs the spell entry with metamagic details', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({ totalCost: 3, options: ['Empowered Spell'] });
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: playerStats.name,
        spellName: spell.name,
        spellLevel: spell.level,
        castingTime: spell.casting_time,
        metamagic: ['Empowered Spell'],
        spCost: 3,
        timestamp: expect.any(Number),
      });
    });

    it('clears pendingMetamagic after confirm', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(result.current.pendingMetamagic).not.toBeNull();

      act(() => {
        result.current.handleConfirm({ totalCost: 3, options: ['Empowered Spell'] });
      });

      expect(result.current.pendingMetamagic).toBeNull();
    });

    it('calls onExecute with the spell and empty metaCtx when no options', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({ totalCost: 0, options: [] });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {});
    });

    it('calls onExecute with the spell and empty metaCtx when options is missing', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({ totalCost: 0 });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {});
    });

    it('sets metamagicHeighten when Heightened Spell is in options', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({
          totalCost: 1,
          options: ['Heightened Spell'],
        });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {
        metamagicHeighten: true,
      });
    });

    it('sets metamagicCareful when Careful Spell is in options', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({
          totalCost: 1,
          options: ['Careful Spell'],
        });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {
        metamagicCareful: true,
      });
    });

    it('sets metamagicTwinTarget when Twinned Spell is in options and twinTarget provided', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({
          totalCost: 1,
          options: ['Twinned Spell'],
          twinTarget: 'Goblin A',
        });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {
        metamagicTwinTarget: 'Goblin A',
      });
    });

    it('does NOT set metamagicTwinTarget when Twinned Spell is in options but no twinTarget', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({
          totalCost: 1,
          options: ['Twinned Spell'],
        });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {});
    });

    it('sets metamagicDistant when Distant Spell is in options', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({
          totalCost: 1,
          options: ['Distant Spell'],
        });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {
        metamagicDistant: true,
      });
    });

    it('combines multiple recognized metamagics in metaCtx', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({
          totalCost: 3,
          options: ['Heightened Spell', 'Careful Spell', 'Distant Spell'],
        });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {
        metamagicHeighten: true,
        metamagicCareful: true,
        metamagicDistant: true,
      });
    });

    it('ignores unrecognized metamagic options in metaCtx', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({
          totalCost: 1,
          options: ['Empowered Spell', 'Quickened Spell'],
        });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {});
    });

    it('handles confirm with totalCost of negative number (does not spend)', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({ totalCost: -1, options: [] });
      });

      const metamagicMod = await import('./useMetamagic.js');
      expect(metamagicMod.spendSorceryPoints).not.toHaveBeenCalled();
    });
  });

  // ── handleSkip ─────────────────────────────────────────────────────────

  describe('handleSkip', () => {
    it('does nothing when called with no pending metamagic', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('logs a spell entry with empty metamagic and calls onExecute', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: playerStats.name,
        spellName: spell.name,
        spellLevel: spell.level,
        castingTime: spell.casting_time,
        metamagic: [],
        spCost: 0,
        timestamp: expect.any(Number),
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {});
    });

    it('clears pendingMetamagic after skip', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(result.current.pendingMetamagic).not.toBeNull();

      act(() => {
        result.current.handleSkip();
      });

      expect(result.current.pendingMetamagic).toBeNull();
    });

    it('handles skip with spell missing level (defaults to 0)', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell({ level: undefined });
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: playerStats.name,
        spellName: spell.name,
        spellLevel: 0,
        castingTime: spell.casting_time,
        metamagic: [],
        spCost: 0,
        timestamp: expect.any(Number),
      });
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty campaignName', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, '', onExecute)
      );

      expect(result.current.pendingMetamagic).toBeNull();
    });

    it('handles null campaignName', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, null, onExecute)
      );

      expect(result.current.pendingMetamagic).toBeNull();
    });

    it('handles null onExecute', () => {
      const playerStats = makePlayerStats();
      expect(() => {
        renderHook(() =>
          useSpellMetamagicFlow(playerStats, 'TestCampaign', null)
        );
      }).not.toThrow();
    });

    it('handles playerStats with missing name', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats({ name: undefined });
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      expect(result.current.pendingMetamagic).toBeNull();
    });
  });
});
