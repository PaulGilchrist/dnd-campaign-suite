import React from 'react'
import storage from '../../../services/storage.js'
import './CharConditions.css'

const CONDITIONS = [
  { key: 'blinded', label: 'Blinded' },
  { key: 'charmed', label: 'Charmed' },
  { key: 'cursed', label: 'Cursed' },
  { key: 'deafened', label: 'Deafened' },
  { key: 'frightened', label: 'Frightened' },
  { key: 'grappled', label: 'Grappled' },
  { key: 'incapacitated', label: 'Incapacitated' },
  { key: 'paralyzed', label: 'Paralyzed' },
  { key: 'petrified', label: 'Petrified' },
  { key: 'poisoned', label: 'Poisoned' },
  { key: 'prone', label: 'Prone' },
  { key: 'restrained', label: 'Restrained' },
  { key: 'stunned', label: 'Stunned' },
  { key: 'unconscious', label: 'Unconscious' },
]

const STORAGE_KEY = 'activeConditions'

function loadConditions(name, campaignName) {
  const stored = storage.getProperty(name, STORAGE_KEY, campaignName)
  return Array.isArray(stored) ? stored : []
}

function saveConditions(name, campaignName, conditions) {
  storage.setProperty(name, STORAGE_KEY, conditions, campaignName)
}

function CharConditions({ playerStats, campaignName }) {
  const [activeConditions, setActiveConditions] = React.useState(() =>
    loadConditions(playerStats.name, campaignName)
  )

  const toggle = (key) => {
    setActiveConditions(prev => {
      const next = prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
      saveConditions(playerStats.name, campaignName, next)
      return next
    })
  }

  return (
    <div className="char-conditions">
      <div className="char-conditions-grid">
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
