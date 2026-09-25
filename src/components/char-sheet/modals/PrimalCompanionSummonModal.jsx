import { useState } from 'react';
import { confirmPrimalCompanionSummon } from '../../../services/automation/handlers/class-ranger/primalCompanionHandler.js';

export default function PrimalCompanionSummonModal({ action, playerStats, campaignName, onClose }) {
    const [selectedType, setSelectedType] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const companionTypes = action?.automation?.companionTypes || [];

    const handleConfirm = async () => {
        const res = await confirmPrimalCompanionSummon(action, playerStats, campaignName, selectedType);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay">
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-paw"></i> {action.name}
                    </div>
                    <div className="sp-body">
                        <div dangerouslySetInnerHTML={{ __html: result.payload.description }} />
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-paw"></i> Primal Companion
                </div>
                <div className="sp-body">
                    <p>Choose a primal beast to bond with:</p>
                    <div style={{ marginTop: '12px' }}>
                        {companionTypes.map((ct, idx) => (
                            <label key={idx} style={{ display: 'block', marginBottom: '16px', cursor: 'pointer', padding: '8px', border: selectedType === ct.name ? '1px solid #4a9eff' : '1px solid transparent', borderRadius: '4px', background: selectedType === ct.name ? 'rgba(74, 158, 255, 0.1)' : 'transparent' }}>
                                <input
                                    type="radio"
                                    name="primalCompanion"
                                    value={ct.name}
                                    checked={selectedType === ct.name}
                                    onChange={() => setSelectedType(ct.name)}
                                    style={{ marginRight: '8px' }}
                                />
                                <strong>{ct.name}</strong> ({ct.size})
                                <div style={{ marginTop: '4px', opacity: 0.8, fontSize: '0.9em', lineHeight: '1.4' }}>
                                    {ct.description ? (
                                        <div dangerouslySetInnerHTML={{ __html: ct.description }} />
                                    ) : (
                                        <>AC {ct.acFormula}, HP {ct.hpBase}+{ct.hpPerLevel}xRanger level</>
                                    )}
                                    {ct.speed && <><br/>Speed: {ct.speed}{ct.specialSpeed ? `, ${ct.specialSpeed}` : ''}</>}
                                    {ct.attacks && ct.attacks.length > 0 && (
                                        <><br/>{ct.attacks[0].name}: {ct.attacks[0].damageDice}{ct.attacks[0].damageFlat} {ct.attacks[0].damageType}</>
                                    )}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm} disabled={!selectedType} type="button" style={{ opacity: !selectedType ? 0.5 : 1 }}>
                        <i className="fa-solid fa-paw"></i> Summon Primal Companion
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">Cancel</button>
                </div>
            </div>
        </div>
    );
}
