import { useState } from 'react';
import './SummonSpiritModal.css';

export default function SummonSpiritModal({ action, onConfirm, onClose }) {
    const [selectedName, setSelectedName] = useState(null);

    const variants = action?.automation?.variants || [];

    const handleConfirm = () => {
        if (selectedName) {
            onConfirm(selectedName);
        }
    };

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-hand-sparkles"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Choose the form your summoned creature takes:</p>
                    <div className="summon-spirit-options">
                        {variants.map(variant => (
                            <button
                                key={variant.name}
                                className={`summon-spirit-option ${selectedName === variant.name ? 'summon-spirit-option-selected' : ''}`}
                                onClick={() => setSelectedName(variant.name)}
                                type="button"
                            >
                                <strong>{variant.name}</strong>
                                {variant.description && (
                                    <span className="summon-spirit-option-desc">
                                        {variant.description}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={!selectedName}
                        type="button"
                    >
                        <i className="fa-solid fa-hand-sparkles"></i> Summon
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
