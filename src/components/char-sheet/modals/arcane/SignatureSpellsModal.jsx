import { useState } from 'react';

function SignatureSpellsModal({ payload, onConfirm, onClose }) {
    const { level3Options, selectedSpells } = payload;
    const [selected1, setSelected1] = useState(selectedSpells?.[0] || '');
    const [selected2, setSelected2] = useState(selectedSpells?.[1] || '');

    const handleConfirm = () => {
        onConfirm(selected1, selected2);
    };

    return (
        <div className="popup-overlay" data-testid="signature-spells-modal" role="presentation" onClick={onClose}>
            <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '16px' }}>
                    <h3 style={{ marginTop: 0 }}>Signature Spells</h3>
                    <p>Choose two level 3 spells in your spellbook as your signature spells. You always have these spells prepared, and you can cast each of them once at level 3 without expending a spell slot. Recharges on a Short or Long Rest.</p>
                    {selectedSpells?.length > 0 && <p style={{ opacity: 0.7 }}>Current: <b>{selectedSpells[0]}</b> and <b>{selectedSpells[1]}</b></p>}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Signature spell 1:</label>
                        <select
                            className="char-btn"
                            value={selected1}
                            onChange={e => setSelected1(e.target.value)}
                            style={{ width: '100%' }}
                        >
                            <option value="">-- Select a level 3 spell --</option>
                            {level3Options.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Signature spell 2:</label>
                        <select
                            className="char-btn"
                            value={selected2}
                            onChange={e => setSelected2(e.target.value)}
                            style={{ width: '100%' }}
                        >
                            <option value="">-- Select a level 3 spell --</option>
                            {level3Options.map(s => (
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

export default SignatureSpellsModal;
