import React from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js'
import * as deathSaveRules from '../../../services/combat/conditions/deathSaveRules.js'
import { hasSaveModifier } from '../../../services/combat/conditions/conditionEffects.js'
import { addEntry } from '../../../services/ui/logService.js'
import './CharSummary.css'

function DeathSavingThrows({ playerStats, campaignName }) {
    const [saves, setSaves] = React.useState([false, false, false])
    const [failures, setFailures] = React.useState([false, false, false])
    const [lastRoll, setLastRoll] = React.useState(null)

    React.useEffect(() => {
        const savedSaves = getRuntimeValue(playerStats.name, 'deathSaves')
        const savedFailures = getRuntimeValue(playerStats.name, 'deathFailures')
        if (savedSaves) setSaves(savedSaves)
        if (savedFailures) setFailures(savedFailures)
    }, [playerStats, campaignName])

    React.useEffect(() => {
        const handler = (e) => {
            if (!e.detail || e.detail.targetName !== playerStats.name) return;
            setSaves(e.detail.newSaves);
            setFailures(e.detail.newFailures);
            setLastRoll({
                roll: e.detail.roll,
                success: e.detail.success,
                isNat20: e.detail.isNat20,
                isNat1: e.detail.isNat1,
            });
            setTimeout(() => setLastRoll(null), 2000);
        };
        window.addEventListener('death-save-result', handler);
        return () => window.removeEventListener('death-save-result', handler);
    }, [playerStats.name])

    const isStable = deathSaveRules.isStable(saves)
    const isDead = deathSaveRules.isDead(failures)

    const logEntry = (entry) => {
        addEntry(campaignName, entry).catch((e) => { console.error("[DeathSavingThrows] Error:", e); })
    }

    const rollDeathSave = () => {
        if (isStable || isDead) return;

        const hasAdvantage = hasSaveModifier(playerStats?.saveModifiers, 'death_saving_throws');
        const treat18AsNat20 = (playerStats?.automation?.passives || []).some(
            p => p.type === 'passive_rule' && p.effect === 'death_save_nat18_as_20'
        );
        const result = hasAdvantage
            ? deathSaveRules.rollDeathSaveWithAdvantage(saves, failures, treat18AsNat20)
            : deathSaveRules.rollDeathSave(saves, failures, treat18AsNat20);

        setLastRoll({ roll: result.roll, success: result.result === 'success' || result.result === 'nat20' || result.result === 'stable', isNat20: result.isNat20, isNat1: result.isNat1 });
        setTimeout(() => setLastRoll(null), 2000);

        logEntry({
            type: 'death_save',
            characterName: playerStats.name,
            roll: result.roll,
            isNatural20: result.isNat20,
            isNatural1: result.isNat1,
            success: result.result === 'success' || result.result === 'nat20' || result.result === 'stable',
        });

        if (result.restoredToHp !== null) {
            setRuntimeValue(playerStats.name, 'currentHitPoints', result.restoredToHp, campaignName);
        }

        setSaves(result.newSaves);
        setFailures(result.newFailures);
        setRuntimeValue(playerStats.name, 'deathSaves', result.newSaves, campaignName);
        setRuntimeValue(playerStats.name, 'deathFailures', result.newFailures, campaignName);
        clearDeathSavePrompt(campaignName, playerStats.name);
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
