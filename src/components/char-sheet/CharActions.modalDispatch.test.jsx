// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { executeHandler } from '../../services/automation/index.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/automation/index.js', () => ({ executeHandler: vi.fn() }));
vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => null),
}));
vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null, handleActionMetamagicConfirm: vi.fn(), handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(), handleSpellAttackClick: vi.fn(), handleSpellDamageClick: vi.fn(),
  })),
}));
vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => entity.details ? `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}` : null),
}));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null, gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn(),
    pendingAid: null, handleAidConfirm: vi.fn(), handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null, handleGreaterRestorationConfirm: vi.fn(), handleGreaterRestorationSkip: vi.fn(),
    pendingRemoveCurse: null, handleRemoveCurseConfirm: vi.fn(), handleRemoveCurseSkip: vi.fn(),
  })),
}));
vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));
vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({ isExhausted: vi.fn(() => false) }));
vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({ onSpellSelected: vi.fn() }));
vi.mock('../../services/automation/handlers/class-wizard/divinationSavantHandler.js', () => ({ onDivinationSavantSelected: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../services/automation/handlers/class-wizard/illusionSavantHandler.js', () => ({ onIllusionSavantSelected: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../services/combat/buffs/buffService.js', () => ({ getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })) }));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn(() => Promise.resolve({})) }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({ getTargetFromAttacker: vi.fn(() => null), getCombatContext: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({ getNearestPlacedItem: vi.fn(() => null) }));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => html) }));
vi.mock('./DiceRollResult.jsx', () => ({ default: vi.fn(() => <div data-testid="dice-roll-result">DiceRollResult</div>) }));
vi.mock('./popups/MetamagicPopup.jsx', () => ({ default: vi.fn(() => <div data-testid="metamagic-popup">MetamagicPopup</div>) }));
vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({ default: vi.fn(() => <div data-testid="spell-detail-popup">SpellDetailPopup</div>) }));
vi.mock('./popups/EmpoweredSpellPopup.jsx', () => ({ default: vi.fn(() => <div data-testid="empowered-spell-popup">EmpoweredSpellPopup</div>) }));
vi.mock('./CharBonusActions.jsx', () => ({ default: vi.fn(() => <div data-testid="char-bonus-actions">CharBonusActions</div>) }));
vi.mock('./CharActionModals.jsx', () => ({ default: vi.fn(() => <div data-testid="char-action-modals">CharActionModals</div>) }));
vi.mock('./CharActionSpellPopups.jsx', () => ({ default: vi.fn(() => <div data-testid="char-action-spell-popups">CharActionSpellPopups</div>) }));
vi.mock('../../services/encounters/combatData.js', () => ({ getCombatSummary: vi.fn(() => ({ creatures: [] })), getCurrentCombatRound: vi.fn(() => 1) }));
vi.mock('../../services/rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => name.startsWith('+') ? { baseName: name.replace(/^\+\d+\s*/, '') } : { baseName: name }),
}));
vi.mock('../../services/character/classFeatures.js', () => ({ getClassFeatures: vi.fn(() => ({ maxFocusPoints: 2 })) }));
vi.mock('../../services/character/featRangeService.js', () => ({ computeFeatRangeEffects: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [3, 2, 3, 2], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 48, rolls: [6, 6, 6, 6, 6, 6, 6, 6], modifier: 0 })),
}));
vi.mock('./useInitiativeEffects.js', () => ({ default: vi.fn() }));
vi.mock('./useCharActionModals.js', () => ({
  default: vi.fn(() => ({
    pendingDamageRef: { current: null },
    healingPoolModal: null, setHealingPoolModal: vi.fn(),
    handOfHealingModal: null, setHandOfHealingModal: vi.fn(),
    fontOfMagicModal: false, setFontOfMagicModal: vi.fn(),
    resourcePoolModal: null, setResourcePoolModal: vi.fn(),
    wildCompanionModal: null, setWildCompanionModal: vi.fn(),
    setConditionModal: null, setSetConditionModal: vi.fn(),
    attackRiderModal: null, setAttackRiderModal: vi.fn(),
    openHandTechniqueModal: null, setOpenHandTechniqueModal: vi.fn(),
    weaponMasteryModal: null,
    weaponMasteryChoiceModal: null, setWeaponMasteryChoiceModal: vi.fn(),
    combatStanceModal: null, setCombatStanceModal: vi.fn(),
    teleportModal: null, setTeleportModal: vi.fn(),
    healingIllusionModal: null, setHealingIllusionModal: vi.fn(),
    saveAttackHealModal: null, setSaveAttackHealModal: vi.fn(),
    divineSparkModal: null, setDivineSparkModal: vi.fn(),
    divineInterventionModal: null, setDivineInterventionModal: vi.fn(),
    divineInterventionAction: null, setDivineInterventionAction: vi.fn(),
    moonlightStepResourceModal: null, setMoonlightStepResourceModal: vi.fn(),
    starryFormConstellationModal: null, setStarryFormConstellationModal: vi.fn(),
    twinklingConstellationModal: null, setTwinklingConstellationModal: vi.fn(),
    arcaneChargeModal: null, setArcaneChargeModal: vi.fn(),
    warMagicCantripModal: null, setWarMagicCantripModal: vi.fn(),
    warMagicSpellModal: null, setWarMagicSpellModal: vi.fn(),
    sacredWeaponModal: null, setSacredWeaponModal: vi.fn(),
    elderChampionRestoreModal: null, setElderChampionRestoreModal: vi.fn(),
    primalCompanionBonusActionModal: null, setPrimalCompanionBonusActionModal: vi.fn(),
    mistyWandererModal: null, setMistyWandererModal: vi.fn(),
    bonusActionChoiceModal: null, setBonusActionChoiceModal: vi.fn(),
    revelationInFleshModal: null, setRevelationInFleshModal: vi.fn(),
    bastionOfLawModal: null, setBastionOfLawModal: vi.fn(),
    elementalAffinityModal: null, setElementalAffinityModal: vi.fn(),
    fiendishResilienceModal: null, setFiendishResilienceModal: vi.fn(),
    boonOfEnergyResistanceModal: null, setBoonOfEnergyResistanceModal: vi.fn(),
    dragonCompanionModal: null, setDragonCompanionModal: vi.fn(),
    wildMagicDoubleRollModal: null, setWildMagicDoubleRollModal: vi.fn(),
    wildMagicTamedModal: null, setWildMagicTamedModal: vi.fn(),
    thirdEyeModal: null, setThirdEyeModal: vi.fn(),
    soulstitchSpellsModal: null, setSoulstitchSpellsModal: vi.fn(),
    illusoryRealityModal: null, setIllusoryRealityModal: vi.fn(),
    celestialRevelationModal: null, setCelestialRevelationModal: vi.fn(),
    elfishLineageModal: null, setElfisLineageModal: vi.fn(),
    gnomishLineageModal: null, setGnomishLineageModal: vi.fn(),
    fiendishLegacyModal: null, setFiendishLegacyModal: vi.fn(),
    giantAncestryModal: null, setGiantAncestryModal: vi.fn(),
    eyebiteEffectModal: null, setEyebiteEffectModal: vi.fn(),
    breathWeaponShapeModal: null, setBreathWeaponShapeModal: vi.fn(),
    divineFuryChoice: null,
    damageTypeChoice: null,
    featureChoice: null,
    setFeatureChoice: vi.fn(),
    handleDamageClick: vi.fn(),
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
    cleaveAttackPending: null,
    handleCleaveAttack: vi.fn(),
    handleCleaveSkip: vi.fn(),
    hypnoticPatternShakeModal: null, setHypnoticPatternShakeModal: vi.fn(),
    arcaneWardRestoreModal: null, setArcaneWardRestoreModal: vi.fn(),
  })),
}));

const BASE_PLAYER_STATS = { name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [], spellAbilities: { spells: [] }, equipment: [] };
function createStats(overrides = {}) { return { ...BASE_PLAYER_STATS, ...overrides }; }

describe('CharActions handleAutomationAction modal dispatching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    hasAutomation.mockImplementation(() => false);
    getRuntimeValue.mockImplementation(() => null);
  });

  const modalTests = [
    { name: 'healingPool', action: 'Life Stream', automation: { type: 'healing_pool' }, payload: { poolName: 'Life Stream', amount: 10 } },
    { name: 'handOfHealing', action: 'Hand of Healing', automation: { type: 'auto_effect' }, payload: { amount: 5 } },
    { name: 'fontOfMagic', action: 'Font of Magic', automation: { type: 'auto_effect' }, payload: null },
    { name: 'resourcePool', action: 'Pact Magic', automation: { type: 'auto_effect' }, payload: { poolName: 'Pact Magic' } },
    { name: 'wildCompanion', action: 'Wild Companion', automation: { type: 'auto_effect' }, payload: { companionName: 'Pseudodragon' } },
    { name: 'combatStance', action: 'Stunning Strike', automation: { type: 'auto_effect' }, payload: { stanceName: 'Stunning Strike' } },
    { name: 'teleport', action: 'Misty Step', automation: { type: 'auto_effect' }, payload: { destination: 'Misty Step' } },
    { name: 'divineIntervention', action: 'Divine Intervention', automation: { type: 'auto_effect' }, payload: { available: true } },
    { name: 'soulstitchSpells', action: 'Soulstitch', automation: { type: 'auto_effect' }, payload: { spells: ['Magic Missile'] } },
    { name: 'elementalAffinity', action: 'Elemental Affinity', automation: { type: 'auto_effect' }, payload: { action: { name: 'Elemental Affinity' }, damageTypes: ['Fire', 'Cold'] } },
    { name: 'fiendishResilience', action: 'Fiendish Resilience', automation: { type: 'auto_effect' }, payload: { action: { name: 'Fiendish Resilience' }, damageTypes: ['Fire'] } },
    { name: 'boonOfEnergyResistance', action: 'Boon of Energy Resistance', automation: { type: 'auto_effect' }, payload: { action: { name: 'Boon' }, damageTypes: ['Fire'], maxSelections: 2 } },
    { name: 'dragonCompanion', action: 'Dragon Companion', automation: { type: 'auto_effect' }, payload: { dragonName: 'Young Red Dragon' } },
    { name: 'wildMagicDoubleRoll', action: 'Wild Magic Surge', automation: { type: 'auto_effect' }, payload: { spellName: 'Fireball' } },
    { name: 'weaponMasteryChoice', action: 'Weapon Mastery', automation: { type: 'auto_effect' }, payload: { choices: ['Sap', 'Topple'] } },
    { name: 'thirdEye', action: 'Third Eye', automation: { type: 'auto_effect' }, payload: { options: ['See Invisibility', 'Detect Magic'] } },
    { name: 'starryFormConstellation', action: 'Starry Form', automation: { type: 'auto_effect' }, payload: { constellations: ['The Maelstrom'] } },
    { name: 'twinklingConstellation', action: 'Twinkling Constellation', automation: { type: 'auto_effect' }, payload: { options: ['The Moon', 'The Stars'] } },
    { name: 'arcaneCharge', action: 'Arcane Charge', automation: { type: 'auto_effect' }, payload: { chargeType: 'Force' } },
    { name: 'warMagicCantrip', action: 'War Magic', automation: { type: 'auto_effect' }, payload: { cantrips: ['Firebolt', 'Ray of Frost'] } },
    { name: 'warMagicSpell', action: 'War Magic', automation: { type: 'auto_effect' }, payload: { spells: ['Magic Missile'] } },
    { name: 'sacredWeaponDamageType', action: 'Sacred Weapon', automation: { type: 'auto_effect' }, payload: { action: { name: 'Sacred Weapon' } } },
    { name: 'elderChampionRestore', action: 'Elder Champion', automation: { type: 'auto_effect' }, payload: { options: ['Hit Points', 'Spell Slots'] } },
    { name: 'primalCompanionBonusActionCommand', action: 'Primal Companion', automation: { type: 'auto_effect' }, payload: { commands: ['Attack', 'Help'] } },
    { name: 'mistyWanderer', action: 'Misty Wanderer', automation: { type: 'auto_effect' }, payload: { destination: 'Misty Step' } },
    { name: 'bonusActionChoice', action: 'Bonus Action Choice', automation: { type: 'auto_effect' }, payload: { choices: ['Dash', 'Disengage'] } },
    { name: 'revelationInFlesh', action: 'Revelation in Flesh', automation: { type: 'auto_effect' }, payload: { options: ['Darkvision', 'Low-Light Vision'] } },
    { name: 'bastionOfLaw', action: 'Bastion of Law', automation: { type: 'auto_effect' }, payload: { options: ['Protective Aura'] } },
    { name: 'wildMagicTamed', action: 'Wild Magic Tamed', automation: { type: 'auto_effect' }, payload: { options: ['Stable'] } },
    { name: 'illusoryReality', action: 'Illusory Reality', automation: { type: 'auto_effect' }, payload: { options: ['Real Color', 'Real Sound'] } },
    { name: 'celestialRevelation', action: 'Celestial Revelation', automation: { type: 'auto_effect' }, payload: { options: ['Healing Hands'] } },
    { name: 'elfishLineage', action: 'Elfish Lineage', automation: { type: 'auto_effect' }, payload: { options: ['Fey Ancestry'] } },
    { name: 'gnomishLineage', action: 'Gnomish Lineage', automation: { type: 'auto_effect' }, payload: { options: ['Magic Resistance'] } },
    { name: 'fiendishLegacy', action: 'Fiendish Legacy', automation: { type: 'auto_effect' }, payload: { options: ['Darkvision'] } },
    { name: 'giantAncestry', action: 'Giant Ancestry', automation: { type: 'auto_effect' }, payload: { options: ['Powerful Build'] } },
    { name: 'eyebiteEffect', action: 'Eyebite', automation: { type: 'auto_effect' }, payload: { options: ['Sapped', 'Paralyzed', 'Horrified'] } },
    { name: 'breathWeaponShape', action: 'Breath Weapon', automation: { type: 'auto_effect' }, payload: { options: ['Cone', 'Line'] } },
    { name: 'hypnoticPatternShake', action: 'Hypnotic Pattern', automation: { type: 'auto_effect' }, payload: { affected: ['Goblin 1', 'Goblin 2'] } },
    { name: 'saveAttackHeal', action: 'Save Attack Heal', automation: { type: 'auto_effect' }, payload: { amount: 10 } },
    { name: 'divineSpark', action: 'Divine Spark', automation: { type: 'auto_effect' }, payload: { options: ['Radiant', 'Force'] } },
    { name: 'healingIllusion', action: 'Healing Illusion', automation: { type: 'auto_effect' }, payload: { amount: 5 } },
    { name: 'openHandTechnique', action: 'Open Hand Technique', automation: { type: 'auto_effect' }, payload: { options: ['Push', 'Grapple'] } },
    { name: 'setCondition', action: 'Set Condition', automation: { type: 'auto_effect' }, payload: { condition: 'Bleeding' } },
    { name: 'arcaneWardRestore', action: 'Arcane Ward', automation: { type: 'auto_effect' }, payload: { wardAmount: 12 } },
  ];

  modalTests.forEach(({ name, action, automation, payload }) => {
    it(`dispatches modal "${name}" when executeHandler returns it`, async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'modal', modalName: name, payload });

      const stats = createStats({ actions: [{ name: action, description: 'Test.', automation }] });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(new RegExp(action + ':'));
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => { expect(executeHandler).toHaveBeenCalled(); });
    });
  });
});
