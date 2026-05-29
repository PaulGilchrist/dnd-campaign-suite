const CONDITIONS_THAT_CANNOT_ACT = new Set([
  'incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious',
])

const CONDITIONS_THAT_SPEED_ZERO = new Set([
  'grappled', 'paralyzed', 'petrified', 'restrained', 'unconscious',
])

function computeConditionEffects(conditions = []) {
  const effects = {
    attackAdvantageCount: 0,
    attackDisadvantageCount: 0,
    abilityCheckDisadvantage: false,
    autoFailSaves: [],
    saveDisadvantage: [],
    cannotAct: false,
    speedZero: false,
    concentrationBroken: false,
    targetAdvantageCount: 0,
    targetDisadvantageCount: 0,
    targetAdvantageIfWithin5ft: false,
    targetDisadvantageIfBeyond5ft: false,
    autoCritWithin5ft: false,
    resistantToAll: false,
    poisonImmune: false,
  }

  const conditionSet = new Set(conditions)

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

      case 'restrained':
        effects.speedZero = true
        effects.attackDisadvantageCount++
        effects.targetAdvantageCount++
        effects.saveDisadvantage.push('dex')
        break

      case 'stunned':
        effects.cannotAct = true
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

export {
  computeConditionEffects,
  getNetAttackMode,
  combineAttackModes,
  CONDITIONS_THAT_CANNOT_ACT,
  CONDITIONS_THAT_SPEED_ZERO,
}
