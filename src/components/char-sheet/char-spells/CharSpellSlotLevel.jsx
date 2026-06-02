  
import React from 'react'

import './CharSpellSlotLevel.css'
import { setRuntimeValue, useRuntimeValue } from '../../../hooks/useRuntimeState.js'

function CharSpellSlotLevel({ level, totalSlots, playerStats, campaignName }) {
    const storedValue = useRuntimeValue(playerStats.name, `spell_slots_level_${level}`, campaignName);
    const availableSlots = storedValue != null ? storedValue : totalSlots;

    const handleClick = (event) => {
        if (event.key !== "Tab") {
            if(availableSlots > 0) {
                const newAvailableSlots = availableSlots-1;
                setRuntimeValue(playerStats.name, `spell_slots_level_${level}`, newAvailableSlots, campaignName);
            } else {
                setRuntimeValue(playerStats.name, `spell_slots_level_${level}`, totalSlots, campaignName);
            }
        }
    }

    return (
        <div className='char-spell-slot-level level clickable' onClick={handleClick} onKeyDown={handleClick} tabIndex="0">
            <div className='header'>{level}</div>
            <div className='slots'>
                <div className='row'>
                    <div className={`slot ${availableSlots > 0 ? 'active' : totalSlots > 0 ? 'inactive' : ''}`}></div>
                    <div className={`slot ${availableSlots > 1 ? 'active' : totalSlots > 1 ? 'inactive' : ''}`}></div>
                </div>
                <div className='row'>
                    <div className={`slot ${availableSlots > 2 ? 'active' : totalSlots > 2 ? 'inactive' : ''}`}></div>
                    <div className={`slot ${availableSlots > 3 ? 'active' : totalSlots > 3 ? 'inactive' : ''}`}></div>
                </div>
            </div>
        </div>
    )
}

export default CharSpellSlotLevel
