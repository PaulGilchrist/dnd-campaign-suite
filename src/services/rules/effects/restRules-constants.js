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
  // CLA-382: War Priest recharges on a Short Rest (classes.json 'short_rest').
  // Null = re-arm (handler reads `getRuntimeValue(...) ?? usesMax`).
  'warPriestUses',
  'focusPoints',
  'superiorityDice',
  'kiPoints',
  'actionsurgeUses',
  'actionSurgeUses',
  'actionSurgeUsedThisRound',
  'adrenalineRushUses',
  // CLA-048: Celestial Revelation recharge is 'long_rest' (2024 races.json) —
  // it must NOT re-arm on a Short Rest; LONG_REST_RESOURCES owns the key.
  '_War_Gods_Blessing_active',
   'spellthiefUses',
   'strokeOfLuckUsed',
   '_Boon_of_Combat_Prowess_usedRound',
    'encouragingsongUses',
     'piercerPunctureUsedThisTurn',
     'poisonedWeaponsActive',
       '_Savage_Attacker_usedRound',
       '_Shield_Bash_usedRound',
        '_Hamstring_usedRound',
        '_friendsCastTargets',
   'illusorySelfUses',
   'relentlessrageUses',
   // CLA-140: Fiendish Resilience re-chooses on a Short OR Long Rest (classes.json
   // "when you finish a Short or Long Rest"). Short Rest clears ONLY the re-choose
   // latch; _Fiendish_Resilience_chosenType persists ("until you choose a different one").
   '_fiendishResilienceUsed'
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
   '_Boon_of_Combat_Prowess_usedRound',
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
  // CLA-050: Circle of the Land land choice is re-made after each Long Rest —
  // cleared in the atomic batch so the badge/spell grants drop and the chooser re-prompts.
  '_circleOfTheLandType',
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
    // CLA-138: the arm-time "Skip Concentration" choice is consumed with the free
    // cast; a spent latch and an untouched choice both null re-arm at LR.
    '_Fey_Reinforcements_noConcentration',
     '_Misty_Wanderer_freeCastCount',
     "_Paladin's_Smite_freeCastCount",
    // CLA-130: Faithful Steed (2024 Paladin lv5, classes.json free_spell
    // uses:1 recharge:"long_rest") — the spell row spends
    // `_Faithful_Steed_freeCastCount` to 0 via spellPreparationService.
    // Null re-arm restores the free use (featureFreeCastCount falls back to
    // entry.uses=1, re-arming the "Free Cast" badge). Missing registration
    // killed the free use permanently after one cast (CLA-096/099 family rule:
    // every latch belongs in LONG_REST_RESOURCES or the use dies).
    '_Faithful_Steed_freeCastCount',
    // CLA-130 family safety-net: Favored Enemy's latch also gets the batch
    // null re-arm here (the dedicated resetFlags site in restRules-longRest.js
    // stays authoritative; null+null is idempotent).
    '_Favored_Enemy_freeCastCount',
    // FT-035: Fey Touched feat free-cast latch family, keyed by the FEATURE name
    // ('Fey Magic') by the spellPreparationService writers — the shared latch spent by
    // the chosen-spell cast (adjustRechargeCounter) and the per-spell latch spent by
    // the fixed Misty Step cast (adjustPerSpellCounter). Null re-arm returns BOTH free
    // badges after a Long Rest (the :567 loop re-arms the per-spell key from the
    // automation entry; this registration is the batch safety net). CLA-130 family
    // rule: a latch missing here dies permanently.
    '_Fey_Magic_freeCastCount',
    '_Fey_Magic_Misty_Step_freeCastCount',
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
    '_Boon_of_Combat_Prowess_usedRound',
    'strokeOfLuckUsed',
   '_boonOfEnergyResistanceUsedThisRest',
   '_Energy_Resistances_chosenTypes',
   '_guardedMind_usedRest',
   'poisonedWeaponsActive',
   '_RendMind_Used',
    // CLA-355: Telekinetic Thrust re-arms on a Long Rest (null = re-armed)
    'telekineticThrustUses',
   // CLA-382: War Priest app-data recharges on a Short Rest; the Long Rest null
   // re-arm here is the harmless superset that stops a spent numeric 0 pinning
   // the pool past a long rest via the server override.
   'warPriestUses',
    // CLA-388: a paid-but-unspent Wild Companion Find Familiar grant must not survive a
    // Long Rest ("the familiar disappears when you finish a Long Rest") — null re-arm.
    '_Wild_Companion_freeCast',
     // CLA-064: Countercharm recharge:"long_rest" (classes.json lv7) — numeric uses
     // pool on the bard; null re-arm (handler reads `stored ?? auto.uses`).
     'countercharmUses',
      // CLA-065: Cosmic Omen armed-but-unspent ±1d6 pending bonus expires with the
      // Star Map it came from ("until you finish your next Long Rest") — null clear.
      // The live store lives under the global 'cosmicOmen' characterKey and is also
      // cleared explicitly in resetStarMapOnLongRest; this registration sweeps any
      // legacy per-character copies from before the key unification.
      'cosmicOmenPendingBonus',
      // CLA-096: Draconic Flight once-per-Long-Rest use flag — null re-arm so
      // the trait is available again after a Long Rest even when the 10-minute
      // rounds clock or a retract already dropped the buff (CLA-130 rule: any
      // latch must be in LONG_REST_RESOURCES or the use dies permanently).
      'draconicFlightUsed',
      // CLA-099: Dragon Wings once-per-Long-Rest uses counter + active stamp —
      // null re-arm so the trait is available again after a Long Rest even when
      // the 1-hour rounds clock or a retract already dropped the buff. The
      // handler reads `storedUses ?? auto.uses` (null = full uses).
      'dragonWingsUses',
      'dragonWingsActive',
      // CLA-226: Memorize Spell is once per Short Rest — the swap latch must
      // re-arm after ANY rest (CLA-130 rule: a latch missing from the reset
      // lists dies permanently; the short-rest flag list covers SR, this the LR).
      'memorizeSpellUsedSinceRest',
      // FT-046: Inspiring Leader once-per-rest latch — null re-arm after a
      // Long Rest (CLA-226 twin; short-rest flag list covers SR).
      'inspiringLeaderUsedSinceRest'
    ]

export function getLongRestResources() {
  return [...LONG_REST_RESOURCES]
}

export function spellSlotLevels() {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9]
}

export { getLevelAfterLongRest }
