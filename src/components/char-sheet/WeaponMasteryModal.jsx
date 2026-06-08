import { useState, useEffect } from 'react';
import { MASTERY_EFFECTS, applyMasteryEffect } from '../../services/automation/handlers/weaponMasteryHandler.js';
import { loadWeaponMasteries } from '../../hooks/useActionPopup.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/damageUtils.js';
import './CharSheet.css';

function WeaponMasteryModal({ attackName, baseMastery, extraMasteries, playerStats, campaignName, targetName: targetNameProp, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);
    const [masteryDescriptions, setMasteryDescriptions] = useState(null);
    const [targetName, setTargetName] = useState(targetNameProp || null);

    useEffect(() => {
        if (!targetName) {
            getCombatContext(campaignName).then(cs => {
                const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                if (target?.name) setTargetName(target.name);
            }).catch(() => {});
        }
    }, [targetName, campaignName, playerStats.name]);

    useEffect(() => {
        loadWeaponMasteries().then(masteries => {
            const descMap = {};
            for (const m of masteries || []) {
                descMap[m.name] = m.description;
            }
            setMasteryDescriptions(descMap);
        }).catch(() => {});
    }, []);

    const allMasteries = [];
    if (baseMastery) {
        allMasteries.push({ name: baseMastery, source: 'weapon' });
    }
    for (const name of (extraMasteries || [])) {
        if (!allMasteries.find(m => m.name === name)) {
            allMasteries.push({ name, source: 'feature' });
        }
    }

    const handleActivate = async () => {
        if (!selected) return;
        const res = await applyMasteryEffect(selected, playerStats, campaignName, targetName);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-crosshairs"></i> Weapon Mastery
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

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-crosshairs"></i> Weapon Mastery — {attackName}
                </div>
                <div className="sp-body">
                    <p>Choose a mastery property to activate{targetName ? ` against <b>${targetName}</b>` : ''}:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {allMasteries.map((m, i) => {
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
                                        name="masteryOption"
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
                        You can activate one mastery property per hit.
                    </p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleActivate} disabled={!selected}>
                        <i className="fa-solid fa-crosshairs"></i> Activate
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Skip</button>
                </div>
            </div>
        </div>
    );
}

export default WeaponMasteryModal;
