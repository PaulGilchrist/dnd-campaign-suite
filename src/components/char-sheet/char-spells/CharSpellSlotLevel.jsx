  
import './CharSpellSlotLevel.css'
import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

function slotStateClass(totalSlots, availableSlots, position) {
    if (totalSlots > position && availableSlots >= totalSlots - position) return 'inactive';
    if (availableSlots < totalSlots - position) return 'active';
    return '';
}

function CharSpellSlotLevel({ level, totalSlots, playerStats, campaignName }) {
    const computedCurrent = playerStats?._trackedResources?.[`spell_slots_level_${level}`]?.current ?? totalSlots;
    const storedValue = useRuntimeValue(playerStats.name, `spell_slots_level_${level}`, campaignName);
    const availableSlots = storedValue != null ? storedValue : computedCurrent;

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
                    <div className={`slot ${slotStateClass(totalSlots, availableSlots, 0)}`}></div>
                    <div className={`slot ${slotStateClass(totalSlots, availableSlots, 1)}`}></div>
                </div>
                <div className='row'>
                    <div className={`slot ${slotStateClass(totalSlots, availableSlots, 2)}`}></div>
                    <div className={`slot ${slotStateClass(totalSlots, availableSlots, 3)}`}></div>
                </div>
            </div>
        </div>
    )
}

export default CharSpellSlotLevel
