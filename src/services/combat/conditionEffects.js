const CONDITIONS_THAT_CANNOT_ACT = new Set([
   'incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious',
])

const CONDITIONS_THAT_SPEED_ZERO = new Set([
    'grappled', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious', 'speed_zero',
])

const CONDITION_KEYWORDS = new Set(['charmed', 'frightened', 'poison', 'magic'])

function saveModifierApplies(modifier, saveType, abilityName, isRaging = false, shapeShiftActive = false, isPeerlessAthlete = false, isLargeFormActive = false, combatContext = null, conditions = []) {
  const conditionSet = new Set(conditions);
  if (modifier.effect === 'replacement') return true;
  if (modifier.effect === 'reliable_talent') return true;
  if (modifier.effect === 'dex_jump') return true;
  if (modifier.effect === 'restore_balance') return true;
  if (modifier.effect === 'd20_floor_10') return true;
  if (modifier.effect === 'no_advantage_against') return true;
  if (modifier.effect === 'dark_ones_look') return true;
  if (modifier.effect === 'portent') return true;
  if (modifier.effect === 'potent_cantrip') return true;
  if (modifier.effect === 'soulstitch_spells') return true;
  if (modifier.target !== 'saving_throw' && modifier.target !== 'save') return false;
  if (modifier.condition === 'raging') return isRaging;
  if (modifier.condition === 'shape_shift') return shapeShiftActive;
  if (modifier.condition === 'peerless_athlete') return isPeerlessAthlete;
  if (modifier.condition === 'charmed' && saveType === 'charmed') return true;
  if (modifier.condition === 'frightened' && saveType === 'frightened') return true;
  if (modifier.condition === 'poison' && saveType === 'poison') return true;
  if (modifier.condition === 'magic') {
    if (!modifier.abilities || modifier.abilities.length === 0) return true;
    if (abilityName && modifier.abilities.includes(abilityName)) return true;
    return false;
    }
  if (modifier.condition === 'fiend_undead') return true;
  if (modifier.condition === 'holy_nimbus_active') return true;
  if (modifier.condition === 'holy_aura_active') return true;
  if (modifier.condition === 'living_legend_active') return true;
  if (modifier.condition === 'elder_champion_active') return true;
  if (modifier.condition === 'large_form_active') return isLargeFormActive;
  if (CONDITION_KEYWORDS.has(modifier.condition)) return false;
  if (modifier.condition === 'first_round_target_no_turn') {
    if (!combatContext || !combatContext.creatures) return false;
    const currentRound = combatContext.round || 1;
    if (currentRound !== 1) return false;
    const playerCreature = combatContext.creatures.find(c => c.name === combatContext.attackerName);
    if (playerCreature && playerCreature.hasActed) return false;
    return true;
  }
  if (modifier.condition && conditionSet.has(modifier.condition)) return true;
  if (modifier.abilities && modifier.abilities.length > 0) {
    if (!abilityName) return true;
    return modifier.abilities.includes(abilityName);
  }
  return true;
}

function applySaveModifiers(effects, modifiers, saveType, abilityName, isRaging = false, shapeShiftActive = false, isPeerlessAthlete = false, isLargeFormActive = false, combatContext = null, conditions = []) {
  if (!modifiers || modifiers.length === 0) return;
  for (const mod of modifiers) {
    if (!saveModifierApplies(mod, saveType, abilityName, isRaging, shapeShiftActive, isPeerlessAthlete, isLargeFormActive, combatContext, conditions)) continue;
    if (mod.target === 'ability_check' || mod.target === 'check') {
      if (mod.effect === 'advantage') {
        if (mod.abilities && mod.abilities.length > 0) {
          // Per-ability check advantage (e.g., Remarkable Athlete for STR)
          const abbr = abilityName ? abilityName.substring(0, 3).toUpperCase() : null;
          if (!abbr || mod.abilities.includes(abbr)) {
            effects.abilityCheckAdvantage = true;
            effects.abilityCheckAdvantageAbilities = [...new Set([
              ...(effects.abilityCheckAdvantageAbilities || []),
              ...mod.abilities
            ])];
          }
        } else {
          effects.abilityCheckAdvantage = true;
        }
      }
      if (mod.effect === 'dex_jump') {
        effects.dexJump = true;
      }
    } else if (mod.target === 'd20') {
      if (mod.effect === 'restore_balance') {
        effects.restoreBalance = true;
      }
    } else if (mod.target !== 'saving_throw' && mod.target !== 'save') {
      continue;
    }
    if (mod.effect === 'advantage') {
      if (mod.abilities && mod.abilities.length > 0 && !abilityName) {
        effects.saveAdvantageAbilities = [...new Set([
          ...(effects.saveAdvantageAbilities || []),
          ...mod.abilities
        ])];
      } else {
        effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1;
      }
    } else if (mod.effect === 'disadvantage') {
      if (mod.abilities && mod.abilities.length > 0 && !abilityName) {
        effects.saveDisadvantageAbilities = [...new Set([
          ...(effects.saveDisadvantageAbilities || []),
          ...mod.abilities
        ])];
      } else {
        effects.saveDisadvantageCount = (effects.saveDisadvantageCount || 0) + 1;
      }
    } else if (mod.effect === 'reroll') {
      effects.autoReroll = true;
      effects.autoRerollCondition = mod.condition;
      if (mod.bonusExpression) {
        effects.autoRerollBonus = mod.bonusExpression;
      }
    } else if (mod.effect === 'replacement') {
      if (mod.saveType === 'STR') {
        if (mod.target === 'saving_throw' || mod.target === 'save') {
          effects.strSaveReplace = true;
        }
        if (mod.target === 'ability_check' || mod.target === 'check' || !mod.target) {
          effects.strCheckReplace = true;
        }
      }
    } else if (mod.effect === 'tactical_mind') {
      effects.tacticalMind = true;
      effects.tacticalMindBonus = mod.bonusExpression || '';
    } else if (mod.effect === 'wis_replacement') {
      effects.wisCheckReplace = true;
      effects.wisCheckReplaceAbilities = mod.abilities || ['CHA'];
    } else if (mod.effect === 'reliable_talent') {
      effects.reliableTalent = true;
    }
    else if (mod.effect === 'stroke_of_luck') {
      effects.strokeOfLuck = true;
    }
    else if (mod.effect === 'restore_balance') {
      effects.restoreBalance = true;
    }
    else if (mod.effect === 'd20_floor_10') {
      effects.d20Floor10 = true;
    }
    else if (mod.effect === 'no_advantage_against') {
      effects.noAdvantageAgainst = true;
    }
    else if (mod.effect === 'dark_ones_look') {
      effects.darkOnesLook = true;
    }
    else if (mod.effect === 'portent') {
      effects.portent = true;
    }
    else if (mod.effect === 'improved_illusions') {
      effects.improvedIllusions = true;
    }
    else if (mod.effect === 'illusory_reality') {
      effects.illusoryReality = true;
    }
    else if (mod.effect === 'potent_cantrip') {
      effects.potentCantrip = true;
    }
    else if (mod.effect === 'soulstitch_spells') {
      effects.soulstitchSpells = true;
    }
    else if (mod.effect === 'spell_breaker_dispel_bonus') {
      effects.spellBreakerDispelBonus = true;
      effects.spellBreakerDispelBonusExpression = mod.bonusExpression || '';
    }
  }
}

function computeConditionEffects(conditions = [], saveModifiers = [], targetEffects = [], isRaging = false, shapeShiftActive = false, isPeerlessAthlete = false, isLargeFormActive = false, combatContext = null) {
  const effects = {
    attackAdvantageCount: 0,
    attackDisadvantageCount: 0,
    abilityCheckDisadvantage: false,
    abilityCheckAdvantage: false,
    abilityCheckAdvantageAbilities: null,
    abilityCheckAdvantageSkill: null,
    autoFailSaves: [],
    saveDisadvantage: [],
    cannotAct: false,
    speedZero: false,
    speedReduction: 0,
    concentrationBroken: false,
    targetAdvantageCount: 0,
    targetDisadvantageCount: 0,
    targetAdvantageIfWithin5ft: false,
    targetDisadvantageIfBeyond5ft: false,
    autoCritWithin5ft: false,
    resistantToAll: false,
    poisonImmune: false,
    saveAdvantage: [],
    saveAdvantageCount: 0,
    saveDisadvantageCount: 0,
    saveDisadvantageAbilities: null,
    autoReroll: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    strSaveReplace: false,
    strCheckReplace: false,
    wisCheckReplace: false,
    reliableTalent: false,
    tacticalMind: false,
    tacticalMindBonus: null,
    strokeOfLuck: false,
    dexJump: false,
    restoreBalance: false,
    d20Floor10: false,
    noAdvantageAgainst: false,
    darkOnesLook: false,
    portent: false,
    potentCantrip: false,
    soulstitchSpells: false,
    spellBreakerDispelBonus: false,
    spellBreakerDispelBonusExpression: null,
    improvedIllusions: false,
    illusoryReality: false,
    riderSaveDisadvantage: false,
    riderAttackBonus: 0,
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
    repeatingSave: false,
    hexSaveDisadvantage: false,
    hexSaveDisadvantageAbility: null,
   }

  const conditionSet = new Set(conditions)

  for (const mod of saveModifiers) {
    if (mod.target !== 'saving_throw' && mod.target !== 'save') continue;
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
       } else if (mod.condition === 'visible_effect' && [...CONDITIONS_THAT_CANNOT_ACT].some(c => conditionSet.has(c))) {
        continue; // Danger Sense disabled while incapacitated
       }
     }

  const isIncapacitated = [...CONDITIONS_THAT_CANNOT_ACT].some(c => conditionSet.has(c));
  const activeSaveModifiers = isIncapacitated
    ? saveModifiers.filter(mod => mod.condition !== 'visible_effect')
    : saveModifiers;
  applySaveModifiers(effects, activeSaveModifiers, null, null, isRaging, shapeShiftActive, isPeerlessAthlete, isLargeFormActive, combatContext, conditions);

  for (const key of conditionSet) {
    switch (key) {
       case 'blinded':
        effects.attackDisadvantageCount++
        effects.targetAdvantageCount++
        break

        case 'charmed':
         effects.attackDisadvantageCount++
         effects.targetAdvantageCount++
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
        effects.attackAdvantageCount++
        effects.targetDisadvantageCount++
        break

       case 'paralyzed':
        effects.cannotAct = true
        effects.speedZero = true
        effects.autoFailSaves.push('str', 'dex')
        effects.targetAdvantageCount++
        effects.autoCritWithin5ft = true
        break

       case 'petrified':
        effects.cannotAct = true
        effects.speedZero = true
        effects.targetAdvantageCount++
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
        effects.saveDisadvantage.push('dex')
        break

       case 'stunned':
        effects.cannotAct = true
        effects.speedZero = true
        effects.autoFailSaves.push('str', 'dex')
        effects.targetAdvantageCount++
        break

       case 'unconscious':
         effects.cannotAct = true
         effects.speedZero = true
         effects.targetAdvantageCount++
         effects.autoFailSaves.push('str', 'dex')
         effects.autoCritWithin5ft = true
         break

       case 'dazed':
         // Dazed: on next turn can only do one of: move OR action OR Bonus Action
         // We represent this as partial incapacitation — no attack advantage for target,
         // but the creature can still move. The UI will enforce the restriction.
         effects.dazed = true
         effects.targetAdvantageCount++
         break
       }
    }

  for (const te of targetEffects) {
    if (te.effect === 'disadvantage_on_next_save') {
      effects.riderSaveDisadvantage = true;
      effects.saveDisadvantageCount = (effects.saveDisadvantageCount || 0) + 1;
    }
    if (te.effect === 'next_attack_advantage') {
      effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1;
    }
    if (te.effect === 'disadvantage_next_attack') {
      effects.attackDisadvantageCount = (effects.attackDisadvantageCount || 0) + 1;
    }
    if (te.effect === 'disadvantage_perception_checks') {
      effects.abilityCheckDisadvantage = true;
    }
    if (te.effect === 'escape_the_horde') {
      effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
    }
    if (te.effect === 'multiattack_defense') {
      effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
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
      effects.repeatingSave = !!te.repeatingSave;
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
      }
      if (te.defenderDisadvantage) {
        effects.attackDisadvantageCount = (effects.attackDisadvantageCount || 0) + 1;
      }
    }
    // Handle Foresight — the target has Advantage on D20 Tests, and other creatures have Disadvantage on attack rolls against it
    if (te.effect === 'foresight') {
      effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1;
      effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1;
      effects.abilityCheckAdvantage = true;
      effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
    }
    // Handle Eldritch Hex — target has Disadvantage on saves of chosen ability
    if (te.effect === 'hex_save_disadvantage') {
      effects.hexSaveDisadvantage = true;
      effects.hexSaveDisadvantageAbility = te.ability || null;
      effects.saveDisadvantageCount = (effects.saveDisadvantageCount || 0) + 1;
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

function combineAttackModes(attackerEffects, targetEffects, attackRange) {
  let adv = attackerEffects.attackAdvantageCount + targetEffects.targetAdvantageCount
  let dis = attackerEffects.attackDisadvantageCount + targetEffects.targetDisadvantageCount

  if (targetEffects.targetAdvantageIfWithin5ft && attackRange <= 5) adv++
  if (targetEffects.targetDisadvantageIfBeyond5ft && attackRange > 5) dis++

  if (targetEffects.noAdvantageAgainst) {
    adv = 0
  }

  return getNetAttackMode(adv, dis, attackerEffects.restoreBalance || targetEffects.restoreBalance)
}

function hasSaveAdvantage(effects, saveType, restoreBalance) {
  if (!effects) return false;
  if (restoreBalance) {
    const effectiveAdvCount = Math.max(0, (effects.saveAdvantageCount || 0) - 1);
    if (effectiveAdvCount > 0) return true;
    if (saveType && effects.saveAdvantage?.includes(saveType)) return true;
    if (saveType && effects.saveAdvantageAbilities?.length) {
      const abbr = saveType.substring(0, 3).toUpperCase();
      if (effects.saveAdvantageAbilities.includes(abbr)) return true;
    }
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
