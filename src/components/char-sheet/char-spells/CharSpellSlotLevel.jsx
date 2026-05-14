 
import React from 'react'

import './CharSpellSlotLevel.css'
import storage from '../../../services/storage.js'

function CharSpellSlotLevel({ level, totalSlots, playerStats }) {
    const [availableSlots, setAvailableSlots] = React.useState(totalSlots);

    React.useEffect(() => {
        let value = storage.getProperty(playerStats.name, `spell_slots_level_${level}`);
        setAvailableSlots(value != null ? value : totalSlots);
    }, [level, totalSlots, playerStats]);

    const handleClick = (event) => {
        if (event.key !== "Tab") {
            if(availableSlots > 0) {
                const newAvailableSlots = availableSlots-1;
                storage.setProperty(playerStats.name, `spell_slots_level_${level}`, newAvailableSlots);
                setAvailableSlots(newAvailableSlots);
            } else {
                // Reset
                storage.setProperty(playerStats.name, `spell_slots_level_${level}`, totalSlots);
                setAvailableSlots(totalSlots);
            }
        }
    }

    return (
        <div className='level clickable' onClick={handleClick} onKeyDown={handleClick} tabIndex="0">
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
