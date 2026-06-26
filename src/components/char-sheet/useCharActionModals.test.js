// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCharActionModals from './useCharActionModals.js';

vi.mock('./useDamageClick.js', () => ({
  default: vi.fn(),
}));

vi.mock('./useModalHandlers.js', () => ({
  default: vi.fn(),
}));

const useDamageClick = (await import('./useDamageClick.js')).default;
const useModalHandlers = (await import('./useModalHandlers.js')).default;

const mockDamageClickResult = {
  handleDamageClick: vi.fn(),
  proceedWithDamage: vi.fn(),
};

const mockModalHandlersResult = {
  handleMasteryClose: vi.fn(),
  handleWeaponMasteryChoice: vi.fn(),
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
};

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

const modalStatePairs = [
  ['healingPoolModal', 'setHealingPoolModal'],
  ['handOfHealingModal', 'setHandOfHealingModal'],
  ['fontOfMagicModal', 'setFontOfMagicModal'],
  ['resourcePoolModal', 'setResourcePoolModal'],
  ['wildCompanionModal', 'setWildCompanionModal'],
  ['setConditionModal', 'setSetConditionModal'],
  ['attackRiderModal', 'setAttackRiderModal'],
  ['openHandTechniqueModal', 'setOpenHandTechniqueModal'],
  ['weaponMasteryModal', 'setWeaponMasteryModal'],
  ['weaponMasteryChoiceModal', 'setWeaponMasteryChoiceModal'],
  ['combatStanceModal', 'setCombatStanceModal'],
  ['teleportModal', 'setTeleportModal'],
  ['healingIllusionModal', 'setHealingIllusionModal'],
  ['saveAttackHealModal', 'setSaveAttackHealModal'],
  ['divineSparkModal', 'setDivineSparkModal'],
  ['divineInterventionModal', 'setDivineInterventionModal'],
  ['divineInterventionAction', 'setDivineInterventionAction'],
  ['moonlightStepResourceModal', 'setMoonlightStepResourceModal'],
  ['starryFormConstellationModal', 'setStarryFormConstellationModal'],
  ['twinklingConstellationModal', 'setTwinklingConstellationModal'],
  ['arcaneChargeModal', 'setArcaneChargeModal'],
  ['warMagicCantripModal', 'setWarMagicCantripModal'],
  ['warMagicSpellModal', 'setWarMagicSpellModal'],
  ['sacredWeaponModal', 'setSacredWeaponModal'],
  ['elderChampionRestoreModal', 'setElderChampionRestoreModal'],
  ['primalCompanionBonusActionModal', 'setPrimalCompanionBonusActionModal'],
  ['mistyWandererModal', 'setMistyWandererModal'],
  ['bonusActionChoiceModal', 'setBonusActionChoiceModal'],
  ['revelationInFleshModal', 'setRevelationInFleshModal'],
  ['bastionOfLawModal', 'setBastionOfLawModal'],
  ['elementalAffinityModal', 'setElementalAffinityModal'],
  ['fiendishResilienceModal', 'setFiendishResilienceModal'],
  ['boonOfEnergyResistanceModal', 'setBoonOfEnergyResistanceModal'],
  ['dragonCompanionModal', 'setDragonCompanionModal'],
  ['wildMagicDoubleRollModal', 'setWildMagicDoubleRollModal'],
  ['wildMagicTamedModal', 'setWildMagicTamedModal'],
  ['divinationSavantModal', 'setDivinationSavantModal'],
  ['illusionSavantModal', 'setIllusionSavantModal'],
  ['thirdEyeModal', 'setThirdEyeModal'],
  ['soulstitchSpellsModal', 'setSoulstitchSpellsModal'],
  ['illusoryRealityModal', 'setIllusoryRealityModal'],
  ['celestialRevelationModal', 'setCelestialRevelationModal'],
  ['elfishLineageModal', 'setElfisLineageModal'],
  ['gnomishLineageModal', 'setGnomishLineageModal'],
  ['fiendishLegacyModal', 'setFiendishLegacyModal'],
  ['giantAncestryModal', 'setGiantAncestryModal'],
  ['hypnoticPatternShakeModal', 'setHypnoticPatternShakeModal'],
  ['eyebiteEffectModal', 'setEyebiteEffectModal'],
  ['divineFuryChoice', 'setDivineFuryChoice'],
  ['damageTypeChoice', 'setDamageTypeChoice'],
  ['featureChoice', 'setFeatureChoice'],
];

const delegatedHandlerNames = [
  'handleMasteryClose',
  'handleWeaponMasteryChoice',
  'handleDivineFuryDamageType',
  'handleDivineFurySkip',
  'handleGenericDamageTypeChoice',
  'handleGenericDamageTypeSkip',
  'handleDamageTypeModifierChoice',
  'handleDamageTypeModifierSkip',
  'handleEnhancedUnarmedChoice',
  'handleEnhancedUnarmedSkip',
  'handleFeatureChoiceConfirm',
  'handleFeatureChoiceSkip',
  'handleConstellationSelect',
  'handleElderChampionRestore',
];

describe('useCharActionModals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDamageClick.mockReturnValue(mockDamageClickResult);
    useModalHandlers.mockReturnValue(mockModalHandlersResult);
  });

  describe('initial state', () => {
    it('returns all modal states as null', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));

      for (const [stateName] of modalStatePairs) {
        expect(result.current[stateName]).toBeNull();
      }

      expect(result.current.pendingDamageRef.current).toBeNull();
    });
  });

  describe('modal state setters', () => {
    for (const [stateName, setterName] of modalStatePairs) {
      it(`sets and retrieves ${stateName} via ${setterName}`, () => {
        const { result } = renderHook(() => useCharActionModals(baseArgs));
        const modalData = { type: stateName };

        act(() => {
          result.current[setterName](modalData);
        });

        expect(result.current[stateName]).toEqual(modalData);
      });
    }

  describe('delegated functions', () => {
    it('returns handleDamageClick from useDamageClick', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.handleDamageClick).toBe(mockDamageClickResult.handleDamageClick);
    });

    for (const handlerName of delegatedHandlerNames) {
      it(`returns ${handlerName} from useModalHandlers`, () => {
        const { result } = renderHook(() => useCharActionModals(baseArgs));
        expect(result.current[handlerName]).toBe(mockModalHandlersResult[handlerName]);
      });
    }
  });

  describe('return value structure', () => {
    it('returns all modal state pairs plus refs and handlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));

      for (const [stateName] of modalStatePairs) {
        expect(result.current).toHaveProperty(stateName);
      }

      expect(result.current).toHaveProperty('pendingDamageRef');
      expect(result.current).toHaveProperty('handleDamageClick');

      for (const handlerName of delegatedHandlerNames) {
        expect(result.current).toHaveProperty(handlerName);
      }
    });

    it('returns a ref object for pendingDamageRef', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.pendingDamageRef).toBeDefined();
      expect(result.current.pendingDamageRef).toHaveProperty('current');
    });
  });

  describe('delegation wiring', () => {
    it('passes all expected setters to useModalHandlers', () => {
      renderHook(() => useCharActionModals(baseArgs));

      const handlersCall = useModalHandlers.mock.calls[0][0];

      expect(handlersCall).toHaveProperty('setWeaponMasteryModal');
      expect(handlersCall).toHaveProperty('setWeaponMasteryChoiceModal');
      expect(handlersCall).toHaveProperty('setFeatureChoice');
      expect(handlersCall).toHaveProperty('setDamageTypeChoice');
      expect(handlersCall).toHaveProperty('setDivineFuryChoice');
      expect(handlersCall).toHaveProperty('setStarryFormConstellationModal');
      expect(handlersCall).toHaveProperty('setTwinklingConstellationModal');
      expect(handlersCall).toHaveProperty('setPopupHtml');
    });

    it('passes all expected setters to useDamageClick', () => {
      renderHook(() => useCharActionModals(baseArgs));

      const clickCall = useDamageClick.mock.calls[0][0];

      expect(clickCall).toHaveProperty('setDamageTypeChoice');
      expect(clickCall).toHaveProperty('setDivineFuryChoice');
      expect(clickCall).toHaveProperty('setWeaponMasteryModal');
      expect(clickCall).toHaveProperty('setAttackRiderModal');
      expect(clickCall).toHaveProperty('pendingDamageRef');
    });
  });

  describe('edge cases', () => {
    it('handles null playerStats without throwing', () => {
      expect(() => {
        renderHook(() => useCharActionModals({ ...baseArgs, playerStats: null }));
      }).not.toThrow();
    });

    it('handles null campaignName without throwing', () => {
      expect(() => {
        renderHook(() => useCharActionModals({ ...baseArgs, campaignName: null }));
      }).not.toThrow();
    });

    it('handles empty args object without throwing', () => {
      expect(() => {
        renderHook(() => useCharActionModals({}));
      }).not.toThrow();
    });

    it('returns null modal states when called with minimal args', () => {
      const { result } = renderHook(() => useCharActionModals({}));

      expect(result.current.healingPoolModal).toBeNull();
      expect(result.current.pendingDamageRef.current).toBeNull();
    });

    it('returns null modal states when playerStats is missing class', () => {
      const { result } = renderHook(() =>
        useCharActionModals({ ...baseArgs, playerStats: { name: 'Orphan' } })
      );

      expect(result.current.healingPoolModal).toBeNull();
      expect(result.current.featureChoice).toBeNull();
    });
  });
});
});
