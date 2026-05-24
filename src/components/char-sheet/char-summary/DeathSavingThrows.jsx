import React from 'react'
import storage from '../../../services/storage.js'
import './CharSummary.css'

function DeathSavingThrows({ playerStats, campaignName }) {
    const [saves, setSaves] = React.useState([false, false, false])
    const [failures, setFailures] = React.useState([false, false, false])

    React.useEffect(() => {
        const savedSaves = storage.getProperty(playerStats.name, 'deathSaves', campaignName)
        const savedFailures = storage.getProperty(playerStats.name, 'deathFailures', campaignName)
        if (savedSaves) setSaves(savedSaves)
        if (savedFailures) setFailures(savedFailures)
    }, [playerStats, campaignName])

    const toggleSave = (index) => {
        const newSaves = [...saves]
        newSaves[index] = !newSaves[index]
        setSaves(newSaves)
        storage.setProperty(playerStats.name, 'deathSaves', newSaves, campaignName)
    }

    const toggleFailure = (index) => {
        const newFailures = [...failures]
        newFailures[index] = !newFailures[index]
        setFailures(newFailures)
        storage.setProperty(playerStats.name, 'deathFailures', newFailures, campaignName)
    }

    return (
        <div className="death-saves-container">
            <div className="death-saves-title">Death Saves</div>
            <div>
                <span className="death-saves-label">Successes: </span>
                {saves.map((s, i) => (
                    <span key={`save-${i}`} className="clickable" onClick={() => toggleSave(i)} style={{ cursor: 'pointer', marginRight: '5px' }}>
                        {s ? '⬤' : '◯'}
                    </span>
                ))}
            </div>
            <div>
                <span className="death-saves-label">Failures: </span>
                {failures.map((f, i) => (
                    <span key={`fail-${i}`} className="clickable" onClick={() => toggleFailure(i)} style={{ cursor: 'pointer', marginRight: '5px' }}>
                        {f ? '⬤' : '◯'}
                    </span>
                ))}
            </div>
        </div>
    )
}

export default DeathSavingThrows
