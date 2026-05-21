 
import React from 'react'
import { cloneDeep, isEqual } from 'lodash';
import storage from '../../services/storage.js'
import utils from '../../services/utils.js'
import rulesFactory from '../../services/rulesFactory.js'
import CharAbilities from './CharAbilities.jsx'
import CharActions from './CharActions.jsx'
import CharInventory from './CharInventory.jsx'
import CharReactions from './CharReactions.jsx'
import CharSpecialActions from './CharSpecialActions.jsx'
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx'
import CharSpells from './char-spells/CharSpells.jsx'
import CharSummary from './char-summary/CharSummary.jsx'
import Subscriber from '../common/Subscriber.jsx';
import './CharSheet.css'

function CharSheet({ allAbilityScores, allClasses, allClasses2024, allEquipment, allMagicItems, allRaces, allSpells, allSpells2024, playerSummary, allRaces2024, allMagicItems2024, onDeleteCharacter, onEditCharacter, onUploadClick, onSaveClick, campaignName }) {
    const [playerStats, setPlayerStats] = React.useState(null);
    const [forceRefresh, setForceRefresh] = React.useState(0);
    React.useEffect(() => {
        const fetchData = async () => {
            // Use rules factory to get appropriate rules based on character's rules setting
            const spellData = playerSummary.rules === '2024' ? allSpells2024 : allSpells;
            const effectiveClasses = playerSummary.rules === '2024' ? allClasses2024 : allClasses;
            const effectiveRaces = playerSummary.rules === '2024' ? allRaces2024 : allRaces;
            const effectiveMagicItems = playerSummary.rules === '2024' ? allMagicItems2024 : allMagicItems;
                const stats = await rulesFactory.getPlayerStats(effectiveClasses, allEquipment, effectiveMagicItems, effectiveRaces, spellData, playerSummary);

            // Load prepared spells from localStorage (skip for 2024 ruleset where all spells are known/prepared)
            if (playerSummary.rules !== '2024') {
                const storedData = localStorage.getItem(playerSummary.name);
                let preparedSpells = null;

                if (storedData) {
                    const parsedData = JSON.parse(storedData);
                    if (parsedData && parsedData.preparedSpells) {
                        preparedSpells = parsedData.preparedSpells;
                    }
                }

                if (preparedSpells) {
                    stats.spellAbilities?.spells.forEach(spell => {
                        if (preparedSpells.includes(spell.name)) {
                            if (spell.prepared === '') {
                                spell.prepared = 'Prepared';
                            }
                        } else {
                            if (spell.prepared === 'Prepared') {
                                spell.prepared = '';
                            }
                        }
                    });
                }
            }
            setPlayerStats(stats);
        };
        fetchData();
    }, [allAbilityScores, allClasses, allClasses2024, allEquipment, allMagicItems, allRaces, allSpells, allSpells2024, playerSummary, forceRefresh, allRaces2024, allMagicItems2024]);

    const handleEvent = (event) => {
            if (!isEqual(storage.get(event.key), event.data)) {
                localStorage.setItem(event.key, JSON.stringify(event.data));
                if (playerStats && event.key === utils.getFirstName(playerStats.name)) {
                    setForceRefresh(utils.guid());
                 }
             }
         }

    const handleTogglePreparedSpells = (spellName) => {
        const spell = playerStats.spellAbilities.spells.find(spell => spell.name === spellName);
        if (spell) {
            if (spell.prepared === 'Prepared') {
                spell.prepared = '';
            } else if (spell.prepared === '') {
                const preparedSpellCount = playerStats.spellAbilities.spells.filter(spell => spell.prepared === 'Prepared').length;
                if (preparedSpellCount < playerStats.spellAbilities.maxPreparedSpells) {
                    spell.prepared = 'Prepared';
                }
            }
            const preparedSpells = [];
            playerStats.spellAbilities.spells.forEach(spell => {
                if (spell.prepared === 'Prepared') {
                    preparedSpells.push(spell.name);
                }
            });
            storage.setProperty(playerStats.name, 'preparedSpells', preparedSpells, campaignName);
            setPlayerStats(cloneDeep(playerStats));
        }
    }

    return (<React.Fragment>
        {playerStats && <div className='char-sheet' data-testid='char-sheet'>
            <CharSummary playerStats={playerStats} onDeleteCharacter={onDeleteCharacter} onEditCharacter={onEditCharacter} onUploadClick={onUploadClick} onSaveClick={onSaveClick} campaignName={campaignName}></CharSummary><hr />
            <CharAbilities allAbilityScores={allAbilityScores} playerStats={playerStats}></CharAbilities><hr />
            
            <CharActions playerStats={playerStats}></CharActions><hr />
            <CharReactions playerStats={playerStats}></CharReactions>
            {playerSummary.rules === '2024' 
  ? <CharSpells playerStats={playerStats} campaignName={campaignName}></CharSpells>
  : <CharSpells playerStats={playerStats} handleTogglePreparedSpells={(spellName) => handleTogglePreparedSpells(spellName)} campaignName={campaignName}></CharSpells>
}<hr />
            <CharSpecialActions playerStats={playerStats}></CharSpecialActions><hr />
            <CharInventory playerStats={playerStats}></CharInventory><hr />
            <div className='no-print'><CharCharacterAdvancement playerStats={playerStats}></CharCharacterAdvancement></div>
            <Subscriber handleEvent={handleEvent}></Subscriber>
        </div>}
    </React.Fragment>)
}

export default CharSheet
