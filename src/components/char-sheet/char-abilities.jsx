/* eslint-disable react/prop-types */
import React from 'react'
import usePopup from './common/use-popup'
import './char-abilities.css'

function CharAbilities({ allAbilityScores, playerStats }) {
    const { showPopup, PopupElement, setPopupHtml } = usePopup((name) => {
        const abilityScore = allAbilityScores.find((abilityScore) => abilityScore.full_name === name);
        if (abilityScore) {
            return `<h3>${name}</h3>${abilityScore.desc}<br/>`;
           }
        return null;
       });
    let signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });
    return (
        <div className='abilities-popup-parent'>
               {PopupElement}
            <div className='abilities'>
                <div className='left'><b>Ability</b></div>
                <div><b>Score</b></div>
                <div><b>Bonus</b></div>
                <div><b>Save</b></div>
                <div className='left'><b>Skills</b></div>
            </div>
            {playerStats.abilities.map((ability) => {
                return <div key={ability.name} className='abilities'>
                    <div className='clickable left' onClick={() => showPopup(ability.name)}>{ability.name}</div>
                    <div>{ability.totalScore}</div>
                    <div>{signFormatter.format(ability.bonus)}</div>
                    <div>{signFormatter.format(ability.save)}</div>
                    <div className='left'>{ability.skills.map((skill) => {
                        return `${skill.name}    ${signFormatter.format(skill.bonus)}`;
                    }).join(', ')}</div>
                </div>;
            })}
        </div>
    )
}

export default CharAbilities

