import { rollD20 } from '../dice/diceRoller.js'

function rollConcentrationSave(saveBonus, dc, dragonConstellationActive) {
  let roll = rollD20()
  if (dragonConstellationActive && roll <= 9) {
    roll = 10
  }
  const total = roll + saveBonus
  const success = total >= dc
  return { success, roll, total }
}

function breakConcentration() {
  return null
}

function computeConcentrationDc(damageTaken) {
  return Math.max(10, Math.floor(damageTaken / 2))
}

export { rollConcentrationSave, breakConcentration, computeConcentrationDc }
