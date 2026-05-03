/* eslint-disable react/prop-types */
import React from 'react'
import classRules from '../../../services/class-rules-2024'

function CharClassRanger({ playerStats }) {
    const is2024 = playerStats.rules === '2024';
    
    let extraAttacks = 0;
    if(playerStats.level > 4) { // "Extra Attack" class feature at level 5
        extraAttacks = 1;
    }
    
    const favoredEnemiesCount = classRules.getFavoredEnemy(playerStats);
    
        return (<React.Fragment>
                {playerStats.class.name === 'Ranger' && <div>
                    {playerStats.class.fightingStyles && <div><b>Fighting Styles: </b>{playerStats.level > 1 ? playerStats.class.fightingStyles.join(', ') : ''}</div>}
                    <div><b>Extra Attacks: </b>{extraAttacks}</div>
                    <div><b>Favored Enemies: </b>{favoredEnemiesCount}</div>
                </div>}
            </React.Fragment>)
}

export default CharClassRanger
