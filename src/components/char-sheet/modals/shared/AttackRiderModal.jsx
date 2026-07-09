import { useState, useEffect } from 'react';
import { applyRiderOption } from '../../../../services/automation/handlers/combat/attackRiderHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import SecondaryTargetModal from './SecondaryTargetModal.jsx';
import '../../CharSheet.css';

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
        if (applied && !result) {
            onClose();
        }
    }, [applied, result, onClose]);

    const options = action.options || action.automation?.options || [];
    const maxEffects = action.automation?.maxEffects || action.maxEffects || 1;
    const multiSelect = maxEffects > 1;

    // Check for Versatile Trickster secondary targets after applying
    useEffect(() => {
        if (applied && result) {
            const secondaryTargets = getRuntimeValue(playerStats.name, 'versatileTricksterSecondaryTargets', campaignName);
            if (secondaryTargets && secondaryTargets.length > 0) {
                setVersatileTricksterTargets(secondaryTargets);
            }
        }
    }, [applied, result, playerStats.name, campaignName]);

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
            setApplied(true);
        } else {
            if (!selected) return;
            const res = await applyRiderOption(action, playerStats, campaignName, targetName, selected ? [selected] : []);
            setResult(res);
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
                <div className="sp-overlay" onClick={onClose}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
                <div className="sp-overlay" onClick={onClose}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
            } else {
                const targetEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const massFearIndex = targetEffects.findIndex(te => te.effect === 'mass_fear');
                if (massFearIndex !== -1) {
                    const updatedEffects = [...targetEffects];
                    updatedEffects[massFearIndex] = {
                        ...updatedEffects[massFearIndex],
                        target: selectedTargetName,
                    };
                    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
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
                <div className="sp-overlay" onClick={onClose}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
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

    const labelText = multiSelect
        ? `Choose up to ${maxEffects} effect${maxEffects > 1 ? 's' : ''}${targetName ? ` against <b>${targetName}</b>` : ''}:`
        : `Choose an effect${targetName ? ` against <b>${targetName}</b>` : ''}:`;

    const canApply = multiSelect ? selectedMulti.length > 0 : !!selected;

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-bolt"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p dangerouslySetInnerHTML={{ __html: labelText }}></p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {options.map((opt, i) => {
                            const effects = [];
                            if (opt.effect === 'disadvantage_on_next_save') effects.push('Disadvantage on next save');
                            if (opt.noOpportunityAttacks && !opt.movement) effects.push('Cannot make Opportunity Attacks');
                            if (opt.effect === 'next_attack_advantage') effects.push(`+${opt.value || '5'} to next attack`);
                            if (opt.effect === 'push_15ft') effects.push('Push 15 ft');
                            if (opt.effect === 'push') effects.push(`Push ${opt.value || 10} ft`);
                            if (opt.effect === 'speed_reduction') effects.push('Speed reduced by 15 ft');
                            if (opt.effect === 'sudden_strike') effects.push('Make another attack vs. different creature within 5 ft');
                            if (opt.effect === 'mass_fear') effects.push('Target + creatures within 10 ft make WIS save or be Frightened');
                            if (opt.effect === 'prone') effects.push('Target makes DEX save or gains Prone condition');
                            if (opt.effect === 'poisoned') effects.push('Target makes CON save or becomes Poisoned (1 min, repeating)');
                            if (opt.effect === 'no_opportunity_attacks' && opt.movement) effects.push(`Move up to ${opt.movement} without provoking OAs`);
                            if (opt.effect === 'daze') effects.push('Target makes CON save or on next turn can only do one of: move, action, or Bonus Action');
                            if (opt.effect === 'unconscious') effects.push('Target makes CON save or becomes Unconscious (1 min, repeating)');
                            if (opt.effect === 'blinded') effects.push('Target makes DEX save or becomes Blinded (until end of its next turn)');
                            if (opt.effect === 'damage_bonus') effects.push(`${opt.damageExpression || '1d6'} damage`);
                            if (opt.cost) effects.push(`Cost: ${opt.cost} Sneak Attack dice`);
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
