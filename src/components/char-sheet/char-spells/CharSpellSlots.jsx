 
import React from 'react'
import './CharSpellSlots.css'
import rules from '../../../services/rules/rules.js'
import CharSpellSlotLevel from './CharSpellSlotLevel.jsx'

function CharSpellSlots({ playerStats, campaignName }) {
    let spellMaxLevel = rules.getSpellMaxLevel(playerStats.spellAbilities);
    return (
        <React.Fragment>
            { playerStats.spellAbilities && <div className='char-spell-slots levels'>
                <div className='header'><b>Spell Slots</b></div>
                {spellMaxLevel && spellMaxLevel > 0 && <CharSpellSlotLevel level={1} totalSlots={playerStats.spellAbilities.spell_slots_level_1} playerStats={playerStats} campaignName={campaignName}></CharSpellSlotLevel>}
                {spellMaxLevel && spellMaxLevel > 1 && <CharSpellSlotLevel level={2} totalSlots={playerStats.spellAbilities.spell_slots_level_2} playerStats={playerStats} campaignName={campaignName}></CharSpellSlotLevel>}
                {spellMaxLevel && spellMaxLevel > 2 && <CharSpellSlotLevel level={3} totalSlots={playerStats.spellAbilities.spell_slots_level_3} playerStats={playerStats} campaignName={campaignName}></CharSpellSlotLevel>}
                {spellMaxLevel && spellMaxLevel > 3 && <CharSpellSlotLevel level={4} totalSlots={playerStats.spellAbilities.spell_slots_level_4} playerStats={playerStats} campaignName={campaignName}></CharSpellSlotLevel>}
                {spellMaxLevel && spellMaxLevel > 4 && <CharSpellSlotLevel level={5} totalSlots={playerStats.spellAbilities.spell_slots_level_5} playerStats={playerStats} campaignName={campaignName}></CharSpellSlotLevel>}
                {spellMaxLevel && spellMaxLevel > 5 && <CharSpellSlotLevel level={6} totalSlots={playerStats.spellAbilities.spell_slots_level_6} playerStats={playerStats} campaignName={campaignName}></CharSpellSlotLevel>}
                {spellMaxLevel && spellMaxLevel > 6 && <CharSpellSlotLevel level={7} totalSlots={playerStats.spellAbilities.spell_slots_level_7} playerStats={playerStats} campaignName={campaignName}></CharSpellSlotLevel>}
                {spellMaxLevel && spellMaxLevel > 7 && <CharSpellSlotLevel level={8} totalSlots={playerStats.spellAbilities.spell_slots_level_8} playerStats={playerStats} campaignName={campaignName}></CharSpellSlotLevel>}
                {spellMaxLevel && spellMaxLevel > 8 && <CharSpellSlotLevel level={9} totalSlots={playerStats.spellAbilities.spell_slots_level_9} playerStats={playerStats} campaignName={campaignName}></CharSpellSlotLevel>}
            </div>}
        </React.Fragment>
    )
}

export default CharSpellSlots
