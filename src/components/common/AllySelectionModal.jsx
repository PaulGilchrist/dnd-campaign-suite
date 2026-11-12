import { useState } from 'react';
import './AllySelectionModal.css';

export default function AllySelectionModal({
    title,
    icon,
    creatures,
    currentAllies,
    selfName,
    onConfirm,
    onCancel,
}) {
    // currentAllies is trusted-ish display state, but filter to known names
    // so stale entries never inflate the count or leak into onConfirm.
    const [selected, setSelected] = useState(() =>
        (currentAllies || []).filter(name => creatures.some(c => c.name === name))
    );

    const toggleCreature = (name) => {
        setSelected(prev =>
            prev.includes(name)
                ? prev.filter(n => n !== name)
                : [...prev, name]
        );
    };

    const selectAll = () => {
        setSelected(creatures.map(c => c.name));
    };

    const clearAll = () => {
        setSelected([]);
    };

    // One-click betrayal flip (LZ backlog 2026-11-11): self-only = "trusts no
    // one". Draft-state only — same lane as Clear All/Select All, nothing is
    // written until Confirm.
    const selfInList = !!selfName && creatures.some(c => c.name === selfName);
    const selectSelfOnly = () => {
        setSelected([selfName]);
    };

    const handleConfirm = () => {
        if (selected.length === 0) return;
        onConfirm(selected);
    };

    const iconClass = icon || 'fa-shield-halved';
    const label = title || 'Select Allies';

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className={`fa-solid ${iconClass}`}></i> {label}
                </div>
                <div className="sp-body">
                    <div className="ally-selection-controls">
                        <button type="button" className="ally-select-btn" onClick={selectAll}>
                            <i className="fa-solid fa-check-double"></i> Select All
                        </button>
                        <button type="button" className="ally-select-btn" onClick={clearAll}>
                            <i className="fa-solid fa-xmark"></i> Clear All
                        </button>
                        {selfInList && (
                            <button type="button" className="ally-select-btn" onClick={selectSelfOnly}>
                                <i className="fa-solid fa-user-slash"></i> Self only (hostile)
                            </button>
                        )}
                        <span className="ally-count">{selected.length} selected</span>
                    </div>
                    {/* Self-only is the sanctioned "trust no one" route (useAllyEditor
                        mirrors the monster-card lane); surface it while Confirm is
                        still disabled at 0 so the escape hatch is not invisible. */}
                    {selected.length === 0 && creatures.length > 0 && (
                        <p className="sp-note ally-hostile-hint">
                            Select only yourself to trust no one.
                        </p>
                    )}
                    <div className="secondary-target-list">
                        {creatures.map((creature, i) => {
                        const name = creature.name;
                        const isSelected = selected.includes(name);
                        const isPlayer = creature.type === 'player';
                            const hpDisplay = (!isPlayer && creature.currentHp != null && creature.maxHp != null)
                                ? `${Math.round((creature.currentHp / creature.maxHp) * 100)}%`
                                : null;
                            return (
                                <label
                                    key={i}
                                    className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''}`}
                                >
                                    {/* EB canon (EncounterMonsterTable): explicit accessible
                                        name so rows read as checkboxes, not label-text spans. */}
                                    <input
                                        type="checkbox"
                                        aria-label={`Select ${name}`}
                                        checked={isSelected}
                                        onChange={() => toggleCreature(name)}
                                    />
                                    <span className="secondary-target-name">
                                        <strong>{name}</strong>
                                        {isPlayer && <span className="secondary-target-size"> (Player)</span>}
                                        {!isPlayer && <span className="secondary-target-size"> (NPC)</span>}
                                        {hpDisplay && (
                                            <span className="secondary-target-hp">
                                                ({hpDisplay} HP)
                                            </span>
                                        )}
                                    </span>
                                </label>
                            );
                        })}
                        {creatures.length === 0 && (
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
                        <i className={`fa-solid ${iconClass}`}></i> Confirm Allies ({selected.length})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onCancel} type="button">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
