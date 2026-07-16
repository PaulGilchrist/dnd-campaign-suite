const CONDITIONS_THAT_CANNOT_ACT = new Set([
   'incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious',
])

const CONDITIONS_THAT_SPEED_ZERO = new Set([
    'grappled', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious', 'speed_zero',
])

const CONDITION_KEYWORDS = new Set(['charmed', 'frightened', 'poison', 'magic'])

function saveModifierApplies(modifier, saveType, abilityName, isRaging = false, shapeShiftActive = false, isPeerlessAthlete = false, isLargeFormActive = false, combatContext = null, conditions = [], attackerName = null, isLivingLegendActive = false, isElderChampionActive = false, isElderChampionAttackerActive = false, isHolyAuraActive = false, isProtectionFromPoisonActive = false) {
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
  if (modifier.condition === 'creature_grappled_by_you') {
    if (!combatContext || !combatContext.creatures) return false;
    const attackerName = combatContext.activeCreatureName || combatContext.attackerName;
    if (!attackerName) return false;
    const attackerCreature = combatContext.creatures.find(c => c.name === attackerName);
    const targetName = attackerCreature?.targetName;
    if (!targetName) return false;
    const targetCreature = combatContext.creatures.find(c => c.name === targetName);
    if (targetCreature && targetCreature.conditions) {
      const targetConditions = targetCreature.conditions.map(c => {
        if (typeof c === 'object') return String(c.key || '').toLowerCase();
        return String(c).toLowerCase();
      });
      return targetConditions.includes('grappled');
    }
    return false;
  }
  if (modifier.condition === 'mounted_and_target_one_size_smaller') {
    if (!combatContext || !combatContext.creatures) return false;
    const attackerName = combatContext.activeCreatureName || combatContext.attackerName;
    if (!attackerName) return false;
    const attackerCreature = combatContext.creatures.find(c => c.name === attackerName);
    if (!attackerCreature) return false;
    const isMounted = attackerCreature.isMounted || false;
    if (!isMounted) return false;
    const isNotIncapacitated = !attackerCreature.conditions || !attackerCreature.conditions.some(c => {
      const cStr = typeof c === 'object' ? String(c.key || '') : String(c);
      return ['incapacitated'].includes(cStr.toLowerCase());
    });
    if (!isNotIncapacitated) return false;
    const targetName = attackerCreature.targetName;
    if (!targetName) return false;
    const targetCreature = combatContext.creatures.find(c => c.name === targetName);
    if (!targetCreature) return false;
    const mountSizeIndex = ['Fine', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
    const mountSizeIdx = mountSizeIndex.indexOf(attackerCreature.mountSize || 'Medium');
    const targetSizeIdx = mountSizeIndex.indexOf(targetCreature.size || 'Medium');
    if (mountSizeIdx === -1 || targetSizeIdx === -1) return false;
    if (targetSizeIdx >= mountSizeIdx) return false;
    const within5ft = attackerCreature.rangeToTarget == null || attackerCreature.rangeToTarget <= 5;
    if (!within5ft) return false;
    return true;
  }
  if (modifier.target !== 'saving_throw' && modifier.target !== 'save' && modifier.target !== 'attack_roll' && modifier.target !== 'attack_rolls' && modifier.target !== 'attack_rolls_vs_unmounted_near_mount' && modifier.target !== 'concentration_saving_throws' && modifier.target !== 'death_saving_throws' && modifier.target !== 'ability_check' && modifier.target !== 'check' && modifier.target !== 'd20' && modifier.target !== 'performance_checks' && modifier.target !== 'deception_performance_checks') return false;
  if (modifier.condition === 'raging') return isRaging;
  if (modifier.condition === 'shape_shift') return shapeShiftActive;
  if (modifier.condition === 'peerless_athlete') {
      if (!isPeerlessAthlete) return false;
      if (!modifier.abilities || modifier.abilities.length === 0) return true;
      if (!abilityName) return true;
      if (abilityName && modifier.abilities.includes(abilityName)) return true;
      return false;
  }
  if (modifier.condition === 'charmed' && saveType === 'charmed') return true;
  if (modifier.condition === 'frightened' && saveType === 'frightened') return true;
  if (modifier.condition === 'poison' && saveType === 'poison') return true;
  if (modifier.condition === 'magic') {
    if (!modifier.abilities || modifier.abilities.length === 0) return true;
    if (abilityName && modifier.abilities.includes(abilityName)) return true;
    return false;
    }
  if (modifier.condition === 'fiend_undead') return true;
  if (modifier.condition === 'holy_aura_active') return isHolyAuraActive;
  if (modifier.condition === 'living_legend_active') return isLivingLegendActive;
  if (modifier.condition === 'elder_champion_active') return isElderChampionActive;
  if (modifier.condition === 'elder_champion_attacker') return isElderChampionAttackerActive;
  if (modifier.condition === 'large_form_active') return isLargeFormActive;
  if (CONDITION_KEYWORDS.has(modifier.condition)) return false;
  if (modifier.condition === 'first_round_target_no_turn') {
    if (!combatContext || !combatContext.creatures) return false;
    const currentRound = combatContext.round || 1;
    if (currentRound !== 1) return false;
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
  if (modifier.condition === 'target_hasnt_taken_turn') {
    if (!combatContext || !combatContext.creatures) return false;
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
  if (modifier.condition === 'concentration_breaker') return true;
  if (modifier.condition === 'pfeag_save_advantage') return true;
  if (modifier.condition === 'protection_from_poison_active') return isProtectionFromPoisonActive;
  if (modifier.condition === 'remarkable_athlete_athletics') {
    return true;
  }
  if (modifier.condition && conditionSet.has(modifier.condition)) return true;
  if (modifier.abilities && modifier.abilities.length > 0) {
    if (!abilityName) return true;
    return modifier.abilities.includes(abilityName);
  }
  return true;
}

function applySaveModifiers(effects, modifiers, saveType, abilityName, isRaging = false, shapeShiftActive = false, isPeerlessAthlete = false, isLargeFormActive = false, combatContext = null, conditions = [], attackerName = null, isLivingLegendActive = false, isElderChampionActive = false, isElderChampionAttackerActive = false, isHolyAuraActive = false, isProtectionFromPoisonActive = false) {
  if (!modifiers || modifiers.length === 0) return;
  for (const mod of modifiers) {
    if (!saveModifierApplies(mod, saveType, abilityName, isRaging, shapeShiftActive, isPeerlessAthlete, isLargeFormActive, combatContext, conditions, attackerName, isLivingLegendActive, isElderChampionActive, isElderChampionAttackerActive, isHolyAuraActive, isProtectionFromPoisonActive)) continue;
    if (mod.target === 'ability_check' || mod.target === 'check' || mod.target === 'performance_checks' || mod.target === 'deception_performance_checks') {
      if (mod.effect === 'advantage') {
        // Skill-specific advantage (e.g., Peerless Athlete) — check before abilities
        if (mod.skills && mod.skills.length > 0) {
          if (!effects.peerlessAthleteAdvantageSkills) {
            effects.peerlessAthleteAdvantageSkills = [];
          }
          effects.peerlessAthleteAdvantageSkills = [...new Set([
            ...(effects.peerlessAthleteAdvantageSkills || []),
            ...mod.skills
          ])];
        } else if (mod.abilities && mod.abilities.length > 0) {
          if (!abilityName) {
            // Per-ability check advantage (e.g., Remarkable Athlete for STR)
            // General computation: store abilities list for UI to match against
            effects.abilityCheckAdvantageAbilities = [...new Set([
              ...(effects.abilityCheckAdvantageAbilities || []),
              ...mod.abilities
            ])];
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
          // Deception/Performance checks: use CHA ability filter
          effects.abilityCheckAdvantageAbilities = [...new Set([
            ...(effects.abilityCheckAdvantageAbilities || []),
            'CHA'
          ])];
        } else {
          effects.abilityCheckAdvantage = true;
        }
      }
      if (mod.effect === 'dex_jump') {
        effects.dexJump = true;
      }
    } else if (mod.target === 'all_attackers_vs_target') {
      if (mod.effect === 'advantage') {
        effects.targetAdvantageCount = (effects.targetAdvantageCount || 0) + 1;
      }
      if (mod.effect === 'disadvantage') {
        effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
      }
    } else if (mod.target === 'd20') {
      if (mod.effect === 'restore_balance') {
        effects.restoreBalance = true;
      }
      if (mod.effect === 'portent') {
        effects.portent = true;
      }
      if (mod.effect === 'stroke_of_luck') {
        effects.strokeOfLuck = true;
      }
      if (mod.effect === 'bardic_inspiration') {
        effects.bardicInspiration = true;
      }
    } else if (mod.target === 'attack_roll' || mod.target === 'attack_rolls' || mod.target === 'attack_rolls_vs_unmounted_near_mount') {
      if (mod.effect === 'advantage') {
        effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1;
      }
      if (mod.effect === 'disadvantage') {
        effects.attackDisadvantageCount = (effects.attackDisadvantageCount || 0) + 1;
      }
    } else if (mod.target !== 'saving_throw' && mod.target !== 'save' && mod.target !== 'concentration_saving_throws' && mod.target !== 'death_saving_throws') {
      continue;
    }
    if (mod.target === 'saving_throw' || mod.target === 'save' || mod.target === 'concentration_saving_throws' || mod.target === 'death_saving_throws') {
      if (mod.effect === 'advantage') {
        if (mod.abilities && mod.abilities.length > 0 && !abilityName) {
          // General computation: store abilities list for UI to match against
          effects.saveAdvantageAbilities = [...new Set([
            ...(effects.saveAdvantageAbilities || []),
            ...mod.abilities
          ])];
        } else if (mod.condition !== 'against_spell' && mod.target !== 'death_saving_throws') {
          // Specific save or no abilities filter: increment global count
          // death_saving_throws is handled separately by DeathSavingThrows.jsx via hasSaveModifier
          effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1;
        }
      } else if (mod.effect === 'disadvantage') {
        if (mod.abilities && mod.abilities.length > 0 && !abilityName) {
          effects.saveDisadvantageAbilities = [...new Set([
            ...(effects.saveDisadvantageAbilities || []),
            ...mod.abilities
          ])];
        } else if (mod.condition !== 'against_spell') {
          effects.saveDisadvantageCount = (effects.saveDisadvantageCount || 0) + 1;
        }
      }
    }
    if (mod.effect === 'reroll') {
      if (mod.target === 'saving_throw' || mod.target === 'save' || mod.target === 'concentration_saving_throws' || mod.target === 'death_saving_throws') {
        effects.autoRerollForSaves = true;
      } else if (mod.target === 'ability_check' || mod.target === 'check' || mod.target === 'd20') {
        effects.autoRerollForChecks = true;
      }
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
    else if (mod.effect === 'lucky_point') {
      if (mod.effectType === 'advantage') {
        effects.luckyAdvantage = true;
      }
      if (mod.effectType === 'disadvantage') {
        effects.luckyDisadvantage = true;
      }
    }
    else if (mod.effect === 'modify_d20_roll') {
      effects.modifyD20Roll = true;
      effects.modifyD20RollDice = mod.diceExpression || '2d4';
      effects.modifyD20RollCanBeBonusOrPenalty = !!mod.canBeBonusOrPenalty;
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
    else if (mod.effect === 'pass_without_trace') {
      effects.passWithoutTraceBonus = mod.bonusExpression || '10';
    }
    else if (mod.effect === 'str_check_disadvantage') {
      effects.strCheckDisadvantage = true;
    }
    else if (mod.effect === 'ray_of_enfeeble_damage_reduction') {
      effects.rayOfEnfeebleDamageReduction = true;
    }
    else if (mod.effect === 'save_bonus') {
      if (mod.abilities && mod.abilities.length > 0) {
        effects.saveBonusAbilities = [...(effects.saveBonusAbilities || []), ...mod.abilities];
      }
      effects.saveBonusExpression = (effects.saveBonusExpression || '0') + ' + ' + (mod.bonusExpression || '0');
    }
  }
}

function computeConditionEffects(conditions = [], saveModifiers = [], targetEffects = [], isRaging = false, shapeShiftActive = false, isPeerlessAthlete = false, isLargeFormActive = false, combatContext = null, seeInvisibilityActive = false, attackerName = null, isLivingLegendActive = false, isElderChampionActive = false, isElderChampionAttackerActive = false, isHolyAuraActive = false, isProtectionFromPoisonActive = false) {
  const effects = {
    attackAdvantageCount: 0,
    attackAdvantageReasons: [],
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
    darkOnesLook: false,
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
    repeatingSave: false,
    hexSaveDisadvantage: false,
    hexSaveDisadvantageAbility: null,
    strCheckDisadvantage: false,
    slowRepeatSave: false,
    slowNoReactions: false,
    slowActionLimit: false,
    slowSingleAttackLimit: false,
    slowSomaticFailure: false,
    slowDexSaveDisadvantage: false,
    stinkingCloudRepeatSave: false,
    webRepeatSave: false,
    acPenalty: 0,
    rayOfEnfeebleDamageReduction: false,
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

  const isIncapacitated = [...CONDITIONS_THAT_CANNOT_ACT].some(c => conditionSet.has(c));
  const activeSaveModifiers = isIncapacitated
    ? saveModifiers.filter(mod => mod.condition !== 'visible_effect')
    : saveModifiers;
  applySaveModifiers(effects, activeSaveModifiers, null, null, isRaging, shapeShiftActive, isPeerlessAthlete, isLargeFormActive, combatContext, conditions, attackerName, isLivingLegendActive, isElderChampionActive, isElderChampionAttackerActive, isHolyAuraActive, isProtectionFromPoisonActive);

  for (const key of conditionSet) {
    switch (key) {
        case 'blinded':
         effects.attackDisadvantageCount++
         effects.targetAdvantageCount++
         effects.targetAdvantageReasons.push('Blinded')
         break

        case 'charmed':
          effects.attackDisadvantageCount++
          effects.targetAdvantageCount++
          effects.targetAdvantageReasons.push('Charmed')
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
            effects.attackAdvantageCount++
            effects.attackAdvantageReasons.push('Invisible')
            effects.targetDisadvantageCount++
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
          effects.speedReduction = (effects.speedReduction || 0) + 50;
          effects.acPenalty = (effects.acPenalty || 0) + 2;
          effects.slowNoReactions = true;
          effects.slowActionLimit = true;
          effects.slowSingleAttackLimit = true;
          effects.slowSomaticFailure = true;
          effects.targetAdvantageCount++;
          effects.targetAdvantageReasons.push('Slow');
          // DEX save disadvantage from Slow
          if (!effects.saveDisadvantage.includes('dex')) {
            effects.saveDisadvantage.push('dex');
          }
          break;
        }
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
        effects.attackAdvantageReasons.push(te.source || 'next_attack_advantage');
      }
    }
    if (te.effect === 'next_attack_bonus') {
      effects.riderAttackBonus = (effects.riderAttackBonus || 0) + (parseInt(te.value, 10) || 5);
    }
    if (te.effect === 'distracting_strike_advantage') {
      effects.targetAdvantageCount = (effects.targetAdvantageCount || 0) + 1;
      effects.targetAdvantageReasons.push(te.source || 'Distracting Strike');
    }
    if (te.effect === 'crusher_enhanced_critical') {
      effects.targetAdvantageCount = (effects.targetAdvantageCount || 0) + 1;
    }
    if (te.effect === 'disadvantage_next_attack') {
      effects.attackDisadvantageCount = (effects.attackDisadvantageCount || 0) + 1;
    }
    if (te.effect === 'goad') {
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
    // Handle Power Word Stun — repeating CON save for Stunned condition
    if (te.effect === 'power_word_stun_repeat_save') {
      effects.saveType = te.saveType || 'CON';
      effects.saveDc = te.saveDc;
      effects.saveAbility = 'CON';
      effects.conditionToApply = 'stunned';
      effects.repeatingSave = true;
      effects.powerWordStun = true;
    }
    // Handle Sleep — repeating WIS save at end of target's turn for Incapacitated→Unconscious
    if (te.effect === 'sleep_repeat_save') {
      effects.saveType = te.saveType || 'WIS';
      effects.saveDc = te.saveDc;
      effects.saveAbility = 'WIS';
      effects.conditionToApply = 'unconscious';
      effects.repeatingSave = true;
      effects.sleepRepeatSave = true;
    }
    // Handle Slow — repeating WIS save at end of target's turn, success ends spell
    if (te.effect === 'slow_repeat_save') {
      effects.saveType = te.saveType || 'WIS';
      effects.saveDc = te.saveDc;
      effects.saveAbility = 'WIS';
      effects.repeatingSave = true;
      effects.slowRepeatSave = true;
    }
    // Handle Stinking Cloud — repeating CON save at end of target's turn for Poisoned condition
    if (te.effect === 'stinking_cloud_repeat_save') {
      effects.saveType = te.saveType || 'CON';
      effects.saveDc = te.saveDc;
      effects.saveAbility = 'CON';
      effects.conditionToApply = 'poisoned';
      effects.repeatingSave = true;
      effects.stinkingCloudRepeatSave = true;
    }
    // Handle Web — repeating DEX save when creature enters or starts turn in webs for Restrained condition
    if (te.effect === 'web_repeat_save') {
      effects.saveType = te.saveType || 'DEX';
      effects.saveDc = te.saveDc;
      effects.saveAbility = 'DEX';
      effects.conditionToApply = 'restrained';
      effects.repeatingSave = true;
      effects.webRepeatSave = true;
    }
    // Handle Clairvoyant Combatant — target has Disadvantage on attacks against you, you have Advantage on attacks against target
    if (te.effect === 'clairvoyant_combatant') {
      if (te.attackerAdvantage) {
        effects.targetAdvantageCount = (effects.targetAdvantageCount || 0) + 1;
        effects.targetAdvantageReasons.push('Clairvoyant Combatant');
      }
      if (te.defenderDisadvantage) {
        effects.attackDisadvantageCount = (effects.attackDisadvantageCount || 0) + 1;
      }
    }
    // Handle Foresight — the target has Advantage on D20 Tests, and other creatures have Disadvantage on attack rolls against it
    if (te.effect === 'foresight') {
      effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1;
      effects.attackAdvantageReasons.push('Foresight');
      effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1;
      effects.saveAdvantageReasons.push('Foresight');
      effects.abilityCheckAdvantage = true;
      effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1;
    }
    // Handle Eldritch Hex — target has Disadvantage on saves of chosen ability
    if (te.effect === 'hex_save_disadvantage') {
      effects.hexSaveDisadvantage = true;
      effects.hexSaveDisadvantageAbility = te.ability || null;
      effects.saveDisadvantageCount = (effects.saveDisadvantageCount || 0) + 1;
    }
    // Handle Ray of Enfeeblement debuff — STR check disadvantage + damage reduction
    if (te.effect === 'ray_of_enfeeble_debuff') {
      if (te.strCheckDisadvantage) effects.strCheckDisadvantage = true;
      if (te.rayOfEnfeebleDamageReduction) effects.rayOfEnfeebleDamageReduction = true;
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
    if (te.effect === 'dex_save_disadvantage') {
      effects.slowDexSaveDisadvantage = true;
      if (!effects.saveDisadvantage.includes('dex')) {
        effects.saveDisadvantage.push('dex');
      }
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
  let dis = attackerEffects.attackDisadvantageCount + targetEffects.targetDisadvantageCount

  if (attackerEffects.vexAdvantageTargets && targetName && attackerEffects.vexAdvantageTargets.includes(targetName)) {
    adv++
  }
  if (targetEffects.targetAdvantageIfWithin5ft && attackRange <= 5) adv++
  if (targetEffects.targetDisadvantageIfBeyond5ft && attackRange > 5) dis++

  if (targetEffects.noAdvantageAgainst) {
    adv = 0
  }

  return getNetAttackMode(adv, dis, attackerEffects.restoreBalance || targetEffects.restoreBalance)
}

function hasSaveAdvantage(effects, saveType, restoreBalance) {
  if (!effects) return false;
  if (effects.saveAdvantage?.includes('against_spell')) {
    if (restoreBalance) return true;
    return true;
  }
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
