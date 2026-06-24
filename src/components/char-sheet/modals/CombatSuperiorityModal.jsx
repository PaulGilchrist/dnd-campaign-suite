import { useState } from 'react';

const ACTION_TYPE_LABELS = {
    attack_rider: 'Attack Riders (on hit)',
    bonus_action: 'Bonus Actions',
    reaction: 'Reactions',
    skill_check: 'Skill Checks',
    movement: 'Movement',
    grant_attack: 'Grant Attack',
};

const ACTION_TYPE_ORDER = ['attack_rider', 'bonus_action', 'reaction', 'skill_check', 'movement', 'grant_attack'];

function CombatSuperiorityModal({ payload, onConfirm, onReopenSelection, onClose }) {
    const {
        allManeuvers,
        knownManeuvers,
        maxOptions,
        selectionMode,
        availableManeuvers,
        attackContext,
        skillContext,
        lastAttack,
        playerStats,
    } = payload;


    const [selectedForSelection, setSelectedForSelection] = useState(knownManeuvers || []);
    const [selectedForUse, setSelectedForUse] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const isPromptMode = !!attackContext || !!skillContext;
    const isPrompt = isPromptMode;

    const toggleSelection = (maneuverName) => {
        setSelectedForSelection(prev => {
            if (prev.includes(maneuverName)) {
                return prev.filter(n => n !== maneuverName);
            }
            if (prev.length >= maxOptions) return prev;
            return [...prev, maneuverName];
        });
    };

    const handleConfirmSelection = () => {
        if (selectedForSelection.length === 0) return;
        onConfirm(selectedForSelection, null);
    };

    const handleClearSelection = () => {
        onConfirm([], null);
    };

    const handleReopenSelection = () => {
        if (onReopenSelection) {
            onReopenSelection().catch(e => console.error('[CombatSuperiorityModal] Reopen selection failed:', e));
        } else {
            onConfirm(selectedForSelection, null);
        }
    };

    const handleUseManeuver = async () => {
        if (!selectedForUse) return;
        try {
            const res = await onConfirm(null, selectedForUse);
            setResult(res);
            setApplied(true);
        } catch (e) {
            console.error('[CombatSuperiorityModal] Use maneuver failed:', e);
        }
    };

    const maneuverList = availableManeuvers && availableManeuvers.length > 0 ? availableManeuvers : (() => {
        if (!allManeuvers || allManeuvers.length === 0) return [];
        if (selectionMode) return allManeuvers;
        if (!lastAttack) {
            return allManeuvers.filter(m => knownManeuvers.includes(m.name));
        }
        const playerName = playerStats?.name;
        const attackContext = {
            hit: lastAttack.hit,
            isCrit: lastAttack.isCrit || false,
            weaponType: lastAttack.weaponType || null,
            isUnarmedStrike: lastAttack.isUnarmedStrike || false,
            replacingAttack: lastAttack.replacingAttack || false,
            attackerName: lastAttack.attackerName || null,
            targetName: lastAttack.targetName || null,
        };
        return allManeuvers.filter(m => {
            if (!knownManeuvers.includes(m.name)) return false;
            if (!m.trigger || m.trigger === 'any') return true;
            if (m.trigger === 'weapon_attack_hit') {
                return attackContext.attackerName === playerName && (attackContext.weaponType === 'melee' || attackContext.weaponType === 'ranged' || attackContext.isUnarmedStrike);
            }
            if (m.trigger === 'melee_weapon_attack_hit') {
                return attackContext.attackerName === playerName && (attackContext.weaponType === 'melee' || attackContext.isUnarmedStrike);
            }
            if (m.trigger === 'attack_roll_miss') {
                return attackContext.attackerName === playerName && attackContext.hit === false;
            }
            if (m.trigger === 'melee_attack_miss') {
                return attackContext.targetName === playerName && (attackContext.weaponType === 'melee' || attackContext.isUnarmedStrike) && attackContext.hit === false;
            }
            if (m.trigger === 'melee_damage_taken') {
                return attackContext.targetName === playerName && (attackContext.weaponType === 'melee' || attackContext.isUnarmedStrike);
            }
            if (m.trigger === 'melee_attack_straight_line') {
                return attackContext.attackerName === playerName && (attackContext.weaponType === 'melee' || attackContext.isUnarmedStrike);
            }
            if (m.trigger === 'replace_attack') {
                return attackContext.attackerName === playerName && attackContext.replacingAttack === true;
            }
            return true;
        });
    })();

    const groupedManeuvers = {};
    for (const m of maneuverList) {
        const type = m.actionType || 'other';
        if (!groupedManeuvers[type]) groupedManeuvers[type] = [];
        groupedManeuvers[type].push(m);
    }

    const knownManeuverObjects = selectionMode ? [] : maneuverList.filter(m => knownManeuvers.includes(m.name));

    if (!selectionMode && applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal sp-modal--wide" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> {result.payload.name || 'Maneuver'}
                    </div>
                    <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.payload.description }}>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    if (selectionMode) {
        const isKnown = knownManeuvers.length > 0;
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal sp-modal--wide" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> {isPrompt ? 'Combat Superiority — Choose Maneuver' : 'Combat Superiority — Select Maneuvers'}
                    </div>
                    <div className="sp-body">
                        <p>
                            {isKnown
                                ? `Your known maneuvers: ${knownManeuvers.length}. You can know up to ${maxOptions}. Select your maneuvers below. You can change your selection at any time.`
                                : `Choose up to ${maxOptions} maneuvers. You learn 3 at level 3, and gain more at levels 7, 10, and 15.`
                            }
                        </p>
                        <p style={{ opacity: 0.7, marginTop: '4px' }}>
                            {selectedForSelection.length}/{maxOptions} selected
                        </p>
                        {ACTION_TYPE_ORDER.filter(t => groupedManeuvers[t]).map(type => (
                            <div key={type} style={{ marginTop: '12px' }}>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95em', opacity: 0.9 }}>
                                    {ACTION_TYPE_LABELS[type] || type}
                                </h4>
                                {groupedManeuvers[type].map(m => {
                                    const isSelected = selectedForSelection.includes(m.name);
                                    const atMax = selectedForSelection.length >= maxOptions && !isSelected;
                                    return (
                                        <div key={m.name} style={{ marginBottom: '2px' }}>
                                            <label
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '8px',
                                                    padding: '6px 10px',
                                                    borderRadius: '4px',
                                                    cursor: atMax ? 'not-allowed' : 'pointer',
                                                    background: isSelected ? 'rgba(255,255,255,0.12)' : 'transparent',
                                                    border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent',
                                                    opacity: atMax ? 0.5 : 1,
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        if (!atMax) toggleSelection(m.name);
                                                    }}
                                                    disabled={atMax}
                                                    style={{ marginTop: '2px', flexShrink: 0 }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div>
                                                        <strong>{m.name}</strong>
                                                    </div>
                                                    {m.description && (
                                                        <div style={{ fontSize: '0.85em', opacity: 0.7, marginTop: '2px', lineHeight: 1.3 }}>
                                                            {m.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    <div className="sp-actions">
                        <button
                            className="sp-roll-btn"
                            onClick={handleConfirmSelection}
                            disabled={selectedForSelection.length === 0}
                        >
                            <i className="fa-solid fa-check"></i> Confirm Selection
                        </button>
                        {isKnown && (
                            <button className="sp-dismiss-btn" onClick={handleClearSelection}>
                                Clear Selection
                            </button>
                        )}
                        <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    if (knownManeuverObjects.length === 0) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal sp-modal--wide" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> Combat Superiority
                    </div>
                    <div className="sp-body">
                        <p>No maneuvers selected. Use Combat Superiority again to select your maneuvers.</p>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-dismiss-btn" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal sp-modal--wide" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-bolt"></i> {isPrompt ? 'Combat Superiority — Use Maneuver' : 'Combat Superiority — Choose Maneuver'}
                </div>
                <div className="sp-body">
                    <p>{isPrompt ? 'Choose a maneuver to use:' : 'Choose a maneuver to use:'}</p>
                    {ACTION_TYPE_ORDER.filter(t => (isPrompt && groupedManeuvers[t]) || (!isPrompt && t !== 'attack_rider') && groupedManeuvers[t] && groupedManeuvers[t].some(m => knownManeuvers.includes(m.name))).map(type => (
                        <div key={type} style={{ marginTop: '12px' }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95em', opacity: 0.9 }}>
                                {ACTION_TYPE_LABELS[type] || type}
                            </h4>
                            {groupedManeuvers[type].filter(m => knownManeuvers.includes(m.name)).map(m => {
                                const isSelected = selectedForUse === m.name;
                                return (
                                    <label
                                        key={m.name}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '8px',
                                            padding: '6px 10px',
                                            marginBottom: '2px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            background: isSelected ? 'rgba(255,255,255,0.12)' : 'transparent',
                                            border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent',
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="combatManeuver"
                                            checked={isSelected}
                                            onChange={() => setSelectedForUse(m.name)}
                                            style={{ marginTop: '2px', flexShrink: 0 }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div>
                                                <strong>{m.name}</strong>
                                                <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>
                                                    — {m.actionType === 'attack_rider' ? 'on hit' : m.actionType === 'bonus_action' ? 'bonus action' : m.actionType === 'reaction' ? 'reaction' : m.actionType === 'skill_check' ? 'skill check' : ''}
                                                </span>
                                            </div>
                                            {m.description && (
                                                <div style={{ fontSize: '0.85em', opacity: 0.7, marginTop: '2px', lineHeight: 1.3 }}>
                                                    {m.description}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    ))}
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleUseManeuver} disabled={!selectedForUse}>
                        <i className="fa-solid fa-bolt"></i> Use Maneuver
                    </button>
                    <button className="sp-dismiss-btn" onClick={handleReopenSelection}>
                        <i className="fa-solid fa-gear"></i> Manage Maneuvers
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default CombatSuperiorityModal;
