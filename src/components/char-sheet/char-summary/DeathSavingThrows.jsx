import { setRuntimeBatch, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js'
import * as deathSaveRules from '../../../services/combat/conditions/deathSaveRules.js'
import { hasSaveModifier } from '../../../services/combat/conditions/conditionEffects.js'
import { getActiveTargetEffect } from '../../../services/combat/conditions/targetEffectDefinitions.js'
import { addEntry } from '../../../services/ui/logService.js'
import './CharSummary.css'

const EMPTY_TRACK = [false, false, false]

// Attribution mirrors concentrationPromptRoll.js's advantageSources pattern:
// name each contributing source so the dying-track ADVANTAGE chip can say WHY.
// Qualifier matches hasSaveModifier(mods, 'death_saving_throws') called with no
// abilityName: ability-scoped mods never grant death-save advantage there, so
// they must not be attributed here either.
function collectDeathSaveAdvantageSources(saveModifiers, beaconEffect) {
    const sources = []
    ;(saveModifiers || []).forEach(mod => {
        if (mod.target !== 'death_saving_throws' || mod.effect !== 'advantage') return
        if (mod.abilities && mod.abilities.length > 0) return
        if (mod.source && !sources.includes(mod.source)) sources.push(mod.source)
    })
    if (beaconEffect) {
        const label = beaconEffect.source ? `Beacon of Hope (${beaconEffect.source})` : 'Beacon of Hope'
        if (!sources.includes(label)) sources.push(label)
    }
    return sources
}

// Generic copy is reserved for genuinely unattributable advantage (bare DM-flag
// mods with no source field); a named source always wins.
function buildAdvantageTooltip(hasAdvantage, saveModifiers, beaconEffect) {
    if (!hasAdvantage) return undefined
    const sources = collectDeathSaveAdvantageSources(saveModifiers, beaconEffect)
    return sources.length > 0
        ? `Advantage from: ${sources.join(', ')}`
        : 'Advantage — no source recorded'
}

function DeathSavingThrows({ playerStats, campaignName, isLocalhost, onRollResult }) {
    const name = playerStats.name
    const storedSaves = useRuntimeValue(name, 'deathSaves', campaignName)
    const storedFailures = useRuntimeValue(name, 'deathFailures', campaignName)
    const saves = storedSaves ?? EMPTY_TRACK
    const failures = storedFailures ?? EMPTY_TRACK
    const isDead = !!useRuntimeValue(name, 'isDead', campaignName)

    const isStable = deathSaveRules.isStable(saves)
    const isDeadState = deathSaveRules.isDead(failures)
    // Reading the beacon targetEffect (not just hasBeaconOfHope) so the chip
    // tooltip can name the caster — same truth source, richer payload.
    const beaconEffect = getActiveTargetEffect(campaignName, name, 'beacon_of_hope')
    const hasAdvantage = hasSaveModifier(playerStats?.saveModifiers, 'death_saving_throws') || !!beaconEffect
    const advantageTooltip = buildAdvantageTooltip(hasAdvantage, playerStats?.saveModifiers, beaconEffect)

    const logEntry = (entry) => {
        addEntry(campaignName, entry).catch((e) => { console.error("[DeathSavingThrows] Error:", e); })
    }

    // "Clear death state" (owner decision 2026-11-19): this ONLY clears the
    // dying track — isDead + both save/failure counters — it never restores HP.
    // At 0 HP the character stays unconscious and the Roll area re-arms, so the
    // title must not claim resurrection.
    //
    // Single merged write (improve-run 2026-11-19, same family as the resolved
    // bug-clear-latch-eviction-resurrects-stamps): this used to fire THREE
    // sequential setRuntimeValue calls, each POSTing a whole-bucket snapshot.
    // HTTP/1.1 socket fan-out gives same-origin POSTs no arrival-order
    // guarantee, so a stale body still carrying isDead:1 could land LAST and
    // RESURRECT the DEAD badge via the SSE echo (live-witnessed UI/server
    // divergence). One setRuntimeBatch body ⇒ nothing to interleave — the
    // single POST carries every cleared key at once, mirroring the merged
    // sheet-revive batch in CharHitPoints.jsx.
    const handleRemoveDead = () => {
        setRuntimeBatch(name, {
            isDead: 0,
            deathSaves: EMPTY_TRACK,
            deathFailures: EMPTY_TRACK,
        }, campaignName);
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

        // The chip is hosted by CharHitPoints (outside the DEAD-badge branch
        // swap and the currentHitPoints <= 0 unmount gate) so terminal rolls
        // still paint their dwell face — see bug-death-save-terminal-roll-chip-
        // never-renders. Report it BEFORE the runtime writes below.
        onRollResult({ roll: result.roll, success: isSuccess, isNat20: result.isNat20, isNat1: result.isNat1 });

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

        if (result.result === 'stable') {
            // RAW semantics (owner decision 2026-10-29): stabilization leaves
            // the creature at 0 HP — NO HP write here (the old immediate
            // currentHitPoints:1 diverged from the modal lane, which always
            // stayed at 0; both seams now match). The summary row stays
            // synchronous (no-timers plan T2: state must never hang on a
            // wall-clock delay).
            logEntry({
                type: 'death_save',
                characterName: name,
                result: 'stable',
                totalSuccesses: 3,
                totalFailures,
            });
        }

        if (result.result === 'dead') {
            logEntry({
                type: 'death_save',
                characterName: name,
                result: 'dead',
                totalSuccesses,
                totalFailures: 3,
            });
        }

        // Single merged write (fix bug-death-save-roll-lane-sequential-bucket-
        // posts 2026-11-19, same family as handleRemoveDead above and the
        // merged sheet-revive batch in CharHitPoints.jsx): this used to fire
        // up to FOUR sequential setRuntimeValue calls (currentHitPoints on a
        // NAT 20, isDead when fatal, then both tracks), each POSTing a whole-
        // bucket snapshot whose arrival order HTTP/1.1 does not guarantee —
        // a stale intermediate (e.g. isDead:1 with a 2/3 failures track, or
        // restored HP with pre-roll tracks) landing LAST leaves the server
        // bucket divergent via the SSE echo. One setRuntimeBatch body carries
        // every mutated field: one commit = one POST = nothing to interleave.
        const writes = {
            deathSaves: result.newSaves,
            deathFailures: result.newFailures,
        };
        if (result.result === 'dead') {
            writes.isDead = 1;
        }
        if (result.restoredToHp !== null) {
            writes.currentHitPoints = result.restoredToHp;
        }
        setRuntimeBatch(name, writes, campaignName);
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
                            title="Clear death state"
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
                    {hasAdvantage && <span className="death-saves-advantage" title={advantageTooltip}>ADVANTAGE</span>}
                    <div className="death-saves-roll" onClick={rollDeathSave} role="button" tabIndex={0}>
                        <i className="fas fa-dice-d20"></i> Roll
                    </div>
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
