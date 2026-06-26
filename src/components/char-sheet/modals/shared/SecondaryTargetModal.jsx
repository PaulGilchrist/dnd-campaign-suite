import { useState } from 'react';
import './SecondaryTargetModal.css';

function SecondaryTargetModal({ title, targets, onTargetSelected, onSkip, featureDescription }) {
    const [selected, setSelected] = useState(null);

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
                    <i className="fa-solid fa-crosshairs"></i> {title}
                </div>
                <div className="sp-body">
                    <p>{targets.length > 0 ? `Choose a target from the ${targets.length} available:` : 'No valid targets available.'}</p>
                    <div className="secondary-target-list">
                        {targets.map((target, i) => {
                            const hp = target.currentHp ?? target.maxHp;
                            const maxHp = target.maxHp;
                            const pct = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
                            const isSelected = selected === target.name;
                            return (
                                <label
                                    key={i}
                                    className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''}`}
                                    onClick={() => handleSelect(target.name)}
                                >
                                    <input
                                        type="radio"
                                        name="secondaryTarget"
                                        checked={isSelected}
                                        onChange={() => handleSelect(target.name)}
                                    />
                                    <span className="secondary-target-name">
                                        <strong>{target.name}</strong>
                                        <span className="secondary-target-hp">
                                            {hp}/{maxHp} HP ({pct}%)
                                        </span>
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
                        <i className="fa-solid fa-crosshairs"></i> Attack
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
