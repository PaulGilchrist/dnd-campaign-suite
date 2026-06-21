import { useState, useEffect } from 'react';
import { getRuntimeValue, setRuntimeBatch } from '../../../../hooks/runtime/useRuntimeState.js';
import './ArcaneWardRestoreModal.css';

function ArcaneWardRestoreModal({ action, playerStats, campaignName, onClose, onConfirm }) {
    const name = playerStats.name;
    const [selectedLevel, setSelectedLevel] = useState(null);
    const [wardInfo, setWardInfo] = useState({ currentHp: 0, maxHp: 0 });
    const [availableSlots, setAvailableSlots] = useState({});

    useEffect(() => {
        const currentHp = Number(getRuntimeValue(name, 'arcaneWardHp', campaignName) ?? 0);
        const maxHp = Number(getRuntimeValue(name, 'arcaneWardMax', campaignName) ?? 0);
        setWardInfo({ currentHp, maxHp });

        const slots = {};
        for (let lvl = 1; lvl <= 9; lvl++) {
            const stored = getRuntimeValue(name, `spell_slots_level_${lvl}`, campaignName);
            slots[lvl] = Number(stored) || 0;
        }
        setAvailableSlots(slots);
    }, [name, campaignName]);

    const restoreAmount = (selectedLevel || 0) * 2;
    const newHp = Math.min(wardInfo.maxHp, wardInfo.currentHp + restoreAmount);
    const canApply = selectedLevel != null && availableSlots[selectedLevel] > 0;

    const handleApply = () => {
        if (!canApply) return;
        const updates = {};
        updates[`arcaneWardHp`] = newHp;
        updates[`spell_slots_level_${selectedLevel}`] = availableSlots[selectedLevel] - 1;
        setRuntimeBatch(name, updates, campaignName);
        if (onConfirm) {
            onConfirm(selectedLevel, restoreAmount, wardInfo.currentHp, newHp);
        }
        onClose();
    };

    return (
        <div className="arcane-ward-restore-overlay" onClick={onClose}>
            <div className="arcane-ward-restore-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-shield-halved"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p><b>Arcane Ward HP:</b> {wardInfo.currentHp}/{wardInfo.maxHp}</p>
                    <p>Choose a spell slot level to expend. Ward HP restored = 2 × slot level.</p>
                    <div className="arcane-ward-slot-grid">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => (
                            <label
                                key={lvl}
                                className={`arcane-ward-slot-option ${selectedLevel === lvl ? 'selected' : ''} ${availableSlots[lvl] === 0 ? 'disabled' : ''}`}
                                onClick={() => availableSlots[lvl] > 0 && setSelectedLevel(lvl)}
                            >
                                <input
                                    type="radio"
                                    name="arcaneWardSlotLevel"
                                    checked={selectedLevel === lvl}
                                    onChange={() => {}}
                                    disabled={availableSlots[lvl] === 0}
                                />
                                <span className="slot-level">Level {lvl}</span>
                                <span className="slot-available">{availableSlots[lvl]} available</span>
                                <span className="slot-restore">+{lvl * 2} HP</span>
                            </label>
                        ))}
                    </div>
                    {selectedLevel && (
                        <div className="arcane-ward-preview">
                            <b>Preview:</b> {wardInfo.currentHp} → {newHp}/{wardInfo.maxHp}
                        </div>
                    )}
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!canApply}>
                        <i className="fa-solid fa-shield-halved"></i> Restore Ward
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default ArcaneWardRestoreModal;
