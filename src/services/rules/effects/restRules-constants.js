import { getLevelAfterLongRest } from '../../combat/conditions/exhaustionRules.js'

export function getHitDieSize(playerStats) {
  const hitDieStr = playerStats?.class?.hit_point_die || playerStats?.class?.hit_die;

  if (hitDieStr != null) {
    const die = parseInt(String(hitDieStr).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(die)) return die;
   }

  return 8;
}

const SHORT_REST_RESOURCE_LABELS = [
    { key: 'channelDivinityCharges', label: 'Channel Divinity', classes: ['Cleric', 'Paladin'] },
    { key: 'wildShapeUses', label: 'Wild Shape', classes: ['Druid'] },
    { key: 'secondWindUses', label: 'Second Wind', classes: ['Fighter'] },
    { key: 'actionSurgeUses', label: 'Action Surge', classes: ['Fighter'] },
    { key: 'focusPoints', label: 'Focus Points', classes: ['Monk'] },
    { key: 'psionicEnergy', label: 'Psionic Energy', classes: ['Fighter'], subclasses: ['Psi Warrior'] },
    { key: 'psionicEnergy', label: 'Psionic Energy', classes: ['Rogue'], subclasses: ['Soulknife'] },
    { key: 'telekineticThrustUses', label: 'Telekinetic Thrust', classes: ['Fighter'], subclasses: ['Psi Warrior'] },
    { key: 'superiorityDice', label: 'Superiority Dice', classes: ['Fighter'], subclasses: ['Battle Master'], styles: ['Superior Technique'] },
    { key: 'naturalRecoverySlots', label: 'Natural Recovery (Spell Slots)', classes: ['Druid'], subclasses: ['Circle of the Land'] },
    { key: 'arcaneRecoveryLevels', label: 'Arcane Recovery (Spell Slots)', classes: ['Wizard'] }
];

export function getShortRestResourceLabels(playerStats) {
    const className = playerStats?.class?.name;
    const subclassName = playerStats?.class?.subclass?.name || playerStats?.class?.major?.name;
    const fightingStyles = playerStats?.class?.fightingStyles || [];

    return SHORT_REST_RESOURCE_LABELS.filter(entry => {
        if (!entry.classes.includes(className)) return false;
        // FS-010: a subclass-gated label also passes for holders of a
        // matching fighting style (Superior Technique grants Superiority Dice).
        if (entry.subclasses && !entry.subclasses.includes(subclassName)) {
            if (!entry.styles || !entry.styles.some(s => fightingStyles.includes(s))) return false;
        }
        return true;
       }).map(entry => entry.label);
}

export function computeHitDieRecovery(rollValue, conBonus) {
  return Math.max(1, rollValue + conBonus)
}

export function computeShortRestHpNewCurrent(currentHp, maxHp, recoveredAmount) {
  const base = currentHp != null && currentHp !== '' ? Number(currentHp) : maxHp
  return Math.min(maxHp, base + (recoveredAmount || 0))
}

// SHORT REST RESET: For once-per-turn trackers that reset on short rest, add the key
// to SHORT_REST_RESOURCES array below. The applyShortRest function sets all keys in
// this array to null via setRuntimeBatch. Use the _<Name>_usedRound key pattern.
//
// LONG REST RESET: For once-per-turn trackers that reset on long rest, add the key
// to LONG_REST_RESOURCES array below. The applyLongRest function sets all keys in
// this array to null via setRuntimeBatch. Use the _<Name>_usedRound key pattern.
//
// INITIATIVE RESET: For once-per-turn trackers that reset when the character rolls
// initiative, add setRuntimeValue(playerStats.name, '_TrackerName_usedRound', null, campaignName)
// inside useInitiativeEffects.js handleInitiativeRolled handler.

export const SHORT_REST_RESOURCES = [
  'channelDivinityCharges',
  'wildShapeUses',
  'psionicEnergy',
  // CLA-355: Telekinetic Thrust re-arms on a Short or Long Rest (app-data truth)
  'telekineticThrustUses',
  'focusPoints',
  'superiorityDice',
  'kiPoints',
  'actionsurgeUses',
  'actionSurgeUses',
  'actionSurgeUsedThisRound',
  'adrenalineRushUses',
  '_celestialRevelationUses',
  '_War_Gods_Blessing_active',
   'spellthiefUses',
   'strokeOfLuckUsed',
   'boonOfCombatProwessUsed',
    'encouragingsongUses',
     'piercerPunctureUsedThisTurn',
     'poisonedWeaponsActive',
       '_Savage_Attacker_usedRound',
       '_Shield_Bash_usedRound',
        '_Hamstring_usedRound',
        '_friendsCastTargets',
   'illusorySelfUses',
   'relentlessrageUses'
 ]

export function getShortRestResources() {
  return [...SHORT_REST_RESOURCES]
}

export const LONG_REST_RESOURCES = [
  'healinghandsUses',
  'ragePoints',
  'bardicInspirationUses',
  'channelDivinityCharges',
  'wildShapeUses',
  'secondWindUses',
  'psionicEnergy',
  'focusPoints',
  'uncannymetabolismUses',
  'sorceryPoints',
  'arcaneRecoveryLevels',
  'superiorityDice',
  'kiPoints',
  'actionSurgeUses',
  'actionSurgeUsedThisRound',
  // CLA-360: Thief's Reflexes extra_action recharges on a long rest (null = re-armed).
  "thief'sreflexesUses",
  'layOnHandsPool',
  'preserveLifePool',
  'gloriousDefenseUses',
   'warlockPactMagic',
  'luckyPoints',
  'adrenalineRushUses',
  '_celestialRevelationUses',
  '_War_Gods_Blessing_active',
  'spellthiefUses',
   'strokeOfLuckUsed',
   'boonOfCombatProwessUsed',
   'encouragingsongUses',
    '_Charge_Attack_usedRound',
   '_FastHands_usedRound',
   'clockworkCavalcadeUses',
   '_CunningAction_usedRound',
   '_Cleave_UsedRound',
   '_Nick_UsedRound',
   'surgeUsedRound',
   'illusoryRealityUsedRound',
   'portentUsedThisTurn',
   'psionicStrikeUsedThisTurn',
     '_BrutalStrike_usedRound',
      '_fortifiedHealth_usedRound',
      '_Shield_Bash_usedRound',
       '_Hamstring_usedRound',
       'piercerPunctureUsedThisTurn',
     '_Savage_Attacker_usedRound',
     '_friendsCastTargets',
    'secondWindUses',
  'psionicEnergy',
  'focusPoints',
  'psychicWhispersFreeUsed',
  'uncannymetabolismUses',
  'sorceryPoints',
  'arcaneRecoveryLevels',
  'superiorityDice',
  'kiPoints',
  'actionSurgeUses',
  'actionSurgeUsedThisRound',
   'layOnHandsPool',
   'preserveLifePool',
   'gloriousDefenseUses',
   'warlockPactMagic',
  'innateSorceryUses',
  'psychicveilUses',
  'sorcerousRestorationUses',
  'zealousPresenceUses',
  'intimidatingPresenceUses',
  'rageOfTheGodsUses',
  'divineInterventionUses',
  'wholenessofbodyUses',
  'wildResurgenceReversedThisRest',
  'indomitableUses',
  'warriorofthegodsPool',
  'naturalRecoveryFreeCast',
  'naturalRecoveryFreeCastUsed',
  'naturalRecoverySlots',
  'wardingflareUses',
  '_Star_Map_freeCastCount',
  '_Dragon_Companion_freeCastCount',
  '_Contact_Patron_freeCastCount',
  'mysticArcanumLevel6',
  'mysticArcanumLevel7',
  'mysticArcanumLevel8',
  'mysticArcanumLevel9',
  '_Phantasmal_Creatures_freeCastCount',
   '_Fey_Reinforcements_freeCastCount',
    '_Misty_Wanderer_freeCastCount',
    "_Paladin's_Smite_freeCastCount",
       'breathweaponUses',
  'stonecunningUses',
  'naturesVeilUses',
  'favoredEnemyUses',
   'tirelessUses',
   'moonlightStepUses',
   'dreadambushUses',
   'cosmicomenUses',
      'relentlessrageUses',
      'persistentRageUsed',
       'aspectOfTheWildsUsedThisRest',
       'aspectOfTheWildsOption',
    'elderChampionRestUsed',
    'avengingAngelRestUsed',
  'warpingimplosionUses',
  'restorebalanceUses',
  'restoreBalanceArmed',
  'tranceOfOrderUses',
  'tamedSurgeUses',
    'featsOfChaosUses',
    'featsOfChaosActive',
    'magicalCunningUsed',
     '_Steps_of_the_Fey_freeCastCount',
     '_Detect_Thoughts_freeCastCount',
     'beguilingDefensesUses',
     'illusorySelfUses',
     'healinglightPool',
     'searingvengeanceUses',
    'darkOnesLuckUses',
    '_fiendishResilienceUsed',
    'boonOfCombatProwessUsed',
    'strokeOfLuckUsed',
   '_boonOfEnergyResistanceUsedThisRest',
   '_Energy_Resistances_chosenTypes',
   '_guardedMind_usedRest',
   'poisonedWeaponsActive',
   '_RendMind_Used',
   // CLA-355: Telekinetic Thrust re-arms on a Long Rest (null = re-armed)
   'telekineticThrustUses'
]

export function getLongRestResources() {
  return [...LONG_REST_RESOURCES]
}

export function spellSlotLevels() {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9]
}

export { getLevelAfterLongRest }
