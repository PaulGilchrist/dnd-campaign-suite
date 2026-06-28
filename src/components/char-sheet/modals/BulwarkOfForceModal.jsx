import { useState } from 'react';
import '../modals/shared/SecondaryTargetModal.css';

export default function BulwarkOfForceModal({
    targets,
    maxTargets,
    onConfirm,
    onSkip,
}) {
    const [selected, setSelected] = useState([]);

    const toggleTarget = (name) => {
        setSelected(prev =>
            prev.includes(name)
                ? prev.filter(n => n !== name)
                : prev.length < maxTargets
                    ? [...prev, name]
                    : prev
        );
    };

    const handleConfirm = () => {
        if (selected.length === 0) return;
        onConfirm(selected);
    };

    return (
        <div className="sp-overlay" onClick={onSkip}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-shield-halved"></i> Bulwark of Force
                </div>
                <div className="sp-body">
                    <p>
                        Choose allies to grant Half Cover
                        {maxTargets > 1 ? ` (${selected.length}/${maxTargets} selected)` : ''}:
                    </p>
                    <div className="secondary-target-list">
                        {targets.map((target, i) => {
                            const name = target.name || target;
                            const isSelected = selected.includes(name);
                            const atMax = selected.length >= maxTargets && !isSelected;
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
                                        {target.currentHp != null && target.maxHp != null && (
                                            <span className="secondary-target-hp">
                                                {target.currentHp}/{target.maxHp} HP
                                            </span>
                                        )}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={selected.length === 0}
                        type="button"
                    >
                        <i className="fa-solid fa-shield-halved"></i> Grant Half Cover ({selected.length})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onSkip} type="button">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}
