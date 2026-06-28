/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import { getRuntimeValue, setRuntimeValue, addStorageChangeListener } from '../../../hooks/runtime/useRuntimeState.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'
import { CONDITIONS, CONDITION_SAVE_DC, CONDITION_SAVE_MAP, getAbilityLabel, getAbilitySaveBonus } from '../../../services/combat/conditions/conditionUtils.js'
import { addEntry } from '../../../services/ui/logService.js'
import { EXHAUSTION_LEVELS, isDeadFromExhaustion, getExhaustionSaveDC } from '../../../services/combat/conditions/exhaustionRules.js'
import usePopup from '../../../hooks/combat/usePopup.js'
import Popup from '../../common/popup.jsx'
import DiceRollResult from '../DiceRollResult.jsx'
import { computeAuraBonus } from '../../../services/combat/auras/auraOfProtection.js'
import { clearUnbreakableMajesty } from '../../../services/combat/auras/unbreakableMajesty.js'
import './CharConditions.css'

const STORAGE_KEY = 'activeConditions'

function loadConditions(name, campaignName) {
  void campaignName;
  const stored = getRuntimeValue(name, STORAGE_KEY)
  return Array.isArray(stored) ? stored : []
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

  const { popupHtml, setPopupHtml } = usePopup(() => null)

  React.useEffect(() => {
    setActiveConditions(loadConditions(playerStats.name, campaignName))
   }, [playerStats.name, campaignName])

   React.useEffect(() => {
    saveConditions(playerStats.name, campaignName, activeConditions)
   }, [activeConditions, playerStats.name, campaignName])

   React.useEffect(() => {
     const unsubscribe = addStorageChangeListener(playerStats.name, () => {
       setActiveConditions(loadConditions(playerStats.name, campaignName))
     })
     return unsubscribe
   }, [playerStats.name, campaignName])

  function logEntry(entry) {
    addEntry(campaignName, entry).catch((e) => { console.error("[CharConditions] Error:", e); })
  }

  async function handleConditionSave(conditionKey, saveAbility, saveLabel) {
    const condition = CONDITIONS.find(c => c.key === conditionKey)
    const conditionName = condition?.label || conditionKey
    const saveBonus = getAbilitySaveBonus(playerStats, saveAbility)
    const hasAdvantage = (conditionEffects?.saveAdvantageCount || 0) > 0 || conditionEffects?.saveAdvantage?.includes(conditionKey) || conditionEffects?.saveAdvantageAbilities?.includes(saveAbility);

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

    const aura = await computeAuraBonus({ targetName: playerStats.name, characters, campaignName, activeMapName })
    const auraBonus = aura.bonus
    const total = finalRoll + saveBonus + auraBonus
    const success = total >= CONDITION_SAVE_DC

    const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined

    logEntry({
      type: 'roll',
      characterName: playerStats.name,
      rollType: 'save',
      name: `${saveLabel} (${conditionName})`,
      rolls: hasAdvantage ? [roll1, roll2] : [roll1],
      mode,
      total,
      bonus: saveBonus + auraBonus,
      bonusDetail,
      dc: CONDITION_SAVE_DC,
      success,
      condition: conditionName,
    })

    setPopupHtml({
      type: 'd20',
      rollType: 'save',
      name: `${saveLabel} (DC ${CONDITION_SAVE_DC})`,
      rolls: hasAdvantage ? [roll1, roll2] : [roll1],
      bonus: saveBonus + auraBonus,
      bonusDetail,
      total,
      dc: CONDITION_SAVE_DC,
      success,
      forcedMode: hasAdvantage ? 'advantage' : undefined,
    })

    setPopupHtml({
      type: 'd20',
      rollType: 'save',
      name: `${saveLabel} (DC ${CONDITION_SAVE_DC})`,
      rolls: hasAdvantage ? [roll1, roll2] : [roll1],
      bonus: saveBonus,
      dc: CONDITION_SAVE_DC,
      success,
      forcedMode: hasAdvantage ? 'advantage' : undefined,
    })

    if (success) {
    setActiveConditions(prev => prev.filter(c => c !== conditionKey))
    onConditionsChange?.()
   }
  }

  const toggle = (key) => {
    const saveAbility = CONDITION_SAVE_MAP[key]

    if (activeConditions.includes(key) && saveAbility) {
      handleConditionSave(key, saveAbility, getAbilityLabel(saveAbility))
      return
     }

    setActiveConditions(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])
     onConditionsChange?.()
     if (key === 'incapacitated') {
         clearUnbreakableMajesty(playerStats.name, campaignName)
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

  return (
    <div className="char-conditions">
      {popupHtml && (
        <Popup onClickOrKeyDown={() => setPopupHtml(null)}>
          <DiceRollResult {...popupHtml} />
        </Popup>
      )}
      <div className="char-conditions-grid">
        <span className={`exhaustion-badge ${dead ? 'exhaustion-badge--dead' : active ? 'exhaustion-badge--active' : ''}`}>
          <button className="exhaustion-badge-btn" onClick={() => adjustExhaustion(-1)} type="button" disabled={exhaustionLevel <= 0}>−</button>
          <span className="exhaustion-badge-label" title={`Exhaustion level ${exhaustionLevel}${dead ? ' - DEAD' : ''}`}>Exhaustion ({exhaustionLevel})</span>
          <button className="exhaustion-badge-btn" onClick={() => adjustExhaustion(1)} type="button" disabled={dead}>+</button>
        </span>
        {CONDITIONS.map(({ key, label }) => (
          <button
            key={key}
            className={`condition-badge ${activeConditions.includes(key) ? 'condition-badge--active' : ''}`}
            onClick={() => toggle(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default CharConditions
