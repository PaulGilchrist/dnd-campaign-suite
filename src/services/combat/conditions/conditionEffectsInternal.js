// ---------------------------------------------------------------------------
// Internal helpers (saveModifierApplies, applySaveModifiers, attackerHasBlindsightOrTruesight)
// ---------------------------------------------------------------------------

const CONDITION_KEYWORDS = new Set(['charmed', 'frightened', 'poison', 'magic'])

const SAVE_NEVER_APPLIES_EFFECTS = new Set(['restore_balance'])

const SAVE_ALWAYS_APPLIES_EFFECTS = new Set([
  'replacement',
  'reliable_talent',
  'dex_jump',
  'dark_ones_luck',
  'portent',
  'potent_cantrip',
  'soulstitch_spells',
])

const SAVE_GATE_TARGETS = new Set([
  'saving_throw',
  'save',
  'attack_roll',
  'attack_rolls',
  'attack_rolls_vs_unmounted_near_mount',
  'concentration_saving_throws',
  'death_saving_throws',
  'ability_check',
  'check',
  'd20',
  'performance_checks',
  'deception_performance_checks',
])

const SIZE_ORDER = ['Fine', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

const SAVE_TARGET_SET = new Set(['saving_throw', 'save', 'concentration_saving_throws', 'death_saving_throws'])

function normalizeConditionKey(c) {
  if (typeof c === 'object') return String(c.key || '').toLowerCase();
  return String(c).toLowerCase();
}

function grappledTargetActive(ctx) {
  const { combatContext } = ctx;
  if (!combatContext || !combatContext.creatures) return false;
  const attackerName = combatContext.activeCreatureName || combatContext.attackerName;
  if (!attackerName) return false;
  const attackerCreature = combatContext.creatures.find(c => c.name === attackerName);
  const targetName = attackerCreature?.targetName;
  if (!targetName) return false;
  const targetCreature = combatContext.creatures.find(c => c.name === targetName);
  if (targetCreature && targetCreature.conditions) {
    const targetConditions = targetCreature.conditions.map(normalizeConditionKey);
    return targetConditions.includes('grappled');
  }
  return false;
}

function mountedAndTargetSmaller(ctx) {
  const { combatContext } = ctx;
  if (!combatContext || !combatContext.creatures) return false;
  const attackerName = combatContext.activeCreatureName || combatContext.attackerName;
  if (!attackerName) return false;
  const attackerCreature = combatContext.creatures.find(c => c.name === attackerName);
  if (!attackerCreature) return false;
  if (!attackerCreature.isMounted) return false;
  const isNotIncapacitated = !attackerCreature.conditions || !attackerCreature.conditions.some(c => {
    const cStr = typeof c === 'object' ? String(c.key || '') : String(c);
    return ['incapacitated'].includes(cStr.toLowerCase());
  });
  if (!isNotIncapacitated) return false;
  const targetName = attackerCreature.targetName;
  if (!targetName) return false;
  const targetCreature = combatContext.creatures.find(c => c.name === targetName);
  if (!targetCreature) return false;
  const mountSizeIdx = SIZE_ORDER.indexOf(attackerCreature.mountSize || 'Medium');
  const targetSizeIdx = SIZE_ORDER.indexOf(targetCreature.size || 'Medium');
  if (mountSizeIdx === -1 || targetSizeIdx === -1) return false;
  if (targetSizeIdx >= mountSizeIdx) return false;
  return attackerCreature.rangeToTarget == null || attackerCreature.rangeToTarget <= 5;
}

function targetActsAfterAttacker(ctx) {
  const { combatContext, attackerName } = ctx;
  const attacker = combatContext.creatures.find(c => c.name === attackerName);
  if (!attacker) return true;
  const targetName = attacker.targetName;
  if (!targetName) return true;
  const targetCreature = combatContext.creatures.find(c => c.name === targetName);
  if (!targetCreature) return true;
  const attackerIndex = combatContext.creatures.indexOf(attacker);
  const targetIndex = combatContext.creatures.indexOf(targetCreature);
  return targetIndex > attackerIndex;
}

function firstRoundTargetNoTurn(ctx) {
  const { combatContext } = ctx;
  if (!combatContext || !combatContext.creatures) return false;
  const currentRound = combatContext.round || 1;
  if (currentRound !== 1) return false;
  return targetActsAfterAttacker(ctx);
}

function peerlessAthleteApplies(ctx) {
  const { modifier, abilityName } = ctx;
  if (!ctx.isPeerlessAthlete) return false;
  if (!modifier.abilities || modifier.abilities.length === 0) return true;
  if (!abilityName) return true;
  return modifier.abilities.includes(abilityName);
}

function magicConditionApplies(ctx) {
  const { modifier, abilityName } = ctx;
  if (!modifier.abilities || modifier.abilities.length === 0) return true;
  return !!(abilityName && modifier.abilities.includes(abilityName));
}

// Ordered condition dispatch. Handlers returning `undefined` fall through
// to subsequent checks (mirroring the original if-chain fall-through, e.g.
// 'charmed' with a non-matching saveType must still reach CONDITION_KEYWORDS).
const PRE_TARGET_GATE_CHECKS = [
  ['trance_of_order_active', ctx => ctx.isTranceOfOrderActive],
  ['grappling_target', grappledTargetActive],
  ['creature_grappled_by_you', grappledTargetActive],
  ['mounted_and_target_one_size_smaller', mountedAndTargetSmaller],
];

const POST_TARGET_GATE_CHECKS = [
  ['raging', ctx => ctx.isRaging],
  ['shape_shift', ctx => ctx.shapeShiftActive],
  ['peerless_athlete', peerlessAthleteApplies],
  ['charmed', ctx => ctx.saveType === 'charmed' ? true : undefined],
  ['frightened', ctx => ctx.saveType === 'frightened' ? true : undefined],
  ['poison', ctx => ctx.saveType === 'poison' ? true : undefined],
  ['magic', magicConditionApplies],
  ['fiend_undead', () => true],
  ['holy_aura_active', ctx => ctx.holyAuraTargets.includes(ctx.attackerName)],
  ['living_legend_active', ctx => ctx.isLivingLegendActive],
  ['elder_champion_active', ctx => ctx.isElderChampionActive],
  ['elder_champion_attacker', ctx => ctx.isElderChampionAttackerActive],
  ['large_form_active', ctx => ctx.isLargeFormActive],
  ['first_round_target_no_turn', firstRoundTargetNoTurn],
  ['target_hasnt_taken_turn', targetActsAfterAttacker],
  ['concentration_breaker', () => true],
  ['pfeag_save_advantage', () => true],
  ['protection_from_poison_active', ctx => ctx.isProtectionFromPoisonActive],
  ['powerful_build_grapple_escape', ctx => ctx.hasPowerfulBuild],
  ['remarkable_athlete_athletics', () => true],
];

function runConditionChecks(checks, ctx) {
  for (const [condition, handler] of checks) {
    if (ctx.modifier.condition === condition) {
      const result = handler(ctx);
      if (result !== undefined) return result;
    }
  }
  return undefined;
}

function buildModifierContext(options) {
  const {
    modifier,
    saveType,
    abilityName,
    isRaging = false,
    shapeShiftActive = false,
    isPeerlessAthlete = false,
    isLargeFormActive = false,
    combatContext = null,
    conditions = [],
    attackerName = null,
    isLivingLegendActive = false,
    isElderChampionActive = false,
    isElderChampionAttackerActive = false,
    holyAuraTargets = [],
    isProtectionFromPoisonActive = false,
    isTranceOfOrderActive = false,
    hasPowerfulBuild = false,
  } = options;
  return {
    modifier,
    saveType,
    abilityName,
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
    conditionSet: new Set(conditions),
  };
}

// Fall-through applicability once the modifier has passed the target gate.
function appliesAfterTargetGate(ctx) {
  const { modifier, abilityName } = ctx;
  if (CONDITION_KEYWORDS.has(modifier.condition)) return false;
  if (modifier.condition && ctx.conditionSet.has(modifier.condition)) return true;
  if (modifier.abilities && modifier.abilities.length > 0) {
    if (!abilityName) return true;
    return modifier.abilities.includes(abilityName);
  }
  return true;
}

function saveModifierApplies(options) {
  const ctx = buildModifierContext(options);
  const { modifier } = ctx;
  if (SAVE_NEVER_APPLIES_EFFECTS.has(modifier.effect)) return false;
  if (SAVE_ALWAYS_APPLIES_EFFECTS.has(modifier.effect)) return true;
  const preGate = runConditionChecks(PRE_TARGET_GATE_CHECKS, ctx);
  if (preGate !== undefined) return preGate;
  if (!SAVE_GATE_TARGETS.has(modifier.target)) return false;
  const postGate = runConditionChecks(POST_TARGET_GATE_CHECKS, ctx);
  if (postGate !== undefined) return postGate;
  return appliesAfterTargetGate(ctx);
}

const ABILITY_CHECK_TARGETS = new Set(['ability_check', 'check', 'performance_checks', 'deception_performance_checks']);

const ATTACK_TARGETS = new Set(['attack_roll', 'attack_rolls', 'attack_rolls_vs_unmounted_near_mount']);

function unionLists(...lists) {
  return [...new Set(lists.flatMap(l => l || []))];
}

function applyAbilityCheckAdvantage(effects, mod, abilityName) {
  // Skill-specific advantage (e.g., Peerless Athlete) — check before abilities
  if (mod.skills && mod.skills.length > 0) {
    if (!effects.peerlessAthleteAdvantageSkills) {
      effects.peerlessAthleteAdvantageSkills = [];
    }
    effects.peerlessAthleteAdvantageSkills = unionLists(effects.peerlessAthleteAdvantageSkills, mod.skills);
  } else if (mod.abilities && mod.abilities.length > 0) {
    if (!abilityName) {
      // Per-ability check advantage (e.g., Remarkable Athlete for STR)
      // General computation: store abilities list for UI to match against
      effects.abilityCheckAdvantageAbilities = unionLists(effects.abilityCheckAdvantageAbilities, mod.abilities);
    } else {
      // Specific check: only set global advantage if ability matches (or no filter)
      const abbr = abilityName.substring(0, 3).toUpperCase();
      if (mod.abilities.includes(abbr)) {
        effects.abilityCheckAdvantage = true;
      }
    }
  } else if (mod.target === 'performance_checks') {
    // Performance checks specific: limit to Performance skill
    effects.abilityCheckAdvantage = true;
    effects.abilityCheckAdvantageSkill = 'Performance';
  } else if (mod.target === 'deception_performance_checks') {
    // Deception/Performance checks: store specific skills
    if (!effects.abilityCheckAdvantageSkills) {
      effects.abilityCheckAdvantageSkills = [];
    }
    effects.abilityCheckAdvantageSkills = unionLists(effects.abilityCheckAdvantageSkills, ['Deception', 'Performance']);
  } else {
    effects.abilityCheckAdvantage = true;
  }
}

function applyAdvantageDisadvantageCount(effects, mod, advKey, disKey) {
  if (mod.effect === 'advantage') {
    effects[advKey] = (effects[advKey] || 0) + 1;
  } else if (mod.effect === 'disadvantage') {
    effects[disKey] = (effects[disKey] || 0) + 1;
  }
}

function applyD20Effect(effects, mod) {
  if (mod.effect === 'portent') {
    effects.portent = true;
  } else if (mod.effect === 'stroke_of_luck') {
    effects.strokeOfLuck = true;
  } else if (mod.effect === 'bardic_inspiration') {
    effects.bardicInspiration = true;
  }
}

// Returns false when the modifier's target should be skipped entirely
// (original `continue` in the target if/else-if chain).
function applyTargetModifiers(effects, mod, abilityName) {
  if (ABILITY_CHECK_TARGETS.has(mod.target)) {
    if (mod.effect === 'advantage') {
      applyAbilityCheckAdvantage(effects, mod, abilityName);
    }
    if (mod.effect === 'dex_jump') {
      effects.dexJump = true;
    }
    return true;
  }
  if (mod.target === 'all_attackers_vs_target') {
    applyAdvantageDisadvantageCount(effects, mod, 'targetAdvantageCount', 'targetDisadvantageCount');
    return true;
  }
  if (mod.target === 'd20') {
    applyD20Effect(effects, mod);
    return true;
  }
  if (ATTACK_TARGETS.has(mod.target)) {
    applyAdvantageDisadvantageCount(effects, mod, 'attackAdvantageCount', 'attackDisadvantageCount');
    return true;
  }
  return SAVE_TARGET_SET.has(mod.target);
}

function applySaveAdvantageDisadvantage(effects, mod, abilityName) {
  if (mod.effect === 'advantage') {
    if (mod.abilities && mod.abilities.length > 0 && !abilityName) {
      // General computation: store abilities list for UI to match against
      effects.saveAdvantageAbilities = unionLists(effects.saveAdvantageAbilities, mod.abilities);
    } else if (mod.condition !== 'against_spell' && mod.target !== 'death_saving_throws') {
      // Specific save or no abilities filter: increment global count
      // death_saving_throws is handled separately by DeathSavingThrows.jsx via hasSaveModifier
      effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1;
    }
  } else if (mod.effect === 'disadvantage') {
    if (mod.abilities && mod.abilities.length > 0 && !abilityName) {
      effects.saveDisadvantageAbilities = unionLists(effects.saveDisadvantageAbilities, mod.abilities);
    } else if (mod.condition !== 'against_spell') {
      effects.saveDisadvantageCount = (effects.saveDisadvantageCount || 0) + 1;
    }
  }
}

const SAVE_EFFECT_APPLIERS = {
  reroll: (effects, mod) => {
    if (SAVE_TARGET_SET.has(mod.target)) {
      effects.autoRerollForSaves = true;
    } else if (mod.target === 'ability_check' || mod.target === 'check' || mod.target === 'd20') {
      effects.autoRerollForChecks = true;
      // A 'd20' target is a full d20 Test (Halfling Lucky: "a 1 on the d20 of a d20 Test") —
      // covers sheet saving throws too (autoRerollForAttack intentionally NOT set here:
      // that flag renders the manual Boon-of-Combat-Prowess button, and the attack
      // context has no auto-reroll consumer — see bug-cla-216 notes).
      if (mod.target === 'd20') {
        effects.autoRerollForSaves = true;
      }
    } else if (mod.target === 'attack' || mod.target === 'attack_roll') {
      effects.autoRerollForAttack = true;
    }
    effects.autoRerollCondition = mod.condition;
    if (mod.bonusExpression) {
      effects.autoRerollBonus = mod.bonusExpression;
    }
  },
  replacement: (effects, mod) => {
    if (mod.saveType !== 'STR') return;
    if (mod.target === 'saving_throw' || mod.target === 'save') {
      effects.strSaveReplace = true;
    }
    if (mod.target === 'ability_check' || mod.target === 'check' || !mod.target) {
      effects.strCheckReplace = true;
    }
  },
  tactical_mind: (effects, mod) => {
    effects.tacticalMind = true;
    effects.tacticalMindBonus = mod.bonusExpression || '';
  },
  wis_replacement: (effects, mod) => {
    effects.wisCheckReplace = true;
    effects.wisCheckReplaceAbilities = mod.abilities || ['CHA'];
  },
  reliable_talent: (effects) => {
    effects.reliableTalent = true;
  },
  stroke_of_luck: (effects) => {
    effects.strokeOfLuck = true;
  },
  lucky_point: (effects, mod) => {
    if (mod.effectType === 'advantage') {
      effects.luckyAdvantage = true;
    }
    if (mod.effectType === 'disadvantage') {
      effects.luckyDisadvantage = true;
    }
  },
  modify_d20_roll: (effects, mod) => {
    effects.modifyD20Roll = true;
    effects.modifyD20RollDice = mod.diceExpression || '2d4';
    effects.modifyD20RollCanBeBonusOrPenalty = !!mod.canBeBonusOrPenalty;
  },
  d20_floor_10: (effects) => {
    effects.d20Floor10 = true;
  },
  no_advantage_against: (effects) => {
    effects.noAdvantageAgainst = true;
  },
  dark_ones_luck: (effects) => {
    effects.darkOnesLuck = true;
  },
  portent: (effects) => {
    effects.portent = true;
  },
  improved_illusions: (effects) => {
    effects.improvedIllusions = true;
  },
  illusory_reality: (effects) => {
    effects.illusoryReality = true;
  },
  potent_cantrip: (effects) => {
    effects.potentCantrip = true;
  },
  soulstitch_spells: (effects) => {
    effects.soulstitchSpells = true;
  },
  pass_without_trace: (effects, mod) => {
    effects.passWithoutTraceBonus = mod.bonusExpression || '10';
  },
  str_check_disadvantage: (effects) => {
    effects.strCheckDisadvantage = true;
  },
  powerful_build_grapple_escape: (effects) => {
    effects.strCheckAdvantage = true;
  },
  ray_of_enfeeble_damage_reduction: (effects) => {
    effects.rayOfEnfeebleDamageReduction = true;
  },
  save_bonus: (effects, mod) => {
    if (mod.abilities && mod.abilities.length > 0) {
      effects.saveBonusAbilities = [...(effects.saveBonusAbilities || []), ...mod.abilities];
    }
    effects.saveBonusExpression = (effects.saveBonusExpression || '0') + ' + ' + (mod.bonusExpression || '0');
  },
};

function applySaveModifiers(options = {}) {
  const { effects, modifiers, ...modifierContext } = options;
  if (!modifiers || modifiers.length === 0) return;
  for (const mod of modifiers) {
    if (!saveModifierApplies({ ...modifierContext, modifier: mod })) continue;
    if (!applyTargetModifiers(effects, mod, modifierContext.abilityName)) continue;
    if (SAVE_TARGET_SET.has(mod.target)) {
      applySaveAdvantageDisadvantage(effects, mod, modifierContext.abilityName);
    }
    if (Object.hasOwn(SAVE_EFFECT_APPLIERS, mod.effect)) {
      SAVE_EFFECT_APPLIERS[mod.effect](effects, mod);
    }
  }
}

export {
  saveModifierApplies,
  applySaveModifiers,
};
