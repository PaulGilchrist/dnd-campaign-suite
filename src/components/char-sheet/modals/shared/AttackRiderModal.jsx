import { useState, useEffect } from 'react';
import { applyRiderOption } from '../../../../services/automation/handlers/combat/attackRiderHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import SecondaryTargetModal from './SecondaryTargetModal.jsx';
import '../../CharSheet.css';

const RIDER_EFFECT_LABELS = [
    [opt => opt.effect === 'disadvantage_on_next_save', () => 'Disadvantage on next save'],
    [opt => opt.noOpportunityAttacks && !opt.movement, () => 'Cannot make Opportunity Attacks'],
    [opt => opt.effect === 'next_attack_advantage', opt => `+${opt.value || '5'} to next attack`],
    [opt => opt.effect === 'push_15ft', () => 'Push 15 ft'],
    [opt => opt.effect === 'push', opt => `Push ${opt.value || 10} ft`],
    [opt => opt.effect === 'speed_reduction', () => 'Speed reduced by 15 ft'],
    [opt => opt.effect === 'sudden_strike', () => 'Make another attack vs. different creature within 5 ft'],
    [opt => opt.effect === 'mass_fear', () => 'Target + creatures within 10 ft make WIS save or be Frightened'],
    [opt => opt.effect === 'prone', () => 'Target makes DEX save or gains Prone condition'],
    [opt => opt.effect === 'poisoned', () => 'Target makes CON save or becomes Poisoned (1 min, repeating)'],
    [opt => opt.effect === 'no_opportunity_attacks' && opt.movement, opt => `Move up to ${opt.movement} without provoking OAs`],
    [opt => opt.effect === 'daze', () => 'Target makes CON save or on next turn can only do one of: move, action, or Bonus Action'],
    [opt => opt.effect === 'unconscious', () => 'Target makes CON save or becomes Unconscious (1 min, repeating)'],
    [opt => opt.effect === 'blinded', () => 'Target makes DEX save or becomes Blinded (until end of its next turn)'],
    [opt => opt.effect === 'damage_bonus', opt => `${opt.damageExpression || '1d6'} damage`],
    [opt => opt.cost, opt => `Cost: ${opt.cost} Sneak Attack dice`],
];

function describeRiderOptionEffects(opt) {
    const effects = [];
    for (const [match, label] of RIDER_EFFECT_LABELS) {
        if (match(opt)) effects.push(label(opt));
    }
    return effects;
}

function riderOptionList(action) {
    return action.options || action.automation?.options || [];
}

function riderMaxEffects(action) {
    return action.automation?.maxEffects || action.maxEffects || 1;
}

function buildRiderLabelText(multiSelect, maxEffects, targetName) {
    const against = targetName ? ` against <b>${targetName}</b>` : '';
    if (multiSelect) return `Choose up to ${maxEffects} effect${maxEffects > 1 ? 's' : ''}${against}:`;
    return `Choose an effect${against}:`;
}

function riderCanApply(multiSelect, selectedMulti, selected) {
    if (multiSelect) return selectedMulti.length > 0;
    return !!selected;
}

function AttackRiderModal({ action, playerStats, campaignName, targetName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [selectedMulti, setSelectedMulti] = useState([]);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);
    const [versatileTricksterTargets, setVersatileTricksterTargets] = useState(null);
    const [vtApplied, setVtApplied] = useState(false);
    const [vtResult, setVtResult] = useState(null);
    const [stalkersFlurryTargets, setStalkersFlurryTargets] = useState(null);
    const [sfApplied, setSfApplied] = useState(false);
    const [sfResult, setSfResult] = useState(null);

    useEffect(() => {
        if (applied && !result && !versatileTricksterTargets && !stalkersFlurryTargets) {
            onClose();
        }
    }, [applied, result, versatileTricksterTargets, stalkersFlurryTargets, onClose]);

    const options = riderOptionList(action);
    const maxEffects = riderMaxEffects(action);
    const multiSelect = maxEffects > 1;

    // Check for Versatile Trickster secondary targets after applying.
    // CLA-376: gate on `applied` alone — save-bearing single-option picks
    // (Trip) return null from applyRiderOption, so `result` truthiness hid the
    // chooser. applyRiderOption clears these keys at entry, so persisted keys
    // here are always this cast's fresh Trip scan.
    useEffect(() => {
        if (applied) {
            const secondaryTargets = getRuntimeValue(playerStats.name, 'versatileTricksterSecondaryTargets', campaignName);
            if (secondaryTargets && secondaryTargets.length > 0) {
                setVersatileTricksterTargets(secondaryTargets);
            }
        }
    }, [applied, playerStats.name, campaignName]);

    // Check for Stalker's Flurry secondary targets after applying
    useEffect(() => {
        if (applied && result) {
            const secondaryTargets = getRuntimeValue(playerStats.name, 'stalkersFlurrySecondaryTargets', campaignName);
            if (secondaryTargets && secondaryTargets.length > 0) {
                setStalkersFlurryTargets(secondaryTargets);
            }
        }
    }, [applied, result, playerStats.name, campaignName]);

    const handleApply = async () => {
        if (multiSelect) {
            if (selectedMulti.length === 0) return;
            const res = await applyRiderOption(action, playerStats, campaignName, targetName, selectedMulti);
            setResult(res);
            // CLA-376: Trip save legs return null — open the VT picker off the
            // freshly-written (entry-cleared) persisted keys, not result truthiness.
            const vtTargets = getRuntimeValue(playerStats.name, 'versatileTricksterSecondaryTargets', campaignName);
            if (vtTargets && vtTargets.length > 0) setVersatileTricksterTargets(vtTargets);
            setApplied(true);
        } else {
            if (!selected) return;
            const res = await applyRiderOption(action, playerStats, campaignName, targetName, selected ? [selected] : []);
            setResult(res);
            const vtTargets = getRuntimeValue(playerStats.name, 'versatileTricksterSecondaryTargets', campaignName);
            if (vtTargets && vtTargets.length > 0) setVersatileTricksterTargets(vtTargets);
            setApplied(true);
        }
    };

    const toggleMultiSelect = (optName) => {
        setSelectedMulti(prev => {
            if (prev.includes(optName)) return prev.filter(n => n !== optName);
            if (prev.length >= maxEffects) return prev;
            return [...prev, optName];
        });
    };

    // Versatile Trickster secondary target selection
    if (versatileTricksterTargets && versatileTricksterTargets.length > 0) {
        if (vtApplied && vtResult) {
            return (
                <div className="sp-overlay" onClick={(e) => {
                    if (e.target.closest('.sp-modal')) return;
                    onClose?.();
                }}>
                    <div className="sp-modal">
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> Versatile Trickster
                        </div>
                        <div className="sp-body" dangerouslySetInnerHTML={{ __html: vtResult.payload.description }}>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-roll-btn" onClick={onClose}>Done</button>
                        </div>
                    </div>
                </div>
            );
        }

        const handleVtTargetSelected = async (selectedTargetName) => {
            const { applyVersatileTrickster } = await import('../../../../services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.js');
            const vtAction = getRuntimeValue(playerStats.name, 'versatileTricksterAction', campaignName);
            const res = await applyVersatileTrickster(vtAction, playerStats, campaignName, selectedTargetName);
            setVtResult(res);
            setVtApplied(true);
        };

        return (
            <SecondaryTargetModal
                title="Versatile Trickster"
                targets={versatileTricksterTargets}
                description={`Trip applied to <b>${targetName}</b>. Versatile Trickster allows you to also Trip another creature within 5 feet of the spectral hand:`}
                onTargetSelected={handleVtTargetSelected}
                onSkip={onClose}
                confirmLabel="Trip Secondary Target"
                confirmIcon="fa-bolt"
                showSize={true}
            />
        );
    }

    // Stalker's Flurry secondary target selection
    if (stalkersFlurryTargets && stalkersFlurryTargets.length > 0) {
        if (sfApplied && sfResult) {
            return (
                <div className="sp-overlay" onClick={(e) => {
                    if (e.target.closest('.sp-modal')) return;
                    onClose?.();
                }}>
                    <div className="sp-modal">
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> Stalker's Flurry
                        </div>
                        <div className="sp-body" dangerouslySetInnerHTML={{ __html: sfResult.payload.description }}>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-roll-btn" onClick={onClose}>Done</button>
                        </div>
                    </div>
                </div>
            );
        }

        const stalkerOptions = getRuntimeValue(playerStats.name, 'stalkersFlurryOptions', campaignName);
        const isSuddenStrike = stalkerOptions?.includes('Sudden Strike');

        const handleSfTargetSelected = async (selectedTargetName) => {
            setRuntimeValue(playerStats.name, 'stalkersFlurryChosenTarget', selectedTargetName, campaignName);
            if (isSuddenStrike) {
                setRuntimeValue(playerStats.name, 'pendingSuddenStrikeTarget', selectedTargetName, campaignName);
                setRuntimeValue(playerStats.name, 'pendingSuddenStrike', true, campaignName);
                onClose();
                return;
            } else {
                const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                const massFearIndex = targetEffects.findIndex(te => te.effect === 'mass_fear');
                if (massFearIndex !== -1) {
                    const updatedEffects = [...targetEffects];
                    updatedEffects[massFearIndex] = {
                        ...updatedEffects[massFearIndex],
                        target: selectedTargetName,
                    };
                    setRuntimeValue('campaign', 'targetEffects', updatedEffects, campaignName);
                }
            }
            setSfResult({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: "Stalker's Flurry",
                    description: isSuddenStrike
                        ? `Sudden Strike target set to <b>${selectedTargetName}</b>. You may now make a bonus action attack against this creature.`
                        : `Mass Fear epicenter set to <b>${selectedTargetName}</b>. ${selectedTargetName} and creatures within 10 ft must make a Wisdom save or be Frightened.`,
                },
            });
            setSfApplied(true);
        };

        return (
            <SecondaryTargetModal
                title="Stalker's Flurry"
                targets={stalkersFlurryTargets}
                description={isSuddenStrike
                    ? `Sudden Strike: Choose a target within 5 ft of <b>${targetName}</b> for your bonus action attack:`
                    : `Mass Fear: Choose a target for the fear effect. The target and creatures within 10 ft will make a Wisdom save or be Frightened.`}
                onTargetSelected={handleSfTargetSelected}
                onSkip={onClose}
                confirmLabel={isSuddenStrike ? "Attack Target" : "Apply Fear"}
                confirmIcon="fa-bolt"
                showSize={true}
            />
        );
    }

    if (applied) {
        if (result) {
            return (
                <div className="sp-overlay" onClick={(e) => {
                    if (e.target.closest('.sp-modal')) return;
                    onClose?.();
                }}>
                    <div className="sp-modal">
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {action.name}
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
        return null;
    }

    const labelText = buildRiderLabelText(multiSelect, maxEffects, targetName);
    const canApply = riderCanApply(multiSelect, selectedMulti, selected);

    return (
        <div className="sp-overlay" onClick={(e) => {
            if (e.target.closest('.sp-modal')) return;
            onClose?.();
        }}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-bolt"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p dangerouslySetInnerHTML={{ __html: labelText }}></p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {options.map((opt, i) => {
                            const effects = describeRiderOptionEffects(opt);
                            const isSelected = multiSelect ? selectedMulti.includes(opt.name) : selected === opt.name;
                            const inputType = multiSelect ? 'checkbox' : 'radio';
                            const inputChecked = isSelected;
                            const handleChange = multiSelect
                                ? () => toggleMultiSelect(opt.name)
                                : () => setSelected(opt.name);
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type={inputType}
                                        name={multiSelect ? `riderOption_${i}` : 'riderOption'}
                                        checked={inputChecked}
                                        onChange={handleChange}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{opt.name}</strong>
                                    {effects.length > 0 && <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {effects.join(', ')}</span>}
                                </label>
                            );
                        })}
                    </div>
                    {multiSelect && (
                        <p style={{ opacity: 0.7, fontSize: '0.85em', marginTop: '8px' }}>
                            {selectedMulti.length}/{maxEffects} selected
                        </p>
                    )}
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!canApply}>
                        <i className="fa-solid fa-bolt"></i> Apply Effect{multiSelect ? 's' : ''}
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default AttackRiderModal;
