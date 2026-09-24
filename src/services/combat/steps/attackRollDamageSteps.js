import { buildHousekeepingStep } from './attackRollHousekeeping.js';
import { buildAttackRiderManeuversStep, buildCunningStrikeStep, buildChargerStep, buildBardicInspirationOffenseStep } from './attackRollRiders.js';
import { buildRollBaseDamageStep, buildBuildContextStep, buildSneakAttackStep, buildTwoWeaponFightingStep, buildTargetEffectsStep, buildSuperiorityDieBonusesStep } from './attackRollDamageCalc.js';
import { buildAutomationBonusesStep, buildWeaponHitBonusesStep, buildNatural20BonusesStep, buildCelestialRevelationStep } from './attackRollBonuses.js';
import { buildFeatureRidersStep, buildDamageTypeModifiersStep, buildOverchannelStep, buildProceedToDamageStep, buildStalkersFlurryPostDamageStep, buildCleaveMasteryStep, buildTacticalMasterStep, buildToppleMasteryStep, buildMasteryDoneStep } from './attackRollPostDamage.js';

export function buildAttackRollDamageSteps() {
  return [
    buildHousekeepingStep(),
    buildAttackRiderManeuversStep(),
    buildCunningStrikeStep(),
    buildChargerStep(),
    buildBardicInspirationOffenseStep(),
    buildRollBaseDamageStep(),
    buildBuildContextStep(),
    buildSneakAttackStep(),
    buildTwoWeaponFightingStep(),
    buildTargetEffectsStep(),
    buildSuperiorityDieBonusesStep(),
    buildAutomationBonusesStep(),
    buildWeaponHitBonusesStep(),
    buildNatural20BonusesStep(),
    buildCelestialRevelationStep(),
    buildFeatureRidersStep(),
    buildDamageTypeModifiersStep(),
    buildOverchannelStep(),
    buildProceedToDamageStep(),
    buildStalkersFlurryPostDamageStep(),
    buildCleaveMasteryStep(),
    buildTacticalMasterStep(),
    buildToppleMasteryStep(),
    buildMasteryDoneStep(),
  ];
}
