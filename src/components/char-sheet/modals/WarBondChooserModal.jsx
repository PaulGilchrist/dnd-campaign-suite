import { useState } from 'react';
import './WarBondChooserModal.css';

function WarBondChooserModal({ title, icon, options, maxChoices, existing, confirmLabel, onConfirm, onClose }) {
    const [selected, setSelected] = useState(maxChoices > 1 && Array.isArray(existing) ? [...existing] : []);
    const [result, setResult] = useState(null);

    const toggle = (name) => {
        setSelected(prev => {
            if (prev.includes(name)) return prev.filter(w => w !== name);
            if (maxChoices <= 1) return [name];
            if (prev.length >= maxChoices) return prev;
            return [...prev, name];
        });
    };

    const handleConfirm = async () => {
        if (selected.length === 0) return;
        const res = await onConfirm(selected);
        if (res) setResult(res);
    };

    if (result) {
        return (
            <div className="sp-overlay" onClick={(e) => {
                if (e.target.closest('.sp-modal')) return;
                onClose?.();
            }}>
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className={`fa-solid ${icon || 'fa-link'}`}></i> {title}
                    </div>
                    <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.payload?.description || '' }}></div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    const capReached = selected.length >= maxChoices;

    return (
        <div className="sp-overlay" onClick={(e) => {
            if (e.target.closest('.sp-modal')) return;
            onClose?.();
        }}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className={`fa-solid ${icon || 'fa-link'}`}></i> {title}
                </div>
                <div className="sp-body">
                    <p>{maxChoices > 1 ? <>Choose up to <b>{maxChoices}</b> weapons:</> : <>Choose one weapon:</>}</p>
                    <div className="war-bond-chooser-list">
                        {(options || []).map((name) => {
                            const isSelected = selected.includes(name);
                            const isDisabled = capReached && !isSelected;
                            return (
                                <label key={name} className={'war-bond-chooser-option' + (isSelected ? ' selected' : '') + (isDisabled ? ' capped' : '')}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        disabled={isDisabled}
                                        onChange={() => toggle(name)}
                                    />
                                    <strong>{name}</strong>
                                </label>
                            );
                        })}
                    </div>
                    <p className="war-bond-chooser-count">Selected: {selected.length}/{maxChoices}</p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm} disabled={selected.length === 0}>
                        <i className="fa-solid fa-check"></i> {confirmLabel}
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Skip</button>
                </div>
            </div>
        </div>
    );
}

export default WarBondChooserModal;
