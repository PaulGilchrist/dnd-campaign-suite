import { useState } from 'react';

function SavantModal({ payload, onConfirm, onClose }) {
    const { school, spellOptions, selectedSpells } = payload;
    const [selected1, setSelected1] = useState(selectedSpells?.[0] || '');
    const [selected2, setSelected2] = useState(selectedSpells?.[1] || '');

    const handleConfirm = () => {
        onConfirm(selected1, selected2);
    };

    return (
        <div className="popup-overlay" data-testid={`${school.toLowerCase()}-savant-modal`} role="presentation" onClick={onClose}>
            <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '16px' }}>
                    <h3 style={{ marginTop: 0 }}>{school} Savant</h3>
                    <p>Choose two Wizard spells from the {school} school (no higher than level 2), add to spellbook for free. These are always prepared.</p>
                    {selectedSpells?.length > 0 && (
                        <p style={{ opacity: 0.7 }}>
                            Current: {selectedSpells.map((s, i) => (
                                <span key={s}>{i > 0 && <span> and </span>}<b>{s}</b></span>
                            ))}
                        </p>
                    )}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>{school} spell 1:</label>
                        <select
                            className="char-btn"
                            value={selected1}
                            onChange={e => setSelected1(e.target.value)}
                            style={{ width: '100%' }}
                        >
                            <option value="">-- Select a {school} spell (level 2 or lower) --</option>
                            {spellOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>{school} spell 2:</label>
                        <select
                            className="char-btn"
                            value={selected2}
                            onChange={e => setSelected2(e.target.value)}
                            style={{ width: '100%' }}
                        >
                            <option value="">-- Select a {school} spell (level 2 or lower) --</option>
                            {spellOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        className="char-btn"
                        onClick={handleConfirm}
                        disabled={!selected1 || !selected2 || selected1 === selected2}
                        style={{ width: '100%', marginBottom: '8px' }}
                    >
                        Confirm Selection
                    </button>
                    {selectedSpells?.length > 0 && (
                        <button
                            className="char-btn"
                            onClick={() => onConfirm(null, null)}
                            style={{ width: '100%', opacity: 0.7 }}
                        >
                            Clear Selection
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SavantModal;
