import { useState } from 'react';
import './DivineInterventionModal.css';
import { sanitizeHtml } from '../../../../services/ui/sanitize.js';

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
                            <div className="divine-intervention-filters">
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

                            <div className="divine-intervention-spell-list">
                                {filteredSpells.map(spell => (
                                    <div
                                        key={spell.index}
                                        className="divine-intervention-spell-item clickable"
                                        onClick={() => handleSpellClick(spell)}
                                    >
                                        <div className="spell-name">{spell.name}</div>
                                        <div className="spell-meta">
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
                            <h3>{selectedSpell.name}</h3>
                            <div className="spell-level-meta">
                                Level {selectedSpell.level || 'Cantrip'} — {selectedSpell.school}
                                {selectedSpell.concentration ? ' — Concentration' : ''}
                                {selectedSpell.ritual ? ' — Ritual' : ''}
                            </div>
                            <div className="spell-details">
                                Casting Time: {selectedSpell.casting_time} — Range: {selectedSpell.range}
                                {selectedSpell.components && ` — Components: ${selectedSpell.components}`}
                                {selectedSpell.duration && ` — Duration: ${selectedSpell.duration}`}
                            </div>
                            <div className="spell-description">
                                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(Array.isArray(selectedSpell.description) ? selectedSpell.description.join('') : selectedSpell.description || '') }} />
                            </div>
                            {selectedSpell.damage && (
                                <div className="spell-damage">
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
                            <button className="sp-dismiss-btn" onClick={() => setSelectedSpell(null)} type="button" className="back-btn">
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
