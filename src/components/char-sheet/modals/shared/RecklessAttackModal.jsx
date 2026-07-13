import { useState } from 'react';
import '../../CharSheet.css';

const BRUTAL_STRIKE_DESCRIPTIONS = {
    'Forceful Blow': 'Push target 15 ft',
    'Hamstring Blow': 'Reduce target Speed by 15 ft',
    'Staggering Blow': 'Disadvantage on next save, no Opportunity Attacks',
    'Sundering Blow': '+5 to next attack against target',
};

function RecklessAttackModal({ playerStats: _playerStats, campaignName: _campaignName, attack, onConfirm, onCancel, mode = 'full', hasBrutalStrike = false, brutalStrikeOptions = [], maxEffects = 1 }) {
    const [useBrutalStrike, setUseBrutalStrike] = useState(false);
    const [selectedEffects, setSelectedEffects] = useState([]);

    const isBrutalOnly = mode === 'brutalOnly';
    const multiSelect = maxEffects > 1;

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
            setSelectedEffects(prev => prev[0] === effectName ? [] : [effectName]);
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
            <div className="sp-overlay" onClick={handleCancel}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> Brutal Strike
                    </div>
                    <div className="sp-body">
                        <p>Reckless Attack is already active. Use Brutal Strike on this attack?</p>
                        <p style={{ opacity: 0.8, fontSize: '0.9em' }}>
                            Forgo Advantage on this attack to deal extra {maxEffects > 1 ? '2d10' : '1d10'} damage and apply effects.
                        </p>
                        {hasBrutalStrike && (
                            <div style={{ marginTop: '12px', textAlign: 'left' }}>
                                <label style={{ display: 'block', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', background: useBrutalStrike ? 'rgba(255,255,255,0.15)' : 'transparent', border: useBrutalStrike ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="checkbox"
                                        checked={useBrutalStrike}
                                        onChange={() => { setUseBrutalStrike(!useBrutalStrike); setSelectedEffects([]); }}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>Use Brutal Strike</strong>
                                </label>
                                {useBrutalStrike && brutalStrikeOptions.length > 0 && (
                                    <div style={{ marginTop: '8px', marginLeft: '16px' }}>
                                        <p style={{ opacity: 0.7, fontSize: '0.85em', marginBottom: '8px' }}>
                                            Choose {multiSelect ? `up to ${maxEffects}` : 'one'} effect{multiSelect ? 's' : ''}:
                                        </p>
                                        {brutalStrikeOptions.map((opt, i) => {
                                            const isSelected = multiSelect ? selectedEffects.includes(opt.name) : selectedEffects[0] === opt.name;
                                            const inputType = multiSelect ? 'checkbox' : 'radio';
                                            return (
                                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                                    <input
                                                        type={inputType}
                                                        name={multiSelect ? `brutalOption_${i}` : 'brutalOption'}
                                                        checked={isSelected}
                                                        onChange={() => handleEffectToggle(opt.name)}
                                                        style={{ marginRight: '8px' }}
                                                    />
                                                    <strong>{opt.name}</strong>
                                                    {BRUTAL_STRIKE_DESCRIPTIONS[opt.name] && (
                                                        <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {BRUTAL_STRIKE_DESCRIPTIONS[opt.name]}</span>
                                                    )}
                                                </label>
                                            );
                                        })}
                                        {multiSelect && (
                                            <p style={{ opacity: 0.7, fontSize: '0.85em', marginTop: '8px' }}>
                                                {selectedEffects.length}/{maxEffects} selected
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
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
        <div className="sp-overlay" onClick={handleCancel}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-shield-halved"></i> Reckless Attack
                </div>
                <div className="sp-body">
                    <p>Use Reckless Attack? You'll have Advantage on Strength attack rolls until the start of your next turn, but attack rolls against you also have Advantage.</p>
                    {hasBrutalStrike && (
                        <div style={{ marginTop: '12px', textAlign: 'left' }}>
                            <label style={{ display: 'block', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', background: useBrutalStrike ? 'rgba(255,255,255,0.15)' : 'transparent', border: useBrutalStrike ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                <input
                                    type="checkbox"
                                    checked={useBrutalStrike}
                                    onChange={() => { setUseBrutalStrike(!useBrutalStrike); setSelectedEffects([]); }}
                                    style={{ marginRight: '8px' }}
                                />
                                <strong>Use Brutal Strike</strong> — Forgo Advantage for extra {maxEffects > 1 ? '2d10' : '1d10'} damage
                            </label>
                            {useBrutalStrike && brutalStrikeOptions.length > 0 && (
                                <div style={{ marginTop: '8px', marginLeft: '16px' }}>
                                    <p style={{ opacity: 0.7, fontSize: '0.85em', marginBottom: '8px' }}>
                                        Choose {multiSelect ? `up to ${maxEffects}` : 'one'} effect{multiSelect ? 's' : ''}:
                                    </p>
                                    {brutalStrikeOptions.map((opt, i) => {
                                        const isSelected = multiSelect ? selectedEffects.includes(opt.name) : selectedEffects[0] === opt.name;
                                        const inputType = multiSelect ? 'checkbox' : 'radio';
                                        return (
                                            <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                                <input
                                                    type={inputType}
                                                    name={multiSelect ? `brutalOption_${i}` : 'brutalOption'}
                                                    checked={isSelected}
                                                    onChange={() => handleEffectToggle(opt.name)}
                                                    style={{ marginRight: '8px' }}
                                                />
                                                <strong>{opt.name}</strong>
                                                {BRUTAL_STRIKE_DESCRIPTIONS[opt.name] && (
                                                    <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {BRUTAL_STRIKE_DESCRIPTIONS[opt.name]}</span>
                                                )}
                                            </label>
                                        );
                                    })}
                                    {multiSelect && (
                                        <p style={{ opacity: 0.7, fontSize: '0.85em', marginTop: '8px' }}>
                                            {selectedEffects.length}/{maxEffects} selected
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
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
