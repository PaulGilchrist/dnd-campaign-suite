import { useState } from 'react';
import './DivineInterventionModal.css';
import { sanitizeHtml } from '../../../../services/ui/sanitize.js';

function SpellLevelFilters({ levels, filterLevel, onSelectLevel }) {
    return (
        <div className="divine-intervention-filters">
            <button
                className={`sp-filter-btn ${filterLevel == null ? 'active' : ''}`}
                onClick={() => onSelectLevel(null)}
                type="button"
            >
                All Levels
            </button>
            {levels.map(lvl => (
                <button
                    key={lvl}
                    className={`sp-filter-btn ${filterLevel === lvl ? 'active' : ''}`}
                    onClick={() => onSelectLevel(lvl)}
                    type="button"
                >
                    {lvl === 0 ? 'Cantrip' : `Level ${lvl}`}
                </button>
            ))}
        </div>
    );
}

function SpellList({ spells, onSpellClick }) {
    return (
        <div className="divine-intervention-spell-list">
            {spells.map(spell => (
                <div
                    key={spell.index}
                    className="divine-intervention-spell-item clickable"
                    onClick={() => onSpellClick(spell)}
                >
                    <div className="spell-name">{spell.name}</div>
                    <div className="spell-meta">
                        {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} — {spell.casting_time}
                        {spell.concentration ? ' — Concentration' : ''}
                        {spell.ritual ? ' — Ritual' : ''}
                    </div>
                </div>
            ))}
            {spells.length === 0 && (
                <p className="sp-note">No spells found for this level.</p>
            )}
        </div>
    );
}

function SelectedSpellDetails({ spell }) {
    return (
        <div className="divine-intervention-selected-spell">
            <h3>{spell.name}</h3>
            <div className="spell-level-meta">
                Level {spell.level || 'Cantrip'} — {spell.school}
                {spell.concentration ? ' — Concentration' : ''}
                {spell.ritual ? ' — Ritual' : ''}
            </div>
            <div className="spell-details">
                Casting Time: {spell.casting_time} — Range: {spell.range}
                {spell.components && ` — Components: ${spell.components}`}
                {spell.duration && ` — Duration: ${spell.duration}`}
            </div>
            <div className="spell-description">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(Array.isArray(spell.description) ? spell.description.join('') : spell.description || '') }} />
            </div>
            {spell.damage && (
                <div className="spell-damage">
                    Damage: {Object.values(spell.damage?.damage_at_slot_level || spell.damage?.damage_at_character_level || {}).join(' / ')}
                    {spell.damage.damage_type ? ` (${spell.damage.damage_type})` : ''}
                </div>
            )}
        </div>
    );
}

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
        <div className="sp-overlay" onClick={(e) => {
        if (e.target.closest('.sp-modal')) return;
        onClose?.();
    }}>
            <div className="sp-modal">
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
                            <SpellLevelFilters levels={levels} filterLevel={filterLevel} onSelectLevel={setFilterLevel} />
                            <SpellList spells={filteredSpells} onSpellClick={handleSpellClick} />
                        </>
                    )}

                    {selectedSpell && <SelectedSpellDetails spell={selectedSpell} />}
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
