// FT-107: single-select mount chooser cloned from the verified
// AllySelectionModal seam (same .sp-overlay/.sp-modal chrome, no new CSS).
import { useState } from 'react';
import './AllySelectionModal.css';

export default function MountSelectionModal({
    creatures,
    riderName,
    onConfirm,
    onCancel,
}) {
    const [selected, setSelected] = useState('');

    const selectCreature = (name) => {
        setSelected(prev => (prev === name ? '' : name));
    };

    const handleConfirm = () => {
        if (!selected) return;
        onConfirm(selected);
    };

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-horse"></i> Select a Mount for {riderName}
                </div>
                <div className="sp-body">
                    <div className="ally-selection-controls">
                        <span className="ally-count">{selected ? `1 selected: ${selected}` : 'No mount selected'}</span>
                    </div>
                    <div className="secondary-target-list">
                        {creatures.map((creature, i) => {
                            const isSelected = selected === creature.name;
                            const isBeast = String(creature.monsterType || '').toLowerCase() === 'beast'
                                || String(creature.monsterType || '').toLowerCase() === 'vehicle';
                            return (
                                <label
                                    key={i}
                                    className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''}`}
                                    onClick={() => selectCreature(creature.name)}
                                >
                                    <input
                                        type="radio"
                                        name="mount-selection"
                                        checked={isSelected}
                                        onChange={() => selectCreature(creature.name)}
                                    />
                                    <span className="secondary-target-name">
                                        <strong>{creature.name}</strong>
                                        {creature.monsterType && <span className="secondary-target-size"> ({creature.monsterType})</span>}
                                        {creature.size && <span className="secondary-target-size"> {creature.size}</span>}
                                        {!isBeast && <span className="secondary-target-size"> (advisory: not a Beast/Vehicle)</span>}
                                    </span>
                                </label>
                            );
                        })}
                        {creatures.length === 0 && (
                            <p className="sp-note">No creatures on the initiative board to mount — join a mount (e.g. a Pony or Riding Horse) first.</p>
                        )}
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={!selected}
                        type="button"
                    >
                        <i className="fa-solid fa-horse"></i> Mount{selected ? ` ${selected}` : ''}
                    </button>
                    <button className="sp-dismiss-btn" onClick={onCancel} type="button">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
