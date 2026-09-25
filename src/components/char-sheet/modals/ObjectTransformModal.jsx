import React from 'react';
import './ObjectTransformModal.css';

const OBJECT_TYPES = [
    { value: 'stone_block', label: 'Stone Block', icon: 'fa-cube' },
    { value: 'iron_chain', label: 'Iron Chain', icon: 'fa-link' },
    { value: 'wooden_crate', label: 'Wooden Crate', icon: 'fa-box' },
    { value: 'iron_bars', label: 'Iron Bars', icon: 'fa-grip-lines' },
    { value: 'glass_vial', label: 'Glass Vial', icon: 'fa-flask' },
    { value: 'leather_book', label: 'Leather Book', icon: 'fa-book' },
    { value: 'bronze_statue', label: 'Bronze Statue', icon: 'fa-statue' },
    { value: 'other', label: 'Other Object', icon: 'fa-circle' },
];

function ObjectTransformModal({ onConfirm, onCancel }) {
    const [selectedType, setSelectedType] = React.useState('stone_block');
    const [customType, setCustomType] = React.useState('');

    React.useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onCancel() };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onCancel]);

    const handleConfirm = () => {
        const objectType = selectedType === 'other' ? (customType.trim() || 'Stone Block') : selectedType;
        onConfirm(objectType);
    };

    return (
        <div className="sp-overlay sp-overlay--evasion">
            <div className="sp-modal">
                <div className="sp-header"><i className="fa-solid fa-paw"></i> Creature into Object</div>
                <div className="sp-body">
                    <p>Select the object form for the transformation:</p>
                    <div className="object-type-grid">
                        {OBJECT_TYPES.map((obj) => (
                            <button
                                key={obj.value}
                                className={`object-type-btn ${selectedType === obj.value ? 'selected' : ''}`}
                                onClick={() => setSelectedType(obj.value)}
                            >
                                <i className={`fa-solid ${obj.icon}`}></i>
                                <span>{obj.label}</span>
                            </button>
                        ))}
                    </div>
                    {selectedType === 'other' && (
                        <div className="custom-object-input">
                            <input
                                type="text"
                                placeholder="Enter object description..."
                                value={customType}
                                onChange={(e) => setCustomType(e.target.value)}
                            />
                        </div>
                    )}
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={onCancel}>Cancel</button>
                    <button className="sp-roll-btn" onClick={handleConfirm}>
                        <i className="fa-solid fa-paw"></i> Transform
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ObjectTransformModal;
