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

function CombatSuperiorityModal({ payload, onConfirm, onClose }) {
    const {
        allManeuvers,
        knownManeuvers,
        maxOptions,
        selectionMode,
    } = payload;

    const [selectedForSelection, setSelectedForSelection] = useState(knownManeuvers || []);
    const [selectedForUse, setSelectedForUse] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

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

    const handleUseManeuver = async () => {
        if (!selectedForUse) return;
        const res = await onConfirm(null, selectedForUse);
        setResult(res);
        setApplied(true);
    };

    const groupedManeuvers = {};
    for (const m of allManeuvers) {
        const type = m.actionType || 'other';
        if (!groupedManeuvers[type]) groupedManeuvers[type] = [];
        groupedManeuvers[type].push(m);
    }

    if (!selectionMode && applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> Combat Superiority — Select Maneuvers
                    </div>
                    <div className="sp-body">
                        <p>
                            {isKnown
                                ? `Your known maneuvers: ${knownManeuvers.length}. You can know up to ${maxOptions}. Select your maneuvers below.`
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
                                        <label
                                            key={m.name}
                                            style={{
                                                display: 'block', padding: '6px 10px', margin: '2px 0',
                                                borderRadius: '4px', cursor: atMax ? 'not-allowed' : 'pointer',
                                                background: isSelected ? 'rgba(255,255,255,0.12)' : 'transparent',
                                                border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent',
                                                opacity: atMax ? 0.5 : 1,
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(m.name)}
                                                disabled={atMax}
                                                style={{ marginRight: '6px' }}
                                            />
                                            <strong>{m.name}</strong>
                                        </label>
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

    const knownManeuverObjects = allManeuvers.filter(m => knownManeuvers.includes(m.name));

    if (knownManeuverObjects.length === 0) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-bolt"></i> Combat Superiority — Choose Maneuver
                </div>
                <div className="sp-body">
                    <p>Choose a maneuver to use:</p>
                    {ACTION_TYPE_ORDER.filter(t => groupedManeuvers[t] && groupedManeuvers[t].some(m => knownManeuvers.includes(m.name))).map(type => (
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
                                            display: 'block', padding: '6px 10px', margin: '2px 0',
                                            borderRadius: '4px', cursor: 'pointer',
                                            background: isSelected ? 'rgba(255,255,255,0.12)' : 'transparent',
                                            border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent',
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="combatManeuver"
                                            checked={isSelected}
                                            onChange={() => setSelectedForUse(m.name)}
                                            style={{ marginRight: '6px' }}
                                        />
                                        <strong>{m.name}</strong>
                                        <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>
                                            — {m.actionType === 'attack_rider' ? 'on hit' : m.actionType === 'bonus_action' ? 'bonus action' : m.actionType === 'reaction' ? 'reaction' : m.actionType === 'skill_check' ? 'skill check' : ''}
                                        </span>
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
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default CombatSuperiorityModal;
