import { useState } from 'react';

function SpellMasteryModal({ payload, onConfirm, onClose }) {
    const { level1Options, level2Options, currentLevel1, currentLevel2 } = payload;
    const [selectedLevel1, setSelectedLevel1] = useState(currentLevel1 || '');
    const [selectedLevel2, setSelectedLevel2] = useState(currentLevel2 || '');

    const handleConfirm = () => {
        onConfirm(selectedLevel1, selectedLevel2);
    };

    return (
        <div className="popup-overlay" data-testid="spell-mastery-modal" role="presentation" onClick={onClose}>
            <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '16px' }}>
                    <h3 style={{ marginTop: 0 }}>Spell Mastery</h3>
                    <p>Choose a level 1 and a level 2 spell from your spellbook with casting time of an action. You can cast them at will at their lowest level without expending a spell slot.</p>
                    {currentLevel1 && <p style={{ opacity: 0.7 }}>Current: Level 1 - <b>{currentLevel1}</b>, Level 2 - <b>{currentLevel2}</b></p>}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Level 1 spell:</label>
                        <select
                            className="char-btn"
                            value={selectedLevel1}
                            onChange={e => setSelectedLevel1(e.target.value)}
                            style={{ width: '100%' }}
                        >
                            <option value="">-- Select a level 1 spell --</option>
                            {level1Options.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Level 2 spell:</label>
                        <select
                            className="char-btn"
                            value={selectedLevel2}
                            onChange={e => setSelectedLevel2(e.target.value)}
                            style={{ width: '100%' }}
                        >
                            <option value="">-- Select a level 2 spell --</option>
                            {level2Options.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        className="char-btn"
                        onClick={handleConfirm}
                        disabled={!selectedLevel1 || !selectedLevel2}
                        style={{ width: '100%' }}
                    >
                        Confirm Selection
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SpellMasteryModal;
