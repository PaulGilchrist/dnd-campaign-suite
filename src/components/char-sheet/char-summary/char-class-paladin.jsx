/* eslint-disable react/prop-types */
import React from 'react'

function CharClassPaladin({ playerStats }) {
                const classLevel = playerStats.class?.class_levels?.[playerStats.level-1];
        const classSpecific = classLevel?.class_specific || {};
           // 2024 uses top-level channel_divinity, 5e uses class_specific.channel_divinity_charges
        const channelDivinity = playerStats.rules === '2024'
               ? classLevel?.channel_divinity || 0
               : classSpecific.channel_divinity_charges || 0;
        let extraAttacks = 0;
        if(playerStats.level > 4) { // "Extra Attack" class feature at level 5
            extraAttacks = 1;
         }
        return (<React.Fragment>
               {playerStats.class.name === 'Paladin' && <div>
                   <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles.join(', ')}</div>
                   <div><b>Extra Attacks: </b>{extraAttacks}</div>
                   <div><b>Channel Divinity: </b>{channelDivinity}</div>
                   {playerStats.rules !== '2024' && <div><b>Aura Range: </b>{classSpecific.aura_range}</div>}
               </div>}
           </React.Fragment>)
}

export default CharClassPaladin
