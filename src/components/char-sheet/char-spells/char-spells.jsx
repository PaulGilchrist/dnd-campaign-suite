/* eslint-disable react/prop-types */
import React from 'react'
import { cloneDeep } from 'lodash';
import useActionPopup from '../common/use-action-popup'
import CharSpellSlots from './char-spell-slots'
import './char-spells.css'

function CharSpells({ playerStats, handleTogglePreparedSpells }) {
    const { showPopup, PopupElement } = useActionPopup('spell');
    const [filterPrepared, setFilterPrepared] = React.useState(false);
    const [spells, setSpells] = React.useState([]);
    React.useEffect(() => {
        if(playerStats.spellAbilities) {
            setFilterPrepared(false);
            setSpells(playerStats.spellAbilities.spells);
          }
      }, [playerStats]);
    const handleTogglePreparedFilter = () => {
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        if(!filterPrepared) {
            setSpells(spells.filter(spell => spell.prepared === 'Always' || spell.prepared === 'Prepared'));
        } else {
            setSpells(spells)
        }
        setFilterPrepared(!filterPrepared)
    }
    const handleSortLevel = () => {
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        // Sort by level (ascending) and then by name
        spells.sort((a, b) => {
            if (a.level !== b.level) {
                return a.level - b.level;
            } else {
                return a.name.localeCompare(b.name);
              }
          });
        setSpells(spells);
    }
    const handleSortSpell = () => {
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        spells.sort((a, b) => a.name.localeCompare(b.name));
        setSpells(spells);
    }
    return (
        <div>
            {(playerStats.spellAbilities && playerStats.spellAbilities.spells.length > 0) && <div className="spell-popup-parent">
                     {PopupElement}
                <hr />
                <div className='spell-abilities'>
                    <div className="sectionHeader"><h4>&nbsp;Spells</h4></div>
                    <div>
                        <b>Attack (to hit):</b> +{playerStats.spellAbilities.toHit}<br/>
                        <b>Modifier:</b> +{playerStats.spellAbilities.modifier}<br/>
                        <b>Save DC:</b> {playerStats.spellAbilities.saveDc}
                    </div>
                    <div>
                        <b>Cantrips Known:</b> {playerStats.spellAbilities.cantrips_known ? playerStats.spellAbilities.cantrips_known : 0}<br/>
                        <b>Prepared Spells:</b> {playerStats.spellAbilities.prepared_spells || playerStats.spellAbilities.spells_known ? (playerStats.spellAbilities.prepared_spells || playerStats.spellAbilities.spells_known) : 'All'}<br/>                    
                        <b>Max Prepared:</b> {playerStats.spellAbilities.maxPreparedSpells ? playerStats.spellAbilities.maxPreparedSpells : 'All'}
                    </div>
                    <CharSpellSlots playerStats={playerStats}></CharSpellSlots>
                </div>
                <table className='table-spells table-striped'>
                    <thead>
                        <tr>
                            <th className='left clickable' onClick={handleSortSpell}>Spell</th>
                            <th className='clickable' onClick={handleSortLevel}>Level</th>
                            <th className='clickable' onClick={handleTogglePreparedFilter}>Prepared</th>
                            <th>Time</th>
                            <th>Range</th>
                            <th>Effect</th>
                            <th>Duration</th>
                            <th className='left'>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {spells.map((spell) => {
                            let notes = [];
                            if(spell.concentration) notes.push('Concentration');
                            if(spell.ritual) notes.push('Ritual');
                            if(spell.components) notes.push(spell.components.join('/'));
                            let effect = 'Utility';
                            if(spell.damage) {
                                if(spell.damage.damage_at_slot_level) {
                                    effect = `${spell.damage.damage_at_slot_level[Object.keys(spell.damage.damage_at_slot_level)[0]]} ${spell.damage.damage_type}`
                                } else if (spell.damage.damage_at_character_level) {
                                    effect = `${spell.damage.damage_at_character_level[Object.keys(spell.damage.damage_at_character_level)[0]]} ${spell.damage.damage_type}`
                                }
                            }
                            return <tr key={spell.name}>
                                <td className='left spell-name clickable' onClick={() => showPopup(spell)}>{spell.name}</td>
                                <td>{spell.level === 0 ? 'Cantrip' : spell.level}</td>
                                {(spell.prepared !== 'Prepared' && spell.prepared !== '') && <td>{spell.prepared}</td>}
                                {(spell.prepared === 'Prepared' || spell.prepared === '') && <td><input tabIndex={0} type="checkbox" checked={spell.prepared === 'Prepared'} onChange={() => handleTogglePreparedSpells(spell.name)}/></td>}
                                <td>{spell.casting_time ? spell.casting_time.replace('reaction','R').replace('bonus action','BA').replace('action',' A').replace('minute','min').replace('minutes','min') : ''}</td>
                                <td>{spell.range}</td>
                                <td>{effect}</td>
                                <td>{spell.duration ? spell.duration.replace('Instantaneous','Instant').replace('minute','min').replace('minutes','min') : ''}</td>
                                <td className='left'>{notes.join(', ').replace('Concentration','Con')}</td>
                            </tr>
                        })}
                    </tbody>
                </table>
            </div>}
        </div>
    )
}

export default CharSpells

