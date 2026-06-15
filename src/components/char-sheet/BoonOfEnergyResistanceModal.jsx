import { useState } from 'react';
import { applyTypeChoice } from '../../services/automation/handlers/reactions/boonOfEnergyResistanceHandler.js';
import './CharSheet.css';

function BoonOfEnergyResistanceModal({ action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState([]);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const damageTypes = action?.damageTypes || ['Acid', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'];
    const existingTypes = action?.existingTypes || [];
    const maxSelections = action?.maxSelections || 2;

    const toggleType = (type) => {
        if (selected.includes(type)) {
            setSelected(selected.filter(t => t !== type));
        } else if (selected.length < maxSelections) {
            setSelected([...selected, type]);
        }
    };

    const handleApply = async () => {
        if (selected.length === 0) return;
        const res = await applyTypeChoice(action, playerStats, campaignName, selected);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-shield-halved"></i> {action?.name || 'Boon Of Energy Resistance'}
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

    const isSelected = (type) => selected.includes(type);
    const isExisting = (type) => existingTypes.includes(type);

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-shield-halved"></i> {action?.name || 'Boon Of Energy Resistance'}
                </div>
                <div className="sp-body">
                    <p>{existingTypes.length > 0
                        ? `Change your chosen damage types (currently ${existingTypes.join(', ')}):`
                        : `Choose ${maxSelections} damage types from the list below. You gain resistance to these types. Whenever you finish a Long Rest, you can change your choices.`
                    }</p>
                    <p style={{ fontSize: '0.9em', opacity: 0.7, marginTop: '4px' }}>
                        Selected: {selected.length} / {maxSelections}
                    </p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {damageTypes.map((type, i) => {
                            const isSel = isSelected(type);
                            const isEx = isExisting(type);
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: selected.length >= maxSelections && !isSel ? 'not-allowed' : 'pointer', background: isSel ? 'rgba(255,255,255,0.15)' : (isEx && !isSel ? 'rgba(100,200,255,0.1)' : 'transparent'), border: isSel ? '1px solid var(--color-link)' : (isEx && !isSel ? '1px dashed var(--color-link)' : '1px solid transparent'), opacity: (selected.length >= maxSelections && !isSel) ? 0.5 : 1 }}>
                                    <input
                                        type="checkbox"
                                        checked={isSel}
                                        onChange={() => toggleType(type)}
                                        disabled={selected.length >= maxSelections && !isSel}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{type}</strong>
                                    {isEx && !isSel && <span style={{ marginLeft: '8px', opacity: 0.7, fontSize: '0.85em' }}>(current)</span>}
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={selected.length === 0}>
                        <i className="fa-solid fa-shield-halved"></i> {existingTypes.length > 0 ? 'Change Damage Types' : 'Choose Damage Types'}
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default BoonOfEnergyResistanceModal;
