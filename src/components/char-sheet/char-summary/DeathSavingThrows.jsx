import React from 'react'
import storage from '../../../services/storage.js'
import { rollD20 } from '../../../services/diceRoller.js'
import './CharSummary.css'

function DeathSavingThrows({ playerStats, campaignName }) {
    const [saves, setSaves] = React.useState([false, false, false])
    const [failures, setFailures] = React.useState([false, false, false])
    const [lastRoll, setLastRoll] = React.useState(null)

    React.useEffect(() => {
        const savedSaves = storage.getProperty(playerStats.name, 'deathSaves', campaignName)
        const savedFailures = storage.getProperty(playerStats.name, 'deathFailures', campaignName)
        if (savedSaves) setSaves(savedSaves)
        if (savedFailures) setFailures(savedFailures)
    }, [playerStats, campaignName])

    const successCount = saves.filter(Boolean).length
    const failureCount = failures.filter(Boolean).length
    const isStable = successCount >= 3
    const isDead = failureCount >= 3

    const logEntry = (entry) => {
        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        }).catch(() => {})
    }

    const rollDeathSave = () => {
        if (isStable || isDead) return;

        const r = rollD20();
        const isNat20 = r === 20;
        const isNat1 = r === 1;
        const isSuccess = isNat20 || r >= 10;
        const failMultiplier = isNat1 ? 2 : 1;

        setLastRoll({ roll: r, success: isSuccess, isNat20, isNat1 });
        setTimeout(() => setLastRoll(null), 2000);

        logEntry({
            type: 'death_save',
            characterName: playerStats.name,
            roll: r,
            isNatural20: isNat20,
            isNatural1: isNat1,
            success: isSuccess,
        });

        if (isNat20) {
            storage.setProperty(playerStats.name, 'currentHitPoints', 1, campaignName);
            storage.setProperty(playerStats.name, 'deathSaves', [false, false, false], campaignName);
            storage.setProperty(playerStats.name, 'deathFailures', [false, false, false], campaignName);
            setSaves([false, false, false]);
            setFailures([false, false, false]);
            return;
        }

        if (isSuccess) {
            const newSaves = [...saves];
            const firstEmpty = newSaves.indexOf(false);
            if (firstEmpty !== -1) newSaves[firstEmpty] = true;
            setSaves(newSaves);
            storage.setProperty(playerStats.name, 'deathSaves', newSaves, campaignName);

            if (newSaves.filter(Boolean).length >= 3) {
                storage.setProperty(playerStats.name, 'deathFailures', [false, false, false], campaignName);
                setFailures([false, false, false]);
            }
        } else {
            const newFailures = [...failures];
            for (let i = 0; i < failMultiplier; i++) {
                const firstEmpty = newFailures.indexOf(false);
                if (firstEmpty !== -1) {
                    newFailures[firstEmpty] = true;
                }
            }
            setFailures(newFailures);
            storage.setProperty(playerStats.name, 'deathFailures', newFailures, campaignName);
        }
    }

    return (
        <div className="death-saves-container">
            <div className="death-saves-title">Death Saves</div>
            {isStable && <div className="death-saves-stable">Stable</div>}
            {isDead && <div className="death-saves-dead">Dead</div>}
            {!isStable && !isDead && (
                <div className="death-saves-roll" onClick={rollDeathSave} role="button" tabIndex={0}>
                    <i className="fas fa-dice-d20"></i> Roll
                </div>
            )}
            {lastRoll && (
                <div className={`death-saves-result ${lastRoll.success ? 'death-saves-result--success' : 'death-saves-result--failure'}`}>
                    <span className="death-saves-roll-value">({lastRoll.roll})</span>
                    {lastRoll.isNat1 && <span className="death-saves-nat death-saves-nat--1">NAT 1</span>}
                    {lastRoll.isNat20 && <span className="death-saves-nat death-saves-nat--20">NAT 20</span>}
                    <span className="death-saves-result-label">{lastRoll.success ? 'Success' : 'Failure'}</span>
                </div>
            )}
            <div className="death-saves-track">
                <span className="death-saves-label">Successes: </span>
                {saves.map((s, i) => (
                    <span key={`save-${i}`}>
                        {s ? '⬤' : '◯'}
                    </span>
                ))}
            </div>
            <div className="death-saves-track">
                <span className="death-saves-label">Failures: </span>
                {failures.map((f, i) => (
                    <span key={`fail-${i}`}>
                        {f ? '⬤' : '◯'}
                    </span>
                ))}
            </div>
        </div>
    )
}

export default DeathSavingThrows
