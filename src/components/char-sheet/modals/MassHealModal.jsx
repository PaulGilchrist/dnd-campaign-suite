import { useState, useCallback } from 'react';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export default function MassHealModal({
    creatureTargets,
    maxTargets,
    pool,
    onConfirm,
    onSkip,
    campaignName,
    combatSummary,
    title = 'Mass Heal',
    description = null,
    icon = 'fa-tree',
    confirmLabel = 'Heal',
    confirmIcon = 'fa-tree',
}) {
    const [selected, setSelected] = useState([]);
    const [allocations, setAllocations] = useState({});

    const totalAllocated = Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const remaining = Math.max(0, pool - totalAllocated);

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
        const num = Math.max(0, Math.min(pool, Number(value) || 0));
        setAllocations(prev => ({ ...prev, [name]: num }));
    }, [pool]);

    const adjustAllocation = (name, delta) => {
        setAllocations(prev => {
            const current = prev[name] || 0;
            const newVal = Math.max(0, Math.min(pool, current + delta));
            return { ...prev, [name]: newVal };
        });
    };

    const getTargetHpInfo = useCallback((name) => {
        if (!combatSummary) return null;
        const creature = combatSummary.creatures?.find(c => c.name === name);
        if (!creature) return null;
        if (creature.type !== 'player') return null;
        const storedCurrent = getRuntimeValue(name, 'currentHitPoints', campaignName);
        const storedMax = getRuntimeValue(name, 'hitPoints', campaignName);
        const currentHp = storedCurrent != null && storedCurrent !== '' ? Number(storedCurrent) : (creature.currentHp ?? 0);
        const maxHp = storedMax != null && storedMax !== '' ? Number(storedMax) : (creature.maxHp ?? currentHp);
        return { currentHp, maxHp };
    }, [combatSummary, campaignName]);

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

    const selectedTargets = creatureTargets.slice(0, maxTargets);

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className={`fa-solid ${icon}`}></i> {title}
                </div>
                <div className="sp-body">
                    <p dangerouslySetInnerHTML={{ __html: description || `Choose up to ${maxTargets} allies to heal. Divide <b>${pool} HP</b> among them however you like.
                    Healed creatures are also cured of blinded, deafened, and poisoned conditions.` }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '12px', fontSize: '0.9em', color: 'var(--color-header)' }}>
                        <span>Pool: {pool} HP</span>
                        <span style={{ color: '#999' }}>
                            Allocated: {totalAllocated} / {pool}
                        </span>
                        {remaining > 0 && (
                            <span style={{ color: '#f0ad4e', fontWeight: 'bold' }}>
                                Remaining: {remaining}
                            </span>
                        )}
                    </div>
                    {selectedTargets.map((target, i) => {
                        const name = target.name || target;
                        const isSelected = selected.includes(name);
                        const amount = allocations[name] || 0;
                        const hpInfo = getTargetHpInfo(name);
                        const hpPercent = hpInfo && hpInfo.maxHp > 0
                            ? `${Math.round((hpInfo.currentHp / hpInfo.maxHp) * 100)}%`
                            : null;
                        return (
                            <div
                                key={i}
                                style={{
                                    border: '1px solid var(--border-color-light)',
                                    borderRadius: '6px',
                                    marginBottom: '6px',
                                    overflow: 'hidden',
                                    background: isSelected ? 'rgba(0,180,216,0.1)' : 'transparent',
                                    borderColor: isSelected ? 'var(--color-link)' : 'var(--border-color-light)',
                                }}
                            >
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    margin: 0,
                                    color: 'var(--color-header)',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        disabled={!isSelected && selected.length >= maxTargets}
                                        onChange={() => toggleTarget(name)}
                                    />
                                    <span>
                                        <strong>{name}</strong>
                                        {hpInfo && (
                                            <span style={{ fontSize: '0.85em', opacity: 0.7, marginLeft: '4px' }}>
                                                ({hpInfo.currentHp} / {hpInfo.maxHp} HP{hpPercent ? `, ${hpPercent}` : ''})
                                            </span>
                                        )}
                                    </span>
                                </label>
                                {isSelected && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 12px 10px',
                                        borderTop: '1px solid var(--border-color-light)',
                                        color: 'var(--color-header)',
                                    }}>
                                        <button
                                            className="sp-dismiss-btn"
                                            onClick={() => adjustAllocation(name, -1)}
                                            type="button"
                                            style={{ padding: '4px 8px', fontSize: '0.85em' }}
                                        >
                                            <i className="fa-solid fa-minus"></i>
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            max={pool}
                                            value={amount}
                                            onChange={(e) => updateAllocation(name, e.target.value)}
                                            style={{
                                                width: '60px',
                                                textAlign: 'center',
                                                background: 'transparent',
                                                border: '1px solid var(--border-color-light)',
                                                borderRadius: '4px',
                                                color: 'var(--color-header)',
                                                padding: '4px',
                                                fontSize: '0.9em',
                                            }}
                                        />
                                        <button
                                            className="sp-roll-btn"
                                            onClick={() => {
                                                const maxMissing = hpInfo ? Math.min(hpInfo.maxHp - hpInfo.currentHp, pool - totalAllocated + amount) : pool;
                                                setAllocations(prev => ({ ...prev, [name]: Math.max(0, maxMissing) }));
                                            }}
                                            type="button"
                                            style={{ padding: '4px 8px', fontSize: '0.85em' }}
                                        >
                                            <i className="fa-solid fa-burst"></i>
                                        </button>
                                        <span style={{ fontSize: '0.85em', opacity: 0.7 }}>HP</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {selectedTargets.length === 0 && (
                        <p style={{ fontStyle: 'italic', opacity: 0.7 }}>No targets available.</p>
                    )}
                    {remaining > 0 && totalAllocated > 0 && (
                        <p style={{ fontSize: '0.85em', opacity: 0.7, fontStyle: 'italic', marginTop: '8px' }}>
                            {remaining} HP unallocated — you may leave HP unused.
                        </p>
                    )}
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={selected.length === 0}
                        type="button"
                        style={{ opacity: selected.length === 0 ? 0.5 : 1 }}
                    >
                        <i className={`fa-solid ${confirmIcon}`}></i> {confirmLabel} ({selected.length})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onSkip} type="button">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}
