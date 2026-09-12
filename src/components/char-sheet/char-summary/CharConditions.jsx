import React from 'react'
import { getRuntimeValue, setRuntimeValue, addStorageChangeListener } from '../../../hooks/runtime/useRuntimeState.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'
import { getAbilityLabel, getAbilitySaveBonus } from '../../../services/combat/conditions/conditionUtils.js'
import { CONDITION_DESCRIPTIONS } from '../../../services/combat/conditions/effectDescriptions.js'
import { addEntry } from '../../../services/ui/logService.js'
import { EXHAUSTION_LEVELS, isDeadFromExhaustion, getExhaustionSaveDC } from '../../../services/combat/conditions/exhaustionRules.js'
import { logConditionSave } from '../../../services/encounters/combatLoggingService.js'
import { hasSaveAdvantage } from '../../../services/combat/conditions/conditionEffects.js'
import { removeSlowEffectsForTarget } from '../../../services/combat/conditions/slowEffects.js'
import { isAuraOfPurityActive, getAuraOfPuritySaveAdvantageConditions } from '../../../services/automation/handlers/buffs/auraOfPurityHandler.js'
import usePopup from '../../../hooks/combat/usePopup.js'
import Popup from '../../common/popup.jsx'
import DiceRollResult from '../DiceRollResult.jsx'
import { computeAuraBonus } from '../../../services/combat/auras/auraOfProtection.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
import CreatureBadge from '../../common/CreatureBadge.jsx'
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

// Check saveModifiers directly for Powerful Build (same logic as conditionSaveService)
function hasPowerfulBuildGrappleAdvantage(playerStats) {
  const saveModifiers = playerStats?.saveModifiers || playerStats?.computedStats?.saveModifiers
  return saveModifiers?.some(mod =>
    mod.target === 'ability_check' && mod.effect === 'advantage' && mod.abilities?.includes('STR') && mod.condition === 'powerful_build_grapple_escape'
  )
}

function computeConditionSaveAdvantage(playerStats, campaignName, conditionEffects, conditionKey) {
  let hasAdvantage = hasSaveAdvantage(conditionEffects, conditionKey, conditionEffects?.restoreBalance)
    || (conditionKey === 'grappled' && (conditionEffects?.strCheckAdvantage || (conditionEffects?.abilityCheckAdvantageAbilities && conditionEffects.abilityCheckAdvantageAbilities.includes('STR'))))

  if (isAuraOfPurityActive(playerStats.name, campaignName)
      && getAuraOfPuritySaveAdvantageConditions(playerStats.name, campaignName).includes(conditionKey)) {
      hasAdvantage = true
  }

  if (conditionKey === 'grappled' && hasPowerfulBuildGrappleAdvantage(playerStats)) {
    hasAdvantage = true
  }
  return hasAdvantage
}

function rollConditionSaveDice(hasAdvantage) {
  if (hasAdvantage) {
    const roll1 = rollD20()
    const roll2 = rollD20()
    return { roll1, roll2, finalRoll: Math.max(roll1, roll2), mode: 'advantage' }
  }
  const roll1 = rollD20()
  return { roll1, roll2: 0, finalRoll: roll1, mode: 'normal' }
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
    // SP-109: never POST a stale empty list while the runtime store is still
    // un-hydrated (reports no activeConditions key) — a fresh sheet mount must
    // not wipe server-side conditions.
    const raw = getRuntimeValue(playerStats.name, STORAGE_KEY)
    if (!Array.isArray(raw) && activeConditions.length === 0) return
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

  function logEntry(entry) {
    addEntry(campaignName, entry).catch((e) => { console.error("[CharConditions] Error:", e); })
  }

  async function handleConditionSave(conditionKey) {
    const meta = conditionMeta[conditionKey]
    if (!meta || !meta.dc) return

    const saveAbility = meta.ability || 'con'
    const saveLabel = getAbilityLabel(saveAbility)
    const conditionLabel = conditionKey === 'speed_zero' ? 'Speed 0' : conditionKey.charAt(0).toUpperCase() + conditionKey.slice(1)
    const saveBonus = getAbilitySaveBonus(playerStats, saveAbility)
    const hasAdvantage = computeConditionSaveAdvantage(playerStats, campaignName, conditionEffects, conditionKey)

    const { roll1, roll2, finalRoll, mode } = rollConditionSaveDice(hasAdvantage)
    const rolls = hasAdvantage ? [roll1, roll2] : [roll1]

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
      rolls,
      mode,
      total,
      bonus: saveBonus + auraBonus,
      bonusDetail,
      dc: meta.dc,
      success,
      condition: conditionLabel,
    })

    logConditionSave({ campaignName, creatureName: playerStats.name, roll: hasAdvantage ? [roll1, roll2] : finalRoll, bonus: saveBonus + auraBonus, bonusDetail, conditionLabel, abilityLabel: saveLabel, dc: meta.dc, success })

    setPopupHtml({
      type: 'd20',
      rollType: 'condition-save',
      name: `${saveLabel} (DC ${meta.dc})`,
      rolls,
      bonus: saveBonus + auraBonus,
      bonusDetail,
      total,
      dc: meta.dc,
      success,
      forcedMode: hasAdvantage ? 'advantage' : undefined,
    })

    if (success) {
      const remaining = activeConditions.filter(c => c !== conditionKey)
      setActiveConditions(remaining)
      saveConditions(playerStats.name, campaignName, remaining)
      const existingMeta = { ...conditionMeta }
      delete existingMeta[conditionKey]
      setConditionMeta(existingMeta)
      // SP-109: Slow ends on itself on a successful repeat save — strip its target effects
      if (String(conditionKey).toLowerCase() === 'slow') {
        removeSlowEffectsForTarget(playerStats.name, campaignName)
        logEntry({
          type: 'condition',
          action: 'removed',
          characterName: playerStats.name,
          condition: 'Slow effects',
          reason: 'Slow (successful repeat save)',
          note: `${playerStats.name} succeeded on the WIS repeat save; Slow ends and its target effects are removed.`,
          timestamp: Date.now(),
        })
      }
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

  if (!hasConditions && !hasExhaustion) {
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

          const condCls = key === 'invisible' ? 'effect-buff' : 'effect-condition'
          return (
            <CreatureBadge
              key={key}
              label={displayText}
              cls={condCls}
              tooltip={title}
              onClick={onClick}
              disabled={!hasSave}
            />
          )
        })}
        {hasExhaustion && (
          <span className={`exhaustion-badge ${dead ? 'exhaustion-badge--dead' : 'exhaustion-badge--active'}`}>
            <button className="exhaustion-badge-btn" onClick={() => adjustExhaustion(-1)} type="button" disabled={exhaustionLevel <= 0}>−</button>
            <span className="exhaustion-badge-label" title={`Exhaustion level ${exhaustionLevel}${dead ? ' - DEAD' : ''}\n\n${CONDITION_DESCRIPTIONS['Exhausted'] || ''}`}>Exhaustion ({exhaustionLevel})</span>
            <button className="exhaustion-badge-btn" onClick={() => adjustExhaustion(1)} type="button" disabled={dead}>+</button>
          </span>
        )}
      </div>
    </div>
  )
}

export default CharConditions
