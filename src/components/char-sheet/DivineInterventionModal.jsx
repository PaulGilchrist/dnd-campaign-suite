import { useState } from 'react';

function DivineInterventionModal({ eligibleSpells, isGreater, featureName, onSelect, onClose }) {
    const [selectedSpell, setSelectedSpell] = useState(null);
    const [filterLevel, setFilterLevel] = useState(null);

    const levelGroups = {};
    eligibleSpells.forEach(spell => {
        const lvl = spell.level || 0;
        if (!levelGroups[lvl]) levelGroups[lvl] = [];
        levelGroups[lvl].push(spell);
    });

    const levels = Object.keys(levelGroups).map(Number).sort((a, b) => a - b);

    const filteredSpells = filterLevel != null
        ? (levelGroups[filterLevel] || [])
        : eligibleSpells;

    const handleSpellClick = (spell) => {
        setSelectedSpell(spell);
    };

    const handleCast = () => {
        if (!selectedSpell) return;
        onSelect(selectedSpell);
    };

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal divine-intervention-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-star-of-life"></i> {featureName}
                </div>
                <div className="sp-body">
                    {!isGreater && (
                        <p className="sp-note">
                            Choose any Cleric spell of level 5 or lower that doesn&apos;t require a Reaction to cast.
                        </p>
                    )}
                    {isGreater && (
                        <p className="sp-note">
                            You can choose any Cleric spell of level 5 or lower, or select <strong>Wish</strong>.
                        </p>
                    )}

                    {!selectedSpell && (
                        <>
                            <div className="divine-intervention-filters" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                <button
                                    className={`sp-filter-btn ${filterLevel == null ? 'active' : ''}`}
                                    onClick={() => setFilterLevel(null)}
                                    type="button"
                                >
                                    All Levels
                                </button>
                                {levels.map(lvl => (
                                    <button
                                        key={lvl}
                                        className={`sp-filter-btn ${filterLevel === lvl ? 'active' : ''}`}
                                        onClick={() => setFilterLevel(lvl)}
                                        type="button"
                                    >
                                        {lvl === 0 ? 'Cantrip' : `Level ${lvl}`}
                                    </button>
                                ))}
                            </div>

                            <div className="divine-intervention-spell-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {filteredSpells.map(spell => (
                                    <div
                                        key={spell.index}
                                        className="divine-intervention-spell-item clickable"
                                        onClick={() => handleSpellClick(spell)}
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid #333',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <div style={{ fontWeight: 'bold' }}>{spell.name}</div>
                                        <div style={{ fontSize: '0.85em', color: '#aaa' }}>
                                            {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} — {spell.casting_time}
                                            {spell.concentration ? ' — Concentration' : ''}
                                            {spell.ritual ? ' — Ritual' : ''}
                                        </div>
                                    </div>
                                ))}
                                {filteredSpells.length === 0 && (
                                    <p className="sp-note">No spells found for this level.</p>
                                )}
                            </div>
                        </>
                    )}

                    {selectedSpell && (
                        <div className="divine-intervention-selected-spell">
                            <h3 style={{ margin: '0 0 8px 0' }}>{selectedSpell.name}</h3>
                            <div style={{ fontSize: '0.9em', color: '#ccc', marginBottom: '8px' }}>
                                Level {selectedSpell.level || 'Cantrip'} — {selectedSpell.school}
                                {selectedSpell.concentration ? ' — Concentration' : ''}
                                {selectedSpell.ritual ? ' — Ritual' : ''}
                            </div>
                            <div style={{ fontSize: '0.85em', color: '#aaa', marginBottom: '12px' }}>
                                Casting Time: {selectedSpell.casting_time} — Range: {selectedSpell.range}
                                {selectedSpell.components && ` — Components: ${selectedSpell.components}`}
                                {selectedSpell.duration && ` — Duration: ${selectedSpell.duration}`}
                            </div>
                            <div style={{ fontSize: '0.85em', color: '#bbb', marginBottom: '12px', maxHeight: '120px', overflowY: 'auto' }}>
                                {(selectedSpell.description || []).map((desc, i) => (
                                    <p key={i} style={{ margin: '4px 0' }}>{desc}</p>
                                ))}
                            </div>
                            {selectedSpell.damage && (
                                <div style={{ fontSize: '0.85em', color: '#e8b84b', marginBottom: '8px' }}>
                                    Damage: {Object.values(selectedSpell.damage?.damage_at_slot_level || selectedSpell.damage?.damage_at_character_level || {}).join(' / ')}
                                    {selectedSpell.damage.damage_type ? ` (${selectedSpell.damage.damage_type})` : ''}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="sp-actions">
                    {selectedSpell ? (
                        <>
                            <button className="sp-roll-btn" onClick={handleCast} type="button">
                                <i className="fa-solid fa-wand-sparkles"></i> Cast with Divine Intervention
                            </button>
                            <button className="sp-dismiss-btn" onClick={() => setSelectedSpell(null)} type="button" style={{ marginLeft: '8px' }}>
                                Back
                            </button>
                        </>
                    ) : (
                        <button className="sp-dismiss-btn" onClick={onClose} type="button">Cancel</button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DivineInterventionModal;
