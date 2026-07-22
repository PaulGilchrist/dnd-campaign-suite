import { useState } from 'react';
import '../CharSheet.css';

function MultiResistanceSelectionModal({ title, icon, action: _action, playerStats: _playerStats, campaignName: _campaignName, damageTypes, existingTypes, maxSelections, onConfirm, onClose }) {
    const [selected, setSelected] = useState(existingTypes ? [...existingTypes] : []);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleToggle = (type) => {
        if (selected.includes(type)) {
            setSelected(selected.filter(t => t !== type));
        } else if (selected.length < maxSelections) {
            setSelected([...selected, type]);
        }
    };

    const handleConfirm = async () => {
        if (selected.length === 0) return;
        const res = await onConfirm(selected);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className={`fa-solid ${icon || 'fa-shield-halved'}`}></i> {title || 'Resistance Selection'}
                    </div>
                    <div className="sp-body" dangerouslySetInnerHTML={{ __html: result?.payload?.description || '' }}>
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
                    <i className={`fa-solid ${icon || 'fa-shield-halved'}`}></i> {title || 'Resistance Selection'}
                </div>
                <div className="sp-body">
                    <p>
                        {existingTypes && existingTypes.length > 0
                            ? `Change resistance types (currently ${existingTypes.join(', ')}):`
                            : `Choose ${maxSelections} damage type${maxSelections > 1 ? 's' : ''} to gain resistance to:`
                        }
                    </p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {damageTypes.map((type, i) => {
                            const isSelected = selected.includes(type);
                            const isExisting = existingTypes && existingTypes.includes(type);
                            const isDisabled = !isSelected && selected.length >= maxSelections;
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1, background: isSelected ? 'rgba(255,255,255,0.15)' : (isExisting && !isSelected ? 'rgba(100,200,255,0.1)' : 'transparent'), border: isSelected ? '1px solid var(--color-link)' : (isExisting ? '1px dashed var(--color-link)' : '1px solid transparent') }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggle(type)}
                                        disabled={isDisabled}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{type}</strong>
                                    {isExisting && !isSelected && <span style={{ marginLeft: '8px', opacity: 0.7, fontSize: '0.85em' }}>(current)</span>}
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm} disabled={selected.length === 0}>
                        <i className={`fa-solid ${icon || 'fa-shield-halved'}`}></i> {existingTypes && existingTypes.length > 0 ? 'Change Resistances' : 'Choose Resistances'}
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default MultiResistanceSelectionModal;
