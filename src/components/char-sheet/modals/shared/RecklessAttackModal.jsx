import { useState } from 'react';
import '../../CharSheet.css';
import './RecklessAttackModal.css';

const BRUTAL_STRIKE_DESCRIPTIONS = {
    'Forceful Blow': 'Push target 15 ft',
    'Hamstring Blow': 'Reduce target Speed by 15 ft',
    'Staggering Blow': 'Disadvantage on next save, no Opportunity Attacks',
    'Sundering Blow': '+5 to next attack against target',
};

function BrutalStrikeOptionsPicker({ multiSelect, maxEffects, selectedEffects, brutalStrikeOptions, handleEffectToggle }) {
    if (!brutalStrikeOptions || brutalStrikeOptions.length === 0) return null;
    return (
        <div className="brutal-strike-picker">
            <p className="brutal-strike-hint">
                Choose {multiSelect ? `up to ${maxEffects}` : 'one'} effect{multiSelect ? 's' : ''}:
            </p>
            {brutalStrikeOptions.map((opt, i) => {
                const isSelected = multiSelect ? selectedEffects.includes(opt.name) : selectedEffects[0] === opt.name;
                const inputType = multiSelect ? 'checkbox' : 'radio';
                return (
                    <label
                        key={i}
                        className="brutal-strike-option"
                        /* background/border are dynamic (derived from isSelected state) — dynamic-data exception, stays inline */
                        style={{
                            background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent',
                            border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent',
                        }}
                    >
                        <input
                            type={inputType}
                            name={multiSelect ? `brutalOption_${i}` : 'brutalOption'}
                            checked={isSelected}
                            onChange={() => handleEffectToggle(opt.name)}
                            className="brutal-strike-input"
                        />
                        <strong>{opt.name}</strong>
                        {BRUTAL_STRIKE_DESCRIPTIONS[opt.name] && (
                            <span className="brutal-strike-desc">— {BRUTAL_STRIKE_DESCRIPTIONS[opt.name]}</span>
                        )}
                    </label>
                );
            })}
            {multiSelect && (
                <p className="brutal-strike-count">
                    {selectedEffects.length}/{maxEffects} selected
                </p>
            )}
        </div>
    );
}

function BrutalStrikeToggle({ useBrutalStrike, onToggle, multiSelect, maxEffects, selectedEffects, brutalStrikeOptions, handleEffectToggle, labelExtra }) {
    return (
        <div className="brutal-strike-toggle">
            <label
                className="brutal-strike-toggle-label"
                /* background/border are dynamic (derived from useBrutalStrike state) — dynamic-data exception, stays inline */
                style={{
                    background: useBrutalStrike ? 'rgba(255,255,255,0.15)' : 'transparent',
                    border: useBrutalStrike ? '1px solid var(--color-link)' : '1px solid transparent',
                }}
            >
                <input
                    type="checkbox"
                    checked={useBrutalStrike}
                    onChange={onToggle}
                    className="brutal-strike-input"
                />
                <strong>Use Brutal Strike</strong>{labelExtra}
            </label>
            {useBrutalStrike && <BrutalStrikeOptionsPicker multiSelect={multiSelect} maxEffects={maxEffects} selectedEffects={selectedEffects} brutalStrikeOptions={brutalStrikeOptions} handleEffectToggle={handleEffectToggle} />}
        </div>
    );
}

function RecklessAttackModal({ playerStats: _playerStats, campaignName: _campaignName, attack, onConfirm, onCancel, mode = 'full', hasBrutalStrike = false, brutalStrikeOptions = [], maxEffects = 1 }) {
    const [useBrutalStrike, setUseBrutalStrike] = useState(false);
    const [selectedEffects, setSelectedEffects] = useState([]);

    const isBrutalOnly = mode === 'brutalOnly';
    const multiSelect = maxEffects > 1;
    const extraDice = multiSelect ? '2d10' : '1d10';
    const toggleBrutalStrike = () => { setUseBrutalStrike(!useBrutalStrike); setSelectedEffects([]); };

    const handleEffectToggle = (effectName) => {
        if (multiSelect) {
            setSelectedEffects(prev => {
                if (prev.includes(effectName)) {
                    return prev.filter(e => e !== effectName);
                }
                if (prev.length >= maxEffects) return prev;
                return [...prev, effectName];
            });
        } else {
            // Radio onChange never refires on an already-checked radio, so the
            // deselect leg of the old ternary was unreachable (fix#228 family).
            setSelectedEffects([effectName]);
        }
    };

    const canConfirmBrutal = useBrutalStrike && selectedEffects.length > 0;

    const handleConfirm = () => {
        if (isBrutalOnly) {
            onConfirm({ useBrutalStrike: canConfirmBrutal, effectChoices: selectedEffects });
        } else {
            onConfirm(attack, { useBrutalStrike: canConfirmBrutal, effectChoices: selectedEffects });
        }
    };

    const handleCancel = () => {
        if (isBrutalOnly) {
            onCancel({ useBrutalStrike: false, effectChoices: [] });
        } else {
            onCancel(attack);
        }
    };

    if (isBrutalOnly) {
        return (
            <div className="sp-overlay">
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> Brutal Strike
                    </div>
                    <div className="sp-body">
                        <p>Reckless Attack is already active. Use Brutal Strike on this attack?</p>
                        <p className="brutal-strike-note">
                            Forgo Advantage on this attack to deal extra {extraDice} damage and apply effects.
                        </p>
                        {hasBrutalStrike && (
                            <BrutalStrikeToggle useBrutalStrike={useBrutalStrike} onToggle={toggleBrutalStrike} multiSelect={multiSelect} maxEffects={maxEffects} selectedEffects={selectedEffects} brutalStrikeOptions={brutalStrikeOptions} handleEffectToggle={handleEffectToggle} />
                        )}
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={handleConfirm} disabled={useBrutalStrike && !canConfirmBrutal}>
                            <i className="fa-solid fa-bolt"></i> Apply Brutal Strike
                        </button>
                        <button className="sp-dismiss-btn" onClick={handleCancel}>Skip</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-shield-halved"></i> Reckless Attack
                </div>
                <div className="sp-body">
                    <p>Use Reckless Attack? You'll have Advantage on Strength attack rolls until the start of your next turn, but attack rolls against you also have Advantage.</p>
                    {hasBrutalStrike && (
                        <BrutalStrikeToggle useBrutalStrike={useBrutalStrike} onToggle={toggleBrutalStrike} multiSelect={multiSelect} maxEffects={maxEffects} selectedEffects={selectedEffects} brutalStrikeOptions={brutalStrikeOptions} handleEffectToggle={handleEffectToggle} labelExtra={` — Forgo Advantage for extra ${extraDice} damage`} />
                    )}
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm} disabled={useBrutalStrike && !canConfirmBrutal}>
                        <i className="fa-solid fa-shield-halved"></i> Attack Recklessly
                    </button>
                    <button className="sp-dismiss-btn" onClick={handleCancel}>Normal Attack</button>
                </div>
            </div>
        </div>
    );
}

export default RecklessAttackModal;
