import React from 'react'
import { getRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js'
import './ResourcePoolModal.css'

function WildCompanionModal({ playerStats, campaignName, onClose }) {
  const name = playerStats.name

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

  const [selectedLevel, setSelectedLevel] = React.useState(1)

  const slotHasAvailable = currentSlots[selectedLevel] > 0

  const handleSpellSlot = () => {
    if (!slotHasAvailable) return
    const updates = {
      [`spell_slots_level_${selectedLevel}`]: currentSlots[selectedLevel] - 1,
    }
    setRuntimeBatch(name, updates, campaignName)
    const freeCastKey = `_Wild_Companion_freeCast`
    setRuntimeBatch(name, { [freeCastKey]: ['Find Familiar'] }, campaignName)
    onClose()
  }

  const handleWildShape = () => {
    if (currentWS <= 0) return
    const updates = {
      wildShapeUses: currentWS - 1,
    }
    setRuntimeBatch(name, updates, campaignName)
    const freeCastKey = `_Wild_Companion_freeCast`
    setRuntimeBatch(name, { [freeCastKey]: ['Find Familiar'] }, campaignName)
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
        <h3><i className="fas fa-leaf"></i> Wild Companion</h3>
        <p className="resource-pool-subtitle">Cast Find Familiar without Material components</p>

        <div className="resource-pool-section">
          <h4>Expend a Spell Slot</h4>
          <p className="resource-pool-hint">Choose a spell slot level to expend for Find Familiar.</p>
          <table className="resource-pool-table">
            <thead>
              <tr><th>Level</th><th>Available</th><th>Select</th></tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => (
                <tr key={`slot-${lvl}`} className={currentSlots[lvl] === 0 ? 'resource-pool-dim' : ''}>
                  <td>{lvl}</td>
                  <td>{currentSlots[lvl]} / {maxSlots[lvl]}</td>
                  <td>
                    <input
                      type="radio"
                      name="wildCompanionSlotLevel"
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
            <button className="char-btn" onClick={handleSpellSlot} disabled={!slotHasAvailable}>
              <i className="fa-solid fa-check"></i> Expend Level {selectedLevel} Slot
            </button>
          </div>
        </div>

        <div className="resource-pool-section">
          <h4>Expend Wild Shape</h4>
          <p className="resource-pool-hint">Use one Wild Shape use instead of a spell slot.</p>
          {currentWS <= 0 ? (
            <p className="resource-pool-blocked">You have no Wild Shape uses remaining.</p>
          ) : (
            <div className="resource-pool-actions">
              <button className="char-btn" onClick={handleWildShape}>
                <i className="fa-solid fa-check"></i> Expend 1 Wild Shape
              </button>
            </div>
          )}
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

export default WildCompanionModal
