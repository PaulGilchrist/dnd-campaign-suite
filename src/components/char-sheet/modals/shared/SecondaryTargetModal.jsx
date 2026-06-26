import { useState } from 'react';
import './SecondaryTargetModal.css';

function isOptionTarget(target) {
    return 'value' in target;
}

function SecondaryTargetModal({ title, targets, onTargetSelected, onSkip, featureDescription, description, confirmLabel, confirmIcon, showHp, showSize }) {
    const [selected, setSelected] = useState(null);

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
        <div className="sp-overlay" onClick={onSkip}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className={`fa-solid ${iconClass}`}></i> {title}
                </div>
                <div className="sp-body">
                    {description && <p dangerouslySetInnerHTML={{ __html: description }} />}
                    {!description && targets.length > 0 && <p>Choose a target from the {targets.length} available:</p>}
                    <div className="secondary-target-list">
                        {targets.map((target, i) => {
                            const isSelected = selected === (isOptionTarget(target) ? target.value : target.name);
                            const targetKey = isOptionTarget(target) ? target.value : target.name;
                            const shouldShowHp = showHp !== false && target.currentHp != null && target.maxHp != null;
                            const shouldShowSize = showSize && target.size;
                            return (
                                <label
                                    key={i}
                                    className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''}`}
                                    onClick={() => handleSelect(targetKey)}
                                >
                                    <input
                                        type="radio"
                                        name="secondaryTarget"
                                        checked={isSelected}
                                        onChange={() => handleSelect(targetKey)}
                                    />
                                    <span className="secondary-target-name">
                                        {isOptionTarget(target) ? (
                                            <strong>{target.label}</strong>
                                        ) : (
                                            <>
                                                <strong>{target.name}</strong>
                                                {shouldShowSize && <span className="secondary-target-size">({target.size})</span>}
                                                {shouldShowHp && <span className="secondary-target-hp">
                                                    {target.currentHp}/{target.maxHp} HP ({Math.round((target.currentHp / target.maxHp) * 100)}%)
                                                </span>}
                                            </>
                                        )}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    {featureDescription && (
                        <p className="secondary-target-note">{featureDescription}</p>
                    )}
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={!selected || targets.length === 0}
                        type="button"
                    >
                        <i className={`fa-solid ${iconClass}`}></i> {label}
                    </button>
                    <button className="sp-dismiss-btn" onClick={onSkip} type="button">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SecondaryTargetModal;
