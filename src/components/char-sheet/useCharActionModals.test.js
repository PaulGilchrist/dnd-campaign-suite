import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCharActionModals from './useCharActionModals.js';

vi.mock('./useDamageClick.js', () => ({
  default: vi.fn(() => ({
    handleDamageClick: vi.fn(),
    proceedWithDamage: vi.fn(),
  })),
}));

vi.mock('./useModalHandlers.js', () => ({
  default: vi.fn(() => ({
    handleMasteryClose: vi.fn(),
    handleWeaponMasteryChoice: vi.fn(),
    handleCleaveAttack: vi.fn(),
    handleCleaveSkip: vi.fn(),
    handleDivineFuryDamageType: vi.fn(),
    handleDivineFurySkip: vi.fn(),
    handleGenericDamageTypeChoice: vi.fn(),
    handleGenericDamageTypeSkip: vi.fn(),
    handleDamageTypeModifierChoice: vi.fn(),
    handleDamageTypeModifierSkip: vi.fn(),
    handleEnhancedUnarmedChoice: vi.fn(),
    handleEnhancedUnarmedSkip: vi.fn(),
    handleFeatureChoiceConfirm: vi.fn(),
    handleFeatureChoiceSkip: vi.fn(),
    handleConstellationSelect: vi.fn(),
    handleElderChampionRestore: vi.fn(),
  })),
}));

const useDamageClick = (await import('./useDamageClick.js')).default;
const useModalHandlers = (await import('./useModalHandlers.js')).default;

describe('useCharActionModals', () => {
  const baseArgs = {
    playerStats: { name: 'TestCharacter', class: { name: 'Fighter' } },
    campaignName: 'test-campaign',
    mapName: null,
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollDamage: vi.fn(),
    buildCtx: vi.fn(() => Promise.resolve({})),
    buildCtxSync: vi.fn(() => ({})),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useDamageClick.mockReturnValue({
      handleDamageClick: vi.fn(),
      proceedWithDamage: vi.fn(),
    });
    useModalHandlers.mockReturnValue({
      handleMasteryClose: vi.fn(),
      handleWeaponMasteryChoice: vi.fn(),
      handleCleaveAttack: vi.fn(),
      handleCleaveSkip: vi.fn(),
      handleDivineFuryDamageType: vi.fn(),
      handleDivineFurySkip: vi.fn(),
      handleGenericDamageTypeChoice: vi.fn(),
      handleGenericDamageTypeSkip: vi.fn(),
      handleDamageTypeModifierChoice: vi.fn(),
      handleDamageTypeModifierSkip: vi.fn(),
      handleEnhancedUnarmedChoice: vi.fn(),
      handleEnhancedUnarmedSkip: vi.fn(),
      handleFeatureChoiceConfirm: vi.fn(),
      handleFeatureChoiceSkip: vi.fn(),
      handleConstellationSelect: vi.fn(),
      handleElderChampionRestore: vi.fn(),
    });
  });

  describe('initial state', () => {
    it('returns all modal states as null', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));

      expect(result.current.healingPoolModal).toBeNull();
      expect(result.current.handOfHealingModal).toBeNull();
      expect(result.current.fontOfMagicModal).toBeNull();
      expect(result.current.resourcePoolModal).toBeNull();
      expect(result.current.wildCompanionModal).toBeNull();
      expect(result.current.setConditionModal).toBeNull();
      expect(result.current.attackRiderModal).toBeNull();
      expect(result.current.openHandTechniqueModal).toBeNull();
      expect(result.current.weaponMasteryModal).toBeNull();
      expect(result.current.weaponMasteryChoiceModal).toBeNull();
      expect(result.current.combatStanceModal).toBeNull();
      expect(result.current.teleportModal).toBeNull();
      expect(result.current.healingIllusionModal).toBeNull();
      expect(result.current.saveAttackHealModal).toBeNull();
      expect(result.current.divineSparkModal).toBeNull();
      expect(result.current.divineInterventionModal).toBeNull();
      expect(result.current.divineInterventionAction).toBeNull();
      expect(result.current.moonlightStepResourceModal).toBeNull();
      expect(result.current.starryFormConstellationModal).toBeNull();
      expect(result.current.twinklingConstellationModal).toBeNull();
      expect(result.current.arcaneChargeModal).toBeNull();
      expect(result.current.warMagicCantripModal).toBeNull();
      expect(result.current.warMagicSpellModal).toBeNull();
      expect(result.current.sacredWeaponModal).toBeNull();
      expect(result.current.elderChampionRestoreModal).toBeNull();
      expect(result.current.primalCompanionBonusActionModal).toBeNull();
      expect(result.current.mistyWandererModal).toBeNull();
      expect(result.current.bonusActionChoiceModal).toBeNull();
      expect(result.current.revelationInFleshModal).toBeNull();
      expect(result.current.bastionOfLawModal).toBeNull();
      expect(result.current.elementalAffinityModal).toBeNull();
      expect(result.current.fiendishResilienceModal).toBeNull();
      expect(result.current.boonOfEnergyResistanceModal).toBeNull();
      expect(result.current.dragonCompanionModal).toBeNull();
      expect(result.current.wildMagicDoubleRollModal).toBeNull();
      expect(result.current.wildMagicTamedModal).toBeNull();
      expect(result.current.divinationSavantModal).toBeNull();
      expect(result.current.illusionSavantModal).toBeNull();
      expect(result.current.thirdEyeModal).toBeNull();
      expect(result.current.soulstitchSpellsModal).toBeNull();
      expect(result.current.illusoryRealityModal).toBeNull();
      expect(result.current.celestialRevelationModal).toBeNull();
      expect(result.current.elfishLineageModal).toBeNull();
      expect(result.current.gnomishLineageModal).toBeNull();
      expect(result.current.fiendishLegacyModal).toBeNull();
      expect(result.current.giantAncestryModal).toBeNull();
      expect(result.current.hypnoticPatternShakeModal).toBeNull();
      expect(result.current.eyebiteEffectModal).toBeNull();
      expect(result.current.divineFuryChoice).toBeNull();
      expect(result.current.damageTypeChoice).toBeNull();
      expect(result.current.featureChoice).toBeNull();
      expect(result.current.cleaveAttackPending).toBeNull();
    });

    it('returns pendingDamageRef as null', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.pendingDamageRef.current).toBeNull();
    });
  });

  describe('modal state setters', () => {
    it('can set and get healingPoolModal', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      const modalData = { type: 'healingPool', value: 10 };
      act(() => {
        result.current.setHealingPoolModal(modalData);
      });
      expect(result.current.healingPoolModal).toEqual(modalData);
    });

    it('can set and get handOfHealingModal', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setHandOfHealingModal({ type: 'handOfHealing' });
      });
      expect(result.current.handOfHealingModal).toEqual({ type: 'handOfHealing' });
    });

    it('can set and get fontOfMagicModal', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setFontOfMagicModal({ type: 'fontOfMagic' });
      });
      expect(result.current.fontOfMagicModal).toEqual({ type: 'fontOfMagic' });
    });

    it('can set and get resourcePoolModal', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setResourcePoolModal({ type: 'resourcePool' });
      });
      expect(result.current.resourcePoolModal).toEqual({ type: 'resourcePool' });
    });

    it('can set and get wildCompanionModal', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setWildCompanionModal({ type: 'wildCompanion' });
      });
      expect(result.current.wildCompanionModal).toEqual({ type: 'wildCompanion' });
    });

    it('can set and get setConditionModal', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setSetConditionModal({ type: 'condition' });
      });
      expect(result.current.setConditionModal).toEqual({ type: 'condition' });
    });

    it('can set and get attackRiderModal', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setAttackRiderModal({ type: 'attackRider' });
      });
      expect(result.current.attackRiderModal).toEqual({ type: 'attackRider' });
    });

    it('can set and get openHandTechniqueModal', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setOpenHandTechniqueModal({ type: 'openHand' });
      });
      expect(result.current.openHandTechniqueModal).toEqual({ type: 'openHand' });
    });

    it('can set and get weaponMasteryModal', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setWeaponMasteryModal({ type: 'weaponMastery' });
      });
      expect(result.current.weaponMasteryModal).toEqual({ type: 'weaponMastery' });
    });

    it('can set and get weaponMasteryChoiceModal', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setWeaponMasteryChoiceModal({ type: 'weaponMasteryChoice' });
      });
      expect(result.current.weaponMasteryChoiceModal).toEqual({ type: 'weaponMasteryChoice' });
    });

    it('returns cleaveAttackPending from hook', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.cleaveAttackPending).toBeNull();
    });
  });

  describe('delegated functions', () => {
    it('returns handleDamageClick from useDamageClick', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleDamageClick).toBe('function');
    });

    it('returns handleMasteryClose from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleMasteryClose).toBe('function');
    });

    it('returns handleWeaponMasteryChoice from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleWeaponMasteryChoice).toBe('function');
    });

    it('returns handleCleaveAttack from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleCleaveAttack).toBe('function');
    });

    it('returns handleCleaveSkip from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleCleaveSkip).toBe('function');
    });

    it('returns handleDivineFuryDamageType from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleDivineFuryDamageType).toBe('function');
    });

    it('returns handleDivineFurySkip from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleDivineFurySkip).toBe('function');
    });

    it('returns handleGenericDamageTypeChoice from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleGenericDamageTypeChoice).toBe('function');
    });

    it('returns handleGenericDamageTypeSkip from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleGenericDamageTypeSkip).toBe('function');
    });

    it('returns handleDamageTypeModifierChoice from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleDamageTypeModifierChoice).toBe('function');
    });

    it('returns handleDamageTypeModifierSkip from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleDamageTypeModifierSkip).toBe('function');
    });

    it('returns handleEnhancedUnarmedChoice from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleEnhancedUnarmedChoice).toBe('function');
    });

    it('returns handleEnhancedUnarmedSkip from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleEnhancedUnarmedSkip).toBe('function');
    });

    it('returns handleFeatureChoiceConfirm from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleFeatureChoiceConfirm).toBe('function');
    });

    it('returns handleFeatureChoiceSkip from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleFeatureChoiceSkip).toBe('function');
    });

    it('returns handleConstellationSelect from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleConstellationSelect).toBe('function');
    });

    it('returns handleElderChampionRestore from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleElderChampionRestore).toBe('function');
    });
  });

  describe('all modal states', () => {
    it('returns all 48 modal states', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));

      const modalKeys = [
        'healingPoolModal', 'handOfHealingModal', 'fontOfMagicModal',
        'resourcePoolModal', 'wildCompanionModal', 'setConditionModal',
        'attackRiderModal', 'openHandTechniqueModal', 'weaponMasteryModal',
        'weaponMasteryChoiceModal', 'combatStanceModal', 'teleportModal',
        'healingIllusionModal', 'saveAttackHealModal', 'divineSparkModal',
        'divineInterventionModal', 'divineInterventionAction',
        'moonlightStepResourceModal', 'starryFormConstellationModal',
        'twinklingConstellationModal', 'arcaneChargeModal',
        'warMagicCantripModal', 'warMagicSpellModal', 'sacredWeaponModal',
        'elderChampionRestoreModal', 'primalCompanionBonusActionModal',
        'mistyWandererModal', 'bonusActionChoiceModal',
        'revelationInFleshModal', 'bastionOfLawModal',
        'elementalAffinityModal', 'fiendishResilienceModal',
        'boonOfEnergyResistanceModal', 'dragonCompanionModal',
        'wildMagicDoubleRollModal', 'wildMagicTamedModal',
        'divinationSavantModal', 'illusionSavantModal', 'thirdEyeModal',
        'soulstitchSpellsModal', 'illusoryRealityModal',
        'celestialRevelationModal', 'elfishLineageModal',
        'gnomishLineageModal', 'fiendishLegacyModal', 'giantAncestryModal',
        'hypnoticPatternShakeModal', 'eyebiteEffectModal',
        'divineFuryChoice', 'damageTypeChoice', 'featureChoice',
      ];

      for (const key of modalKeys) {
        expect(result.current).toHaveProperty(key);
      }
    });
  });

  describe('return value structure', () => {
    it('returns all expected properties', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));

      expect(result.current).toHaveProperty('pendingDamageRef');
      expect(result.current).toHaveProperty('handleDamageClick');
      expect(result.current).toHaveProperty('handleMasteryClose');
      expect(result.current).toHaveProperty('handleWeaponMasteryChoice');
      expect(result.current).toHaveProperty('handleCleaveAttack');
      expect(result.current).toHaveProperty('handleCleaveSkip');
      expect(result.current).toHaveProperty('cleaveAttackPending');
    });
  });

  describe('edge cases', () => {
    it('handles null playerStats', () => {
      expect(() => {
        renderHook(() => useCharActionModals({ ...baseArgs, playerStats: null }));
      }).not.toThrow();
    });

    it('handles null campaignName', () => {
      const { result } = renderHook(() =>
        useCharActionModals({ ...baseArgs, campaignName: null })
      );
      expect(result.current.healingPoolModal).toBeNull();
    });

    it('handles missing args gracefully', () => {
      const { result } = renderHook(() =>
        useCharActionModals({}));
      expect(result.current.healingPoolModal).toBeNull();
    });
  });
});
