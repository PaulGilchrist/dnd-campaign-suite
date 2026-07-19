import { rollD20 } from '../../dice/diceRoller.js'

function isStable(saves) {
  return saves.filter(Boolean).length >= 3
}

function isDead(failures) {
  return failures.filter(Boolean).length >= 3
}

function rollDeathSave(currentSaves, currentFailures, treat18AsNat20 = false) {
  const roll = rollD20()
  const isNat20 = roll === 20
  const isNat1 = roll === 1
  const isTreatedAsNat20 = treat18AsNat20 && roll === 18

  if (isNat20 || isTreatedAsNat20) {
    return {
      newSaves: [false, false, false],
      newFailures: [false, false, false],
      result: 'nat20',
      roll,
      isNat20: isNat20 || isTreatedAsNat20,
      isNat1,
      restoredToHp: 1,
    }
  }

  const isSuccess = roll >= 10

  if (isSuccess) {
    const newSaves = [...currentSaves]
    const firstEmpty = newSaves.indexOf(false)
    if (firstEmpty !== -1) newSaves[firstEmpty] = true

    const stable = isStable(newSaves)

    return {
      newSaves,
      newFailures: [...currentFailures],
      result: stable ? 'stable' : 'success',
      roll,
      isNat20,
      isNat1,
      restoredToHp: null,
    }
  } else {
    const newFailures = [...currentFailures]
    const failMultiplier = isNat1 ? 2 : 1
    for (let i = 0; i < failMultiplier; i++) {
      const firstEmpty = newFailures.indexOf(false)
      if (firstEmpty !== -1) {
        newFailures[firstEmpty] = true
      }
    }

    const dead = isDead(newFailures)

    return {
      newSaves: [...currentSaves],
      newFailures,
      result: dead ? 'dead' : 'failure',
      roll,
      isNat20,
      isNat1,
      restoredToHp: null,
    }
  }
}

function rollDeathSaveWithAdvantage(currentSaves, currentFailures, treat18AsNat20 = false) {
  const roll1 = rollD20()
  const roll2 = rollD20()
  const bestRoll = Math.max(roll1, roll2)

  const isNat20 = bestRoll === 20
  const isNat1 = bestRoll === 1
  const isTreatedAsNat20 = treat18AsNat20 && bestRoll === 18

  if (isNat20 || isTreatedAsNat20) {
    return {
      newSaves: [false, false, false],
      newFailures: [false, false, false],
      result: 'nat20',
      roll: bestRoll,
      isNat20: isNat20 || isTreatedAsNat20,
      isNat1,
      restoredToHp: 1,
    }
  }

  const isSuccess = bestRoll >= 10

  if (isSuccess) {
    const newSaves = [...currentSaves]
    const firstEmpty = newSaves.indexOf(false)
    if (firstEmpty !== -1) newSaves[firstEmpty] = true

    const stable = isStable(newSaves)

    return {
      newSaves,
      newFailures: [...currentFailures],
      result: stable ? 'stable' : 'success',
      roll: bestRoll,
      rolls: [roll1, roll2],
      isNat20,
      isNat1,
      restoredToHp: null,
    }
  } else {
    const newFailures = [...currentFailures]
    const failMultiplier = isNat1 ? 2 : 1
    for (let i = 0; i < failMultiplier; i++) {
      const firstEmpty = newFailures.indexOf(false)
      if (firstEmpty !== -1) {
        newFailures[firstEmpty] = true
      }
    }

    const dead = isDead(newFailures)

    return {
      newSaves: [...currentSaves],
      newFailures,
      result: dead ? 'dead' : 'failure',
      roll: bestRoll,
      rolls: [roll1, roll2],
      isNat20,
      isNat1,
      restoredToHp: null,
    }
  }
}

export { rollDeathSave, rollDeathSaveWithAdvantage, isStable, isDead }
