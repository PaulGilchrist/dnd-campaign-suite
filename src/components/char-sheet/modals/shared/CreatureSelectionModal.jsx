import { useState } from 'react';
import './SecondaryTargetModal.css';

export default function CreatureSelectionModal({
    title,
    icon,
    targets,
    description,
    note,
    maxTargets,
    confirmLabel,
    confirmIcon,
    onConfirm,
    onSkip,
}) {
    const [selected, setSelected] = useState([]);

    const toggleTarget = (name) => {
        setSelected(prev =>
            prev.includes(name)
                ? prev.filter(n => n !== name)
                : !maxTargets || prev.length < maxTargets
                    ? [...prev, name]
                    : prev
        );
    };

    const handleConfirm = () => {
        if (selected.length === 0) return;
        onConfirm(selected);
    };

    const iconClass = confirmIcon || 'fa-crosshairs';
    const label = confirmLabel || 'Confirm';

    return (
        <div className="sp-overlay" onClick={onSkip}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className={`fa-solid ${icon}`}></i> {title}
                </div>
                <div className="sp-body">
                    {description && <p dangerouslySetInnerHTML={{ __html: description }} />}
                    {!description && targets.length > 0 && <p>{description || `Choose ${maxTargets ? `up to ${maxTargets}` : 'multiple'} targets:`}</p>}
                    {note && <p className="sp-note">{note}</p>}
                    <div className="secondary-target-list">
                        {targets.map((target, i) => {
                            const name = target.name || target;
                            const isSelected = selected.includes(name);
                            const atMax = maxTargets && selected.length >= maxTargets && !isSelected;
                            const isPlayer = target.type === 'player';
                            const hpDisplay = (!isPlayer && target.currentHp != null && target.maxHp != null)
                                ? `${Math.round((target.currentHp / target.maxHp) * 100)}%`
                                : null;
                            return (
                                <label
                                    key={i}
                                    className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''} ${atMax ? 'secondary-target-disabled' : ''}`}
                                    onClick={() => !atMax && toggleTarget(name)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        disabled={atMax}
                                        onChange={() => toggleTarget(name)}
                                    />
                                    <span className="secondary-target-name">
                                        <strong>{name}</strong>
                                        {hpDisplay && (
                                            <span className="secondary-target-hp">
                                                ({hpDisplay} HP)
                                            </span>
                                        )}
                                    </span>
                                </label>
                            );
                        })}
                        {targets.length === 0 && (
                            <p className="sp-note">No creatures available.</p>
                        )}
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={selected.length === 0}
                        type="button"
                    >
                        <i className={`fa-solid ${iconClass}`}></i> {label} ({selected.length})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onSkip} type="button">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}
