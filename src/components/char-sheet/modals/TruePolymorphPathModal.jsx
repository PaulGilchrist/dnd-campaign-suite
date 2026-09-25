import React from 'react';
import './TruePolymorphPathModal.css';

function TruePolymorphPathModal({ onConfirm, onCancel }) {
    React.useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onCancel() };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onCancel]);

    return (
        <div className="sp-overlay sp-overlay--evasion">
            <div className="sp-modal">
                <div className="sp-header"><i className="fa-solid fa-paw"></i> True Polymorph</div>
                <div className="sp-body">
                    <p>Choose the type of transformation:</p>
                    <div className="tp-path-grid">
                        <button
                            className="tp-path-btn"
                            onClick={() => onConfirm('creature_to_creature')}
                        >
                            <div className="tp-path-icon"><i className="fa-solid fa-users"></i></div>
                            <div className="tp-path-label">Creature into Creature</div>
                            <div className="tp-path-desc">Transform a creature into another creature of your choice. The new form can be any kind whose challenge rating is equal to or less than the target's.</div>
                        </button>
                        <button
                            className="tp-path-btn"
                            onClick={() => onConfirm('object_into_creature')}
                        >
                            <div className="tp-path-icon"><i className="fa-solid fa-cube"></i></div>
                            <div className="tp-path-label">Object into Creature</div>
                            <div className="tp-path-desc">Transform a nonmagical object into a creature. The creature's size must be no larger than the object's size and its challenge rating must be 9 or lower.</div>
                        </button>
                        <button
                            className="tp-path-btn"
                            onClick={() => onConfirm('creature_to_object')}
                        >
                            <div className="tp-path-icon"><i className="fa-solid fa-gem"></i></div>
                            <div className="tp-path-label">Creature into Object</div>
                            <div className="tp-path-desc">Transform a creature into a nonmagical object. The object's size must be no larger than the creature's size. The target gains the incapacitated condition.</div>
                        </button>
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={onCancel}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default TruePolymorphPathModal;
