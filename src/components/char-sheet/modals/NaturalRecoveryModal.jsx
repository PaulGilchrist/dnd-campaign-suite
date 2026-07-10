import React from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../../services/ui/logService.js'
import './NaturalRecoveryModal.css'

// Arid land spells for Circle of the Land (level 1+ only, cantrips excluded)
// TODO: replace with dynamic land-type selection when "Circle of the Land Spells" becomes clickable
const CIRCLE_OF_LAND_ARID_SPELLS = new Set([
    'Blur', 'Burning Hands', 'Fire Bolt', 'Fireball', 'Blight', 'Wall of Stone',
]);

function NaturalRecoveryModal({ playerStats, campaignName, onClose }) {
    const name = playerStats.name
    const naturalRecoveryFreeCast = getRuntimeValue(name, 'naturalRecoveryFreeCast')
    const naturalRecoveryFreeCastUsed = getRuntimeValue(name, 'naturalRecoveryFreeCastUsed')

    const isCircleOfLand = playerStats.class?.major?.name === 'Circle of the Land';

    const eligibleSpells = React.useMemo(() => {
        return (playerStats.spellAbilities?.spells || []).filter(
            s => s.level >= 1 && s.prepared === 'Always'
        ).filter(s => !isCircleOfLand || CIRCLE_OF_LAND_ARID_SPELLS.has(s.name));
    }, [playerStats.spellAbilities?.spells, isCircleOfLand]);

    const handleSelectSpell = (spellName) => {
        setRuntimeValue(name, 'naturalRecoveryFreeCast', [spellName], campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: name,
            abilityName: 'Natural Recovery',
            description: `Granted free cast: ${spellName}`,
        }).catch(() => {});
        onClose();
    };

    const alreadyGranted = Array.isArray(naturalRecoveryFreeCast) && naturalRecoveryFreeCast.length > 0;
    const alreadyUsed = naturalRecoveryFreeCastUsed === true;

    React.useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className="nr-overlay no-print" onClick={onClose}>
            <div className="nr-modal" onClick={(e) => e.stopPropagation()}>
                <h3><i className="fa-solid fa-leaf"></i> Natural Recovery</h3>
                <p className="nr-subtitle">Free Cast &mdash; 1/Long Rest</p>

                {alreadyGranted && (
                    <div className="nr-section">
                        <p>Free cast granted to: <b>{naturalRecoveryFreeCast[0]}</b></p>
                        <p className="nr-hint">Cast this spell without expending a spell slot.</p>
                    </div>
                )}

                {alreadyUsed && (
                    <div className="nr-section">
                        <p className="nr-blocked">Free cast already used this long rest.</p>
                    </div>
                )}

                {!alreadyGranted && !alreadyUsed && (
                    <div className="nr-section">
                        <p className="nr-hint">Choose one prepared spell to cast without expending a spell slot.</p>
                        {eligibleSpells.length === 0 ? (
                            <p className="nr-blocked">No eligible spells found.</p>
                        ) : (
                            <ul className="nr-spell-list">
                                {eligibleSpells.map(spell => (
                                    <li key={spell.name}>
                                        <button
                                            className="nr-spell-btn"
                                            onClick={() => handleSelectSpell(spell.name)}
                                        >
                                            {spell.name} <span className="nr-spell-level">(level {spell.level})</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                <div className="nr-actions">
                    <button className="char-btn" onClick={onClose}>
                        {alreadyGranted || alreadyUsed ? 'Close' : 'Cancel (save for later)'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default NaturalRecoveryModal
