import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { saveModifierApplies, applySaveModifiers } from './conditionEffectsInternal.js';

const CONDITIONS_THAT_CANNOT_ACT = new Set([
   'incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious',
 ])

const CONDITIONS_THAT_SPEED_ZERO = new Set([
    'grappled', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious', 'speed_zero', 'forcecaged', 'mazed',
])

// !!! ADDING A NEW TARGET EFFECT? !!!
// First check if it exists in src/services/combat/conditions/targetEffectDefinitions.js
// Every new te.effect value MUST be added there with label/description/group/icon.
// The GM UI depends on this registry to display manual-add options.

function computeConditionEffects(conditions = [], saveModifiers = [], targetEffects = [], isRaging = false, shapeShiftActive = false, isPeerlessAthlete = false, isLargeFormActive = false, combatContext = null, seeInvisibilityActive = false, attackerName = null, isLivingLegendActive = false, isElderChampionActive = false, isElderChampionAttackerActive = false, holyAuraTargets = [], isProtectionFromPoisonActive = false, isTranceOfOrderActive = false, hasPowerfulBuild = false, attackerSenses = null) {
  const effects = {
    attackAdvantageCount: 0,
    attackAdvantageReasons: [],
    attackDisadvantageCount: 0,
    abilityCheckDisadvantage: false,
    abilityCheckAdvantageAbilities: null,
    abilityCheckDisadvantageAbilities: null,
    abilityCheckAdvantage: false,
    abilityCheckAdvantageReasons: [],
    abilityCheckAdvantageSkill: null,
    autoFailSaves: [],
    saveDisadvantage: [],
    cannotAct: false,
    cannotActReason: null,
    speedZero: false,
    speedReduction: 0,
    concentrationBroken: false,
    targetAdvantageCount: 0,
    targetAdvantageReasons: [],
    targetDisadvantageCount: 0,
    targetAdvantageIfWithin5ft: false,
    targetDisadvantageIfBeyond5ft: false,
    autoCritWithin5ft: false,
    resistantToAll: false,
    poisonImmune: false,
    saveAdvantage: [],
    saveAdvantageCount: 0,
    saveAdvantageReasons: [],
    saveDisadvantageCount: 0,
    saveDisadvantageAbilities: null,
    autoReroll: false,
    autoRerollForSaves: false,
    autoRerollForChecks: false,
    autoRerollForAttack: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    strSaveReplace: false,
    strCheckReplace: false,
    wisCheckReplace: false,
    reliableTalent: false,
    tacticalMind: false,
    tacticalMindBonus: null,
    strokeOfLuck: false,
    bardicInspiration: false,
    luckyAdvantage: false,
    luckyDisadvantage: false,
    modifyD20Roll: false,
    modifyD20RollDice: null,
    modifyD20RollCanBeBonusOrPenalty: false,
    dexJump: false,
    restoreBalance: false,
    d20Floor10: false,
    noAdvantageAgainst: false,
    darkOnesLuck: false,
    portent: false,
    potentCantrip: false,
    soulstitchSpells: false,
    passWithoutTraceBonus: null,
    improvedIllusions: false,
    illusoryReality: false,
    riderSaveDisadvantage: false,
    riderAttackBonus: 0,
    riderDamageExpression: null,
    riderDamageType: '',
    damageDoubled: false,
    riderCannotOpportunityAttack: false,
    riderNoReactions: false,
    pushEffect: false,
    pushDistance: null,
    saveType: null,
    saveDc: null,
    saveAbility: null,
     conditionToApply: null,
     conditionDuration: null,
     hexSaveDisadvantage: false,
     hexSaveDisadvantageAbility: null,
     strCheckDisadvantage: false,
     strCheckAdvantage: false,
     acPenalty: 0,
    rayOfEnfeebleDamageReduction: false,
    resistanceDamageReduction: false,
    seeInvisibilityActive: false,
    wardingBondAcBonus: 0,
    cleaveAttack: false,
    vexAdvantageTargets: null,
    nickExtraAttack: false,
    toppleEffect: false,
    toppleSaveType: null,
    toppleSaveDc: null,
    toppleSaveAbility: null,
    saveBonusExpression: null,
   }

  const conditionSet = new Set(conditions)

  for (const mod of saveModifiers) {
    if (mod.target !== 'saving_throw' && mod.target !== 'save' && mod.target !== 'concentration_saving_throws' && mod.target !== 'death_saving_throws') continue;
    if (mod.condition === 'charmed' && conditionSet.has('charmed')) {
      if (mod.effect === 'advantage') effects.saveAdvantage.push('charmed');
      if (mod.effect === 'disadvantage') effects.saveDisadvantage.push('charmed');
       } else if (mod.condition === 'frightened' && conditionSet.has('frightened')) {
      if (mod.effect === 'advantage') effects.saveAdvantage.push('frightened');
      if (mod.effect === 'disadvantage') effects.saveDisadvantage.push('frightened');
       } else if (mod.condition === 'poison' && conditionSet.has('poisoned')) {
        if (mod.effect === 'advantage') effects.saveAdvantage.push('poisoned');
        if (mod.effect === 'disadvantage') effects.saveDisadvantage.push('poisoned');
        } else if (mod.condition === 'magic' && mod.abilities && mod.abilities.length > 0) {
        // Track per-ability advantage for traits like Gnomish Cunning
        if (mod.effect === 'advantage') effects.saveAdvantageAbilities = [...(effects.saveAdvantageAbilities || []), ...mod.abilities];
        if (mod.effect === 'disadvantage') effects.saveDisadvantageAbilities = [...(effects.saveDisadvantageAbilities || []), ...mod.abilities];
        } else if (mod.condition === 'against_spell') {
        if (mod.effect === 'advantage') effects.saveAdvantage.push('against_spell');
        if (mod.effect === 'disadvantage') effects.saveDisadvantage.push('against_spell');
        } else if (mod.condition === 'visible_effect' && [...CONDITIONS_THAT_CANNOT_ACT].some(c => conditionSet.has(c))) {
        continue; // Danger Sense disabled while incapacitated
       }
    }

  // Handle passive_immunity save advantage (e.g., Psychic Defense) — applies regardless of current conditions
  for (const mod of saveModifiers) {
    if (mod.saveType && mod.condition && mod.target === 'saving_throw' && mod.effect === 'advantage' && (!mod.abilities || mod.abilities.length === 0)) {
      if (!effects.saveAdvantage.includes(mod.condition)) {
        effects.saveAdvantage.push(mod.condition);
      }
    }
    if (mod.saveType && mod.condition && mod.target === 'saving_throw' && mod.effect === 'disadvantage' && (!mod.abilities || mod.abilities.length === 0)) {
      if (!effects.saveDisadvantage.includes(mod.condition)) {
        effects.saveDisadvantage.push(mod.condition);
      }
    }
  }

  const isIncapacitated = [...CONDITIONS_THAT_CANNOT_ACT].some(c => conditionSet.has(c));
  const activeSaveModifiers = isIncapacitated
    ? saveModifiers.filter(mod => mod.condition !== 'visible_effect')
    : saveModifiers;
  applySaveModifiers(effects, activeSaveModifiers, null, null, isRaging, shapeShiftActive, isPeerlessAthlete, isLargeFormActive, combatContext, conditions, attackerName, isLivingLegendActive, isElderChampionActive, isElderChampionAttackerActive, holyAuraTargets, isProtectionFromPoisonActive, isTranceOfOrderActive, hasPowerfulBuild);

  // Protection from Poison: Advantage on saving throws to avoid or end the Poisoned condition
  if (isProtectionFromPoisonActive && conditionSet.has('poisoned')) {
    effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1;
    effects.saveAdvantageReasons = [...(effects.saveAdvantageReasons || []), 'Protection from Poison'];
  }

  for (const key of conditionSet) {
    switch (key) {
        case 'blinded':
         effects.attackDisadvantageCount++
         effects.targetAdvantageCount++
         effects.targetAdvantageReasons.push('Blinded')
         break

        case 'charmed':
          effects.attackDisadvantageCount++
          effects.saveDisadvantage.push('dex')
          break

        case 'frightened':
        effects.attackDisadvantageCount++
        effects.abilityCheckDisadvantage = true
        break

       case 'grappled':
        effects.speedZero = true
        effects.attackDisadvantageCount++
        break

       case 'incapacitated':
        effects.cannotAct = true
        effects.concentrationBroken = true
        break

        case 'invisible':
          if (!seeInvisibilityActive) {
            // Faerie Fire prevents benefiting from Invisible — suppress the advantage/disadvantage
            const hasFaerieFire = targetEffects.some(te => te.effect === 'faerie_fire')
            if (!hasFaerieFire) {
              effects.attackAdvantageCount++
              effects.attackAdvantageReasons.push('Invisible')
              effects.targetDisadvantageCount++
            }
          }
          break

        case 'paralyzed':
         effects.cannotAct = true
         effects.speedZero = true
         effects.autoFailSaves.push('str', 'dex')
         effects.targetAdvantageCount++
         effects.targetAdvantageReasons.push('Paralyzed')
         effects.autoCritWithin5ft = true
         break

        case 'petrified':
         effects.cannotAct = true
         effects.speedZero = true
         effects.targetAdvantageCount++
         effects.targetAdvantageReasons.push('Petrified')
         effects.autoFailSaves.push('str', 'dex')
         effects.resistantToAll = true
         effects.poisonImmune = true
         break

       case 'poisoned':
        effects.attackDisadvantageCount++
        effects.abilityCheckDisadvantage = true
        break

       case 'prone':
        effects.attackDisadvantageCount++
        effects.targetAdvantageIfWithin5ft = true
        effects.targetDisadvantageIfBeyond5ft = true
        break

       case 'speed_zero':
        effects.speedZero = true
        break

        case 'restrained':
         effects.speedZero = true
         effects.attackDisadvantageCount++
         effects.targetAdvantageCount++
         effects.targetAdvantageReasons.push('Restrained')
         effects.saveDisadvantage.push('dex')
         break

        case 'stunned':
         effects.cannotAct = true
         effects.speedZero = true
         effects.autoFailSaves.push('str', 'dex')
         effects.targetAdvantageCount++
         effects.targetAdvantageReasons.push('Stunned')
         break

        case 'unconscious':
          effects.cannotAct = true
          effects.speedZero = true
          effects.targetAdvantageCount++
          effects.targetAdvantageReasons.push('Unconscious')
          effects.autoFailSaves.push('str', 'dex')
          effects.autoCritWithin5ft = true
          break

        case 'dazed':
          effects.dazed = true
          effects.targetAdvantageCount++
          effects.targetAdvantageReasons.push('Dazed')
          break

         case 'slow':
           effects.speedHalved = true;
           effects.acPenalty = (effects.acPenalty || 0) + 2;
           effects.slowNoReactions = true;
           effects.slowActionLimit = true;
           effects.slowSingleAttackLimit = true;
           effects.slowSomaticFailure = true;
           // DEX save disadvantage from Slow
           if (!effects.saveDisadvantage.includes('dex')) {
             effects.saveDisadvantage.push('dex');
           }
           break;

          case 'forcecaged':
            // Forcecaged: trapped in cage, can't leave by nonmagical means
            // Speed is 0 (can't move out of cage)
            effects.speedZero = true;
            effects.cannotAct = true;
            effects.concentrationBroken = true;
            break;
          case 'mazed':
            // Mazed: banished to labyrinthine demiplane, can't attack or be attacked
            // Speed is 0, cannot act, concentration broken
            effects.speedZero = true;
            effects.cannotAct = true;
            effects.concentrationBroken = true;
            break;
          }
    }

  // Helper function for blindsight/truesight checks
  function attackerHasBlindsightOrTruesight(senses) {
    if (!senses || !Array.isArray(senses)) return false;
    return senses.some(s => {
      const name = (s.name || s.type || '').toLowerCase();
      return name === 'blindsight' || name === 'truesight';
    });
  }

  for (const te of targetEffects) {
    if (te.effect === 'disadvantage_on_next_save') {
      effects.riderSaveDisadvantage = true;
      effects.saveDisadvantageCount = (effects.saveDisadvantageCount || 0) + 1;
    }
    if (te.effect === 'next_attack_advantage') {
      if (te.vexTarget) {
        effects.vexAdvantageTargets = [...(effects.vexAdvantageTargets || []), te.vexTarget];
      } else {
        effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1;
        effects.attackAdvantageReasons.push(te.source || 'Next Attack Advantage');
      }
    }
    if (te.effect === 'next_attack_bonus') {
      effects.riderAttackBonus = (effects.riderAttackBonus || 0) + (parseInt(te.value, 10) || 5);
    }
    if (te.effect === 'distracting_strike_advantage') {
      effects.targetAdvantageCount = (effects.targetAdvantageCount || 0) + 1;
      effects.targetAdvantageReasons.push(te.source || 'Next Attack Adv vs Target');
    }
    if (te.effect === 'crusher_enhanced_critical') {
      effects.targetAdvantageCount = (effects.targetAdvantageCount || 0) + 1;
      effects.targetAdvantageReasons.push(te.source || 'Attack Adv');
    }
    if (te.effect === 'slasher_enhanced_critical') {
      effects.targetAttackDisadvantageCount = (effects.targetAttackDisadvantageCount || 0) + 1;
    }
    if (te.effect === 'disadvantage_next_attack') {
      effects.attackDisadvantageCount = (effects.attackDisadvantageCount || 0) + 1;
    }
    if (te.effect === 'reckless_attack') {
      effects.targetAdvantageCount = (effects.targetAdvantageCount || 0) + 1;
      effects.targetAdvantageReasons.push('Reckless Attack');
    }
    if (te.effect === 'disadvantage_perception_checks') {
      effects.abilityCheckDisadvantage = true;
    }
    if (te.effect === 'escape_the_horde') {
      effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
    }
    if (te.effect === 'protection') {
      effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
    }
    if (te.effect === 'multiattack_defense') {
      effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
    }
    if (te.effect === 'taunting_step' || te.effect === 'compelled_duel') {
      effects.attacksOtherDisadvantageSource = te.source;
    }
    if (te.noOpportunityAttacks) {
      effects.riderCannotOpportunityAttack = true;
    }
    if (te.effect === 'no_reactions') {
      effects.riderNoReactions = true;
    }

    if (te.effect === 'speed_reduction') {
      effects.speedReduction = (effects.speedReduction || 0) + (te.value || 10);
    }
    if (te.effect === 'push') {
      effects.pushEffect = true;
      if (!effects.pushDistance) {
        effects.pushDistance = te.value || 10;
      }
    }
    if (te.effect === 'damage_bonus') {
      effects.riderAttackBonus = (effects.riderAttackBonus || 0) + (te.value || 0);
      if (te.damageExpression) {
        effects.riderDamageExpression = te.damageExpression;
        effects.riderDamageType = te.damageType || '';
      }
    }
    if (te.effect === 'prone_and_push') {
      effects.pushEffect = true;
      if (!effects.pushDistance) {
        effects.pushDistance = te.value || 10;
      }
      effects.proneEffect = true;
    }
    // Handle Cunning Strike and similar save-based condition effects
    if (te.saveType && te.condition) {
      effects.saveType = te.saveType;
      effects.saveDc = te.saveDc;
      effects.saveAbility = te.saveAbility;
      effects.conditionToApply = te.condition;
      effects.conditionDuration = te.duration || 'until_start_of_next_turn';
    }
    // Handle mass_fear effect
    if (te.effect === 'mass_fear') {
      effects.saveType = te.saveType || 'WIS';
      effects.saveDc = te.saveDc;
      effects.saveAbility = te.saveAbility;
      effects.conditionToApply = te.condition || 'frightened';
      effects.conditionDuration = te.duration || 'until_start_of_next_turn';
      effects.massFearRange = te.range || '10_ft';
    }
    // Handle Death Strike — doubles damage on failed CON save
    if (te.effect === 'death_strike') {
      effects.saveType = te.saveType || 'CON';
      effects.saveDc = te.saveDc;
      effects.saveAbility = te.saveAbility;
      effects.damageDoubled = !!te.damageDoubled;
    }
    // Handle direct condition application (no save required, e.g., Withdraw noOAs)
    if (te.effect === 'no_opportunity_attacks' && !te.saveType) {
      effects.riderCannotOpportunityAttack = true;
    }
    // Handle Banishment — incapacitated condition with concentration
    if (te.effect === 'banishment') {
      // Banishment grants Incapacitated (handled by condition switch) and tracks the effect
      // The permanent banishment flag is stored but doesn't change combat mechanics
    }
    // Handle Forcecage — tracks trapped creature for escape CHA save
    if (te.effect === 'forcecage') {
      // Forcecage prevents nonmagical escape and requires CHA save for teleportation
      // The DC is stored in te.dc for escape checks
      // No direct combat stat modification — the effect is tracked for escape attempts
    }
    // Handle Prismatic Spray Indigo — Restrained with recurring CON saves (tracked via initiative component)
    if (te.effect === 'prismatic_spray_indigo') {
      // The Restrained condition is already applied; this tracks the effect for cleanup
      // Recurring CON saves are handled by the initiative component
    }
    // Handle Prismatic Spray Violet — Blinded with WIS save at caster's next turn (tracked via initiative component)
    if (te.effect === 'prismatic_spray_violet') {
      // The Blinded condition is already applied; this tracks the effect for cleanup
      // WIS save for banishment is handled by the initiative component
    }
    // Handle Hurl Through Hell — incapacitated condition with save
    if (te.effect === 'incapacitated' && te.saveType) {
      effects.saveType = te.saveType;
      effects.saveDc = te.saveDc;
      effects.saveAbility = te.saveAbility;
      effects.conditionToApply = 'incapacitated';
      effects.conditionDuration = te.duration || 'until_end_of_next_turn';
      effects.hurlThroughHell = true;
    }
    // Handle Clairvoyant Combatant — target has Disadvantage on attacks against you, you have Advantage on attacks against target
    if (te.effect === 'clairvoyant_combatant') {
      if (te.attackerAdvantage) {
        effects.targetAdvantageCount = (effects.targetAdvantageCount || 0) + 1;
        effects.targetAdvantageReasons.push('Clairvoyant Combatant');
      }
      if (te.defenderDisadvantage) {
        effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
      }
    }
    // Handle Foresight — the target has Advantage on D20 Tests, and other creatures have Disadvantage on attack rolls against it (unless attacker has Blindsight or Truesight)
    if (te.effect === 'foresight') {
      effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1;
      effects.attackAdvantageReasons.push('Foresight');
      effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1;
      effects.saveAdvantageReasons.push('Foresight');
      effects.abilityCheckAdvantage = true;
      effects.abilityCheckAdvantageReasons = ['Foresight'];
      if (!attackerHasBlindsightOrTruesight(attackerSenses)) {
        effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
      }
    }
    // Handle Blur — creatures have Disadvantage on attack rolls against the target (unless attacker has Blindsight or Truesight)
    if (te.effect === 'blur') {
      if (!attackerHasBlindsightOrTruesight(attackerSenses)) {
        effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
      }
    }
    // Handle Faerie Fire — attack rolls against affected creature have Advantage if attacker can see it, and creature can't benefit from Invisible
    if (te.effect === 'faerie_fire') {
      effects.targetAdvantageCount = (effects.targetAdvantageCount || 0) + 1;
      if (!effects.targetAdvantageReasons) {
        effects.targetAdvantageReasons = [];
      }
      if (te.source && !effects.targetAdvantageReasons.includes(te.source)) {
        effects.targetAdvantageReasons.push(te.source);
      }
      // Prevent benefiting from Invisible — suppress invisible's attackAdvantage when faerie_fire is active
      effects.noAdvantageAgainstInvisible = true;
    }
    // Handle Hex — target has Disadvantage on ability checks of chosen ability
    if (te.effect === 'hex_ability_check_disadvantage') {
      if (!effects.abilityCheckDisadvantageAbilities) {
        effects.abilityCheckDisadvantageAbilities = [];
      }
      if (te.ability && !effects.abilityCheckDisadvantageAbilities.includes(te.ability)) {
        effects.abilityCheckDisadvantageAbilities.push(te.ability);
      }
    }
    // Handle Enhance Ability — target has Advantage on ability checks of chosen ability
    if (te.effect === 'enhance_ability') {
      if (!effects.abilityCheckAdvantageAbilities) {
        effects.abilityCheckAdvantageAbilities = [];
      }
      if (te.ability) {
        const ability = String(te.ability).toUpperCase();
        if (!effects.abilityCheckAdvantageAbilities.includes(ability)) {
          effects.abilityCheckAdvantageAbilities.push(ability);
        }
      }
    }
    // Handle Adv Check (advantage_abilities) — target has Advantage on all ability checks
    if (te.effect === 'advantage_abilities') {
      effects.abilityCheckAdvantage = true;
      if (!effects.abilityCheckAdvantageReasons) {
        effects.abilityCheckAdvantageReasons = [];
      }
      if (te.source && !effects.abilityCheckAdvantageReasons.includes(te.source)) {
        effects.abilityCheckAdvantageReasons.push(te.source);
      }
    }
    // Handle Adv (advantage_attacks) — target has Advantage on attack rolls
    if (te.effect === 'advantage_attacks') {
      effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1;
      if (!effects.attackAdvantageReasons) {
        effects.attackAdvantageReasons = [];
      }
      if (te.source && !effects.attackAdvantageReasons.includes(te.source)) {
        effects.attackAdvantageReasons.push(te.source);
      }
    }
    // Handle Adv Save (advantage_saves) — target has Advantage on saving throws
    if (te.effect === 'advantage_saves') {
      effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1;
      if (!effects.saveAdvantageReasons) {
        effects.saveAdvantageReasons = [];
      }
      if (te.source && !effects.saveAdvantageReasons.includes(te.source)) {
        effects.saveAdvantageReasons.push(te.source);
      }
    }
    // Handle Eldritch Hex — target has Disadvantage on saves of chosen ability
    if (te.effect === 'hex_save_disadvantage') {
      if (!effects.saveDisadvantage.includes(te.ability?.toLowerCase())) {
        effects.saveDisadvantage.push(te.ability?.toLowerCase());
      }
      effects.saveDisadvantageCount = (effects.saveDisadvantageCount || 0) + 1;
    }
    // Handle Ray of Enfeeblement debuff — STR check disadvantage + damage reduction
    if (te.effect === 'ray_of_enfeeble_debuff') {
      if (te.strCheckDisadvantage) effects.strCheckDisadvantage = true;
      if (te.rayOfEnfeebleDamageReduction) effects.rayOfEnfeebleDamageReduction = true;
    }
    // Handle Resistance — reduce damage of chosen type by 1d4 (once per turn)
    if (te.effect === 'resistance_damage_reduction') {
      effects.resistanceDamageReduction = true;
    }
    // Handle Cleave — extra melee attack against second creature within 5 ft
    if (te.effect === 'cleave') {
      effects.cleaveAttack = true;
      effects.cleaveTarget = te.target;
      effects.cleaveSource = te.source;
    }
    // Handle Nick — extra attack as part of Attack action (Light weapon)
    if (te.effect === 'nick') {
      effects.nickExtraAttack = true;
      effects.nickTarget = te.target;
      effects.nickSource = te.source;
    }
    // Handle Topple — CON save, Prone condition on failure
    if (te.effect === 'topple') {
      effects.toppleEffect = true;
      effects.saveType = te.saveType || 'CON';
      effects.saveDc = te.saveDc || 'ability';
      effects.saveAbility = te.saveAbility || 'CON';
      effects.conditionToApply = 'prone';
      effects.conditionDuration = te.duration || 'until_start_of_next_turn';
    }
    // Handle Slow — AC penalty and DEX save disadvantage
    if (te.effect === 'ac_penalty') {
      effects.acPenalty = (effects.acPenalty || 0) + (te.value || 2);
    }
    if (te.effect === 'dodge') {
      effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
      if (!effects.saveAdvantage.includes('dex')) {
        effects.saveAdvantage.push('dex');
      }
    }
    if (te.effect === 'bane_penalty') {
      effects.banePenalty = true;
    }
    if (te.effect === 'bless_bonus') {
      effects.blessBonus = true;
    }
    if (te.effect === 'beacon_of_hope') {
      effects.beaconOfHope = true;
      effects.saveAdvantageAbilities = [...new Set([...(effects.saveAdvantageAbilities || []), 'WIS'])];
      effects.saveAdvantageReasons.push('Beacon of Hope');
    }
    if (te.effect === 'holy_aura') {
      effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
      effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1;
      if (!effects.saveAdvantageReasons) {
        effects.saveAdvantageReasons = [];
      }
      if (te.source && !effects.saveAdvantageReasons.includes(te.source)) {
        effects.saveAdvantageReasons.push(te.source);
      }
      effects.saveAdvantageReasons.push('Holy Aura');
    }
    if (te.effect === 'circle_of_power') {
      effects.saveAdvantage.push('against_spell');
      effects.saveAdvantageReasons.push('Circle of Power');
    }
    if (te.effect === 'pass_without_trace_bonus') {
      effects.passWithoutTraceBonus = te.bonusExpression || '10';
    }
    if (te.effect === 'dex_save_disadvantage') {
      effects.slowDexSaveDisadvantage = true;
      if (!effects.saveDisadvantage.includes('dex')) {
        effects.saveDisadvantage.push('dex');
      }
    }
    // Handle Heroism — Advantage on Wisdom saving throws
    if (te.effect === 'wisdom_save_advantage') {
      effects.saveAdvantageAbilities = [...(effects.saveAdvantageAbilities || []), 'WIS'];
      effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1;
      effects.saveAdvantageReasons = [...(effects.saveAdvantageReasons || []), te.source || 'Heroism'];
    }
  }

  return effects
}

function getNetAttackMode(attackAdvantageCount, attackDisadvantageCount, restoreBalance) {
  if (restoreBalance) {
    if (attackAdvantageCount > 0) attackAdvantageCount--
    if (attackDisadvantageCount > 0) attackDisadvantageCount--
  }
  if (attackAdvantageCount > attackDisadvantageCount) return 'advantage'
  if (attackDisadvantageCount > attackAdvantageCount) return 'disadvantage'
  return 'normal'
}

function combineAttackModes(attackerEffects, targetEffects, attackRange, targetName = null) {
  let adv = attackerEffects.attackAdvantageCount + targetEffects.targetAdvantageCount
  let dis = attackerEffects.attackDisadvantageCount + (attackerEffects.targetAttackDisadvantageCount || 0) + targetEffects.targetDisadvantageCount

  if (attackerEffects.vexAdvantageTargets && targetName && attackerEffects.vexAdvantageTargets.includes(targetName)) {
    adv++
  }
  if (targetEffects.targetAdvantageIfWithin5ft && attackRange <= 5) adv++
  if (targetEffects.targetDisadvantageIfBeyond5ft && attackRange > 5) dis++

  if (attackerEffects.attacksOtherDisadvantageSource && targetName && targetName !== attackerEffects.attacksOtherDisadvantageSource) {
    dis++
  }

  if (targetEffects.noAdvantageAgainst) {
    adv = 0
  }

  return getNetAttackMode(adv, dis, attackerEffects.restoreBalance || targetEffects.restoreBalance)
}

function hasSaveAdvantage(effects, saveType, restoreBalance) {
  if (!effects) return false;
  if (effects.saveAdvantage?.includes('against_spell')) {
    if (restoreBalance) return false;
    return true;
  }
  if (restoreBalance) {
    const effectiveAdvCount = Math.max(0, (effects.saveAdvantageCount || 0) - 1);
    if (effectiveAdvCount > 0) return true;
    return false;
  }
  if ((effects.saveAdvantageCount || 0) > 0) return true;
  if (saveType && effects.saveAdvantage?.includes(saveType)) return true;
  if (saveType && effects.saveAdvantageAbilities?.length) {
    const abbr = saveType.substring(0, 3).toUpperCase();
    if (effects.saveAdvantageAbilities.includes(abbr)) return true;
  }
  return false;
}

export function hasSaveModifier(modifiers, target, abilityName) {
  if (!modifiers || modifiers.length === 0) return false;
  return modifiers.some(mod => {
    if (mod.target !== target) return false;
    if (mod.effect !== 'advantage') return false;
    if (mod.abilities && mod.abilities.length > 0) {
      if (!abilityName) return false;
      return mod.abilities.includes(abilityName);
    }
    return true;
  });
}

export function hasBeaconOfHope(targetName, campaignName) {
  if (!targetName) return false;
  const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
  return effects.some(te => te.effect === 'beacon_of_hope' && te.target === targetName);
}

export {
  computeConditionEffects,
  getNetAttackMode,
  combineAttackModes,
  CONDITIONS_THAT_CANNOT_ACT,
  CONDITIONS_THAT_SPEED_ZERO,
  applySaveModifiers,
  saveModifierApplies,
  hasSaveAdvantage,
}
