// @improved-by-ai
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

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(),
}));

vi.mock('../../services/automation/index.js', () => ({
  applyAidEffect: vi.fn().mockResolvedValue(undefined),
  applyHeroesFeastEffect: vi.fn().mockResolvedValue(undefined),
  applyLesserRestorationEffect: vi.fn().mockResolvedValue(undefined),
  applyMageArmorEffect: vi.fn().mockResolvedValue(undefined),
  applyProtectionFromEnergyHandler: vi.fn().mockResolvedValue(undefined),
  applyResistanceEffect: vi.fn().mockResolvedValue(undefined),
  applyShieldOfFaithEffect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn().mockResolvedValue(undefined),
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
    it('returns all expected state variables and handlers', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      const expectedProps = [
        'pendingMetamagic',
        'pendingMultiTarget',
        'pendingAid',
        'pendingHeroesFeast',
        'pendingGreaterRestoration',
        'pendingLesserRestoration',
        'pendingMageArmor',
        'pendingShieldOfFaith',
        'pendingProtectionFromEnergy',
        'pendingResistance',
        'pendingRemoveCurse',
        'pendingMagicMissile',
        'gateMetamagic',
        'handleConfirm',
        'handleSkip',
        'handleMultiTargetConfirm',
        'handleMultiTargetSkip',
        'handleAidConfirm',
        'handleAidSkip',
        'handleHeroesFeastConfirm',
        'handleHeroesFeastSkip',
        'handleGreaterRestorationConfirm',
        'handleGreaterRestorationSkip',
        'handleLesserRestorationConfirm',
        'handleLesserRestorationSkip',
        'handleMageArmorConfirm',
        'handleMageArmorSkip',
        'handleShieldOfFaithConfirm',
        'handleShieldOfFaithSkip',
        'handleProtectionFromEnergyConfirm',
        'handleProtectionFromEnergySkip',
        'handleResistanceConfirm',
        'handleResistanceSkip',
        'handleRemoveCurseConfirm',
        'handleRemoveCurseSkip',
        'handleMagicMissileConfirm',
        'handleMagicMissileSkip',
      ];

      for (const prop of expectedProps) {
        expect(result.current).toHaveProperty(prop);
      }

      const handlerProps = expectedProps.filter(p => typeof result.current[p] === 'function');
      for (const prop of handlerProps) {
        expect(typeof result.current[prop]).toBe('function');
      }
    });

    it('initializes all pending state to null', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      expect(result.current.pendingMetamagic).toBeNull();
      expect(result.current.pendingMultiTarget).toBeNull();
      expect(result.current.pendingAid).toBeNull();
      expect(result.current.pendingHeroesFeast).toBeNull();
      expect(result.current.pendingGreaterRestoration).toBeNull();
      expect(result.current.pendingLesserRestoration).toBeNull();
      expect(result.current.pendingMageArmor).toBeNull();
      expect(result.current.pendingShieldOfFaith).toBeNull();
      expect(result.current.pendingProtectionFromEnergy).toBeNull();
      expect(result.current.pendingResistance).toBeNull();
      expect(result.current.pendingRemoveCurse).toBeNull();
      expect(result.current.pendingMagicMissile).toBeNull();
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

    it('defaults spell level to 0 when undefined for non-sorcerer', async () => {
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
      const call = logService.addEntry.mock.calls[0][1];
      expect(call.spellLevel).toBe(0);
      expect(onExecute).toHaveBeenCalledWith(spell, {});
    });

    it('handles null class as non-sorcerer', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats({ class: null });
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {});
      expect(result.current.pendingMetamagic).toBeNull();
    });

    it('throws on null playerStats', () => {
      const onExecute = vi.fn();
      expect(() => {
        renderHook(() =>
          useSpellMetamagicFlow(null, 'TestCampaign', onExecute)
        );
      }).toThrow();
    });

    it('passes metaCtx through to onExecute for non-sorcerer', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats({ class: { name: 'Wizard' } });
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      const metaCtx = { someFlag: true };
      act(() => {
        result.current.gateMetamagic(spell, metaCtx);
      });

      expect(onExecute).toHaveBeenCalledWith(spell, metaCtx);
    });
  });

  // ── gateMetamagic — sorcerer path ──────────────────────────────────────

  describe('gateMetamagic — sorcerer', () => {
    it('sets pendingMetamagic with spell details', () => {
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
      expect(result.current.pendingMetamagic.spell).toBe(spell);
      expect(result.current.pendingMetamagic.spellName).toBe(spell.name);
      expect(result.current.pendingMetamagic.spellLevel).toBe(spell.level);
      expect(result.current.pendingMetamagic.castingTime).toBe(spell.casting_time);
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('defaults spell level to 0 when undefined for sorcerer', () => {
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

    it('marks isPsionic based on isPsionicSpell and hasPsionicSorcery', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const rulesMod = await import('../../services/rules/spells/metamagicRules.js');
      rulesMod.isPsionicSpell.mockReturnValue(true);
      rulesMod.hasPsionicSorcery.mockReturnValue(true);

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(result.current.pendingMetamagic.isPsionic).toBe(true);
      expect(result.current.pendingMetamagic.psionicCost).toBe(3);
    });

    it('sets isPsionic to false when isPsionicSpell returns false', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const rulesMod = await import('../../services/rules/spells/metamagicRules.js');
      rulesMod.isPsionicSpell.mockReturnValue(false);
      rulesMod.hasPsionicSorcery.mockReturnValue(true);

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(result.current.pendingMetamagic.isPsionic).toBe(false);
      expect(result.current.pendingMetamagic.psionicCost).toBe(0);
    });

    it('stores _metaCtx from gateMetamagic argument', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      const metaCtx = { preExisting: true };
      act(() => {
        result.current.gateMetamagic(spell, metaCtx);
      });

      expect(result.current.pendingMetamagic._metaCtx).toEqual(metaCtx);
    });

    it('calls sorcery point hooks with correct arguments', async () => {
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
      expect(metamagicMod.getCurrentSorceryPoints).toHaveBeenCalledWith(playerStats.name, 10);
      expect(metamagicMod.getMaxSorceryPoints).toHaveBeenCalledWith(playerStats);
    });
  });

  // ── gateMetamagic — special spell routing ──────────────────────────────

  describe('gateMetamagic — special spell routing', () => {
    it('sets pendingLesserRestoration when creature targets exist', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Ally 1' }, { name: 'Ally 2' }],
      });

      act(() => {
        result.current.gateMetamagic({ name: 'Lesser Restoration', level: 2, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingLesserRestoration).not.toBeNull();
      expect(result.current.pendingLesserRestoration.creatureTargets).toEqual(['Ally 1', 'Ally 2']);
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('bypasses pending state when no creature targets for lesser restoration', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [] });

      act(() => {
        result.current.gateMetamagic({ name: 'Lesser Restoration', level: 2, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingLesserRestoration).toBeNull();
    });

    it('sets pendingGreaterRestoration when creature targets exist', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Ally 1' }],
      });

      act(() => {
        result.current.gateMetamagic({ name: 'Greater Restoration', level: 5, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingGreaterRestoration).not.toBeNull();
      expect(result.current.pendingGreaterRestoration.creatureTargets).toEqual(['Ally 1']);
    });

    it('sets pendingRemoveCurse when creature targets exist', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Ally 1' }],
      });

      act(() => {
        result.current.gateMetamagic({ name: 'Remove Curse', level: 3, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingRemoveCurse).not.toBeNull();
    });

    it('sets pendingAid when creature targets exist', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Ally 1' }],
      });

      act(() => {
        result.current.gateMetamagic({ name: 'Aid', level: 2, casting_time: '1 Action', range: '30 feet' });
      });

      expect(result.current.pendingAid).not.toBeNull();
      expect(result.current.pendingAid.maxTargets).toBe(3);
    });

    it('sets pendingHeroesFeast when creature targets exist', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Ally 1' }],
      });

      act(() => {
        result.current.gateMetamagic({ name: "Heroes' Feast", level: 6, casting_time: '8 Hours', range: '30 feet' });
      });

      expect(result.current.pendingHeroesFeast).not.toBeNull();
      expect(result.current.pendingHeroesFeast.maxTargets).toBe(12);
    });

    it('sets pendingMageArmor when creature targets exist', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Ally 1' }],
      });

      act(() => {
        result.current.gateMetamagic({ name: 'Mage Armor', level: 1, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingMageArmor).not.toBeNull();
    });

    it('sets pendingProtectionFromEnergy when creature targets exist', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Ally 1' }],
      });

      act(() => {
        result.current.gateMetamagic({ name: 'Protection from Energy', level: 3, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingProtectionFromEnergy).not.toBeNull();
    });

    it('sets pendingResistance when creature targets exist', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Ally 1' }],
      });

      act(() => {
        result.current.gateMetamagic({ name: 'Resistance', level: 0, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingResistance).not.toBeNull();
    });

    it('sets pendingMagicMissile when creature targets exist', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Enemy 1' }],
      });

      act(() => {
        result.current.gateMetamagic({ name: 'Magic Missile', level: 1, casting_time: '1 Action', range: '120 ft.' });
      });

      expect(result.current.pendingMagicMissile).not.toBeNull();
      expect(result.current.pendingMagicMissile.totalMissiles).toBe(3);
    });

    it('calculates magic missile count based on slot level', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Enemy 1' }],
      });

      act(() => {
        result.current.gateMetamagic({ name: 'Magic Missile', level: 3, casting_time: '1 Action', range: '120 ft.' });
      });

      expect(result.current.pendingMagicMissile.totalMissiles).toBe(5);
    });

    it('routes to multi-target flow when getMultiTargetSpreadForSpell returns a value', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const riderMod = await import('../../services/rules/spells/postCastRiderService.js');
      riderMod.getMultiTargetSpreadForSpell.mockReturnValue({ range: '10 ft' });

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Target 1' }],
      });

      act(() => {
        result.current.gateMetamagic(makeSpell());
      });

      expect(result.current.pendingMultiTarget).not.toBeNull();
      expect(result.current.pendingMultiTarget.range).toBe('10 ft');
    });

    it('falls through to sorcerer path when no special spell matches and no multi-target', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const riderMod = await import('../../services/rules/spells/postCastRiderService.js');
      riderMod.getMultiTargetSpreadForSpell.mockReturnValue(null);

      act(() => {
        result.current.gateMetamagic(makeSpell());
      });

      expect(result.current.pendingMetamagic).not.toBeNull();
    });
  });

  // ── handleConfirm ──────────────────────────────────────────────────────

  describe('handleConfirm', () => {
    it('does nothing when no pending metamagic', async () => {
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

    it('does nothing when result is null', async () => {
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

    it('does nothing when result is undefined', async () => {
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

    it('clears pendingMetamagic after confirm even when result is null', () => {
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
        result.current.handleConfirm(null);
      });

      expect(result.current.pendingMetamagic).toBeNull();
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
        playerStats.name, 3, 'TestCampaign', 10
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

    it('does not spend sorcery points when totalCost is negative', async () => {
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

    it('calls onExecute with the spell and empty metaCtx when no options', async () => {
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

    it('calls onExecute with the spell and empty metaCtx when options is missing', async () => {
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

    it('sets metamagicHeighten when Heightened Spell is in options', async () => {
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

    it('sets metamagicCareful when Careful Spell is in options', async () => {
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

    it('sets metamagicTwinTarget when Twinned Spell is in options with twinTarget', async () => {
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

    it('does NOT set metamagicTwinTarget when Twinned Spell has no twinTarget', async () => {
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

    it('sets metamagicDistant when Distant Spell is in options', async () => {
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

    it('combines multiple recognized metamagics in metaCtx', async () => {
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

    it('ignores unrecognized metamagic options in metaCtx', async () => {
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

    it('adds psionic cost when isPsionic is true and Subtle Spell is not selected', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const rulesMod = await import('../../services/rules/spells/metamagicRules.js');
      rulesMod.isPsionicSpell.mockReturnValue(true);
      rulesMod.hasPsionicSorcery.mockReturnValue(true);

      const spell = makeSpell({ level: 2 });
      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(result.current.pendingMetamagic.isPsionic).toBe(true);
      expect(result.current.pendingMetamagic.psionicCost).toBe(2);

      act(() => {
        result.current.handleConfirm({ totalCost: 1, options: ['Empowered Spell'] });
      });

      const metamagicMod = await import('./useMetamagic.js');
      expect(metamagicMod.spendSorceryPoints).toHaveBeenCalledWith(
        playerStats.name, 3, 'TestCampaign', 10
      );

      const logService = await import('../../services/ui/logService.js');
      const logCall = logService.addEntry.mock.calls[0][1];
      expect(logCall.metamagic).toContain('Psionic Sorcery');
      expect(logCall.spCost).toBe(3);
    });

    it('does NOT add psionic cost when Subtle Spell is selected', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const rulesMod = await import('../../services/rules/spells/metamagicRules.js');
      rulesMod.isPsionicSpell.mockReturnValue(true);
      rulesMod.hasPsionicSorcery.mockReturnValue(true);

      const spell = makeSpell({ level: 2 });
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({ totalCost: 1, options: ['Subtle Spell'] });
      });

      const metamagicMod = await import('./useMetamagic.js');
      expect(metamagicMod.spendSorceryPoints).toHaveBeenCalledWith(
        playerStats.name, 1, 'TestCampaign', 10
      );
    });

    it('sets psionicSpell in metaCtx when psionic cost is applied', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const rulesMod = await import('../../services/rules/spells/metamagicRules.js');
      rulesMod.isPsionicSpell.mockReturnValue(true);
      rulesMod.hasPsionicSorcery.mockReturnValue(true);

      const spell = makeSpell({ level: 2 });
      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleConfirm({ totalCost: 0, options: [] });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {
        psionicSpell: true,
      });
    });

    it('preserves _metaCtx from gateMetamagic in the final metaCtx', async () => {
      const rulesMod = await import('../../services/rules/spells/metamagicRules.js');
      rulesMod.isPsionicSpell.mockReturnValue(false);
      rulesMod.hasPsionicSorcery.mockReturnValue(false);

      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell, { preExisting: true });
      });

      act(() => {
        result.current.handleConfirm({ totalCost: 0, options: [] });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {
        preExisting: true,
      });
    });

    it('merges _metaCtx with metamagic flags from options', async () => {
      const rulesMod = await import('../../services/rules/spells/metamagicRules.js');
      rulesMod.isPsionicSpell.mockReturnValue(false);
      rulesMod.hasPsionicSorcery.mockReturnValue(false);

      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell, { preExisting: true });
      });

      act(() => {
        result.current.handleConfirm({
          totalCost: 1,
          options: ['Heightened Spell'],
        });
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {
        preExisting: true,
        metamagicHeighten: true,
      });
    });
  });

  // ── handleSkip ─────────────────────────────────────────────────────────

  describe('handleSkip', () => {
    it('does nothing when no pending metamagic', async () => {
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

    it('defaults spell level to 0 when undefined', async () => {
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
      const call = logService.addEntry.mock.calls[0][1];
      expect(call.spellLevel).toBe(0);
    });
  });

  // ── handleMultiTargetConfirm / handleMultiTargetSkip ───────────────────

  describe('handleMultiTargetConfirm', () => {
    it('does nothing when no pending multi-target', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleMultiTargetConfirm({});
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('logs with Words of Creation metamagic and calls onExecute with secondTarget', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Target 1' }] });
      const riderMod = await import('../../services/rules/spells/postCastRiderService.js');
      riderMod.getMultiTargetSpreadForSpell.mockReturnValue({ range: '10 ft' });

      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleMultiTargetConfirm({ secondTarget: 'Target 1' });
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: playerStats.name,
        spellName: spell.name,
        spellLevel: spell.level,
        castingTime: spell.casting_time,
        metamagic: ['Words of Creation'],
        spCost: 0,
        timestamp: expect.any(Number),
      });

      expect(onExecute).toHaveBeenCalledWith(spell, { multiTarget: 'Target 1' });
    });

    it('calls onExecute with empty metaCtx when no secondTarget', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Target 1' }] });
      const riderMod = await import('../../services/rules/spells/postCastRiderService.js');
      riderMod.getMultiTargetSpreadForSpell.mockReturnValue({ range: '10 ft' });

      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleMultiTargetConfirm({});
      });

      expect(onExecute).toHaveBeenCalledWith(spell, {});
    });

    it('clears pendingMultiTarget after confirm', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Target 1' }] });
      const riderMod = await import('../../services/rules/spells/postCastRiderService.js');
      riderMod.getMultiTargetSpreadForSpell.mockReturnValue({ range: '10 ft' });

      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(result.current.pendingMultiTarget).not.toBeNull();

      act(() => {
        result.current.handleMultiTargetConfirm({ secondTarget: 'Target 1' });
      });

      expect(result.current.pendingMultiTarget).toBeNull();
    });
  });

  describe('handleMultiTargetSkip', () => {
    it('does nothing when no pending multi-target', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleMultiTargetSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('logs with empty metamagic and calls onExecute', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Target 1' }] });
      const riderMod = await import('../../services/rules/spells/postCastRiderService.js');
      riderMod.getMultiTargetSpreadForSpell.mockReturnValue({ range: '10 ft' });

      act(() => {
        result.current.gateMetamagic(spell);
      });

      act(() => {
        result.current.handleMultiTargetSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      const call = logService.addEntry.mock.calls[0][1];
      expect(call.metamagic).toEqual([]);
      expect(call.spCost).toBe(0);
      expect(onExecute).toHaveBeenCalledWith(spell, {});
    });

    it('clears pendingMultiTarget after skip', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Target 1' }] });
      const riderMod = await import('../../services/rules/spells/postCastRiderService.js');
      riderMod.getMultiTargetSpreadForSpell.mockReturnValue({ range: '10 ft' });

      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(result.current.pendingMultiTarget).not.toBeNull();

      act(() => {
        result.current.handleMultiTargetSkip();
      });

      expect(result.current.pendingMultiTarget).toBeNull();
    });
  });

  // ── handleAidConfirm / handleAidSkip ───────────────────────────────────

  describe('handleAidConfirm', () => {
    it('does nothing when no pending aid', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      await act(async () => {
        await result.current.handleAidConfirm({});
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and applies aid effect', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Aid', level: 2, casting_time: '1 Action', range: '30 feet' });
      });

      const automationMod = await import('../../services/automation/index.js');

      await act(async () => {
        await result.current.handleAidConfirm({ targetNames: ['Ally 1'] });
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalled();
      expect(automationMod.applyAidEffect).toHaveBeenCalled();
    });

    it('clears pendingAid after confirm', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Aid', level: 2, casting_time: '1 Action', range: '30 feet' });
      });

      expect(result.current.pendingAid).not.toBeNull();

      await act(async () => {
        await result.current.handleAidConfirm({ targetNames: ['Ally 1'] });
      });

      expect(result.current.pendingAid).toBeNull();
    });
  });

  describe('handleAidSkip', () => {
    it('does nothing when no pending aid', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleAidSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('logs and clears pendingAid', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Aid', level: 2, casting_time: '1 Action', range: '30 feet' });
      });

      act(() => {
        result.current.handleAidSkip();
      });

      expect(result.current.pendingAid).toBeNull();
    });
  });

  // ── handleHeroesFeastConfirm / handleHeroesFeastSkip ───────────────────

  describe('handleHeroesFeastConfirm', () => {
    it('does nothing when no pending heroes feast', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      await act(async () => {
        await result.current.handleHeroesFeastConfirm({});
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and applies heroes feast effect', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: "Heroes' Feast", level: 6, casting_time: '8 Hours', range: '30 feet' });
      });

      const automationMod = await import('../../services/automation/index.js');

      await act(async () => {
        await result.current.handleHeroesFeastConfirm({ targetNames: ['Ally 1'] });
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalled();
      expect(automationMod.applyHeroesFeastEffect).toHaveBeenCalled();
    });

    it('clears pendingHeroesFeast after confirm', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: "Heroes' Feast", level: 6, casting_time: '8 Hours', range: '30 feet' });
      });

      expect(result.current.pendingHeroesFeast).not.toBeNull();

      await act(async () => {
        await result.current.handleHeroesFeastConfirm({ targetNames: ['Ally 1'] });
      });

      expect(result.current.pendingHeroesFeast).toBeNull();
    });
  });

  describe('handleHeroesFeastSkip', () => {
    it('does nothing when no pending heroes feast', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleHeroesFeastSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and clears pendingHeroesFeast', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: "Heroes' Feast", level: 6, casting_time: '8 Hours', range: '30 feet' });
      });

      act(() => {
        result.current.handleHeroesFeastSkip();
      });

      expect(result.current.pendingHeroesFeast).toBeNull();
    });
  });

  // ── handleGreaterRestorationConfirm / handleGreaterRestorationSkip ─────

  describe('handleGreaterRestorationConfirm', () => {
    it('does nothing when no pending greater restoration', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      await act(async () => {
        await result.current.handleGreaterRestorationConfirm({});
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and calls greater restoration service', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Greater Restoration', level: 5, casting_time: '1 Action', range: 'Touch' });
      });

      await act(async () => {
        await result.current.handleGreaterRestorationConfirm({ targetName: 'Ally 1' });
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalled();
    });

    it('clears pendingGreaterRestoration after confirm', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Greater Restoration', level: 5, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingGreaterRestoration).not.toBeNull();

      await act(async () => {
        await result.current.handleGreaterRestorationConfirm({ targetName: 'Ally 1' });
      });

      expect(result.current.pendingGreaterRestoration).toBeNull();
    });
  });

  describe('handleGreaterRestorationSkip', () => {
    it('does nothing when no pending greater restoration', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleGreaterRestorationSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and clears pending state', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Greater Restoration', level: 5, casting_time: '1 Action', range: 'Touch' });
      });

      act(() => {
        result.current.handleGreaterRestorationSkip();
      });

      expect(result.current.pendingGreaterRestoration).toBeNull();
    });
  });

  // ── handleLesserRestorationConfirm / handleLesserRestorationSkip ───────

  describe('handleLesserRestorationConfirm', () => {
    it('does nothing when no pending lesser restoration', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      await act(async () => {
        await result.current.handleLesserRestorationConfirm({});
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and applies lesser restoration effect', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Lesser Restoration', level: 2, casting_time: '1 Action', range: 'Touch' });
      });

      const automationMod = await import('../../services/automation/index.js');

      await act(async () => {
        await result.current.handleLesserRestorationConfirm({ targetName: 'Ally 1' });
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalled();
      expect(automationMod.applyLesserRestorationEffect).toHaveBeenCalled();
    });

    it('clears pendingLesserRestoration after confirm', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Lesser Restoration', level: 2, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingLesserRestoration).not.toBeNull();

      await act(async () => {
        await result.current.handleLesserRestorationConfirm({ targetName: 'Ally 1' });
      });

      expect(result.current.pendingLesserRestoration).toBeNull();
    });
  });

  describe('handleLesserRestorationSkip', () => {
    it('does nothing when no pending lesser restoration', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleLesserRestorationSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and clears pending state', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Lesser Restoration', level: 2, casting_time: '1 Action', range: 'Touch' });
      });

      act(() => {
        result.current.handleLesserRestorationSkip();
      });

      expect(result.current.pendingLesserRestoration).toBeNull();
    });
  });

  // ── handleRemoveCurseConfirm / handleRemoveCurseSkip ───────────────────

  describe('handleRemoveCurseConfirm', () => {
    it('does nothing when no pending remove curse', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      await act(async () => {
        await result.current.handleRemoveCurseConfirm({});
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and calls remove curse service', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Remove Curse', level: 3, casting_time: '1 Action', range: 'Touch' });
      });

      await act(async () => {
        await result.current.handleRemoveCurseConfirm({ targetName: 'Ally 1' });
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalled();
    });

    it('clears pendingRemoveCurse after confirm', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Remove Curse', level: 3, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingRemoveCurse).not.toBeNull();

      await act(async () => {
        await result.current.handleRemoveCurseConfirm({ targetName: 'Ally 1' });
      });

      expect(result.current.pendingRemoveCurse).toBeNull();
    });
  });

  describe('handleRemoveCurseSkip', () => {
    it('does nothing when no pending remove curse', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleRemoveCurseSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and clears pending state', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Remove Curse', level: 3, casting_time: '1 Action', range: 'Touch' });
      });

      act(() => {
        result.current.handleRemoveCurseSkip();
      });

      expect(result.current.pendingRemoveCurse).toBeNull();
    });
  });

  // ── handleMageArmorConfirm / handleMageArmorSkip ──────────────────────

  describe('handleMageArmorConfirm', () => {
    it('does nothing when no pending mage armor', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      await act(async () => {
        await result.current.handleMageArmorConfirm({});
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and applies mage armor effect', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Mage Armor', level: 1, casting_time: '1 Action', range: 'Touch' });
      });

      const automationMod = await import('../../services/automation/index.js');

      await act(async () => {
        await result.current.handleMageArmorConfirm({ targetName: 'Ally 1' });
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalled();
      expect(automationMod.applyMageArmorEffect).toHaveBeenCalled();
    });

    it('clears pendingMageArmor after confirm', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Mage Armor', level: 1, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingMageArmor).not.toBeNull();

      await act(async () => {
        await result.current.handleMageArmorConfirm({ targetName: 'Ally 1' });
      });

      expect(result.current.pendingMageArmor).toBeNull();
    });
  });

  describe('handleMageArmorSkip', () => {
    it('does nothing when no pending mage armor', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleMageArmorSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and clears pending state', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Mage Armor', level: 1, casting_time: '1 Action', range: 'Touch' });
      });

      act(() => {
        result.current.handleMageArmorSkip();
      });

      expect(result.current.pendingMageArmor).toBeNull();
    });
  });

  // ── handleProtectionFromEnergyConfirm / handleProtectionFromEnergySkip ─

  describe('handleProtectionFromEnergyConfirm', () => {
    it('does nothing when no pending protection from energy', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      await act(async () => {
        await result.current.handleProtectionFromEnergyConfirm({});
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and applies protection from energy effect', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Protection from Energy', level: 3, casting_time: '1 Action', range: 'Touch' });
      });

      const automationMod = await import('../../services/automation/index.js');

      await act(async () => {
        await result.current.handleProtectionFromEnergyConfirm({ targetName: 'Ally 1', damageType: 'Fire' });
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalled();
      expect(automationMod.applyProtectionFromEnergyHandler).toHaveBeenCalled();
    });

    it('clears pendingProtectionFromEnergy after confirm', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Protection from Energy', level: 3, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingProtectionFromEnergy).not.toBeNull();

      await act(async () => {
        await result.current.handleProtectionFromEnergyConfirm({ targetName: 'Ally 1', damageType: 'Fire' });
      });

      expect(result.current.pendingProtectionFromEnergy).toBeNull();
    });
  });

  describe('handleProtectionFromEnergySkip', () => {
    it('does nothing when no pending protection from energy', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleProtectionFromEnergySkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and clears pending state', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Protection from Energy', level: 3, casting_time: '1 Action', range: 'Touch' });
      });

      act(() => {
        result.current.handleProtectionFromEnergySkip();
      });

      expect(result.current.pendingProtectionFromEnergy).toBeNull();
    });
  });

  // ── handleResistanceConfirm / handleResistanceSkip ─────────────────────

  describe('handleResistanceConfirm', () => {
    it('does nothing when no pending resistance', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      await act(async () => {
        await result.current.handleResistanceConfirm({});
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and applies resistance effect', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Resistance', level: 0, casting_time: '1 Action', range: 'Touch' });
      });

      const automationMod = await import('../../services/automation/index.js');

      await act(async () => {
        await result.current.handleResistanceConfirm({ targetName: 'Ally 1', damageType: 'Fire' });
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).toHaveBeenCalled();
      expect(automationMod.applyResistanceEffect).toHaveBeenCalled();
    });

    it('clears pendingResistance after confirm', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Resistance', level: 0, casting_time: '1 Action', range: 'Touch' });
      });

      expect(result.current.pendingResistance).not.toBeNull();

      await act(async () => {
        await result.current.handleResistanceConfirm({ targetName: 'Ally 1', damageType: 'Fire' });
      });

      expect(result.current.pendingResistance).toBeNull();
    });
  });

  describe('handleResistanceSkip', () => {
    it('does nothing when no pending resistance', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleResistanceSkip();
      });

      const logService = await import('../../services/ui/logService.js');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('logs and clears pending state', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Resistance', level: 0, casting_time: '1 Action', range: 'Touch' });
      });

      act(() => {
        result.current.handleResistanceSkip();
      });

      expect(result.current.pendingResistance).toBeNull();
    });
  });

  // ── handleMagicMissileConfirm / handleMagicMissileSkip ─────────────────

  describe('handleMagicMissileConfirm', () => {
    it('does nothing when no pending magic missile', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleMagicMissileConfirm({ distribution: {} });
      });

      expect(onExecute).not.toHaveBeenCalled();
    });

    it('does nothing when all distribution values are zero', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Enemy 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Magic Missile', level: 1, casting_time: '1 Action', range: '120 ft.' });
      });

      act(() => {
        result.current.handleMagicMissileConfirm({ distribution: { 'Enemy 1': 0 } });
      });

      expect(onExecute).not.toHaveBeenCalled();
    });

    it('calls onExecute with magic missile distribution', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Enemy 1' }, { name: 'Enemy 2' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Magic Missile', level: 2, casting_time: '1 Action', range: '120 ft.' });
      });

      const distribution = { 'Enemy 1': 2, 'Enemy 2': 3 };
      act(() => {
        result.current.handleMagicMissileConfirm({ distribution });
      });

      expect(onExecute).toHaveBeenCalledWith({ name: 'Magic Missile', level: 2, casting_time: '1 Action', range: '120 ft.' }, {
        magicMissileDistribution: distribution,
        slotLevel: 2,
      });
    });

    it('clears pendingMagicMissile after confirm', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Enemy 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Magic Missile', level: 1, casting_time: '1 Action', range: '120 ft.' });
      });

      expect(result.current.pendingMagicMissile).not.toBeNull();

      act(() => {
        result.current.handleMagicMissileConfirm({ distribution: { 'Enemy 1': 1 } });
      });

      expect(result.current.pendingMagicMissile).toBeNull();
    });
  });

  describe('handleMagicMissileSkip', () => {
    it('does nothing when no pending magic missile', () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.handleMagicMissileSkip();
      });

      expect(onExecute).not.toHaveBeenCalled();
    });

    it('clears pendingMagicMissile after skip', async () => {
      const onExecute = vi.fn();
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Enemy 1' }] });

      act(() => {
        result.current.gateMetamagic({ name: 'Magic Missile', level: 1, casting_time: '1 Action', range: '120 ft.' });
      });

      expect(result.current.pendingMagicMissile).not.toBeNull();

      act(() => {
        result.current.handleMagicMissileSkip();
      });

      expect(result.current.pendingMagicMissile).toBeNull();
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

    it('handles null onExecute gracefully', () => {
      const playerStats = makePlayerStats();
      expect(() => {
        renderHook(() =>
          useSpellMetamagicFlow(playerStats, 'TestCampaign', null)
        );
      }).not.toThrow();
    });

    it('handles playerStats with missing name in gateMetamagic', async () => {
      const rulesMod = await import('../../services/rules/spells/metamagicRules.js');
      rulesMod.isPsionicSpell.mockReturnValue(false);
      rulesMod.hasPsionicSorcery.mockReturnValue(false);
      const riderMod = await import('../../services/rules/spells/postCastRiderService.js');
      riderMod.getMultiTargetSpreadForSpell.mockReturnValue(null);
      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue(null);

      const onExecute = vi.fn();
      const playerStats = makePlayerStats({ name: undefined });
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      try {
        act(() => {
          result.current.gateMetamagic(spell);
        });
      } catch (e) {
        console.error('GATE_METAMAGIC_ERROR:', e.message, e.stack);
        throw e;
      }

      expect(result.current.pendingMetamagic).not.toBeNull();
      expect(result.current.pendingMetamagic.spellName).toBe('Fireball');
    });

    it('handles playerStats with missing class name as non-sorcerer', async () => {
      const rulesMod = await import('../../services/rules/spells/metamagicRules.js');
      rulesMod.isPsionicSpell.mockReturnValue(false);
      rulesMod.hasPsionicSorcery.mockReturnValue(false);
      const riderMod = await import('../../services/rules/spells/postCastRiderService.js');
      riderMod.getMultiTargetSpreadForSpell.mockReturnValue(null);
      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue(null);

      const onExecute = vi.fn();
      const playerStats = makePlayerStats({ class: { name: undefined } });
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      try {
        act(() => {
          result.current.gateMetamagic(spell);
        });
      } catch (e) {
        console.error('GATE_METAMAGIC_ERROR:', e.message, e.stack);
        throw e;
      }

      expect(onExecute).toHaveBeenCalledWith(spell, {});
      expect(result.current.pendingMetamagic).toBeNull();
    });

    it('handles spell with missing name field', async () => {
      const rulesMod = await import('../../services/rules/spells/metamagicRules.js');
      rulesMod.isPsionicSpell.mockReturnValue(false);
      rulesMod.hasPsionicSorcery.mockReturnValue(false);
      const riderMod = await import('../../services/rules/spells/postCastRiderService.js');
      riderMod.getMultiTargetSpreadForSpell.mockReturnValue(null);
      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue(null);

      const onExecute = vi.fn();
      const playerStats = makePlayerStats({ class: { name: 'Wizard' } });
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = { level: 1, casting_time: '1 Action', range: 'Self' };
      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(onExecute).toHaveBeenCalled();
    });

    it('handles spell with missing casting_time', async () => {
      const rulesMod = await import('../../services/rules/spells/metamagicRules.js');
      rulesMod.isPsionicSpell.mockReturnValue(false);
      rulesMod.hasPsionicSorcery.mockReturnValue(false);
      const riderMod = await import('../../services/rules/spells/postCastRiderService.js');
      riderMod.getMultiTargetSpreadForSpell.mockReturnValue(null);
      const combatMod = await import('../../services/encounters/combatData.js');
      combatMod.getCombatSummary.mockReturnValue(null);

      const onExecute = vi.fn();
      const playerStats = makePlayerStats({ class: { name: 'Wizard' } });
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(playerStats, 'TestCampaign', onExecute)
      );

      const spell = { name: 'Test', level: 1, range: 'Self' };
      act(() => {
        result.current.gateMetamagic(spell);
      });

      const logService = await import('../../services/ui/logService.js');
      const call = logService.addEntry.mock.calls[0][1];
      expect(call.castingTime).toBeUndefined();
    });
  });
});
