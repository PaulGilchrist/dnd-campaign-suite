// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useCharActionModals from './useCharActionModals.js';

vi.mock('./useAttackDamageResolution.js', () => ({
  default: vi.fn(),
}));

vi.mock('./useModalHandlers.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../hooks/combat/useCombatSuperiorityModal.js', () => ({
  useCombatSuperiorityModal: vi.fn(() => ({
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleCombatSuperiorityReopenSelection: vi.fn(),
  })),
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

describe('useCharActionModals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAttackDamageResolution.mockReturnValue(mockResolveAttackDamageResult);
    useModalHandlers.mockReturnValue(mockModalHandlersResult);
  });

  it('returns an object with modal state pairs, delegated handlers, and combat superiority functions', () => {
    const { result } = renderHook(() => useCharActionModals(baseArgs));

    // Modal state pairs (state + setter)
    expect(result.current.healingPoolModal).toBeNull();
    expect(typeof result.current.setHealingPoolModal).toBe('function');
    expect(result.current.handOfHealingModal).toBeNull();
    expect(typeof result.current.setHandOfHealingModal).toBe('function');
    expect(result.current.fontOfMagicModal).toBeNull();
    expect(typeof result.current.setFontOfMagicModal).toBe('function');
    expect(result.current.resourcePoolModal).toBeNull();
    expect(typeof result.current.setResourcePoolModal).toBe('function');
    expect(result.current.wildCompanionModal).toBeNull();
    expect(typeof result.current.setWildCompanionModal).toBe('function');
    expect(result.current.setConditionModal).toBeNull();
    expect(typeof result.current.setSetConditionModal).toBe('function');
    expect(result.current.attackRiderModal).toBeNull();
    expect(typeof result.current.setAttackRiderModal).toBe('function');
    expect(result.current.openHandTechniqueModal).toBeNull();
    expect(typeof result.current.setOpenHandTechniqueModal).toBe('function');
    expect(result.current.weaponMasteryModal).toBeNull();
    expect(typeof result.current.setWeaponMasteryModal).toBe('function');
    expect(result.current.weaponMasteryChoiceModal).toBeNull();
    expect(typeof result.current.setWeaponMasteryChoiceModal).toBe('function');
    expect(result.current.weaponKindMasteryModal).toBeNull();
    expect(typeof result.current.setWeaponKindMasteryModal).toBe('function');
    expect(result.current.combatStanceModal).toBeNull();
    expect(typeof result.current.setCombatStanceModal).toBe('function');
    expect(result.current.teleportModal).toBeNull();
    expect(typeof result.current.setTeleportModal).toBe('function');
    expect(result.current.healingIllusionModal).toBeNull();
    expect(typeof result.current.setHealingIllusionModal).toBe('function');
    expect(result.current.saveAttackHealModal).toBeNull();
    expect(typeof result.current.setSaveAttackHealModal).toBe('function');
    expect(result.current.divineSparkModal).toBeNull();
    expect(typeof result.current.setDivineSparkModal).toBe('function');
    expect(result.current.divineInterventionModal).toBeNull();
    expect(typeof result.current.setDivineInterventionModal).toBe('function');
    expect(result.current.divineInterventionAction).toBeNull();
    expect(typeof result.current.setDivineInterventionAction).toBe('function');
    expect(result.current.moonlightStepResourceModal).toBeNull();
    expect(typeof result.current.setMoonlightStepResourceModal).toBe('function');
    expect(result.current.starryFormConstellationModal).toBeNull();
    expect(typeof result.current.setStarryFormConstellationModal).toBe('function');
    expect(result.current.twinklingConstellationModal).toBeNull();
    expect(typeof result.current.setTwinklingConstellationModal).toBe('function');
    expect(result.current.arcaneChargeModal).toBeNull();
    expect(typeof result.current.setArcaneChargeModal).toBe('function');
    expect(result.current.warMagicCantripModal).toBeNull();
    expect(typeof result.current.setWarMagicCantripModal).toBe('function');
    expect(result.current.warMagicSpellModal).toBeNull();
    expect(typeof result.current.setWarMagicSpellModal).toBe('function');
    expect(result.current.sacredWeaponModal).toBeNull();
    expect(typeof result.current.setSacredWeaponModal).toBe('function');
    expect(result.current.elderChampionRestoreModal).toBeNull();
    expect(typeof result.current.setElderChampionRestoreModal).toBe('function');
    expect(result.current.primalCompanionBonusActionModal).toBeNull();
    expect(typeof result.current.setPrimalCompanionBonusActionModal).toBe('function');
    expect(result.current.mistyWandererModal).toBeNull();
    expect(typeof result.current.setMistyWandererModal).toBe('function');
    expect(result.current.bonusActionChoiceModal).toBeNull();
    expect(typeof result.current.setBonusActionChoiceModal).toBe('function');
    expect(result.current.revelationInFleshModal).toBeNull();
    expect(typeof result.current.setRevelationInFleshModal).toBe('function');
    expect(result.current.bastionOfLawModal).toBeNull();
    expect(typeof result.current.setBastionOfLawModal).toBe('function');
    expect(result.current.elementalAffinityModal).toBeNull();
    expect(typeof result.current.setElementalAffinityModal).toBe('function');
    expect(result.current.fiendishResilienceModal).toBeNull();
    expect(typeof result.current.setFiendishResilienceModal).toBe('function');
    expect(result.current.boonOfEnergyResistanceModal).toBeNull();
    expect(typeof result.current.setBoonOfEnergyResistanceModal).toBe('function');
    expect(result.current.dragonCompanionModal).toBeNull();
    expect(typeof result.current.setDragonCompanionModal).toBe('function');
    expect(result.current.wildMagicDoubleRollModal).toBeNull();
    expect(typeof result.current.setWildMagicDoubleRollModal).toBe('function');
    expect(result.current.wildMagicTamedModal).toBeNull();
    expect(typeof result.current.setWildMagicTamedModal).toBe('function');
    expect(result.current.divinationSavantModal).toBeNull();
    expect(typeof result.current.setDivinationSavantModal).toBe('function');
    expect(result.current.illusionSavantModal).toBeNull();
    expect(typeof result.current.setIllusionSavantModal).toBe('function');
    expect(result.current.thirdEyeModal).toBeNull();
    expect(typeof result.current.setThirdEyeModal).toBe('function');
    expect(result.current.soulstitchSpellsModal).toBeNull();
    expect(typeof result.current.setSoulstitchSpellsModal).toBe('function');
    expect(result.current.illusoryRealityModal).toBeNull();
    expect(typeof result.current.setIllusoryRealityModal).toBe('function');
    expect(result.current.celestialRevelationModal).toBeNull();
    expect(typeof result.current.setCelestialRevelationModal).toBe('function');
    expect(result.current.elfishLineageModal).toBeNull();
    expect(typeof result.current.setElfisLineageModal).toBe('function');
    expect(result.current.gnomishLineageModal).toBeNull();
    expect(typeof result.current.setGnomishLineageModal).toBe('function');
    expect(result.current.fiendishLegacyModal).toBeNull();
    expect(typeof result.current.setFiendishLegacyModal).toBe('function');
    expect(result.current.giantAncestryModal).toBeNull();
    expect(typeof result.current.setGiantAncestryModal).toBe('function');
    expect(result.current.hypnoticPatternShakeModal).toBeNull();
    expect(typeof result.current.setHypnoticPatternShakeModal).toBe('function');
    expect(result.current.arcaneWardRestoreModal).toBeNull();
    expect(typeof result.current.setArcaneWardRestoreModal).toBe('function');
    expect(result.current.combatSuperiorityModal).toBeNull();
    expect(typeof result.current.setCombatSuperiorityModal).toBe('function');
    expect(result.current.eyebiteEffectModal).toBeNull();
    expect(typeof result.current.setEyebiteEffectModal).toBe('function');
    expect(result.current.divineFuryChoice).toBeNull();
    expect(typeof result.current.setDivineFuryChoice).toBe('function');
    expect(result.current.damageTypeChoice).toBeNull();
    expect(typeof result.current.setDamageTypeChoice).toBe('function');
    expect(result.current.featureChoice).toBeNull();
    expect(typeof result.current.setFeatureChoice).toBe('function');
    expect(result.current.attackRiderManeuverPrompt).toBeNull();
    expect(typeof result.current.setAttackRiderManeuverPrompt).toBe('function');
    expect(result.current.sweepingAttackTargetModal).toBeNull();
    expect(typeof result.current.setSweepingAttackTargetModal).toBe('function');
    expect(result.current.baitAndSwitchChoiceModal).toBeNull();
    expect(typeof result.current.setBaitAndSwitchChoiceModal).toBe('function');
    expect(result.current.commanderStrikeChoiceModal).toBeNull();
    expect(typeof result.current.setCommanderStrikeChoiceModal).toBe('function');
    expect(result.current.rallyChoiceModal).toBeNull();
    expect(typeof result.current.setRallyChoiceModal).toBe('function');
    expect(result.current.bulwarkOfForceModal).toBeNull();
    expect(typeof result.current.setBulwarkOfForceModal).toBe('function');
    expect(result.current.coronaEnemySelectionModal).toBeNull();
    expect(typeof result.current.setCoronaEnemySelectionModal).toBe('function');
    expect(result.current.radianceOfDawnModal).toBeNull();
    expect(typeof result.current.setRadianceOfDawnModal).toBe('function');
    expect(result.current.tricksterBlessingModal).toBeNull();
    expect(typeof result.current.setTricksterBlessingModal).toBe('function');
    expect(result.current.secondaryTargetModal).toBeNull();
    expect(typeof result.current.setSecondaryTargetModal).toBe('function');
    expect(result.current.invokeDuplicityModal).toBeNull();
    expect(typeof result.current.setInvokeDuplicityModal).toBe('function');
    expect(result.current.stealthAttackModal).toBeNull();
    expect(typeof result.current.setStealthAttackModal).toBe('function');

    // pendingDamage
    expect(result.current.pendingDamage).toBeDefined();

    // Delegated handlers from useModalHandlers
    expect(result.current.resolveAttackDamage).toBe(mockResolveAttackDamageResult.resolveAttackDamage);
    expect(result.current.handleMasteryClose).toBe(mockModalHandlersResult.handleMasteryClose);
    expect(result.current.handleWeaponMasteryChoice).toBe(mockModalHandlersResult.handleWeaponMasteryChoice);
    expect(result.current.handleDivineFuryDamageType).toBe(mockModalHandlersResult.handleDivineFuryDamageType);
    expect(result.current.handleDivineFurySkip).toBe(mockModalHandlersResult.handleDivineFurySkip);
    expect(result.current.handleGenericDamageTypeChoice).toBe(mockModalHandlersResult.handleGenericDamageTypeChoice);
    expect(result.current.handleGenericDamageTypeSkip).toBe(mockModalHandlersResult.handleGenericDamageTypeSkip);
    expect(result.current.handleDamageTypeModifierChoice).toBe(mockModalHandlersResult.handleDamageTypeModifierChoice);
    expect(result.current.handleDamageTypeModifierSkip).toBe(mockModalHandlersResult.handleDamageTypeModifierSkip);
    expect(result.current.handleEnhancedUnarmedChoice).toBe(mockModalHandlersResult.handleEnhancedUnarmedChoice);
    expect(result.current.handleEnhancedUnarmedSkip).toBe(mockModalHandlersResult.handleEnhancedUnarmedSkip);
    expect(result.current.handleFeatureChoiceConfirm).toBe(mockModalHandlersResult.handleFeatureChoiceConfirm);
    expect(result.current.handleFeatureChoiceSkip).toBe(mockModalHandlersResult.handleFeatureChoiceSkip);
    expect(result.current.handleConstellationSelect).toBe(mockModalHandlersResult.handleConstellationSelect);
    expect(result.current.handleElderChampionRestore).toBe(mockModalHandlersResult.handleElderChampionRestore);

    // Delegated handlers from useCombatSuperiorityModal
    expect(typeof result.current.handleCombatSuperiorityConfirm).toBe('function');
    expect(typeof result.current.handleCombatSuperiorityReopenSelection).toBe('function');
  });
});
