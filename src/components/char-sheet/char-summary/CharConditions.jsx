/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import storage from '../../../services/storage.js'
import { rollD20 } from '../../../services/diceRoller.js'
import { CONDITIONS, CONDITION_SAVE_DC, CONDITION_SAVE_MAP, getAbilityLabel, getAbilitySaveBonus } from '../../../services/conditionUtils.js'
import { EXHAUSTION_LEVELS, isDeadFromExhaustion, getExhaustionSaveDC } from '../../../services/exhaustionRules.js'
import usePopup from '../../../hooks/usePopup.js'
import Popup from '../../common/Popup.jsx'
import DiceRollResult from '../DiceRollResult.jsx'
import './CharConditions.css'

const STORAGE_KEY = 'activeConditions'

function loadConditions(name, campaignName) {
  const stored = storage.getProperty(name, STORAGE_KEY, campaignName)
  return Array.isArray(stored) ? stored : []
}

function saveConditions(name, campaignName, conditions) {
  storage.setProperty(name, STORAGE_KEY, conditions, campaignName)
}

export { EXHAUSTION_LEVELS }

export function loadActiveConditions(name, campaignName) {
  return loadConditions(name, campaignName)
}

function CharConditions({ playerStats, campaignName, exhaustionLevel, onExhaustionChange, onConditionsChange }) {
  const [activeConditions, setActiveConditions] = React.useState(() =>
    loadConditions(playerStats.name, campaignName)
  )

  const { popupHtml, setPopupHtml } = usePopup(() => null)

  React.useEffect(() => {
    setActiveConditions(loadConditions(playerStats.name, campaignName))
  }, [playerStats.name, campaignName])

  function logEntry(entry) {
    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).catch(() => {})
  }

  function handleConditionSave(conditionKey, saveAbility, saveLabel) {
    const condition = CONDITIONS.find(c => c.key === conditionKey)
    const conditionName = condition?.label || conditionKey
    const saveBonus = getAbilitySaveBonus(playerStats, saveAbility)
    const roll = rollD20()
    const total = roll + saveBonus
    const success = total >= CONDITION_SAVE_DC

    logEntry({
      type: 'roll',
      characterName: playerStats.name,
      rollType: 'save',
      name: `${saveLabel} (${conditionName})`,
      rolls: [roll],
      mode: 'normal',
      total: roll,
      bonus: saveBonus,
      dc: CONDITION_SAVE_DC,
      success,
      condition: conditionName,
    })

    setPopupHtml({
      type: 'd20',
      rollType: 'save',
      name: `${saveLabel} (DC ${CONDITION_SAVE_DC})`,
      rolls: [roll],
      bonus: saveBonus,
      dc: CONDITION_SAVE_DC,
      success,
    })

    if (success) {
      setActiveConditions(prev => {
        const next = prev.filter(c => c !== conditionKey)
        saveConditions(playerStats.name, campaignName, next)
        return next
      })
      onConditionsChange?.()
    }
  }

  const toggle = (key) => {
    const saveAbility = CONDITION_SAVE_MAP[key]

    if (activeConditions.includes(key) && saveAbility) {
      handleConditionSave(key, saveAbility, getAbilityLabel(saveAbility))
      return
    }

    setActiveConditions(prev => {
      const next = prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
      saveConditions(playerStats.name, campaignName, next)
      return next
    })
    onConditionsChange?.()
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
        storage.setProperty(playerStats.name, 'exhaustionLevel', next, campaignName)
        onExhaustionChange(next)
      }
    } else if (delta > 0) {
      const next = Math.min(EXHAUSTION_LEVELS, exhaustionLevel + delta)
      storage.setProperty(playerStats.name, 'exhaustionLevel', next, campaignName)
      onExhaustionChange(next)
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
