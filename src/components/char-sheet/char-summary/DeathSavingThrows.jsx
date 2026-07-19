import React from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js'
import * as deathSaveRules from '../../../services/combat/conditions/deathSaveRules.js'
import { hasSaveModifier } from '../../../services/combat/conditions/conditionEffects.js'
import { addEntry } from '../../../services/ui/logService.js'
import './CharSummary.css'

function DeathSavingThrows({ playerStats, campaignName, isLocalhost }) {
    const [saves, setSaves] = React.useState([false, false, false])
    const [failures, setFailures] = React.useState([false, false, false])
    const [lastRoll, setLastRoll] = React.useState(null)
    const [isDead, setIsDead] = React.useState(false)
    const stableHealTimeoutRef = React.useRef(null)

    React.useEffect(() => {
        const deadState = getRuntimeValue(playerStats.name, 'isDead')
        if (deadState) setIsDead(true)
    }, [playerStats.name])

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
            if (e.detail.result === 'dead') {
                setIsDead(true);
            }
        };
        window.addEventListener('death-save-result', handler);
        return () => window.removeEventListener('death-save-result', handler);
    }, [playerStats.name])

    React.useEffect(() => {
        return () => {
            if (stableHealTimeoutRef.current) {
                clearTimeout(stableHealTimeoutRef.current);
            }
        };
    }, []);

    const isStable = deathSaveRules.isStable(saves)
    const isDeadState = deathSaveRules.isDead(failures)

    const logEntry = (entry) => {
        addEntry(campaignName, entry).catch((e) => { console.error("[DeathSavingThrows] Error:", e); })
    }

    const handleRemoveDead = () => {
        setRuntimeValue(playerStats.name, 'isDead', 0, campaignName);
        setRuntimeValue(playerStats.name, 'deathSaves', [false, false, false], campaignName);
        setRuntimeValue(playerStats.name, 'deathFailures', [false, false, false], campaignName);
        setIsDead(false);
        setSaves([false, false, false]);
        setFailures([false, false, false]);
        logEntry({
            type: 'death_save',
            characterName: playerStats.name,
            result: 'removed',
            totalSuccesses: 0,
            totalFailures: 0,
        });
    }

    const rollDeathSave = () => {
        if (isStable || isDeadState || isDead) return;

        const hasAdvantage = hasSaveModifier(playerStats?.saveModifiers, 'death_saving_throws');
        const treat18AsNat20 = (playerStats?.automation?.passives || []).some(
            p => p.type === 'passive_rule' && p.effect === 'death_save_nat18_as_20'
        );
        const result = hasAdvantage
            ? deathSaveRules.rollDeathSaveWithAdvantage(saves, failures, treat18AsNat20)
            : deathSaveRules.rollDeathSave(saves, failures, treat18AsNat20);

        const totalSuccesses = result.newSaves.filter(Boolean).length;
        const totalFailures = result.newFailures.filter(Boolean).length;

        setLastRoll({ roll: result.roll, success: result.result === 'success' || result.result === 'nat20' || result.result === 'stable', isNat20: result.isNat20, isNat1: result.isNat1 });
        setTimeout(() => setLastRoll(null), 2000);

        logEntry({
            type: 'death_save',
            characterName: playerStats.name,
            roll: result.roll,
            isNatural20: result.isNat20,
            isNatural1: result.isNat1,
            success: result.result === 'success' || result.result === 'nat20' || result.result === 'stable',
            totalSuccesses,
            totalFailures,
        });

        if (result.restoredToHp !== null) {
            setRuntimeValue(playerStats.name, 'currentHitPoints', result.restoredToHp, campaignName);
        }

        if (result.result === 'stable') {
            stableHealTimeoutRef.current = setTimeout(() => {
                setRuntimeValue(playerStats.name, 'currentHitPoints', 1, campaignName);
            }, 1500);
            logEntry({
                type: 'death_save',
                characterName: playerStats.name,
                result: 'stable',
                totalSuccesses: 3,
                totalFailures,
            });
        }

        if (result.result === 'dead') {
            setRuntimeValue(playerStats.name, 'isDead', 1, campaignName);
            logEntry({
                type: 'death_save',
                characterName: playerStats.name,
                result: 'dead',
                totalSuccesses,
                totalFailures: 3,
            });
        }

        setSaves(result.newSaves);
        setFailures(result.newFailures);
        setRuntimeValue(playerStats.name, 'deathSaves', result.newSaves, campaignName);
        setRuntimeValue(playerStats.name, 'deathFailures', result.newFailures, campaignName);
        clearDeathSavePrompt(campaignName, playerStats.name);
    }

    if (isDead) {
        return (
            <div className="death-saves-container">
                <div className="death-saves-dead-badge">
                    <i className="fa-solid fa-skull"></i> DEAD
                    {isLocalhost && (
                        <button
                            className="death-saves-dead-remove"
                            onClick={handleRemoveDead}
                            type="button"
                            title="Resurrect character"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="death-saves-container">
            <div className="death-saves-title">Death Saves</div>
            {isStable && <div className="death-saves-stable">Stable</div>}
            {isDeadState && <div className="death-saves-dead">Dead</div>}
            {!isStable && !isDeadState && (
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
