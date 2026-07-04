import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCharActionModals from './useCharActionModals.js';

vi.mock('./useAttackDamageResolution.js', () => ({
  default: vi.fn(),
}));

vi.mock('./useModalHandlers.js', () => ({
  default: vi.fn(),
}));

const useAttackDamageResolution = (await import('./useAttackDamageResolution.js')).default;
const useModalHandlers = (await import('./useModalHandlers.js')).default;

const mockResolveAttackDamageResult = {
  resolveAttackDamage: vi.fn(),
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
    useAttackDamageResolution.mockReturnValue(mockResolveAttackDamageResult);
    useModalHandlers.mockReturnValue(mockModalHandlersResult);
  });

  describe('initial state', () => {
    it('returns all modal states as null and pendingDamageRef as null', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));

      for (const [stateName] of modalStatePairs) {
        expect(result.current[stateName]).toBeNull();
      }

      expect(result.current.pendingDamageRef.current).toBeNull();
    });
  });

  describe('modal state setters', () => {
    for (const [stateName, setterName] of modalStatePairs) {
      it(`sets ${stateName} via ${setterName}`, () => {
        const { result } = renderHook(() => useCharActionModals(baseArgs));
        const modalData = { type: stateName };

        act(() => {
          result.current[setterName](modalData);
        });

        expect(result.current[stateName]).toEqual(modalData);
      });
    }
  });

  describe('delegated functions', () => {
    it('returns resolveAttackDamage from useAttackDamageResolution', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.resolveAttackDamage).toBe(mockResolveAttackDamageResult.resolveAttackDamage);
    });

    for (const handlerName of delegatedHandlerNames) {
      it(`returns ${handlerName} from useModalHandlers`, () => {
        const { result } = renderHook(() => useCharActionModals(baseArgs));
        expect(result.current[handlerName]).toBe(mockModalHandlersResult[handlerName]);
      });
    }
  });

  describe('edge cases', () => {
    it('handles minimal args without throwing and returns null modal states', () => {
      const { result } = renderHook(() => useCharActionModals({}));

      expect(result.current.healingPoolModal).toBeNull();
      expect(result.current.featureChoice).toBeNull();
      expect(result.current.pendingDamageRef.current).toBeNull();
    });
  });
});
