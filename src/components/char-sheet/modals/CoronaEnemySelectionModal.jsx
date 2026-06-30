import React, { useState } from 'react';
import '../modals/shared/SecondaryTargetModal.css';

export default function CoronaEnemySelectionModal({
    creatureTargets,
    onConfirm,
    onSkip,
}) {
    const [selected, setSelected] = useState([]);

    const toggleTarget = (name) => {
        setSelected(prev =>
            prev.includes(name)
                ? prev.filter(n => n !== name)
                : [...prev, name]
        );
    };

    const handleConfirm = () => {
        onConfirm(selected);
    };

    return (
        <div className="sp-overlay" onClick={onSkip}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-sun"></i> Corona of Light
                </div>
                <div className="sp-body">
                    <p>
                        Select which creatures are enemies of the caster.
                        Enemies in the bright light have Disadvantage on saving throws against Fire and Radiant damage:
                    </p>
                    <div className="secondary-target-list">
                        {creatureTargets.map((target, i) => {
                            const name = target.name || target;
                            const isSelected = selected.includes(name);
                            return (
                                <label
                                    key={i}
                                    className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''}`}
                                    onClick={() => toggleTarget(name)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
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
                        {creatureTargets.length === 0 && (
                            <p className="sp-note">No creatures in combat summary.</p>
                        )}
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        type="button"
                    >
                        <i className="fa-solid fa-sun"></i> Activate Corona ({selected.length})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onSkip} type="button">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}
