/* eslint-disable react/prop-types */
import React from 'react'
import useActionPopup from './common/use-action-popup'
import Popup from '../common/popup'
import './char-abilities.css'

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

function CharAbilities({ allAbilityScores, playerStats }) {
    const { showPopup, popupHtml, setPopupHtml } = useActionPopup('ability', { allAbilityScores });
    return (
        <div className='abilities-popup-parent'>
               {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)} />}
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
