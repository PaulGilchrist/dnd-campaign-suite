/* eslint-disable react/prop-types */
import React from 'react'
import storage from '../../../services/storage'
import HiddenInput from '../../common/hidden-input'

function CharClassFighter({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const [secondWindUses, setSecondWindUses] = React.useState(0);
    const [showSecondWindInput, setShowSecondWindInput] = React.useState(false);
    const [psionicEnergy, setPsionicEnergy] = React.useState(0);
    const [showPsionicEnergyInput, setShowPsionicEnergyInput] = React.useState(false);

    React.useEffect(() => {
        if (!classLevel) return;

        let secondWindUses = storage.getProperty(playerStats.name, 'secondWindUses');
        setSecondWindUses(secondWindUses ? secondWindUses : classLevel.second_wind);

        const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name;
        if (classLevel.energy && classLevel.energy.required_major === majorName) {
            let psionicEnergy = storage.getProperty(playerStats.name, 'psionicEnergy');
            setPsionicEnergy(psionicEnergy ? psionicEnergy : classLevel.energy.energy_die_num);
        }
    }, [playerStats, classLevel]);

    const handleSecondWindToggle = () => {
        setShowSecondWindInput((showInput) => !showInput);
    };
    const handleSecondWindChange = (value) => {
        storage.setProperty(playerStats.name, 'secondWindUses', value);
        setSecondWindUses(value);
    };

    const handlePsionicEnergyToggle = () => {
        setShowPsionicEnergyInput((showInput) => !showInput);
    };
    const handlePsionicEnergyChange = (value) => {
        storage.setProperty(playerStats.name, 'psionicEnergy', value);
        setPsionicEnergy(value);
    };

    if (!classLevel) {
        return null;
    }

    const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name;
    const hasEnergy = classLevel.energy && classLevel.energy.required_major === majorName;

    return (<React.Fragment>
             {playerStats.class.name === 'Fighter' && <div>
                 <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles?.join(', ') || 'N/A'}</div>
                 <div><b>Extra Attacks: </b>{classLevel.extra_attacks || 0}</div>
                 <div><b>Weapon Mastery: </b>{classLevel.weapon_mastery}</div>
                 <div className="clickable" onClick={handleSecondWindToggle} onKeyDown={handleSecondWindToggle} tabIndex={0}>
                     <b>Second Wind:</b> {secondWindUses}/{classLevel.second_wind}<HiddenInput handleInputToggle={handleSecondWindToggle} handleValueChange={(value) => handleSecondWindChange(value)} showInput={showSecondWindInput} value={secondWindUses} displayValue={false}></HiddenInput> <span className="text-muted">(cur/max)</span>
                 </div>
                 {hasEnergy && <div>
                     <div><b>Psionic Energy (Psi Warrior):</b></div>
                     <div className="clickable" onClick={handlePsionicEnergyToggle} onKeyDown={handlePsionicEnergyToggle} tabIndex={0}>
                         <b>Energy Dice:</b> {psionicEnergy}/{classLevel.energy.energy_die_num}<HiddenInput handleInputToggle={handlePsionicEnergyToggle} handleValueChange={(value) => handlePsionicEnergyChange(value)} showInput={showPsionicEnergyInput} value={psionicEnergy} displayValue={false}></HiddenInput> <span className="text-muted">(cur/max)</span>
                     </div>
                     <div><b>Energy Die Type: </b>d{classLevel.energy.energy_die_type}</div>
                 </div>}
             </div>}
         </React.Fragment>)
}

export default CharClassFighter
