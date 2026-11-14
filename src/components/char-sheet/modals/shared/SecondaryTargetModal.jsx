import { useState, useEffect } from 'react';
import './SecondaryTargetModal.css';
import { getTargetMapStatuses, distanceBadgeText } from '../../../../services/maps/spellOverlayService.js';
import { useRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveLiveTargetHp } from '../../../../services/automation/handlers/healing/liveTargetHp.js';

function isOptionTarget(target) {
    return 'value' in target;
}

function targetKeyOf(target) {
    return isOptionTarget(target) ? target.value : target.name;
}

function hasHpValues(target) {
    return target.currentHp != null && target.maxHp != null;
}

function hpPercent(target) {
    return Math.round((target.currentHp / target.maxHp) * 100);
}

function rowVisibilityFlags(target, showHp, showSize) {
    const isNpcOrMonster = !target || target.type === 'npc' || target.type === 'monster';
    return {
        shouldShowHp: showHp !== false && !isNpcOrMonster && hasHpValues(target),
        shouldShowSize: showSize && target.size,
    };
}

// Accessible name for a candidate row's radio (backlog 2026-11-13 EH): mirrors the
// explicit `Select <Name>` precedent in AllySelectionModal/EncounterMonsterTable.
// HP shown on the row stays information-complete via a clean separator, so AT row
// nav no longer announces the mashed concatenation ("Name55/132 HP (4%)").
function rowAriaLabel(target, shouldShowHp) {
    const name = isOptionTarget(target) ? target.label : target.name;
    let label = `Select ${name}`;
    if (!isOptionTarget(target) && hasHpValues(target)) {
        label += shouldShowHp
            ? `, ${target.currentHp} of ${target.maxHp} HP`
            : `, ${hpPercent(target)}% HP`;
    }
    return label;
}

function TargetNameContent({ target, shouldShowSize, shouldShowHp }) {
    return (
        <>
            <strong>{target.name}</strong>
            {shouldShowSize && <span className="secondary-target-size">({target.size})</span>}
            {shouldShowHp && <span className="secondary-target-hp">
                {target.currentHp}/{target.maxHp} HP ({hpPercent(target)}%)
            </span>}
            {!shouldShowHp && hasHpValues(target) && <span className="secondary-target-hp">
                {hpPercent(target)}%
            </span>}
        </>
    );
}

function SecondaryTargetRow({ target, selected, showHp, showSize, handleSelect, mapStatuses }) {
    const isSelected = selected === targetKeyOf(target);
    const { shouldShowHp, shouldShowSize } = rowVisibilityFlags(target, showHp, showSize);
    const status = !isOptionTarget(target) && mapStatuses ? mapStatuses[target.name] : null;
    return (
        <label
            className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''}`}
            onClick={() => handleSelect(targetKeyOf(target))}
        >
            <input
                type="radio"
                name="secondaryTarget"
                aria-label={rowAriaLabel(target, shouldShowHp)}
                checked={isSelected}
                onChange={() => handleSelect(targetKeyOf(target))}
            />
            <span className="secondary-target-name">
                {isOptionTarget(target) ? (
                    <strong>{target.label}</strong>
                ) : (
                    <TargetNameContent target={target} shouldShowSize={shouldShowSize} shouldShowHp={shouldShowHp} />
                )}
            </span>
            {status && (
                <span className={`secondary-target-dist secondary-target-dist-${status.status}`}>
                    {distanceBadgeText(status)}
                </span>
            )}
        </label>
    );
}

// Bucket-live variant of the row (improve heal-modal-live-hp-echo): heal
// choosers pass `liveHp` so each candidate row subscribes to the target's
// runtime HP buckets — an SSE echo landing mid-dwell re-renders the row and
// its radio aria-label instead of stranding them on the open-moment snapshot.
// HP still resolves through resolveLiveTargetHp (bucket-first, cs-row
// fallback) — the same precedence the producer used at open time, so monsters
// (no runtime HP keys) keep their row values untouched. Snapshot consumers
// never mount this wrapper, so their rows render byte-identically.
function LiveHpTargetRow({ campaignName, ...rowProps }) {
    useRuntimeValue(rowProps.target.name, 'currentHitPoints', campaignName);
    useRuntimeValue(rowProps.target.name, 'hitPoints', campaignName);
    return <SecondaryTargetRow {...rowProps} target={{ ...rowProps.target, ...resolveLiveTargetHp(rowProps.target) }} />;
}

function SecondaryTargetModal({ title, titleId, targets, onTargetSelected, onSkip, featureDescription, description, confirmLabel, confirmIcon, showHp, showSize, hideConfirm, variantLabel, variantChecked, onVariantChange, variantDisabled, campaignName, attackerName, rangeFt, liveHp }) {
    const [selected, setSelected] = useState(null);
    const [mapStatuses, setMapStatuses] = useState(null);

    useEffect(() => {
        if (!campaignName || !attackerName || targets.length === 0) return undefined;
        let cancelled = false;
        const names = targets.filter(t => !isOptionTarget(t)).map(t => t.name);
        if (names.length === 0) return undefined;
        getTargetMapStatuses(campaignName, attackerName, names, rangeFt).then(statuses => {
            if (statuses && !cancelled) setMapStatuses(statuses);
        });
        return () => { cancelled = true; };
    }, [campaignName, attackerName, rangeFt]); // eslint-disable-line react-hooks/exhaustive-deps

    const iconClass = confirmIcon || 'fa-crosshairs';
    const label = confirmLabel || 'Attack';

    const handleSelect = (targetName) => {
        setSelected(targetName);
    };

    const handleConfirm = () => {
        if (!selected) return;
        onTargetSelected(selected);
    };

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                {/* titleId: optional anchor for a wrapping shell's aria-labelledby
                    (backlog 2026-11-10 HD dialog tier). Undefined = no attribute,
                    zero DOM change for every other consumer. */}
                <div className="sp-header" id={titleId}>
                    <i className={`fa-solid ${iconClass}`}></i> {title}
                </div>
                <div className="sp-body">
                    {description && <p dangerouslySetInnerHTML={{ __html: description }} />}
                    {!description && targets.length > 0 && <p>Choose a target from the {targets.length} available:</p>}
                    <div className="secondary-target-list">
                        {targets.map((target, i) => {
                            const Row = liveHp && !isOptionTarget(target) ? LiveHpTargetRow : SecondaryTargetRow;
                            return (
                                <Row
                                    key={i}
                                    target={target}
                                    selected={selected}
                                    showHp={showHp}
                                    showSize={showSize}
                                    handleSelect={handleSelect}
                                    mapStatuses={mapStatuses}
                                    campaignName={campaignName}
                                />
                            );
                        })}
                    </div>
                    {variantLabel && (
                        <label className={`secondary-target-variant ${variantDisabled ? 'secondary-target-variant-disabled' : ''}`}>
                            <input
                                type="checkbox"
                                checked={!!variantChecked}
                                disabled={!!variantDisabled}
                                onChange={(e) => onVariantChange?.(e.target.checked)}
                            />
                            {variantLabel}
                        </label>
                    )}
                    {featureDescription && (
                        <p className="secondary-target-note">{featureDescription}</p>
                    )}
                </div>
                <div className="sp-actions">
                    {/* LIVE guard — rec #176 "always-true" refuted (it short-circuited the
                        boolean algebra: trivially-true when hideConfirm is falsy, but three
                        producers pass it truthy). Truth table (guard = confirm rendered):
                          hideConfirm=F, targets>0 -> T   (default: every creature picker)
                          hideConfirm=F, targets=0 -> T   (button shown, disabled below)
                          hideConfirm=T, targets>0 -> T   (defensive; no producer reaches it)
                          hideConfirm=T, targets=0 -> F   (REachable: GR/LR effect step with
                            hideConfirm={!hasEffects} fed the same empty array as targets —
                            GreaterRestorationHost / GreaterRestorationTargetPicker /
                            LesserRestorationTargetPicker) */}
                    {!hideConfirm || targets.length > 0 ? (
                        <button
                            className="sp-roll-btn"
                            onClick={handleConfirm}
                            disabled={!selected || targets.length === 0}
                            type="button"
                        >
                            <i className={`fa-solid ${iconClass}`}></i> {label}
                        </button>
                    ) : null}
                    <button className="sp-dismiss-btn" onClick={onSkip} type="button">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SecondaryTargetModal;
