import { useState } from 'react';

function AttackRiderManeuverPrompt({ maneuvers, attack, popupHtml, onUse, onSkip, isMiss }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleUse = async () => {
        if (!selected) return;
        const res = await onUse(selected, attack, popupHtml);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        if (result.isMissResult) {
            return (
                <div className="sp-overlay" onClick={onSkip}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> Precision Attack
                        </div>
                        <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.description }}>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-roll-btn" onClick={onSkip}>Done</button>
                        </div>
                    </div>
                </div>
            );
        }
        if (result.payload) {
            return (
                <div className="sp-overlay" onClick={onSkip}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {result.payload.name || 'Maneuver'}
                        </div>
                        <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.payload.description }}>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-roll-btn" onClick={onSkip}>Done</button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div className="sp-overlay" onClick={onSkip}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> Maneuver Applied
                    </div>
                    <div className="sp-body">
                        <p>Maneuver applied. Proceed with damage.</p>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onSkip}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    const headerText = isMiss
        ? 'Battle Master — Precision Attack'
        : 'Battle Master — Attack Rider Maneuver';

    const bodyText = isMiss
        ? 'The attack missed. Choose a maneuver to attempt to turn the miss into a hit:'
        : 'Choose an attack rider maneuver to use on this hit:';

    return (
        <div className="sp-overlay" onClick={onSkip}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-bolt"></i> {headerText}
                </div>
                <div className="sp-body">
                    <p>{bodyText}</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {maneuvers.map((m, i) => {
                            const isSelected = selected === m.name;
                            return (
                                <label
                                    key={i}
                                    style={{
                                        display: 'block', padding: '8px 12px', margin: '4px 0',
                                        borderRadius: '6px', cursor: 'pointer',
                                        background: isSelected ? 'rgba(255,255,255,0.12)' : 'transparent',
                                        border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent',
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="attackRiderManeuver"
                                        checked={isSelected}
                                        onChange={() => setSelected(m.name)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{m.name}</strong>
                                    {m.effect === 'attack_roll_bonus' && <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>— adds superiority die to attack roll</span>}
                                    {m.damageBonus && <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>— adds superiority die to damage</span>}
                                    {m.saveType && <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>— {m.saveType} save</span>}
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleUse} disabled={!selected}>
                        <i className="fa-solid fa-bolt"></i> Use Maneuver
                    </button>
                    <button className="sp-dismiss-btn" onClick={onSkip}>Skip</button>
                </div>
            </div>
        </div>
    );
}

export default AttackRiderManeuverPrompt;
