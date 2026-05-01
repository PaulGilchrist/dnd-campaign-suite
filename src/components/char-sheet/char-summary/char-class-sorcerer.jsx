/* eslint-disable react/prop-types */
import React from 'react'
import storage from '../../../services/storage'
import HiddenInput from '../../common/hidden-input'

function CharClassSorcerer({ playerStats }) {
    const [sorceryPoints, setSorceryPoints] = React.useState(0);
    const [showInput, setShowInput] = React.useState(false);
    const classLevel = playerStats.class?.class_levels?.[playerStats.level-1];
    
    // 2024 uses top-level sorcery_points, 5e uses class_specific.sorcery_points
    const maxSorceryPoints = playerStats.rules === '2024'
         ? classLevel?.sorcery_points || 0
         : classLevel?.class_specific?.sorcery_points || 0;
    
    React.useEffect(() => {
        let storedSorceryPoints = storage.getProperty(playerStats.name, 'sorceryPoints');
        setSorceryPoints(storedSorceryPoints ? storedSorceryPoints : maxSorceryPoints);
     }, [playerStats, maxSorceryPoints]);
    const handleSorceryPointsToggle = () => {
        setShowInput((showInput) => !showInput);
    };
    const handleSorceryPointsChange = (sorceryPoints) => {
        storage.setProperty(playerStats.name, 'sorceryPoints', sorceryPoints);
        setSorceryPoints(sorceryPoints);
     };
    
        // For 2024, metamagic_known is derived from level (2 at level 3, +2 at level 10, +2 at level 17)
     // For 5e, it's from class_specific.metamagic_known
    let metamagicKnown = 0;
    if (playerStats.rules === '2024') {
        if (playerStats.level >= 3) metamagicKnown = 2;
        if (playerStats.level >= 10) metamagicKnown = 4;
        if (playerStats.level >= 17) metamagicKnown = 6;
      } else {
        metamagicKnown = classLevel?.class_specific?.metamagic_known || 0;
      }
     
      // Spell slot costs - only available in 5e format
    const creatingSpellSlotCosts = [];
    if (playerStats.rules !== '2024' && classLevel?.class_specific?.creating_spell_slots) {
        classLevel.class_specific.creating_spell_slots.forEach((creatingSpellSlot) => {
            creatingSpellSlotCosts.push(creatingSpellSlot.sorcery_point_cost)
          });
      }

    // creating_spell_slots
    return (<React.Fragment>
         {playerStats.class.name === 'Sorcerer' && <div>
             <div className="clickable" onClick={handleSorceryPointsToggle} onKeyDown={handleSorceryPointsToggle} tabIndex={0}>
                 <b>Sorcery Points:</b> {maxSorceryPoints}/<HiddenInput handleInputToggle={handleSorceryPointsToggle} handleValueChange={(value) => handleSorceryPointsChange(value)} showInput={showInput} value={sorceryPoints}></HiddenInput> <span className="text-muted">(max/cur)</span>
             </div>
             <div><b>Metamagic Known: </b>{metamagicKnown}</div>
             {playerStats.rules !== '2024' && <div><b>Spell Slot (level 1-5) Costs: </b>{creatingSpellSlotCosts.join(', ')}</div>}
         </div>}
     </React.Fragment>)
}

export default CharClassSorcerer
