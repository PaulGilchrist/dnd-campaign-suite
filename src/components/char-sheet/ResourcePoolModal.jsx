import React from 'react'
import { getRuntimeValue, setRuntimeBatch } from '../../hooks/useRuntimeState.js'
import { getCurrentCombatRound } from '../../services/encounters/combatData.js'
import './ResourcePoolModal.css'

const FWD_USED_KEY = 'wildResurgenceFwdUsedRound'
const REV_USED_KEY = 'wildResurgenceReversedThisRest'

function ResourcePoolModal({ playerStats, campaignName, automation, onClose }) {
  const name = playerStats.name
  const conversion = automation.conversion || ''
  const reverseConversion = automation.reverseConversion || ''
  const conversionRate = automation.conversionRate || ''

  const maxSlots = (() => {
    const slots = {}
    for (let lvl = 1; lvl <= 9; lvl++) {
      slots[lvl] = playerStats.spellAbilities?.[`spell_slots_level_${lvl}`] || 0
    }
    return slots
  })()

  const currentSlots = (() => {
    const slots = {}
    for (let lvl = 1; lvl <= 9; lvl++) {
      const stored = getRuntimeValue(name, `spell_slots_level_${lvl}`)
      slots[lvl] = stored != null ? Math.min(maxSlots[lvl], Number(stored)) : maxSlots[lvl]
    }
    return slots
  })()

  const maxWS = playerStats._trackedResources?.wildShapeUses?.max || 0
  const currentWS = (() => {
    const stored = getRuntimeValue(name, 'wildShapeUses')
    return stored != null ? Number(stored) : maxWS
  })()

  const fwdHasConversion = conversion === 'spell_slot_to_wild_shape'
  const revHasConversion = reverseConversion === 'wild_shape_to_spell_slot'
  const isArchdruid = conversion === 'wild_shape_to_spell_slot' && conversionRate === '2_levels_per_use'

  const currentRound = getCurrentCombatRound()
  const fwdUsedRound = getRuntimeValue(name, FWD_USED_KEY)
  const fwdPrereqsMet = fwdHasConversion && currentWS === 0 && (fwdUsedRound !== currentRound)

  const revUsedThisRest = getRuntimeValue(name, REV_USED_KEY)
  const revPrereqsMet = revHasConversion && currentWS > 0 && !revUsedThisRest

  const [selectedLevel, setSelectedLevel] = React.useState(1)
  const [archdruidUses, setArchdruidUses] = React.useState(1)

  const canForward = fwdPrereqsMet && currentSlots[selectedLevel] > 0

  const handleForward = () => {
    if (!canForward) return
    const updates = {
      [`spell_slots_level_${selectedLevel}`]: currentSlots[selectedLevel] - 1,
      wildShapeUses: currentWS + 1,
      [FWD_USED_KEY]: currentRound,
    }
    setRuntimeBatch(name, updates, campaignName)
    onClose()
  }

  const handleReverse = () => {
    if (!revPrereqsMet) return
    const updates = {
      wildShapeUses: currentWS - 1,
      spell_slots_level_1: Math.min(maxSlots[1], currentSlots[1] + 1),
      [REV_USED_KEY]: true,
    }
    setRuntimeBatch(name, updates, campaignName)
    onClose()
  }

  const archdruidTargetLevel = Math.min(archdruidUses * 2, 9)
  const archdruidCanConvert = isArchdruid && archdruidUses > 0 && archdruidUses <= currentWS && currentSlots[archdruidTargetLevel] > 0

  const handleArchdruidConvert = () => {
    if (!archdruidCanConvert) return
    const updates = {
      wildShapeUses: currentWS - archdruidUses,
      [`spell_slots_level_${archdruidTargetLevel}`]: Math.min(maxSlots[archdruidTargetLevel], currentSlots[archdruidTargetLevel] + 1),
    }
    setRuntimeBatch(name, updates, campaignName)
    onClose()
  }

  React.useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="resource-pool-overlay no-print" onClick={onClose}>
      <div className="resource-pool-modal" onClick={(e) => e.stopPropagation()}>
        <h3><i className="fas fa-leaf"></i> Wild Resurgence</h3>
        <p className="resource-pool-subtitle">Convert between Wild Shape uses and spell slots</p>

        {fwdHasConversion && (
          <div className="resource-pool-section">
            <h4>Spell Slot &rarr; Wild Shape</h4>
            <p className="resource-pool-hint">Expend a spell slot to regain one use of Wild Shape. Once per turn, when you have no uses left.</p>
            {!fwdPrereqsMet && currentWS > 0 ? (
              <p className="resource-pool-blocked">
                You have {currentWS} Wild Shape use{currentWS > 1 ? 's' : ''} remaining. Use must be 0 to convert.
              </p>
            ) : !fwdPrereqsMet && currentWS === 0 ? (
              <p className="resource-pool-blocked">Already used this conversion this round.</p>
            ) : (
              <>
                <table className="resource-pool-table">
                  <thead>
                    <tr><th>Level</th><th>Available</th><th>Select</th></tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => (
                      <tr key={`fwd-${lvl}`} className={currentSlots[lvl] === 0 ? 'resource-pool-dim' : ''}>
                        <td>{lvl}</td>
                        <td>{currentSlots[lvl]} / {maxSlots[lvl]}</td>
                        <td>
                          <input
                            type="radio"
                            name="slotLevel"
                            checked={selectedLevel === lvl}
                            disabled={currentSlots[lvl] === 0}
                            onChange={() => setSelectedLevel(lvl)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="resource-pool-actions">
                  <button className="char-btn" onClick={handleForward} disabled={!canForward}>
                    <i className="fa-solid fa-check"></i> Expend Level {selectedLevel} Slot
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {isArchdruid && (
          <div className="resource-pool-section">
            <h4>Nature Magician</h4>
            <p className="resource-pool-hint">Convert Wild Shape uses into a spell slot. Each use contributes 2 spell levels (max level 9).</p>
            {currentWS === 0 ? (
              <p className="resource-pool-blocked">You have no Wild Shape uses remaining.</p>
            ) : (
              <>
                <table className="resource-pool-table">
                  <thead>
                    <tr><th>Uses</th><th>Slot Level</th><th>Available</th><th>Select</th></tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.min(currentWS, 4) }, (_, i) => i + 1).map(n => {
                      const lvl = Math.min(n * 2, 9)
                      return (
                        <tr key={`arch-${n}`} className={currentSlots[lvl] === 0 || n > currentWS ? 'resource-pool-dim' : ''}>
                          <td>{n}</td>
                          <td>{lvl}</td>
                          <td>{currentSlots[lvl]} / {maxSlots[lvl]}</td>
                          <td>
                            <input
                              type="radio"
                              name="archdruidUses"
                              checked={archdruidUses === n}
                              disabled={currentSlots[lvl] === 0 || n > currentWS}
                              onChange={() => setArchdruidUses(n)}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="resource-pool-actions">
                  <button className="char-btn" onClick={handleArchdruidConvert} disabled={!archdruidCanConvert}>
                    <i className="fa-solid fa-check"></i> Convert {archdruidUses} Wild Shape &rarr; Level {archdruidTargetLevel} Slot
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!isArchdruid && revHasConversion && (
          <div className="resource-pool-section">
            <h4>Wild Shape &rarr; Spell Slot</h4>
            <p className="resource-pool-hint">Expend one Wild Shape use to regain a level 1 spell slot. Once per Long Rest.</p>
            {!revPrereqsMet && currentWS === 0 ? (
              <p className="resource-pool-blocked">You have no Wild Shape uses remaining.</p>
            ) : !revPrereqsMet ? (
              <p className="resource-pool-blocked">Already used this conversion this Long Rest.</p>
            ) : (
              <div className="resource-pool-actions">
                <button className="char-btn" onClick={handleReverse}>
                  <i className="fa-solid fa-check"></i> Convert 1 Wild Shape &rarr; Level 1 Slot
                </button>
              </div>
            )}
          </div>
        )}

        <div className="resource-pool-actions resource-pool-cancel">
          <button className="char-btn" onClick={onClose}>
            <i className="fa-solid fa-times"></i> Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResourcePoolModal
