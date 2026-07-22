/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import { getRuntimeValue, setRuntimeValue, addStorageChangeListener } from '../../../hooks/runtime/useRuntimeState.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'
import { getAbilityLabel, getAbilitySaveBonus } from '../../../services/combat/conditions/conditionUtils.js'
import { CONDITION_DESCRIPTIONS } from '../../../services/combat/conditions/effectDescriptions.js'
import { addEntry } from '../../../services/ui/logService.js'
import { EXHAUSTION_LEVELS, isDeadFromExhaustion, getExhaustionSaveDC } from '../../../services/combat/conditions/exhaustionRules.js'
import { logConditionSave } from '../../../services/encounters/combatLoggingService.js'
import { hasSaveAdvantage } from '../../../services/combat/conditions/conditionEffects.js'
import usePopup from '../../../hooks/combat/usePopup.js'
import Popup from '../../common/popup.jsx'
import DiceRollResult from '../DiceRollResult.jsx'
import { computeAuraBonus } from '../../../services/combat/auras/auraOfProtection.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
import './CharConditions.css'

const STORAGE_KEY = 'activeConditions'
const META_KEY = 'activeConditionMeta'

function loadConditions(name, campaignName) {
  void campaignName;
  const stored = getRuntimeValue(name, STORAGE_KEY)
  return Array.isArray(stored) ? stored : []
}

function loadConditionMeta(name, campaignName) {
  const stored = getRuntimeValue(name, META_KEY, campaignName)
  return typeof stored === 'object' && stored !== null ? stored : {}
}

function saveConditions(name, campaignName, conditions) {
  setRuntimeValue(name, STORAGE_KEY, conditions, campaignName)
}

export { EXHAUSTION_LEVELS }

export function loadActiveConditions(name, campaignName) {
  return loadConditions(name, campaignName)
}

function CharConditions({ playerStats, campaignName, activeMapName, characters, exhaustionLevel, onConditionsChange, conditionEffects }) {
  const [activeConditions, setActiveConditions] = React.useState(() =>
    loadConditions(playerStats.name, campaignName)
  )
  const [conditionMeta, setConditionMeta] = React.useState(() =>
    loadConditionMeta(playerStats.name, campaignName)
  )

  const { popupHtml, setPopupHtml } = usePopup(() => null)

  React.useEffect(() => {
    const conditions = loadConditions(playerStats.name, campaignName)
    const meta = loadConditionMeta(playerStats.name, campaignName)
    setActiveConditions(conditions)
    setConditionMeta(meta)
  }, [playerStats.name, campaignName])

  React.useEffect(() => {
    saveConditions(playerStats.name, campaignName, activeConditions)
  }, [activeConditions, playerStats.name, campaignName])

  React.useEffect(() => {
    const unsubscribe = addStorageChangeListener(playerStats.name, () => {
      const conditions = loadConditions(playerStats.name, campaignName)
      const meta = loadConditionMeta(playerStats.name, campaignName)
      setActiveConditions(conditions)
      setConditionMeta(meta)
    })
    return unsubscribe
  }, [playerStats.name, campaignName])

  const combatSummary = getCombatSummary(campaignName)
  const playerCreature = combatSummary?.creatures?.find(c => c.name === playerStats.name)
  const concentration = playerCreature?.concentration ?? null

  function logEntry(entry) {
    addEntry(campaignName, entry).catch((e) => { console.error("[CharConditions] Error:", e); })
  }

  async function handleConditionSave(conditionKey) {
    const meta = conditionMeta[conditionKey]
    if (!meta || !meta.dc) return

    const saveAbility = meta.ability || 'con'
    const saveLabel = getAbilityLabel(saveAbility)
    const conditionLabel = conditionKey.charAt(0).toUpperCase() + conditionKey.slice(1)
    const saveBonus = getAbilitySaveBonus(playerStats, saveAbility)
    let hasAdvantage = hasSaveAdvantage(conditionEffects, conditionKey, conditionEffects?.restoreBalance)
      || (conditionKey === 'grappled' && (conditionEffects?.strCheckAdvantage || (conditionEffects?.abilityCheckAdvantageAbilities && conditionEffects.abilityCheckAdvantageAbilities.includes('STR'))))

    // Check saveModifiers directly for Powerful Build (same logic as conditionSaveService)
    if (conditionKey === 'grappled') {
      const saveModifiers = playerStats?.saveModifiers || playerStats?.computedStats?.saveModifiers
      const powerfulBuildAdvantage = saveModifiers?.some(mod =>
        mod.target === 'ability_check' && mod.effect === 'advantage' && mod.abilities?.includes('STR') && mod.condition === 'powerful_build_grapple_escape'
      )
      if (powerfulBuildAdvantage) {
        hasAdvantage = true
      }
    }

    let roll1, roll2, finalRoll, mode
    if (hasAdvantage) {
      roll1 = rollD20()
      roll2 = rollD20()
      finalRoll = Math.max(roll1, roll2)
      mode = 'advantage'
    } else {
      roll1 = rollD20()
      roll2 = 0
      finalRoll = roll1
      mode = 'normal'
    }

    const aura = await computeAuraBonus({ targetName: playerStats.name, characters, campaignName, activeMapName, allCreatures: combatSummary?.creatures })
    const auraBonus = aura.bonus
    const total = finalRoll + saveBonus + auraBonus
    const success = total >= meta.dc

    const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined

    logEntry({
      type: 'roll',
      characterName: playerStats.name,
      rollType: 'save',
      name: `${saveLabel} (${conditionLabel})`,
      rolls: hasAdvantage ? [roll1, roll2] : [roll1],
      mode,
      total,
      bonus: saveBonus + auraBonus,
      bonusDetail,
      dc: meta.dc,
      success,
      condition: conditionLabel,
    })

    logConditionSave(campaignName, playerStats.name, finalRoll, saveBonus + auraBonus, bonusDetail, conditionLabel, saveLabel, meta.dc, success)

    setPopupHtml({
      type: 'd20',
      rollType: 'condition-save',
      name: `${saveLabel} (DC ${meta.dc})`,
      rolls: hasAdvantage ? [roll1, roll2] : [roll1],
      bonus: saveBonus + auraBonus,
      bonusDetail,
      total,
      dc: meta.dc,
      success,
      forcedMode: hasAdvantage ? 'advantage' : undefined,
    })

    if (success) {
      setActiveConditions(prev => prev.filter(c => c !== conditionKey))
      const existingMeta = { ...conditionMeta }
      delete existingMeta[conditionKey]
      setConditionMeta(existingMeta)
      onConditionsChange?.()
    }
  }

  const adjustExhaustion = (delta) => {
    if (delta < 0 && exhaustionLevel > 0) {
      const conSaveBonus = getAbilitySaveBonus(playerStats, 'con')
      const dc = getExhaustionSaveDC(exhaustionLevel)
      const roll = rollD20()
      const total = roll + conSaveBonus
      const success = total >= dc

      logEntry({
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'save',
        name: 'Constitution Save (Exhaustion)',
        rolls: [roll],
        mode: 'normal',
        total: roll,
        bonus: conSaveBonus,
        dc,
        success,
        condition: 'Exhaustion',
      })

      setPopupHtml({
        type: 'd20',
        rollType: 'save',
        name: `Constitution (DC ${dc})`,
        rolls: [roll],
        bonus: conSaveBonus,
        dc,
        success,
      })

      if (success) {
        const next = Math.max(0, exhaustionLevel - 1)
        setRuntimeValue(playerStats.name, 'exhaustionLevel', next, campaignName)
      }
    } else if (delta > 0) {
      const next = Math.min(EXHAUSTION_LEVELS, exhaustionLevel + delta)
      setRuntimeValue(playerStats.name, 'exhaustionLevel', next, campaignName)
    }
  }

  const dead = isDeadFromExhaustion(exhaustionLevel)
  const active = exhaustionLevel > 0
  const hasConditions = activeConditions.length > 0
  const hasExhaustion = active
  const hasConcentration = !!concentration

  if (!hasConditions && !hasExhaustion && !hasConcentration) {
    return popupHtml ? (
      <Popup onClickOrKeyDown={() => setPopupHtml(null)}>
        <DiceRollResult {...popupHtml} />
      </Popup>
    ) : null
  }

  return (
    <div className="char-conditions">
      {popupHtml && (
        <Popup onClickOrKeyDown={() => setPopupHtml(null)}>
          <DiceRollResult {...popupHtml} />
        </Popup>
      )}
      <div className="char-conditions-grid">
        {hasConditions && [...new Set(activeConditions)].map(key => {
          const meta = conditionMeta[key] || {}
          const label = key.charAt(0).toUpperCase() + key.slice(1)
          const hasSave = !!(meta.dc && meta.ability)
          const displayText = meta.dc ? `${label} DC ${meta.dc}` : label
          const title = meta.dc ? CONDITION_DESCRIPTIONS[label] || label : (CONDITION_DESCRIPTIONS[label] || label)
          const onClick = hasSave ? () => handleConditionSave(key) : null

          return (
            <button
              key={key}
              className={`condition-badge condition-badge--active ${hasSave ? 'condition-badge--savable' : 'condition-badge--display-only'}`}
              onClick={onClick}
              type="button"
              title={title}
              disabled={!hasSave}
            >
              {displayText}
            </button>
          )
        })}
        {hasExhaustion && (
          <span className={`exhaustion-badge ${dead ? 'exhaustion-badge--dead' : 'exhaustion-badge--active'}`}>
            <button className="exhaustion-badge-btn" onClick={() => adjustExhaustion(-1)} type="button" disabled={exhaustionLevel <= 0}>−</button>
            <span className="exhaustion-badge-label" title={`Exhaustion level ${exhaustionLevel}${dead ? ' - DEAD' : ''}\n\n${CONDITION_DESCRIPTIONS['Exhausted'] || ''}`}>Exhaustion ({exhaustionLevel})</span>
            <button className="exhaustion-badge-btn" onClick={() => adjustExhaustion(1)} type="button" disabled={dead}>+</button>
          </span>
        )}
        {hasConcentration && (
          <span className="concentration-badge">
            <span className="concentration-badge-label" title={`Concentration: ${concentration.spell} (DC ${concentration.dc} Constitution)`}>
              <i className="fa-solid fa-spinner"></i> {concentration.spell} DC {concentration.dc}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

export default CharConditions
