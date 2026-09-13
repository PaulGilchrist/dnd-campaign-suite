import { useState, useEffect } from 'react';
import './SecondaryTargetModal.css';
import { getTargetMapStatuses, distanceBadgeText } from '../../../../services/maps/spellOverlayService.js';

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

function SecondaryTargetModal({ title, targets, onTargetSelected, onSkip, featureDescription, description, confirmLabel, confirmIcon, showHp, showSize, hideConfirm, variantLabel, variantChecked, onVariantChange, variantDisabled, campaignName, attackerName, rangeFt }) {
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
        <div className="sp-overlay" onClick={(e) => {
            if (e.target.closest('.sp-modal')) return;
            onSkip?.();
        }}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className={`fa-solid ${iconClass}`}></i> {title}
                </div>
                <div className="sp-body">
                    {description && <p dangerouslySetInnerHTML={{ __html: description }} />}
                    {!description && targets.length > 0 && <p>Choose a target from the {targets.length} available:</p>}
                    <div className="secondary-target-list">
                        {targets.map((target, i) => (
                            <SecondaryTargetRow
                                key={i}
                                target={target}
                                selected={selected}
                                showHp={showHp}
                                showSize={showSize}
                                handleSelect={handleSelect}
                                mapStatuses={mapStatuses}
                            />
                        ))}
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
