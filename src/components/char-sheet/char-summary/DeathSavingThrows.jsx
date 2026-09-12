import React from 'react'
import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js'
import * as deathSaveRules from '../../../services/combat/conditions/deathSaveRules.js'
import { hasSaveModifier, hasBeaconOfHope } from '../../../services/combat/conditions/conditionEffects.js'
import { addEntry } from '../../../services/ui/logService.js'
import './CharSummary.css'

const EMPTY_TRACK = [false, false, false]

function LastRollResult({ lastRoll }) {
    return (
        <div className={`death-saves-result ${lastRoll.success ? 'death-saves-result--success' : 'death-saves-result--failure'}`}>
            <span className="death-saves-roll-value">({lastRoll.roll})</span>
            {lastRoll.isNat1 && <span className="death-saves-nat death-saves-nat--1">NAT 1</span>}
            {lastRoll.isNat20 && <span className="death-saves-nat death-saves-nat--20">NAT 20</span>}
            <span className="death-saves-result-label">{lastRoll.success ? 'Success' : 'Failure'}</span>
        </div>
    )
}

function DeathSavingThrows({ playerStats, campaignName, isLocalhost }) {
    const name = playerStats.name
    const storedSaves = useRuntimeValue(name, 'deathSaves', campaignName)
    const storedFailures = useRuntimeValue(name, 'deathFailures', campaignName)
    const saves = storedSaves ?? EMPTY_TRACK
    const failures = storedFailures ?? EMPTY_TRACK
    const isDead = !!useRuntimeValue(name, 'isDead', campaignName)
    const [lastRoll, setLastRoll] = React.useState(null)
    const stableHealTimeoutRef = React.useRef(null)

    React.useEffect(() => {
        const handler = (e) => {
            if (!e.detail || e.detail.targetName !== name) return;
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
    }, [name])

    React.useEffect(() => {
        return () => {
            if (stableHealTimeoutRef.current) {
                clearTimeout(stableHealTimeoutRef.current);
            }
        };
    }, []);

    const isStable = deathSaveRules.isStable(saves)
    const isDeadState = deathSaveRules.isDead(failures)
    const hasAdvantage = hasSaveModifier(playerStats?.saveModifiers, 'death_saving_throws') || hasBeaconOfHope(name, campaignName)

    const logEntry = (entry) => {
        addEntry(campaignName, entry).catch((e) => { console.error("[DeathSavingThrows] Error:", e); })
    }

    const handleRemoveDead = () => {
        setRuntimeValue(name, 'isDead', 0, campaignName);
        setRuntimeValue(name, 'deathSaves', EMPTY_TRACK, campaignName);
        setRuntimeValue(name, 'deathFailures', EMPTY_TRACK, campaignName);
        logEntry({
            type: 'death_save',
            characterName: name,
            result: 'removed',
            totalSuccesses: 0,
            totalFailures: 0,
        });
    }

    const rollDeathSave = () => {
        if (isStable || isDeadState || isDead) return;

        const treat18AsNat20 = (playerStats?.automation?.passives || []).some(
            p => p.type === 'passive_rule' && p.effect === 'death_save_nat18_as_20'
        );
        const result = hasAdvantage
            ? deathSaveRules.rollDeathSaveWithAdvantage(saves, failures, treat18AsNat20)
            : deathSaveRules.rollDeathSave(saves, failures, treat18AsNat20);

        const totalSuccesses = result.newSaves.filter(Boolean).length;
        const totalFailures = result.newFailures.filter(Boolean).length;
        const isSuccess = result.result === 'success' || result.result === 'nat20' || result.result === 'stable';

        setLastRoll({ roll: result.roll, success: isSuccess, isNat20: result.isNat20, isNat1: result.isNat1 });
        setTimeout(() => setLastRoll(null), 2000);

        logEntry({
            type: 'death_save',
            characterName: playerStats.name,
            roll: result.roll,
            rolls: result.rolls,
            hasAdvantage: result.rolls?.length === 2,
            isNatural20: result.isNat20,
            isNatural1: result.isNat1,
            success: isSuccess,
            totalSuccesses,
            totalFailures,
        });

        if (result.restoredToHp !== null) {
            setRuntimeValue(name, 'currentHitPoints', result.restoredToHp, campaignName);
        }

        if (result.result === 'stable') {
            stableHealTimeoutRef.current = setTimeout(() => {
                setRuntimeValue(name, 'currentHitPoints', 1, campaignName);
            }, 1500);
            logEntry({
                type: 'death_save',
                characterName: name,
                result: 'stable',
                totalSuccesses: 3,
                totalFailures,
            });
        }

        if (result.result === 'dead') {
            setRuntimeValue(name, 'isDead', 1, campaignName);
            logEntry({
                type: 'death_save',
                characterName: name,
                result: 'dead',
                totalSuccesses,
                totalFailures: 3,
            });
        }

        setRuntimeValue(name, 'deathSaves', result.newSaves, campaignName);
        setRuntimeValue(name, 'deathFailures', result.newFailures, campaignName);
        clearDeathSavePrompt(campaignName, name);
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
                <div className="death-saves-roll-area">
                    {hasAdvantage && <span className="death-saves-advantage">ADVANTAGE</span>}
                    <div className="death-saves-roll" onClick={rollDeathSave} role="button" tabIndex={0}>
                        <i className="fas fa-dice-d20"></i> Roll
                    </div>
                </div>
            )}
            {lastRoll && <LastRollResult lastRoll={lastRoll} />}
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
