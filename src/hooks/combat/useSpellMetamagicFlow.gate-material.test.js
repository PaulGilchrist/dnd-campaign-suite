// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';

// ── Minimal mocks for material component blocking path ──────────────────────────
// The gateMetamagic flow checks consumed materials BEFORE any spell-specific
// handlers or automation. We only need to mock the modules that gateMetamagic
// reads during the material check phase.

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(),
  hasMaterial: vi.fn(),
  consumeMaterial: vi.fn(),
  getMaterialRequirementMessage: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — material component gating', () => {
  let materialModule;

  beforeEach(async () => {
    materialModule = await import('../../services/rules/spells/materialComponents.js');
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
    // Default: spell has no material requirement
    materialModule.getConsumedMaterial.mockReturnValue(null);
  });

  describe('when spell has no material requirement', () => {
    it('proceeds without showing a material popup for Sorcerer (sets metamagic pending)', async () => {
      const setPopupHtml = vi.fn();
      const onExecute = vi.fn();

      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute, setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      await act(async () => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });

      expect(setPopupHtml).not.toHaveBeenCalled();
      // Sorcerer path: sets metamagic pending, does not call onExecute yet
      expect(result.current.pendingMetamagic).not.toBeNull();
      expect(result.current.pendingMetamagic.spellName).toBe('Fireball');
      expect(onExecute).not.toHaveBeenCalled();
    });
  });

  describe('when spell requires a consumed material', () => {
    beforeEach(async () => {
      const { getConsumedMaterial, getMaterialRequirementMessage } = await import('../../services/rules/spells/materialComponents.js');
      materialModule = await import('../../services/rules/spells/materialComponents.js');
      getConsumedMaterial.mockImplementation((spell) => {
        if (spell.name === 'Greater Restoration') {
          return { itemName: 'Diamond Dust (100 gp)' };
        }
        return null;
      });
      getMaterialRequirementMessage.mockImplementation((spell) => {
        if (spell.name === 'Greater Restoration') {
          return 'Greater Restoration requires diamond dust worth 100+ GP, which the spell consumes.';
        }
        return null;
      });
    });

    it('shows a popup and prevents execution when caster lacks the material', async () => {
      materialModule.hasMaterial.mockReturnValue(false);
      const setPopupHtml = vi.fn();
      const onExecute = vi.fn();

      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute, setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      await act(async () => {
        result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration', level: 5 }));
      });

      expect(setPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Greater Restoration',
        automationType: 'material_required',
        description: 'Greater Restoration requires diamond dust worth 100+ GP, which the spell consumes.',
      });
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('proceeds past material check when caster possesses the material (sets metamagic pending)', async () => {
      materialModule.hasMaterial.mockReturnValue(true);
      const setPopupHtml = vi.fn();
      const onExecute = vi.fn();

      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute, setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      await act(async () => {
        result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration', level: 5 }));
      });

      expect(setPopupHtml).not.toHaveBeenCalled();
      // Sorcerer path: sets metamagic pending for metamagic application
      expect(result.current.pendingMetamagic).not.toBeNull();
      expect(result.current.pendingMetamagic.spellName).toBe('Greater Restoration');
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('does not execute when setPopupHtml is null but material is missing', async () => {
      materialModule.hasMaterial.mockReturnValue(false);
      const onExecute = vi.fn();

      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute, setSecondaryTargetModal: null, characters: [], setPopupHtml: undefined })
      );

      await act(async () => {
        result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration', level: 5 }));
      });

      expect(onExecute).not.toHaveBeenCalled();
    });

    it('blocks execution for any spell with a missing consumed material', async () => {
      materialModule.hasMaterial.mockReturnValue(false);
      materialModule.getConsumedMaterial.mockReturnValue({ itemName: 'Ruby Dust (1,500 gp)' });
      materialModule.getMaterialRequirementMessage.mockReturnValue('Forcecage requires ruby dust worth 1,500+ GP, which the spell consumes.');

      const setPopupHtml = vi.fn();
      const onExecute = vi.fn();

      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute, setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      await act(async () => {
        result.current.gateMetamagic(makeSpell({ name: 'Forcecage', level: 7 }));
      });

      expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
        type: 'automation_info',
        automationType: 'material_required',
      }));
      expect(onExecute).not.toHaveBeenCalled();
    });
  });

  describe('gate ordering', () => {
    it('checks materials before any other gating logic', async () => {
      // Even if other gates would apply (multi-target, sorcerer metamagic, etc.),
      // the material check runs first and blocks execution.
      materialModule.getConsumedMaterial.mockReturnValue({ itemName: 'Diamond Dust (100 gp)' });
      materialModule.hasMaterial.mockReturnValue(false);
      materialModule.getMaterialRequirementMessage.mockReturnValue('Need material.');

      const setPopupHtml = vi.fn();
      const onExecute = vi.fn();

      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute, setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
      );

      await act(async () => {
        result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration', level: 5 }));
      });

      // Material popup shown, execution blocked
      expect(setPopupHtml).toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
      // No pending state should be set because we returned early
      expect(result.current.pendingGreaterRestoration).toBeNull();
    });
  });
});
