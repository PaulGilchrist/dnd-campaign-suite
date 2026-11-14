import React, { useCallback } from 'react'
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js'
import utils from '../../../../services/ui/utils.js'
import { addEntry } from '../../../../services/ui/logService.js'
import { getCombatSummary } from '../../../../services/encounters/combatData.js'
import SecondaryTargetModal from './SecondaryTargetModal.jsx'
import '../../CharSheet.css'

const CUREABLE_CONDITIONS = ['Blinded', 'Deafened', 'Paralyzed', 'Poisoned', 'Stunned'];

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

function getCombatSummaryConditionKeys(campaignName, targetName) {
    try {
        const combatSummary = getCombatSummary(campaignName);
        const creature = combatSummary?.creatures?.find(c => utils.getName(c.name) === utils.getName(targetName));
        if (creature && Array.isArray(creature.conditions)) {
            return creature.conditions.map(c => c.key);
        }
    } catch { /* ignore */ }
    return [];
}

function getTargetConditions(targetName, campaignName) {
    // Get conditions from runtime state (where Stunning Strike writes them)
    const runtimeConditions = getRuntimeValue(targetName, 'activeConditions') || [];

    // Also check combat summary for conditions stored on NPCs
    const csKeys = getCombatSummaryConditionKeys(campaignName, targetName);
    if (csKeys.length === 0) return runtimeConditions;

    // Merge both sources, deduplicate case-insensitively
    const seen = new Set(runtimeConditions.map(c => String(c).toLowerCase()));
    const merged = [...runtimeConditions];
    for (const key of csKeys) {
        const lower = String(key).toLowerCase();
        if (!seen.has(lower)) {
            merged.push(key);
            seen.add(lower);
        }
    }
    return merged;
}

// CLA-159: pending picker stage — mirrors the verified Healing Light target-modal
// seam (CLA-163): SecondaryTargetModal inside .short-rest-modal, confirmLabel Heal.
// Dialog tier (backlog 2026-11-10 HD, ShortRestModal bc409413d pattern): the
// borrowed .short-rest-modal shell IS the dialog root — role + aria-modal +
// aria-labelledby → SecondaryTargetModal's visible .sp-header title (via titleId).
// refusalNote (HoH pre-spend-at-full-HP improve): the commit-time capacity gate
// refused a zero-capacity target with ZERO Focus spent — the picker stays open
// with the note inline, mirroring the d595cff2c noHealCapacity copy placement
// (.healing-restriction-note, same global class Healing-Light uses).
function HandOfHealingPickerStage({ healName, creatureTargets, onPick, onSkip, refusalNote, campaignName }) {
    return (
        <div className="short-rest-overlay no-print">
            <div
                className="short-rest-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hand-of-healing-target-modal-title"
            >
                {refusalNote && (
                    <p className="healing-restriction-note">{refusalNote}</p>
                )}
                <SecondaryTargetModal
                    title={`Choose target for ${healName}`}
                    titleId="hand-of-healing-target-modal-title"
                    targets={creatureTargets}
                    onTargetSelected={onPick}
                    onSkip={onSkip}
                    featureDescription={`Choose a creature you can touch to heal with ${healName}.`}
                    confirmLabel="Heal"
                    confirmIcon="fa-hand-holding-heart"
                    showHp={true}
                    liveHp={true}
                    campaignName={campaignName}
                />
            </div>
        </div>
    );
}

function PhysiciansTouchSection({ targetName, healName, monkName, campaignName, hasPhysiciansTouch }) {
    const [curedCondition, setCureCondition] = React.useState(null);
    const [cureRefusal, setCureRefusal] = React.useState(null);
    // Auto-cure is the MOUNT law only (owner decision 2026-11-14, backlog KB
    // external-cure-auto-spend): the free Physician's Touch may be spent
    // automatically ONLY by the curable set computed from mount-time data.
    // Every later render — an echo from a foreign write or otherwise — shows
    // the picker instead, so an external cure shrinking the set to exactly
    // ONE never spends the touch on a condition nobody chose to cure.
    const isFirstRender = React.useRef(true);

    // Display echo subscription (82f517b26 cure-conditions-echo parity with
    // HealingPoolModal): the cureableConditions read below is imperative, so
    // without this subscription the option list snapshotted at open — an
    // externally-cured condition left a stale clickable button (whose press
    // wrote a zero-delta bucket re-POST plus a phantom `condition broken`
    // audit row) and a newly-arrived curable condition never surfaced.
    // Subscribing re-renders on every activeConditions echo so the list
    // recomputes; the commit-time guard in removeCondition keeps the audit
    // ledger honest for the click-before-echo race.
    useRuntimeValue(targetName, 'activeConditions', campaignName)

    // KB 2026-11-14 (cs-row echo): the merge in getTargetConditions also reads
    // the combat-summary creature row, which previously woke nothing — a
    // cs-side cure left a stale Remove button until some other render. The SSE
    // adoption (App.jsx handleChangeKeyEvent) first refreshes the combatData
    // cache the merge reads, then replaceObject-notifies the 'combatSummary'
    // store, so subscribing its 'creatures' key re-renders the list after the
    // cache already carries the new board (same wake-vs-read order the bucket
    // subscription above gives activeConditions).
    useRuntimeValue('combatSummary', 'creatures', campaignName)

    const removeCondition = useCallback((conditionName) => {
        const conditions = getTargetConditions(targetName, campaignName);
        const filtered = conditions.filter(c => !conditionMatches(String(c).toLowerCase(), conditionName.toLowerCase()));
        // Commit-time presence guard (615a7580a cureRefusal parity): re-read
        // the live bucket and refuse when the condition is already gone —
        // zero write, zero log row, an inline note in the
        // `<Target> is not affected by <Label>.` copy family. `condition
        // broken` may only ever be recorded for a condition that actually
        // broke.
        if (filtered.length === conditions.length) {
            setCureRefusal(`${targetName} is not affected by ${conditionName}.`);
            return;
        }
        setCureRefusal(null);
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);

        addEntry(campaignName, {
            type: 'condition',
            characterName: targetName,
            condition: conditionName,
            action: 'broken',
            sourceName: `${monkName} (${healName})`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[HandOfHealingModal] Error:", e); });

        setCureCondition(conditionName);
    }, [campaignName, targetName, healName, monkName]);

    // Recomputed every render (HealingPoolModal parity: targetConditions is a
    // plain per-render read there too) — the useRuntimeValue subscription
    // above is the wake-deps, so no memo cache to invalidate.
    const cureableConditions = (() => {
        const conditions = getTargetConditions(targetName, campaignName);
        return Array.isArray(conditions)
            ? CUREABLE_CONDITIONS.filter(cc => conditions.some(c => conditionMatches(c, cc)))
            : [];
    })();

    React.useEffect(() => {
        // Mount-only auto-cure (see isFirstRender note): the first effect run
        // cures from the MOUNT-time curable set; every later render — echo or
        // otherwise — short-circuits here so the choice stays with the user.
        if (!isFirstRender.current) {
            return;
        }
        isFirstRender.current = false;
        if (cureableConditions.length === 1 && hasPhysiciansTouch) {
            removeCondition(cureableConditions[0]);
        }
    }, [cureableConditions, hasPhysiciansTouch, removeCondition]);

    if (curedCondition) {
        return (
            <div className="short-rest-section healing-cured-condition">
                <h4><i className="fas fa-shield-virus"></i> Condition Cleared</h4>
                <div>
                    <i className="fas fa-check-circle"></i> {curedCondition} removed from {targetName} (Physician&apos;s Touch)
                </div>
            </div>
        );
    }

    // Picker tier: multi → full option list (unchanged); exactly ONE curable
    // with the touch still unspent reaches here only via an ECHO (a mount-time
    // single was already auto-cured by the effect above) — surface the single
    // `Remove <Label>` button instead of spending the free touch (owner
    // decision 2026-11-14).
    if (cureableConditions.length > 1 ||
        (cureableConditions.length === 1 && hasPhysiciansTouch)) {
        return (
            <>
                <div className="short-rest-section">
                    <h4><i className="fas fa-shield-virus"></i> Physician&apos;s Touch</h4>
                    <p>{cureableConditions.length > 1
                        ? 'Target has multiple conditions. Select one to remove:'
                        : 'Select the condition to remove with the free Physician\u2019s Touch:'}</p>
                    <div className="healing-cure-options">
                        {[...new Set(cureableConditions)].map((condition, i) => (
                            <button key={`${condition}-${i}`} className="char-btn" onClick={() => removeCondition(condition)}>
                                <i className="fas fa-check-circle"></i> Remove {condition}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Sibling of the section (HealingPoolModal cureRefusal placement):
                    after a refusal the echo re-render can filter the whole
                    section away — the note must still surface why nothing
                    happened. */}
                {cureRefusal && (
                    <p className="healing-restriction-note">{cureRefusal}</p>
                )}
            </>
        );
    }

    return cureRefusal ? <p className="healing-restriction-note">{cureRefusal}</p> : null;
}

function HandOfHealingResultStage({ healName, result, monkName, campaignName, hasPhysiciansTouch, onClose }) {
    const rollValues = Array.isArray(result.rolls) ? result.rolls : [];
    return (
        // Dialog tier per bc409413d (see picker-stage note): shell = dialog root,
        // labelled by its visible <h3>.
        <div className="short-rest-overlay no-print">
            <div
                className="short-rest-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hand-of-healing-modal-title"
            >
                <h3 id="hand-of-healing-modal-title"><i className="fas fa-hand-sparkles"></i> {healName}</h3>

                <div className="short-rest-section">
                    <h4>Healing{'\u2014'}{result.targetName} ({result.targetCurrentHp} / {result.targetMaxHp} HP)</h4>
                    <div className="healing-roll-details">
                        <span className="healing-formula">{result.formula}: </span>
                        <span className="healing-dice-rolled">{rollValues.join(' + ')}</span>
                        {result.bonus !== 0 && <span className="healing-bonus"> {result.bonus >= 0 ? '+' : '-'} {Math.abs(result.bonus)}</span>}
                        {/* Ledger honesty (bug-hand-of-healing-modal-overstates-restored-hp):
                            the clamped actualHeal — HP really restored — is what the audit row
                            reports via healDesc, so the modal shows it too, never the raw roll. */}
                        <span className="healing-total"> = <strong>{result.actualHeal}</strong> HP restored{result.actualHeal === 0 && ' (Already at full HP)'}</span>
                    </div>
                </div>

                <PhysiciansTouchSection
                    targetName={result.targetName}
                    healName={healName}
                    monkName={monkName}
                    campaignName={campaignName}
                    hasPhysiciansTouch={hasPhysiciansTouch}
                />

                <div className="short-rest-actions">
                    <button className="char-btn" onClick={onClose}>
                        <i className="fa-solid fa-check"></i> Done
                    </button>
                </div>
            </div>
        </div>
    );
}

function HandOfHealingModal({ healName, formula, rolls, bonus, actualHeal, monkName, targetName, targetCurrentHp, targetMaxHp, hasPhysiciansTouch, campaignName, pending, creatureTargets, confirmHeal, onClose }) {
    const [result, setResult] = React.useState(pending ? null : { targetName, formula, rolls, bonus, actualHeal, targetCurrentHp, targetMaxHp });
    const [healError, setHealError] = React.useState(null);
    const [refusalNote, setRefusalNote] = React.useState(null);

    const runHeal = useCallback(async (name) => {
        try {
            const payload = await confirmHeal?.(name);
            // Pre-spend refusal (target at max HP / pool drained at commit): no
            // Focus was spent and no row was logged — keep the picker open with an
            // inline note so another target can still be chosen.
            if (payload?.refusal) {
                setRefusalNote(payload.refusal);
                return;
            }
            if (!payload) {
                setHealError('Healing failed to resolve.');
                return;
            }
            setResult(payload);
        } catch (e) {
            console.error('[HandOfHealingModal] confirm heal failed:', e);
            setHealError('Healing failed to resolve.');
        }
    }, [confirmHeal]);

    React.useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
          };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    if (pending && !result) {
        if (healError) {
            return (
                // Dialog tier per bc409413d; mutually exclusive with the picker
                // and result stages, so the id below never co-mounts.
                <div className="short-rest-overlay no-print">
                    <div
                        className="short-rest-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="hand-of-healing-modal-title"
                    >
                        <h3 id="hand-of-healing-modal-title"><i className="fas fa-hand-sparkles"></i> {healName}</h3>
                        <div className="short-rest-section">{healError}</div>
                        <div className="short-rest-actions">
                            <button className="char-btn" onClick={onClose}>
                                <i className="fa-solid fa-check"></i> Done
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <HandOfHealingPickerStage
                healName={healName}
                creatureTargets={creatureTargets || []}
                onPick={runHeal}
                onSkip={() => runHeal(monkName)}
                refusalNote={refusalNote}
                campaignName={campaignName}
            />
        );
    }

    return (
        <HandOfHealingResultStage
            healName={healName}
            result={result}
            monkName={monkName}
            campaignName={campaignName}
            hasPhysiciansTouch={hasPhysiciansTouch}
            onClose={onClose}
        />
    );
}

export default HandOfHealingModal;
