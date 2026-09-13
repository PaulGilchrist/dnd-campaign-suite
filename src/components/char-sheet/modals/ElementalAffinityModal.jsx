import { useState } from 'react';
import { applyTypeChoice } from '../../../services/automation/handlers/class-sorcerer/elementalAffinityHandler.js';
import '../CharSheet.css';

function affinityIntroText(action, existingType) {
    if (existingType) return 'Change damage type (currently ' + existingType + '):';
    if (action?.automation?.effect === 'elemental_adept') return 'Choose one of the following damage types (Acid, Cold, Fire, Lightning, or Thunder). Spells you cast ignore Resistance to damage of the chosen type. In addition, when you roll damage for a spell you cast that deals damage of that type, you can treat any 1 on a damage die as a 2.';
    return 'Choose one damage type (Acid, Cold, Fire, Lightning, or Poison). You gain resistance to that type. When you cast a spell that deals damage of that type, add your Charisma modifier to one damage roll.';
}

function ElementalAffinityModal({ action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const damageTypes = action?.automation?.damageTypes || ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'];
    const existingType = action?.existingType;
    const title = action?.name || 'Elemental Affinity';

    const handleApply = async () => {
        if (!selected) return;
        const res = await applyTypeChoice(action, playerStats, campaignName, selected);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={(e) => {
        if (e.target.closest('.sp-modal')) return;
        onClose?.();
    }}>
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> {title}
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
        <div className="sp-overlay" onClick={(e) => {
        if (e.target.closest('.sp-modal')) return;
        onClose?.();
    }}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-bolt"></i> {title}
                </div>
                <div className="sp-body">
                    <p>{affinityIntroText(action, existingType)}</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {damageTypes.map((type, i) => (
                            <AffinityTypeOption
                                key={i}
                                type={type}
                                selected={selected}
                                setSelected={setSelected}
                                isExisting={type === existingType}
                            />
                        ))}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-bolt"></i> {existingType ? 'Change Damage Type' : 'Choose Damage Type'}
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

function AffinityTypeOption({ type, selected, setSelected, isExisting }) {
    const isSelected = selected === type;
    return (
        <label style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : (isExisting ? 'rgba(100,200,255,0.1)' : 'transparent'), border: isSelected ? '1px solid var(--color-link)' : (isExisting ? '1px dashed var(--color-link)' : '1px solid transparent') }}>
            <input
                type="radio"
                name="elementalAffinityOption"
                checked={isSelected}
                onChange={() => setSelected(type)}
                style={{ marginRight: '8px' }}
            />
            <strong>{type}</strong>
            {isExisting && !selected && <span style={{ marginLeft: '8px', opacity: 0.7, fontSize: '0.85em' }}>(current)</span>}
        </label>
    );
}

export default ElementalAffinityModal;
