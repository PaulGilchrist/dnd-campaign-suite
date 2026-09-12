import { useState } from 'react';
import { applyTypeChoice } from '../../../services/automation/handlers/class-warlock/fiendishResilienceHandler.js';
import '../CharSheet.css';

function handleOverlayDismiss(e, onClose) {
    if (e.target.closest('.sp-modal')) return;
    onClose?.();
}

function ResistanceHeader({ title, icon, action }) {
    return (
        <div className="sp-header">
            <i className={`fa-solid ${icon || 'fa-shield-halved'}`}></i> {title || action?.name || 'Resistance Selection'}
        </div>
    );
}

function ResistanceAppliedView({ title, icon, action, result, onClose }) {
    return (
        <div className="sp-overlay" onClick={(e) => handleOverlayDismiss(e, onClose)}>
            <div className="sp-modal">
                <ResistanceHeader title={title} icon={icon} action={action} />
                <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.payload.description }}>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
}

function ResistanceTypeRow({ type, isSelected, isExisting, hasSelection, setSelected }) {
    return (
        <label style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : (isExisting ? 'rgba(100,200,255,0.1)' : 'transparent'), border: isSelected ? '1px solid var(--color-link)' : (isExisting ? '1px dashed var(--color-link)' : '1px solid transparent') }}>
            <input
                type="radio"
                name="resistanceSelectionOption"
                checked={isSelected}
                onChange={() => setSelected(type)}
                style={{ marginRight: '8px' }}
            />
            <strong>{type}</strong>
            {isExisting && !hasSelection && <span style={{ marginLeft: '8px', opacity: 0.7, fontSize: '0.85em' }}>(current)</span>}
        </label>
    );
}

function SingleResistanceSelectionModal({ title, icon, action, playerStats, campaignName, onClose, onConfirm }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const damageTypes = action?.automation?.damageTypes || [
        'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
        'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant',
        'Slashing', 'Thunder'
    ];
    const existingType = action?.existingType;

    const handleApply = async () => {
        if (!selected) return;
        if (onConfirm) {
            onConfirm(selected);
            return;
        }
        const res = await applyTypeChoice(action, playerStats, campaignName, selected);
        setResult(res);
        setApplied(true);
    };

    if (applied && result && !onConfirm) {
        return <ResistanceAppliedView title={title} icon={icon} action={action} result={result} onClose={onClose} />;
    }

    return (
        <div className="sp-overlay" onClick={(e) => handleOverlayDismiss(e, onClose)}>
            <div className="sp-modal">
                <ResistanceHeader title={title} icon={icon} action={action} />
                <div className="sp-body">
                    <p>{existingType ? 'Change damage type (currently ' + existingType + '):' : 'Choose one damage type (other than Force). You gain resistance to that type until you choose a different one.'}</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {damageTypes.map((type) => (
                            <ResistanceTypeRow
                                key={type}
                                type={type}
                                isSelected={selected === type}
                                isExisting={type === existingType}
                                hasSelection={!!selected}
                                setSelected={setSelected}
                            />
                        ))}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className={`fa-solid ${icon || 'fa-shield-halved'}`}></i> {existingType ? 'Change Damage Type' : 'Choose Damage Type'}
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default SingleResistanceSelectionModal;
