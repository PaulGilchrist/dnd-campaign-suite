import { useState } from 'react';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const ACTION_TYPE_LABELS = {
    attack_rider: 'Attack Riders (on hit)',
    bonus_action: 'Bonus Actions',
    reaction: 'Reactions',
    skill_check: 'Skill Checks',
    movement: 'Movement',
    grant_attack: 'Grant Attack',
};

const ACTION_TYPE_ORDER = ['attack_rider', 'bonus_action', 'reaction', 'skill_check', 'movement', 'grant_attack'];

const ACTION_TYPE_HINTS = {
    attack_rider: 'on hit',
    bonus_action: 'bonus action',
    reaction: 'reaction',
    skill_check: 'skill check',
};

// MN-018: HIT-triggered riders require the attack to have actually hit.
const TRIGGER_PREDICATES = {
    weapon_attack_hit: (attack, playerName) => attack.attackerName === playerName && attack.hit === true && (attack.weaponType === 'melee' || attack.weaponType === 'ranged' || attack.isUnarmedStrike),
    melee_weapon_attack_hit: (attack, playerName) => attack.attackerName === playerName && attack.hit === true && (attack.weaponType === 'melee' || attack.isUnarmedStrike),
    attack_roll_miss: (attack, playerName) => attack.attackerName === playerName && attack.hit === false,
    melee_attack_miss: (attack, playerName) => attack.targetName === playerName && (attack.weaponType === 'melee' || attack.isUnarmedStrike) && attack.hit === false,
    melee_damage_taken: (attack, playerName) => attack.targetName === playerName && (attack.weaponType === 'melee' || attack.isUnarmedStrike),
    melee_attack_straight_line: (attack, playerName) => attack.attackerName === playerName && (attack.weaponType === 'melee' || attack.isUnarmedStrike),
    replace_attack: (attack, playerName) => attack.attackerName === playerName && attack.replacingAttack === true,
};

function buildLastAttackContext(lastAttack) {
    if (!lastAttack) return null;
    return {
        hit: lastAttack.hit,
        isCrit: lastAttack.isCrit || false,
        weaponType: lastAttack.weaponType || null,
        isUnarmedStrike: lastAttack.isUnarmedStrike || false,
        replacingAttack: lastAttack.replacingAttack || false,
        attackerName: lastAttack.attackerName || null,
        targetName: lastAttack.targetName || null,
    };
}

function computeManeuverList({ availableManeuvers, allManeuvers, selectionMode, isPromptMode, attackContext, lastAttack, knownManeuvers, playerStats }) {
    if (availableManeuvers && availableManeuvers.length > 0) return availableManeuvers;
    if (!allManeuvers || allManeuvers.length === 0) return [];
    if (selectionMode) return allManeuvers;
    if (!isPromptMode) {
        return allManeuvers.filter(m => knownManeuvers.includes(m.name));
    }
    const effectiveAttack = attackContext || buildLastAttackContext(lastAttack);
    if (!effectiveAttack) {
        return allManeuvers.filter(m => knownManeuvers.includes(m.name));
    }
    const playerName = playerStats?.name;
    return allManeuvers.filter(m => {
        if (!knownManeuvers.includes(m.name)) return false;
        if (!m.trigger || m.trigger === 'any') return true;
        // MN-018: HIT-triggered riders require the attack to have actually hit.
        const predicate = TRIGGER_PREDICATES[m.trigger];
        return predicate ? predicate(effectiveAttack, playerName) : false;
    });
}

function computeHasSuperiorityDice(playerStats) {
    if (!playerStats?.name) return true;
    const dice = getRuntimeValue(playerStats.name, 'superiorityDice');
    const value = dice != null ? Number(dice) : (playerStats._trackedResources?.superiorityDice?.current || 0);
    return value > 0;
}

function shouldShowUseGroup(type, isPrompt, groupedManeuvers, knownManeuvers) {
    if (type === 'skill_check') return false;
    if (isPrompt) return !!groupedManeuvers[type];
    if (type === 'attack_rider') return false;
    return !!groupedManeuvers[type] && groupedManeuvers[type].some(m => knownManeuvers.includes(m.name));
}

function groupManeuversByType(maneuverList) {
    const grouped = {};
    for (const m of maneuverList) {
        const type = m.actionType || 'other';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(m);
    }
    return grouped;
}

function SpOverlay({ onClose, wide, children }) {
    return (
        <div className="sp-overlay" onClick={(e) => {
            if (e.target.closest('.sp-modal')) return;
            onClose?.();
        }}>
            <div className={wide ? 'sp-modal sp-modal--wide' : 'sp-modal'}>
                {children}
            </div>
        </div>
    );
}

function AppliedResultView({ result, onClose }) {
    return (
        <SpOverlay onClose={onClose}>
            <div className="sp-header">
                <i className="fa-solid fa-bolt"></i> {result.payload.name || 'Maneuver'}
            </div>
            <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.payload.description }}>
            </div>
            <div className="sp-actions">
                <button className="sp-roll-btn" onClick={onClose}>Done</button>
            </div>
        </SpOverlay>
    );
}

function SimpleNoticeView({ title, message, onClose }) {
    return (
        <SpOverlay onClose={onClose}>
            <div className="sp-header">
                <i className="fa-solid fa-bolt"></i> {title}
            </div>
            <div className="sp-body">
                <p>{message}</p>
            </div>
            <div className="sp-actions">
                <button className="sp-dismiss-btn" onClick={onClose}>Close</button>
            </div>
        </SpOverlay>
    );
}

function SelectionGroupCheckbox({ maneuver, isSelected, atMax, onToggle }) {
    return (
        <div style={{ marginBottom: '2px' }}>
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
                        if (!atMax) onToggle(maneuver.name);
                    }}
                    disabled={atMax}
                    style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                    <div>
                        <strong>{maneuver.name}</strong>
                    </div>
                    {maneuver.description && (
                        <div style={{ fontSize: '0.85em', opacity: 0.7, marginTop: '2px', lineHeight: 1.3 }}>
                            {maneuver.description}
                        </div>
                    )}
                </div>
            </label>
        </div>
    );
}

function ManeuverRadioItem({ maneuver, isSelected, onSelect }) {
    return (
        <label
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
                onChange={() => onSelect(maneuver.name)}
                style={{ marginTop: '2px', flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
                <div>
                    <strong>{maneuver.name}</strong>
                    <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>
                        — {ACTION_TYPE_HINTS[maneuver.actionType] || ''}
                    </span>
                </div>
                {maneuver.description && (
                    <div style={{ fontSize: '0.85em', opacity: 0.7, marginTop: '2px', lineHeight: 1.3 }}>
                        {maneuver.description}
                    </div>
                )}
            </div>
        </label>
    );
}

function SelectionView({ isPrompt, knownManeuvers, maxOptions, selectedForSelection, groupedManeuvers, toggleSelection, handleConfirmSelection, handleClearSelection, onClose }) {
    const isKnown = knownManeuvers.length > 0;
    return (
        <SpOverlay onClose={onClose} wide>
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
                        {groupedManeuvers[type].map(m => (
                            <SelectionGroupCheckbox
                                key={m.name}
                                maneuver={m}
                                isSelected={selectedForSelection.includes(m.name)}
                                atMax={selectedForSelection.length >= maxOptions && !selectedForSelection.includes(m.name)}
                                onToggle={toggleSelection}
                            />
                        ))}
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
        </SpOverlay>
    );
}

function UseView({ isPrompt, groupedManeuvers, knownManeuvers, selectedForUse, setSelectedForUse, handleUseManeuver, handleReopenSelection, onClose }) {
    return (
        <SpOverlay onClose={onClose}>
            <div className="sp-header">
                <i className="fa-solid fa-bolt"></i> {isPrompt ? 'Combat Superiority — Use Maneuver' : 'Combat Superiority — Choose Maneuver'}
            </div>
            <div className="sp-body">
                <p>{isPrompt ? 'Choose a maneuver to use:' : 'Choose a maneuver to use:'}</p>
                {ACTION_TYPE_ORDER.filter(t => shouldShowUseGroup(t, isPrompt, groupedManeuvers, knownManeuvers)).map(type => (
                    <div key={type} style={{ marginTop: '12px' }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95em', opacity: 0.9 }}>
                            {ACTION_TYPE_LABELS[type] || type}
                        </h4>
                        {groupedManeuvers[type].filter(m => knownManeuvers.includes(m.name)).map(m => (
                            <ManeuverRadioItem
                                key={m.name}
                                maneuver={m}
                                isSelected={selectedForUse === m.name}
                                onSelect={setSelectedForUse}
                            />
                        ))}
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
        </SpOverlay>
    );
}

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
    } = payload || {};

    const [selectedForSelection, setSelectedForSelection] = useState(knownManeuvers || []);
    const [selectedForUse, setSelectedForUse] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    if (!payload) return null;

    const isPromptMode = !!attackContext || !!skillContext;
    const isPrompt = isPromptMode;

    const hasSuperiorityDice = computeHasSuperiorityDice(playerStats);

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

    const maneuverList = computeManeuverList({ availableManeuvers, allManeuvers, selectionMode, isPromptMode, attackContext, lastAttack, knownManeuvers, playerStats });

    const groupedManeuvers = groupManeuversByType(maneuverList);

    const knownManeuverObjects = selectionMode ? [] : maneuverList.filter(m => knownManeuvers.includes(m.name));

    if (!selectionMode && applied && result) {
        return <AppliedResultView result={result} onClose={onClose} />;
    }

    if (!selectionMode && !hasSuperiorityDice) {
        return <SimpleNoticeView title="Combat Superiority" message="No Superiority Dice remaining. Recharges on a Short or Long Rest." onClose={onClose} />;
    }

    if (selectionMode) {
        return (
            <SelectionView
                isPrompt={isPrompt}
                knownManeuvers={knownManeuvers}
                maxOptions={maxOptions}
                selectedForSelection={selectedForSelection}
                groupedManeuvers={groupedManeuvers}
                toggleSelection={toggleSelection}
                handleConfirmSelection={handleConfirmSelection}
                handleClearSelection={handleClearSelection}
                onClose={onClose}
            />
        );
    }

    if (knownManeuverObjects.length === 0) {
        return <SimpleNoticeView title="Combat Superiority" message="No maneuvers selected. Use Combat Superiority again to select your maneuvers." onClose={onClose} />;
    }

    return (
        <UseView
            isPrompt={isPrompt}
            groupedManeuvers={groupedManeuvers}
            knownManeuvers={knownManeuvers}
            selectedForUse={selectedForUse}
            setSelectedForUse={setSelectedForUse}
            handleUseManeuver={handleUseManeuver}
            handleReopenSelection={handleReopenSelection}
            onClose={onClose}
        />
    );
}

export default CombatSuperiorityModal;
