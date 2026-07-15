import { useState, useEffect } from 'react';
import { MASTERY_EFFECTS } from '../../../services/automation/handlers/combat/weaponMasteryHandler.js';
import { loadWeaponMasteries } from '../../../hooks/combat/useActionPopup.js';
import '../CharSheet.css';

function TacticalMasterModal({ attackName, baseMastery, replaceOptions, targetName, playerStats: _playerStats, campaignName: _campaignName, onConfirm, onClose, isChoiceMode }) {
    const defaultOption = isChoiceMode && replaceOptions?.[0] ? replaceOptions[0] : baseMastery;
    const [selected, setSelected] = useState(defaultOption);
    const [applied, setApplied] = useState(false);
    const [masteryDescriptions, setMasteryDescriptions] = useState(null);

    useEffect(() => {
        loadWeaponMasteries().then(masteries => {
            const descMap = {};
            for (const m of masteries || []) {
                descMap[m.name] = m.description;
            }
            setMasteryDescriptions(descMap);
        }).catch((e) => { console.error("[TacticalMasterModal] Error:", e); });
    }, []);

    const allOptions = [];
    if (!isChoiceMode && baseMastery) {
        allOptions.push({ name: baseMastery, source: 'weapon' });
    }
    for (const name of (replaceOptions || [])) {
        if (name === 'Graze') continue;
        if (!allOptions.find(m => m.name === name)) {
            allOptions.push({ name, source: 'feature' });
        }
    }

    const handleConfirm = async () => {
        if (!selected) return;
        await onConfirm(selected);
        setApplied(true);
    };

    if (applied) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-crosshairs"></i> Tactical Master
                    </div>
                    <div className="sp-body">
                        Mastery applied successfully.
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-crosshairs"></i> Tactical Master — {attackName}
                </div>
                <div className="sp-body">
                    <p dangerouslySetInnerHTML={{ __html: targetName ? `Choose a mastery property against <b>${targetName}</b>:` : 'Choose a mastery property:' }} />
                    <p style={{ opacity: 0.7, fontSize: '0.85em' }}>
                        When you attack with a weapon whose mastery property you can use, you can replace that property with the Push, Sap, or Slow property for that attack.
                    </p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {allOptions.map((m, i) => {
                            const effect = MASTERY_EFFECTS[m.name];
                            const isSelected = selected === m.name;
                            const desc = masteryDescriptions?.[m.name] || effect?.description || '';
                            return (
                                <label key={i} style={{
                                    display: 'block', padding: '8px 12px', margin: '4px 0',
                                    borderRadius: '6px', cursor: 'pointer',
                                    background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent',
                                    border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent',
                                }}>
                                    <input
                                        type="radio"
                                        name="tacticalMasterOption"
                                        checked={isSelected}
                                        onChange={() => setSelected(m.name)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{effect?.label || m.name}</strong>
                                    {m.source === 'feature' && (
                                        <span className="automation-badge" style={{ marginLeft: '8px', fontSize: '0.75em' }}>Feature</span>
                                    )}
                                    {desc && (
                                        <div style={{ opacity: 0.8, fontSize: '0.85em', marginTop: '4px', paddingLeft: '24px' }}>
                                            {desc}
                                        </div>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                    <p style={{ opacity: 0.7, fontSize: '0.85em', marginTop: '8px' }}>
                        You can choose one mastery property per hit.
                    </p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm} disabled={!selected}>
                        <i className="fa-solid fa-crosshairs"></i> Apply
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Skip</button>
                </div>
            </div>
        </div>
    );
}

export default TacticalMasterModal;
