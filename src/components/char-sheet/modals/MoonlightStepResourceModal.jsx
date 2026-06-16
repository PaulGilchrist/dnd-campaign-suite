import React from 'react'
import { getRuntimeValue, setRuntimeBatch } from '../../../hooks/useRuntimeState.js'
import './ResourcePoolModal.css'

function MoonlightStepResourceModal({ playerStats, campaignName, automation, onClose }) {
  const name = playerStats.name
  const conversionRate = automation?.conversionRate || 'level_2_plus'

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

  const maxUses = playerStats._trackedResources?.moonlightStepUses?.max || 0
  const currentUses = (() => {
    const stored = getRuntimeValue(name, 'moonlightStepUses')
    return stored != null ? Number(stored) : maxUses
  })()

  const [selectedLevel, setSelectedLevel] = React.useState(2)

  const availableSlots = (() => {
    if (conversionRate === 'level_2_plus') {
      const result = {}
      for (let lvl = 2; lvl <= 9; lvl++) {
        result[lvl] = currentSlots[lvl]
      }
      return result
    }
    return currentSlots
  })()

  const canConvert = availableSlots[selectedLevel] > 0

  const handleConvert = () => {
    if (!canConvert) return
    const newUses = Math.min(maxUses, currentUses + 1)
    const updates = {
      [`spell_slots_level_${selectedLevel}`]: currentSlots[selectedLevel] - 1,
      moonlightStepUses: newUses,
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
        <h3><i className="fas fa-moon"></i> Moonlight Step — Restore Uses</h3>
        <p className="resource-pool-subtitle">Expend a level 2+ spell slot to regain 1 use of Moonlight Step</p>

        <div className="resource-pool-section">
          <h4>Spell Slot → Moonlight Step Uses</h4>
          <p className="resource-pool-hint">Current uses: {currentUses}/{maxUses}</p>
          <table className="resource-pool-table">
            <thead>
              <tr><th>Level</th><th>Available</th><th>Select</th></tr>
            </thead>
            <tbody>
              {[2, 3, 4, 5, 6, 7, 8, 9].map(lvl => (
                <tr key={`fwd-${lvl}`} className={availableSlots[lvl] === 0 ? 'resource-pool-dim' : ''}>
                  <td>{lvl}</td>
                  <td>{availableSlots[lvl]} / {maxSlots[lvl]}</td>
                  <td>
                    <input
                      type="radio"
                      name="slotLevel"
                      checked={selectedLevel === lvl}
                      disabled={availableSlots[lvl] === 0}
                      onChange={() => setSelectedLevel(lvl)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="resource-pool-actions">
            <button className="char-btn" onClick={handleConvert} disabled={!canConvert}>
              <i className="fa-solid fa-check"></i> Expend Level {selectedLevel} Slot
            </button>
          </div>
        </div>

        <div className="resource-pool-actions resource-pool-cancel">
          <button className="char-btn" onClick={onClose}>
            <i className="fa-solid fa-times"></i> Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default MoonlightStepResourceModal
