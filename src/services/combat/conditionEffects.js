const CONDITIONS_THAT_CANNOT_ACT = new Set([
   'incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious',
])

const CONDITIONS_THAT_SPEED_ZERO = new Set([
    'grappled', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious', 'speed_zero',
])

const CONDITION_KEYWORDS = new Set(['charmed', 'frightened', 'poison', 'magic'])

function saveModifierApplies(modifier, saveType, abilityName, isRaging = false, shapeShiftActive = false) {
  if (modifier.effect === 'replacement') return true;
  if (modifier.target !== 'saving_throw' && modifier.target !== 'save') return false;
  if (modifier.condition === 'raging') return isRaging;
  if (modifier.condition === 'shape_shift') return shapeShiftActive;
  if (modifier.condition === 'charmed' && saveType === 'charmed') return true;
  if (modifier.condition === 'frightened' && saveType === 'frightened') return true;
  if (modifier.condition === 'poison' && saveType === 'poison') return true;
  if (modifier.condition === 'magic') {
    if (!modifier.abilities || modifier.abilities.length === 0) return true;
    if (abilityName && modifier.abilities.includes(abilityName)) return true;
    return false;
    }
  if (CONDITION_KEYWORDS.has(modifier.condition)) return false;
  if (modifier.abilities && modifier.abilities.length > 0) {
    if (!abilityName) return true;
    return modifier.abilities.includes(abilityName);
  }
  return true;
}

function applySaveModifiers(effects, modifiers, saveType, abilityName, isRaging = false, shapeShiftActive = false) {
  if (!modifiers || modifiers.length === 0) return;
  for (const mod of modifiers) {
    if (!saveModifierApplies(mod, saveType, abilityName, isRaging, shapeShiftActive)) continue;
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
      effects.saveDisadvantageCount = (effects.saveDisadvantageCount || 0) + 1;
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
    }
  }
}

function computeConditionEffects(conditions = [], saveModifiers = [], targetEffects = [], isRaging = false, shapeShiftActive = false) {
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
    autoReroll: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    strSaveReplace: false,
    strCheckReplace: false,
    tacticalMind: false,
    tacticalMindBonus: null,
    riderSaveDisadvantage: false,
    riderAttackBonus: 0,
    riderCannotOpportunityAttack: false,
    riderNoReactions: false,
    pushEffect: false,
    pushDistance: null,
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
  applySaveModifiers(effects, activeSaveModifiers, null, null, isRaging, shapeShiftActive);

  for (const key of conditionSet) {
    switch (key) {
       case 'blinded':
        effects.attackDisadvantageCount++
        effects.targetAdvantageCount++
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
  }

  return effects
}

function getNetAttackMode(attackAdvantageCount, attackDisadvantageCount) {
  if (attackAdvantageCount > attackDisadvantageCount) return 'advantage'
  if (attackDisadvantageCount > attackAdvantageCount) return 'disadvantage'
  return 'normal'
}

function combineAttackModes(attackerEffects, targetEffects, attackRange) {
  let adv = attackerEffects.attackAdvantageCount + targetEffects.targetAdvantageCount
  let dis = attackerEffects.attackDisadvantageCount + targetEffects.targetDisadvantageCount

  if (targetEffects.targetAdvantageIfWithin5ft && attackRange <= 5) adv++
  if (targetEffects.targetDisadvantageIfBeyond5ft && attackRange > 5) dis++

  return getNetAttackMode(adv, dis)
}

function hasSaveAdvantage(effects, saveType) {
  if (!effects) return false;
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
