import { useState, useCallback } from 'react';
import './PowerWordFortifyModal.css';

export default function PowerWordFortifyModal({
    creatureTargets,
    totalTempHp,
    maxTargets = 6,
    onConfirm,
    onSkip,
}) {
    const [selected, setSelected] = useState([]);
    const [allocations, setAllocations] = useState({});
    const [cappedName, setCappedName] = useState(null);

    const totalAllocated = selected.reduce((sum, name) => sum + (Number(allocations[name]) || 0), 0);
    const remaining = Math.max(0, totalTempHp - totalAllocated);
    const atMax = selected.length >= maxTargets;

    const allocatedToOthers = useCallback((name) => {
        return selected.reduce((sum, n) => n === name ? sum : sum + (Number(allocations[n]) || 0), 0);
    }, [selected, allocations]);

    const toggleTarget = useCallback((name) => {
        const isSelected = selected.includes(name);
        if (!isSelected && selected.length >= maxTargets) {
            return;
        }
        if (isSelected && cappedName === name) {
            setCappedName(null);
        }
        if (!isSelected) {
            setAllocations(prev => ({ ...prev, [name]: 0 }));
        }
        setSelected(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));
    }, [selected, maxTargets, cappedName]);

    const updateAllocation = useCallback((name, value) => {
        const avail = Math.max(0, totalTempHp - allocatedToOthers(name));
        const requested = Number(value) || 0;
        const num = Math.max(0, Math.min(avail, requested));
        setCappedName(requested > avail ? name : null);
        setAllocations(prev => ({ ...prev, [name]: num }));
    }, [totalTempHp, allocatedToOthers]);

    const adjustAllocation = useCallback((name, delta) => {
        const avail = Math.max(0, totalTempHp - allocatedToOthers(name));
        const current = allocations[name] || 0;
        const requested = current + delta;
        const newVal = Math.max(0, Math.min(avail, requested));
        setCappedName(requested > avail ? name : null);
        setAllocations(prev => ({ ...prev, [name]: newVal }));
    }, [totalTempHp, allocatedToOthers, allocations]);

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
        const sum = Object.values(distribution).reduce((s, v) => s + v, 0);
        if (sum > totalTempHp) return;
        onConfirm(distribution);
    }, [selected, allocations, totalTempHp, onConfirm]);

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-shield"></i> Power Word Fortify
                </div>
                <div className="sp-body">
                    <p className="sp-note">
                        <b>{totalTempHp} Temporary Hit Points</b> to distribute among up to {maxTargets} chosen allies.
                    </p>
                    <div className="pwfm-pool-bar">
                        <span>Pool: {totalTempHp} HP</span>
                        <span className="pwfm-allocated">
                            Allocated: {totalAllocated} / {totalTempHp}
                        </span>
                        {remaining > 0 && (
                            <span className="pwfm-remaining">
                                Remaining: {remaining}
                            </span>
                        )}
                    </div>
                    <div className="secondary-target-list">
                        {creatureTargets.map((target, i) => {
                            const name = target.name;
                            const isSelected = selected.includes(name);
                            const amount = allocations[name] || 0;
                            const avail = Math.max(0, totalTempHp - allocatedToOthers(name));
                            const atCap = !isSelected && atMax;
                            return (
                                <div
                                    key={i}
                                    className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''} ${atCap ? 'secondary-target-disabled' : ''}`}
                                >
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={atCap}
                                            onChange={() => toggleTarget(name)}
                                        />
                                        <span className="secondary-target-name">
                                            <strong>{name}</strong>
                                        </span>
                                    </label>
                                    {isSelected && (
                                        <div className="pwfm-allocation">
                                            <button
                                                className="pwfm-adjust-btn"
                                                onClick={() => adjustAllocation(name, -1)}
                                                type="button"
                                            >
                                                <i className="fa-solid fa-minus"></i>
                                            </button>
                                            <input
                                                type="number"
                                                min="0"
                                                max={avail}
                                                value={amount}
                                                onChange={(e) => updateAllocation(name, e.target.value)}
                                                className="pwfm-amount-input"
                                            />
                                            <button
                                                className="pwfm-adjust-btn"
                                                onClick={() => adjustAllocation(name, 1)}
                                                type="button"
                                            >
                                                <i className="fa-solid fa-plus"></i>
                                            </button>
                                            <span className="pwfm-allocation-label">HP</span>
                                            {cappedName === name && (
                                                <div className="pwfm-capped-note">
                                                    Max {avail} — remaining pool
                                                </div>
                                            )}
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
                        <div className="pwfm-unallocated">
                            {remaining} HP unallocated — you may leave HP unused.
                        </div>
                    )}
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={selected.length === 0 || totalAllocated > totalTempHp}
                        type="button"
                    >
                        <i className="fa-solid fa-shield"></i> Fortify ({selected.length})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onSkip} type="button">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}
