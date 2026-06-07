import { rollD20 } from '../dice/diceRoller.js'

function rollConcentrationSave(saveBonus, dc) {
  const roll = rollD20()
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
