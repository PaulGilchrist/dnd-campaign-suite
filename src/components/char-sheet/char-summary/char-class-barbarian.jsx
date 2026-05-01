/* eslint-disable react/prop-types */
import React from 'react'
import storage from '../../../services/storage'
import HiddenInput from '../../common/hidden-input'

function CharClassBarbarian({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level-1];
    const [ragePoints, setRagePoints] = React.useState(0);
    const [showInput, setShowInput] = React.useState(false);
    React.useEffect(() => {
        let ragePoints = storage.getProperty(playerStats.name, 'ragePoints');
        setRagePoints(ragePoints ? ragePoints : classLevel.rages);
    }, [playerStats, classLevel]);
    const handleRagePointsToggle = () => {
        setShowInput((showInput) => !showInput);
    };
    const handleRagePointsChange = (ragePoints) => {
        storage.setProperty(playerStats.name, 'ragePoints', ragePoints);
        setRagePoints(ragePoints);
     };
    return (<React.Fragment>
             {playerStats.class.name === 'Barbarian' && <div>
                 <div><b>Extra Attacks: </b>{classLevel.extra_attacks || 0}</div>
                 <div className="clickable" onClick={handleRagePointsToggle} onKeyDown={handleRagePointsToggle} tabIndex={0}>
                     <b>Rage Points:</b> {classLevel.rages}/<HiddenInput handleInputToggle={handleRagePointsToggle} handleValueChange={(value) => handleRagePointsChange(value)} showInput={showInput} value={ragePoints}></HiddenInput> <span className="text-muted">(max/cur)</span>
                 </div>
                 <div><b>Rage Damage Bonus: </b>{classLevel.rage_damage}</div>
                 <div><b>Weapon Mastery: </b>{classLevel?.weapon_mastery ?? 'N/A'}</div>
             </div>}
         </React.Fragment>)
}

export default CharClassBarbarian
