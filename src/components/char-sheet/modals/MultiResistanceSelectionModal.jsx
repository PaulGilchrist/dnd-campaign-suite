import { useState } from 'react';
import '../CharSheet.css';
import './MultiResistanceSelectionModal.css';

function AppliedResultModal({ title, icon, result, onClose }) {
    return (
        <div className="sp-overlay">
            <div className="sp-modal">
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
        return <AppliedResultModal title={title} icon={icon} result={result} onClose={onClose} />;
    }

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
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
                    <div className="multi-resistance-types">
                        {damageTypes.map((type, i) => {
                            const isSelected = selected.includes(type);
                            const isExisting = existingTypes && existingTypes.includes(type);
                            const isDisabled = !isSelected && selected.length >= maxSelections;
                            // fix#327-twin-shape mirror (own CSS file, same static token
                            // values as SingleResistanceSelectionModal.css — no cross-import
                            // to avoid coupling sibling components). Selection/existing/cap
                            // are enumerable states, so they ride modifier classes per fix#328
                            // (.selected) and WarBondChooserModal (.capped) precedents;
                            // .existing is emitted only when !isSelected, preserving the
                            // original inline precedence where selected won both ternaries.
                            return (
                                <label key={i} className={'multi-resistance-option' + (isSelected ? ' selected' : '') + (isExisting && !isSelected ? ' existing' : '') + (isDisabled ? ' capped' : '')}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggle(type)}
                                        disabled={isDisabled}
                                        className="multi-resistance-option-input"
                                    />
                                    <strong>{type}</strong>
                                    {isExisting && !isSelected && <span className="multi-resistance-current">(current)</span>}
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
