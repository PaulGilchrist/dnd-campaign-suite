 
import React from 'react'
import './CharSpellSlots.css'
import rules from '../../../services/rules/rules.js'
import CharSpellSlotLevel from './CharSpellSlotLevel.jsx'

const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function CharSpellSlots({ playerStats, campaignName }) {
    const spellMaxLevel = rules.getSpellMaxLevel(playerStats.spellAbilities);
    return (
        <React.Fragment>
            { playerStats.spellAbilities && <div className='char-spell-slots levels'>
                <div className='header'><b>Spell Slots</b></div>
                {SLOT_LEVELS.map(level => spellMaxLevel >= level && (
                    <CharSpellSlotLevel key={level} level={level} totalSlots={playerStats.spellAbilities[`spell_slots_level_${level}`]} playerStats={playerStats} campaignName={campaignName}></CharSpellSlotLevel>
                ))}
            </div>}
        </React.Fragment>
    )
}

export default CharSpellSlots
