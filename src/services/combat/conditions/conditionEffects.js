import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { saveModifierApplies, applySaveModifiers } from './conditionEffectsInternal.js';

const CONDITIONS_THAT_CANNOT_ACT = new Set([
   'incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious',
 ])

const CONDITIONS_THAT_SPEED_ZERO = new Set([
    'grappled', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious', 'speed_zero', 'forcecaged', 'mazed',
 ])

const SAVE_MODIFIER_TARGETS = new Set([
  'saving_throw', 'save', 'concentration_saving_throws', 'death_saving_throws',
])

const SAVE_CONDITION_LABELS = {
  charmed: 'charmed',
  frightened: 'frightened',
  poison: 'poisoned',
}

const IMMUNITY_BUCKETS = {
  advantage: 'saveAdvantage',
  disadvantage: 'saveDisadvantage',
}

// !!! ADDING A NEW TARGET EFFECT? !!!
// First check if it exists in src/services/combat/conditions/targetEffectDefinitions.js
// Every new te.effect value MUST be added there with label/description/group/icon.
// The GM UI depends on this registry to display manual-add options.

function buildBaseEffects() {
  return {
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
}

function pushSaveEffectForModifier(effects, mod, label) {
  if (mod.effect === 'advantage') effects.saveAdvantage.push(label);
  if (mod.effect === 'disadvantage') effects.saveDisadvantage.push(label);
}

function applyConditionSaveModifier(effects, mod, conditionSet) {
  const label = SAVE_CONDITION_LABELS[mod.condition]
  if (label) {
    if (conditionSet.has(label)) pushSaveEffectForModifier(effects, mod, label);
    return;
  }
  if (mod.condition === 'magic' && mod.abilities && mod.abilities.length > 0) {
    // Track per-ability advantage for traits like Gnomish Cunning
    if (mod.effect === 'advantage') effects.saveAdvantageAbilities = [...(effects.saveAdvantageAbilities || []), ...mod.abilities];
    if (mod.effect === 'disadvantage') effects.saveDisadvantageAbilities = [...(effects.saveDisadvantageAbilities || []), ...mod.abilities];
    return;
  }
  if (mod.condition === 'against_spell') pushSaveEffectForModifier(effects, mod, 'against_spell');
  // 'visible_effect' modifiers are suppressed here (Danger Sense handled below via activeSaveModifiers)
}

// Handle passive_immunity save advantage (e.g., Psychic Defense) — applies regardless of current conditions
function applyPassiveImmunityModifier(effects, mod) {
  if (!mod.saveType || !mod.condition || mod.target !== 'saving_throw') return;
  if (mod.abilities && mod.abilities.length > 0) return;
  const bucket = IMMUNITY_BUCKETS[mod.effect];
  if (bucket && !effects[bucket].includes(mod.condition)) {
    effects[bucket].push(mod.condition);
  }
}

function applyConditionEffect(effects, condition, ctx) {
  const handler = CONDITION_EFFECT_HANDLERS[condition]
  if (!handler) return
  handler(effects, ctx)
}

const CONDITION_EFFECT_HANDLERS = {
  blinded: (effects) => {
    effects.attackDisadvantageCount++
    effects.targetAdvantageCount++
    effects.targetAdvantageReasons.push('Blinded')
  },
  charmed: (effects) => {
    effects.attackDisadvantageCount++
    effects.saveDisadvantage.push('dex')
  },
  frightened: (effects) => {
    effects.attackDisadvantageCount++
    effects.abilityCheckDisadvantage = true
  },
  grappled: (effects) => {
    effects.speedZero = true
    effects.attackDisadvantageCount++
  },
  incapacitated: (effects) => {
    effects.cannotAct = true
    effects.concentrationBroken = true
  },
  invisible: (effects, ctx) => {
    if (ctx.seeInvisibilityActive || ctx.hasFaerieFire) return
    // Faerie Fire prevents benefiting from Invisible — suppress the advantage/disadvantage
    effects.attackAdvantageCount++
    effects.attackAdvantageReasons.push('Invisible')
    effects.targetDisadvantageCount++
  },
  paralyzed: (effects) => {
    effects.cannotAct = true
    effects.speedZero = true
    effects.autoFailSaves.push('str', 'dex')
    effects.targetAdvantageCount++
    effects.targetAdvantageReasons.push('Paralyzed')
    effects.autoCritWithin5ft = true
  },
  petrified: (effects) => {
    effects.cannotAct = true
    effects.speedZero = true
    effects.targetAdvantageCount++
    effects.targetAdvantageReasons.push('Petrified')
    effects.autoFailSaves.push('str', 'dex')
    effects.resistantToAll = true
    effects.poisonImmune = true
  },
  poisoned: (effects) => {
    effects.attackDisadvantageCount++
    effects.abilityCheckDisadvantage = true
  },
  prone: (effects) => {
    effects.attackDisadvantageCount++
    effects.targetAdvantageIfWithin5ft = true
    effects.targetDisadvantageIfBeyond5ft = true
  },
  speed_zero: (effects) => {
    effects.speedZero = true
  },
  restrained: (effects) => {
    effects.speedZero = true
    effects.attackDisadvantageCount++
    effects.targetAdvantageCount++
    effects.targetAdvantageReasons.push('Restrained')
    effects.saveDisadvantage.push('dex')
  },
  stunned: (effects) => {
    effects.cannotAct = true
    effects.speedZero = true
    effects.autoFailSaves.push('str', 'dex')
    effects.targetAdvantageCount++
    effects.targetAdvantageReasons.push('Stunned')
  },
  unconscious: (effects) => {
    effects.cannotAct = true
    effects.speedZero = true
    effects.targetAdvantageCount++
    effects.targetAdvantageReasons.push('Unconscious')
    effects.autoFailSaves.push('str', 'dex')
    effects.autoCritWithin5ft = true
  },
  dazed: (effects) => {
    effects.dazed = true
    effects.targetAdvantageCount++
    effects.targetAdvantageReasons.push('Dazed')
  },
  slow: (effects) => {
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
  },
  // Forcecaged: trapped in cage, can't leave by nonmagical means — speed 0
  forcecaged: (effects) => {
    effects.speedZero = true;
    effects.cannotAct = true;
    effects.concentrationBroken = true;
  },
  // Mazed: banished to labyrinthine demiplane, can't attack or be attacked
  mazed: (effects) => {
    effects.speedZero = true;
    effects.cannotAct = true;
    effects.concentrationBroken = true;
  },
}

// Helper function for blindsight/truesight checks
function attackerHasBlindsightOrTruesight(senses) {
  if (!senses || !Array.isArray(senses)) return false;
  return senses.some(s => {
    const name = (s.name || s.type || '').toLowerCase();
    return name === 'blindsight' || name === 'truesight';
  });
}

function addUniqueReason(reasons, value) {
  if (value && !reasons.includes(value)) reasons.push(value);
}

function bumpCount(effects, key) {
  effects[key] = (effects[key] || 0) + 1;
}

const EARLY_TARGET_EFFECT_HANDLERS = {
  disadvantage_on_next_save: (effects) => {
    effects.riderSaveDisadvantage = true;
    bumpCount(effects, 'saveDisadvantageCount');
  },
  next_attack_advantage: (effects, te) => {
    if (te.vexTarget) {
      effects.vexAdvantageTargets = [...(effects.vexAdvantageTargets || []), te.vexTarget];
    } else {
      bumpCount(effects, 'attackAdvantageCount');
      effects.attackAdvantageReasons.push(te.source || 'Next Attack Advantage');
    }
  },
  next_attack_bonus: (effects, te) => {
    effects.riderAttackBonus = (effects.riderAttackBonus || 0) + (parseInt(te.value, 10) || 5);
  },
  distracting_strike_advantage: (effects, te) => {
    bumpCount(effects, 'targetAdvantageCount');
    effects.targetAdvantageReasons.push(te.source || 'Next Attack Adv vs Target');
  },
  crusher_enhanced_critical: (effects, te) => {
    bumpCount(effects, 'targetAdvantageCount');
    effects.targetAdvantageReasons.push(te.source || 'Attack Adv');
  },
  slasher_enhanced_critical: (effects) => {
    bumpCount(effects, 'targetAttackDisadvantageCount');
  },
  disadvantage_next_attack: (effects) => {
    bumpCount(effects, 'attackDisadvantageCount');
  },
  reckless_attack: (effects) => {
    bumpCount(effects, 'targetAdvantageCount');
    effects.targetAdvantageReasons.push('Reckless Attack');
  },
  disadvantage_perception_checks: (effects) => {
    effects.abilityCheckDisadvantage = true;
  },
  escape_the_horde: (effects) => {
    bumpCount(effects, 'targetDisadvantageCount');
  },
  protection: (effects) => {
    bumpCount(effects, 'targetDisadvantageCount');
  },
  multiattack_defense: (effects) => {
    bumpCount(effects, 'targetDisadvantageCount');
  },
  taunting_step: (effects, te) => {
    effects.attacksOtherDisadvantageSource = te.source;
  },
  compelled_duel: (effects, te) => {
    effects.attacksOtherDisadvantageSource = te.source;
  },
  no_reactions: (effects) => {
    effects.riderNoReactions = true;
  },
  speed_reduction: (effects, te) => {
    effects.speedReduction = (effects.speedReduction || 0) + (te.value || 10);
  },
  push: (effects, te) => {
    effects.pushEffect = true;
    if (!effects.pushDistance) {
      effects.pushDistance = te.value || 10;
    }
  },
  damage_bonus: (effects, te) => {
    effects.riderAttackBonus = (effects.riderAttackBonus || 0) + (te.value || 0);
    if (te.damageExpression) {
      effects.riderDamageExpression = te.damageExpression;
      effects.riderDamageType = te.damageType || '';
    }
  },
  prone_and_push: (effects, te) => {
    effects.pushEffect = true;
    if (!effects.pushDistance) {
      effects.pushDistance = te.value || 10;
    }
    effects.proneEffect = true;
  },
}

const LATE_TARGET_EFFECT_HANDLERS = {
  // Handle mass_fear effect
  mass_fear: (effects, te) => {
    effects.saveType = te.saveType || 'WIS';
    effects.saveDc = te.saveDc;
    effects.saveAbility = te.saveAbility;
    effects.conditionToApply = te.condition || 'frightened';
    effects.conditionDuration = te.duration || 'until_start_of_next_turn';
    effects.massFearRange = te.range || '10_ft';
  },
  // Handle Death Strike — doubles damage on failed CON save
  death_strike: (effects, te) => {
    effects.saveType = te.saveType || 'CON';
    effects.saveDc = te.saveDc;
    effects.saveAbility = te.saveAbility;
    effects.damageDoubled = !!te.damageDoubled;
  },
  // Handle direct condition application (no save required, e.g., Withdraw noOAs)
  no_opportunity_attacks: (effects, te) => {
    if (!te.saveType) effects.riderCannotOpportunityAttack = true;
  },
  // Handle Hurl Through Hell — incapacitated condition with save
  incapacitated: (effects, te) => {
    if (!te.saveType) return;
    effects.saveType = te.saveType;
    effects.saveDc = te.saveDc;
    effects.saveAbility = te.saveAbility;
    effects.conditionToApply = 'incapacitated';
    effects.conditionDuration = te.duration || 'until_end_of_next_turn';
    effects.hurlThroughHell = true;
  },
  // Handle Clairvoyant Combatant — target has Disadvantage on attacks against you, you have Advantage on attacks against target
  clairvoyant_combatant: (effects, te) => {
    if (te.attackerAdvantage) {
      bumpCount(effects, 'targetAdvantageCount');
      effects.targetAdvantageReasons.push('Clairvoyant Combatant');
    }
    if (te.defenderDisadvantage) {
      bumpCount(effects, 'targetDisadvantageCount');
    }
  },
  // Handle Foresight — the target has Advantage on D20 Tests, and other creatures have Disadvantage on attack rolls against it (unless attacker has Blindsight or Truesight)
  foresight: (effects, te, attackerSenses) => {
    bumpCount(effects, 'attackAdvantageCount');
    effects.attackAdvantageReasons.push('Foresight');
    bumpCount(effects, 'saveAdvantageCount');
    effects.saveAdvantageReasons.push('Foresight');
    effects.abilityCheckAdvantage = true;
    effects.abilityCheckAdvantageReasons = ['Foresight'];
    if (!attackerHasBlindsightOrTruesight(attackerSenses)) {
      bumpCount(effects, 'targetDisadvantageCount');
    }
  },
  // Handle Blur — creatures have Disadvantage on attack rolls against the target (unless attacker has Blindsight or Truesight)
  blur: (effects, te, attackerSenses) => {
    if (!attackerHasBlindsightOrTruesight(attackerSenses)) {
      bumpCount(effects, 'targetDisadvantageCount');
    }
  },
  // Handle Faerie Fire — attack rolls against affected creature have Advantage if attacker can see it, and creature can't benefit from Invisible
  faerie_fire: (effects, te) => {
    bumpCount(effects, 'targetAdvantageCount');
    if (!effects.targetAdvantageReasons) {
      effects.targetAdvantageReasons = [];
    }
    addUniqueReason(effects.targetAdvantageReasons, te.source);
    // Prevent benefiting from Invisible — suppress invisible's attackAdvantage when faerie_fire is active
    effects.noAdvantageAgainstInvisible = true;
  },
  // Handle Hex — target has Disadvantage on ability checks of chosen ability
  hex_ability_check_disadvantage: (effects, te) => {
    if (!effects.abilityCheckDisadvantageAbilities) {
      effects.abilityCheckDisadvantageAbilities = [];
    }
    addUniqueReason(effects.abilityCheckDisadvantageAbilities, te.ability);
  },
  // Handle Enhance Ability — target has Advantage on ability checks of chosen ability
  enhance_ability: (effects, te) => {
    if (!effects.abilityCheckAdvantageAbilities) {
      effects.abilityCheckAdvantageAbilities = [];
    }
    if (te.ability) {
      addUniqueReason(effects.abilityCheckAdvantageAbilities, String(te.ability).toUpperCase());
    }
  },
  // Handle Adv Check (advantage_abilities) — target has Advantage on all ability checks
  advantage_abilities: (effects, te) => {
    effects.abilityCheckAdvantage = true;
    if (!effects.abilityCheckAdvantageReasons) {
      effects.abilityCheckAdvantageReasons = [];
    }
    addUniqueReason(effects.abilityCheckAdvantageReasons, te.source);
  },
  // Handle Adv (advantage_attacks) — target has Advantage on attack rolls
  advantage_attacks: (effects, te) => {
    bumpCount(effects, 'attackAdvantageCount');
    if (!effects.attackAdvantageReasons) {
      effects.attackAdvantageReasons = [];
    }
    addUniqueReason(effects.attackAdvantageReasons, te.source);
  },
  // Handle Adv Save (advantage_saves) — target has Advantage on saving throws
  advantage_saves: (effects, te) => {
    bumpCount(effects, 'saveAdvantageCount');
    if (!effects.saveAdvantageReasons) {
      effects.saveAdvantageReasons = [];
    }
    addUniqueReason(effects.saveAdvantageReasons, te.source);
  },
  // Handle Eldritch Hex — target has Disadvantage on saves of chosen ability
  hex_save_disadvantage: (effects, te) => {
    if (!effects.saveDisadvantage.includes(te.ability?.toLowerCase())) {
      effects.saveDisadvantage.push(te.ability?.toLowerCase());
    }
    bumpCount(effects, 'saveDisadvantageCount');
  },
  // Handle Ray of Enfeeblement debuff — STR check disadvantage + damage reduction
  ray_of_enfeeble_debuff: (effects, te) => {
    if (te.strCheckDisadvantage) effects.strCheckDisadvantage = true;
    if (te.rayOfEnfeebleDamageReduction) effects.rayOfEnfeebleDamageReduction = true;
  },
  // Handle Resistance — reduce damage of chosen type by 1d4 (once per turn)
  resistance_damage_reduction: (effects) => {
    effects.resistanceDamageReduction = true;
  },
  // Handle Cleave — extra melee attack against second creature within 5 ft
  cleave: (effects, te) => {
    effects.cleaveAttack = true;
    effects.cleaveTarget = te.target;
    effects.cleaveSource = te.source;
  },
  // Handle Nick — extra attack as part of Attack action (Light weapon)
  nick: (effects, te) => {
    effects.nickExtraAttack = true;
    effects.nickTarget = te.target;
    effects.nickSource = te.source;
  },
  // Handle Topple — CON save, Prone condition on failure
  topple: (effects, te) => {
    effects.toppleEffect = true;
    effects.saveType = te.saveType || 'CON';
    effects.saveDc = te.saveDc || 'ability';
    effects.saveAbility = te.saveAbility || 'CON';
    effects.conditionToApply = 'prone';
    effects.conditionDuration = te.duration || 'until_start_of_next_turn';
  },
  // Handle Slow — AC penalty and DEX save disadvantage
  ac_penalty: (effects, te) => {
    effects.acPenalty = (effects.acPenalty || 0) + (te.value || 2);
  },
  dodge: (effects) => {
    bumpCount(effects, 'targetDisadvantageCount');
    if (!effects.saveAdvantage.includes('dex')) {
      effects.saveAdvantage.push('dex');
    }
  },
  bane_penalty: (effects) => {
    effects.banePenalty = true;
  },
  bless_bonus: (effects) => {
    effects.blessBonus = true;
  },
  beacon_of_hope: (effects) => {
    effects.beaconOfHope = true;
    effects.saveAdvantageAbilities = [...new Set([...(effects.saveAdvantageAbilities || []), 'WIS'])];
    effects.saveAdvantageReasons.push('Beacon of Hope');
  },
  holy_aura: (effects, te) => {
    bumpCount(effects, 'targetDisadvantageCount');
    bumpCount(effects, 'saveAdvantageCount');
    if (!effects.saveAdvantageReasons) {
      effects.saveAdvantageReasons = [];
    }
    addUniqueReason(effects.saveAdvantageReasons, te.source);
    effects.saveAdvantageReasons.push('Holy Aura');
  },
  circle_of_power: (effects) => {
    effects.saveAdvantage.push('against_spell');
    effects.saveAdvantageReasons.push('Circle of Power');
  },
  pass_without_trace_bonus: (effects, te) => {
    effects.passWithoutTraceBonus = te.bonusExpression || '10';
  },
  dex_save_disadvantage: (effects) => {
    effects.slowDexSaveDisadvantage = true;
    if (!effects.saveDisadvantage.includes('dex')) {
      effects.saveDisadvantage.push('dex');
    }
  },
  // Handle Heroism — Advantage on Wisdom saving throws
  wisdom_save_advantage: (effects, te) => {
    effects.saveAdvantageAbilities = [...(effects.saveAdvantageAbilities || []), 'WIS'];
    bumpCount(effects, 'saveAdvantageCount');
    effects.saveAdvantageReasons = [...(effects.saveAdvantageReasons || []), te.source || 'Heroism'];
  },
}

function applyTargetEffect(effects, te, attackerSenses) {
  const early = EARLY_TARGET_EFFECT_HANDLERS[te.effect];
  if (early) early(effects, te);

  if (te.noOpportunityAttacks) {
    effects.riderCannotOpportunityAttack = true;
  }
  // Handle Cunning Strike and similar save-based condition effects
  if (te.saveType && te.condition) {
    effects.saveType = te.saveType;
    effects.saveDc = te.saveDc;
    effects.saveAbility = te.saveAbility;
    effects.conditionToApply = te.condition;
    effects.conditionDuration = te.duration || 'until_start_of_next_turn';
  }

  const late = LATE_TARGET_EFFECT_HANDLERS[te.effect];
  if (late) late(effects, te, attackerSenses);
  // banishment / forcecage / prismatic_spray_indigo / prismatic_spray_violet are
  // tracked for cleanup or escape attempts only — no direct stat modification here.
}

// Protection from Poison: Advantage on saving throws to avoid or end the Poisoned condition
function applyProtectionFromPoisonAdvantage(effects, conditionSet, isProtectionFromPoisonActive) {
  if (!isProtectionFromPoisonActive || !conditionSet.has('poisoned')) return;
  effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1;
  effects.saveAdvantageReasons = [...(effects.saveAdvantageReasons || []), 'Protection from Poison'];
}

function normalizeConditionEffectFlags(options = {}) {
  const {
    isRaging = false,
    shapeShiftActive = false,
    isPeerlessAthlete = false,
    isLargeFormActive = false,
    combatContext = null,
    seeInvisibilityActive = false,
    attackerName = null,
    isLivingLegendActive = false,
    isElderChampionActive = false,
    isElderChampionAttackerActive = false,
    isProtectionFromPoisonActive = false,
    isTranceOfOrderActive = false,
    hasPowerfulBuild = false,
    attackerSenses = null,
  } = options

  return {
    combatContext,
    seeInvisibilityActive,
    attackerName,
    attackerSenses,
    isRaging,
    shapeShiftActive,
    isPeerlessAthlete,
    isLargeFormActive,
    isLivingLegendActive,
    isElderChampionActive,
    isElderChampionAttackerActive,
    isProtectionFromPoisonActive,
    isTranceOfOrderActive,
    hasPowerfulBuild,
  }
}

function normalizeConditionEffectOptions(options = {}) {
  const {
    conditions = [],
    saveModifiers = [],
    targetEffects = [],
    holyAuraTargets = [],
  } = options

  return {
    conditions,
    saveModifiers,
    targetEffects,
    holyAuraTargets,
    ...normalizeConditionEffectFlags(options),
  }
}

function computeConditionEffects(options = {}) {
  const {
    conditions,
    saveModifiers,
    targetEffects,
    isRaging,
    shapeShiftActive,
    isPeerlessAthlete,
    isLargeFormActive,
    combatContext,
    seeInvisibilityActive,
    attackerName,
    isLivingLegendActive,
    isElderChampionActive,
    isElderChampionAttackerActive,
    holyAuraTargets,
    isProtectionFromPoisonActive,
    isTranceOfOrderActive,
    hasPowerfulBuild,
    attackerSenses,
  } = normalizeConditionEffectOptions(options)

  const effects = buildBaseEffects()

  const conditionSet = new Set(conditions)

  for (const mod of saveModifiers) {
    if (SAVE_MODIFIER_TARGETS.has(mod.target)) applyConditionSaveModifier(effects, mod, conditionSet);
  }

  for (const mod of saveModifiers) {
    applyPassiveImmunityModifier(effects, mod);
  }

  const isIncapacitated = [...CONDITIONS_THAT_CANNOT_ACT].some(c => conditionSet.has(c));
  const activeSaveModifiers = isIncapacitated
    ? saveModifiers.filter(mod => mod.condition !== 'visible_effect')
    : saveModifiers;
  applySaveModifiers({
    effects,
    modifiers: activeSaveModifiers,
    saveType: null,
    abilityName: null,
    isRaging,
    shapeShiftActive,
    isPeerlessAthlete,
    isLargeFormActive,
    combatContext,
    conditions,
    attackerName,
    isLivingLegendActive,
    isElderChampionActive,
    isElderChampionAttackerActive,
    holyAuraTargets,
    isProtectionFromPoisonActive,
    isTranceOfOrderActive,
    hasPowerfulBuild,
  });

  applyProtectionFromPoisonAdvantage(effects, conditionSet, isProtectionFromPoisonActive);

  const conditionCtx = {
    seeInvisibilityActive,
    hasFaerieFire: targetEffects.some(te => te.effect === 'faerie_fire'),
  }
  for (const key of conditionSet) {
    applyConditionEffect(effects, key, conditionCtx)
  }

  for (const te of targetEffects) {
    applyTargetEffect(effects, te, attackerSenses);
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
