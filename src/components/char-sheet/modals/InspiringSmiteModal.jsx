import { useState, useCallback } from 'react';
import './InspiringSmiteModal.css';

export default function InspiringSmiteModal({
    creatureTargets,
    tempHp,
    roll,
    onConfirm,
    onSkip,
}) {
    const [selected, setSelected] = useState([]);
    const [allocations, setAllocations] = useState({});

    const totalAllocated = Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const remaining = Math.max(0, tempHp - totalAllocated);

    const toggleTarget = useCallback((name) => {
        setSelected(prev => {
            const isSelected = prev.includes(name);
            if (!isSelected) {
                setAllocations(p => ({ ...p, [name]: 0 }));
            }
            return isSelected
                ? prev.filter(n => n !== name)
                : [...prev, name];
        });
    }, []);

    const updateAllocation = useCallback((name, value) => {
        const num = Math.max(0, Math.min(tempHp, Number(value) || 0));
        setAllocations(prev => ({ ...prev, [name]: num }));
    }, [tempHp]);

    const adjustAllocation = (name, delta) => {
        setAllocations(prev => {
            const current = prev[name] || 0;
            const newVal = Math.max(0, Math.min(tempHp, current + delta));
            return { ...prev, [name]: newVal };
        });
    };

    const handleConfirm = useCallback(() => {
        const distribution = {};
        let hasAllocation = false;
        for (const name of selected) {
            const amount = allocations[name] || 0;
            if (amount > 0) {
                distribution[name] = amount;
                hasAllocation = true;
            }
        }
        if (!hasAllocation) return;
        onConfirm(distribution);
    }, [selected, allocations, onConfirm]);

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-hand-holding-heart"></i> Inspiring Smite
                </div>
                <div className="sp-body">
                    <p className="sp-note">
                        <b>Rolled {roll}: {tempHp} total temp HP</b> to distribute among chosen allies however you like.
                    </p>
                    <div className="inspiring-smite-pool-bar">
                        <span>Pool: {tempHp} HP</span>
                        <span className="inspiring-smite-allocated">
                            Allocated: {totalAllocated} / {tempHp}
                        </span>
                        {remaining > 0 && (
                            <span className="inspiring-smite-remaining">
                                Remaining: {remaining}
                            </span>
                        )}
                    </div>
                    <div className="secondary-target-list">
                        {creatureTargets.map((target, i) => {
                            const name = target.name;
                            const isSelected = selected.includes(name);
                            const amount = allocations[name] || 0;
                            return (
                                <div
                                    key={i}
                                    className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''}`}
                                >
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleTarget(name)}
                                        />
                                        <span className="secondary-target-name">
                                            <strong>{name}</strong>
                                        </span>
                                    </label>
                                    {isSelected && (
                                        <div className="inspiring-smite-allocation">
                                            <button
                                                className="inspiring-smite-adjust-btn"
                                                onClick={() => adjustAllocation(name, -1)}
                                                type="button"
                                            >
                                                <i className="fa-solid fa-minus"></i>
                                            </button>
                                            <input
                                                type="number"
                                                min="0"
                                                max={tempHp}
                                                value={amount}
                                                onChange={(e) => updateAllocation(name, e.target.value)}
                                                className="inspiring-smite-amount-input"
                                            />
                                            <button
                                                className="inspiring-smite-adjust-btn"
                                                onClick={() => adjustAllocation(name, 1)}
                                                type="button"
                                            >
                                                <i className="fa-solid fa-plus"></i>
                                            </button>
                                            <span className="inspiring-smite-allocation-label">HP</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {creatureTargets.length === 0 && (
                            <p className="sp-note">No targets available.</p>
                        )}
                    </div>
                    {remaining > 0 && totalAllocated > 0 && (
                        <div className="inspiring-smite-unallocated">
                            {remaining} HP unallocated — you may leave HP unused.
                        </div>
                    )}
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={selected.length === 0}
                        type="button"
                    >
                        <i className="fa-solid fa-hand-holding-heart"></i> Inspire ({selected.length})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onSkip} type="button">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}
