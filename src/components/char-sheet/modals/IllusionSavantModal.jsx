import { useState } from 'react';

function IllusionSavantModal({ payload, onConfirm, onClose }) {
    const { illusionOptions, selectedSpells } = payload;
    const [selected1, setSelected1] = useState(selectedSpells?.[0] || '');
    const [selected2, setSelected2] = useState(selectedSpells?.[1] || '');

    const handleConfirm = () => {
        onConfirm(selected1, selected2);
    };

    return (
        <div className="popup-overlay" data-testid="illusion-savant-modal" role="presentation" onClick={onClose}>
            <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '16px' }}>
                    <h3 style={{ marginTop: 0 }}>Illusion Savant</h3>
                    <p>Choose two Wizard spells from the Illusion school (no higher than level 2), add to spellbook for free. These are always prepared and can be cast once without expending a spell slot. Recharges on a Short or Long Rest.</p>
                    {selectedSpells?.length > 0 && <p style={{ opacity: 0.7 }}>Current: <b>{selectedSpells[0]}</b> and <b>{selectedSpells[1]}</b></p>}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Illusion spell 1:</label>
                        <select
                            className="char-btn"
                            value={selected1}
                            onChange={e => setSelected1(e.target.value)}
                            style={{ width: '100%' }}
                        >
                            <option value="">-- Select an Illusion spell (level 2 or lower) --</option>
                            {illusionOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Illusion spell 2:</label>
                        <select
                            className="char-btn"
                            value={selected2}
                            onChange={e => setSelected2(e.target.value)}
                            style={{ width: '100%' }}
                        >
                            <option value="">-- Select an Illusion spell (level 2 or lower) --</option>
                            {illusionOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        className="char-btn"
                        onClick={handleConfirm}
                        disabled={!selected1 || !selected2 || selected1 === selected2}
                        style={{ width: '100%' }}
                    >
                        Confirm Selection
                    </button>
                </div>
            </div>
        </div>
    );
}

export default IllusionSavantModal;
