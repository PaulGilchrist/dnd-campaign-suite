import React from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../../services/ui/logService.js'
import './CircleOfTheLandSpellsModal.css'

function CircleOfTheLandSpellsModal({ playerStats, campaignName, onClose }) {
    const name = playerStats.name
    const [selectedLandType, setSelectedLandType] = React.useState(null)
    const currentLandType = getRuntimeValue(name, '_circleOfTheLandType')

    const landTypes = React.useMemo(() => {
        const spells = playerStats.class?.major?.spells || []
        const types = ['arid', 'polar', 'temperate', 'tropical']
        return types.map(type => ({
            name: type.charAt(0).toUpperCase() + type.slice(1),
            type,
            spells: spells.filter(s => s.landType === type).map(s => ({ name: s.name, level: s.level }))
        }))
    }, [playerStats.class?.major?.spells])

    const handleSelectLandType = (landType) => {
        setRuntimeValue(name, '_circleOfTheLandType', landType.name, campaignName)
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: name,
            abilityName: 'Circle of the Land Spells',
            description: `Chose land type: ${landType.name}`,
        }).catch(() => {})
        onClose()
    }

    React.useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [onClose])

    return (
        <div className="cotl-overlay no-print" onClick={onClose}>
            <div className="cotl-modal" onClick={(e) => e.stopPropagation()}>
                <h3><i className="fa-solid fa-leaf"></i> Circle of the Land Spells</h3>
                <p className="cotl-subtitle">Choose your land type to determine bonus prepared spells. You can change this after each Long Rest.</p>

                <div className="cotl-section">
                    <p className="cotl-hint">Current selection: {currentLandType || 'None chosen'}</p>
                    <p className="cotl-hint">Choose a land type to gain its associated prepared spells:</p>
                    <ul className="cotl-land-list">
                        {landTypes.map(landType => (
                            <li key={landType.type} className="cotl-land-item">
                                <button
                                    className={'cotl-land-btn' + (selectedLandType === landType.type ? ' cotl-land-btn--active' : '')}
                                    onClick={() => handleSelectLandType(landType)}
                                    onMouseEnter={() => setSelectedLandType(landType.type)}
                                >
                                    <div className="cotl-land-name">
                                        <i className={`fa-solid fa-${landType.type === 'arid' ? 'sun' : landType.type === 'polar' ? 'snowflake' : landType.type === 'temperate' ? 'cloud-sun' : 'leaf'}`}></i>
                                        {landType.name}
                                    </div>
                                    {selectedLandType === landType.type && (
                                        <ul className="cotl-spell-list">
                                            {landType.spells.map(spell => (
                                                <li key={spell.name}>
                                                    <span className="cotl-spell-name">{spell.name}</span>
                                                    <span className="cotl-spell-level">(level {spell.level})</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {selectedLandType && (
                    <div className="cotl-section">
                        <p>Click a land type above to select it.</p>
                    </div>
                )}

                <div className="cotl-actions">
                    <button className="char-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    )
}

export default CircleOfTheLandSpellsModal
