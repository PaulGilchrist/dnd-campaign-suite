/* eslint-disable react/prop-types */
import React from 'react'

function CharClassRogue({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    if (!classLevel) {
        // Return null if no class level data available
        return null;
    }

    // Support both 5e format (class_specific.sneak_attack) and 2024 format (sneak_attack_num_d6)
    let sneakAttack;
    if (classLevel.sneak_attack_num_d6 !== undefined) {
        // 2024 format
        sneakAttack = { dice_count: classLevel.sneak_attack_num_d6, dice_value: 6 };
    } else if (classLevel.class_specific && classLevel.class_specific.sneak_attack) {
        // 5e format
        sneakAttack = classLevel.class_specific.sneak_attack;
    } else {
        sneakAttack = { dice_count: 0, dice_value: 6 };
    }
    return (<React.Fragment>
        {playerStats.class?.name === 'Rogue' && <div>
            <div><b>Sneak Attack Damage: </b>+{sneakAttack.dice_count}d{sneakAttack.dice_value}</div>
            {playerStats.class.expertise && <div><b>Expertise: </b>{playerStats.class.expertise.join(', ')}</div>}
        </div>}
    </React.Fragment>)
}

export default CharClassRogue
