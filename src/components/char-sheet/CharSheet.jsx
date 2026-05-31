 
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
import { EXHAUSTION_LEVELS, loadActiveConditions } from './char-summary/CharConditions.jsx'
import { computeConditionEffects, getNetAttackMode, CONDITIONS_THAT_CANNOT_ACT } from '../../services/conditionEffects.js'
import Subscriber from '../common/Subscriber.jsx';
import './CharSheet.css'

function CharSheet({ allAbilityScores, allClasses, allClasses2024, allEquipment, allMagicItems, allRaces, allSpells, allSpells2024, playerSummary, allRaces2024, allMagicItems2024, onDeleteCharacter, onEditCharacter, onUploadClick, onSaveClick, campaignName, activeMapName }) {
    const [playerStats, setPlayerStats] = React.useState(null);
    const [forceRefresh, setForceRefresh] = React.useState(0);
    const readExhaustionLevel = () => {
        if (!playerSummary) return 0;
        const stored = storage.getProperty(playerSummary.name, 'exhaustionLevel', campaignName);
        return typeof stored === 'number' ? Math.min(EXHAUSTION_LEVELS, Math.max(0, stored)) : 0;
    };

    const [exhaustionLevel, setExhaustionLevel] = React.useState(readExhaustionLevel);

    React.useEffect(() => {
        setExhaustionLevel(readExhaustionLevel());
    }, [forceRefresh, playerSummary]); // eslint-disable-line react-hooks/exhaustive-deps
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

    React.useEffect(() => {
        if (!playerStats) return;
        storage.setProperty(playerStats.name, 'hitPoints', playerStats.hitPoints, campaignName);
    }, [playerStats, campaignName]);

    const handleEvent = (event) => {
            if (event.key == null || event.data == null) { return; }
            if (!event.key.startsWith('change-')) { return; }

             // Parse "change-${campaignName}-${characterKey}" to extract character key
            const prefix = `change-${campaignName}-`;
            if (!event.key.startsWith(prefix)) { return; }
            const characterKey = event.key.slice(prefix.length);

            if (isEqual(storage.get(characterKey), event.data)) { return; }

            localStorage.setItem(characterKey, JSON.stringify(event.data));

            if (playerStats && utils.getName(playerStats.name) === characterKey) {
                setForceRefresh(utils.guid());
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

    const handleConditionsChange = () => setForceRefresh(utils.guid())

    const exhaustionPenalty = 2 * exhaustionLevel;

    const activeConditions = loadActiveConditions(playerSummary?.name, campaignName)
    const conditionEffects = computeConditionEffects(activeConditions)
    const cannotAct = activeConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c))
    const conditionAttackMode = getNetAttackMode(conditionEffects.attackAdvantageCount, conditionEffects.attackDisadvantageCount)

    return (<React.Fragment>
        {playerStats && <div className='char-sheet' data-testid='char-sheet'>
            <CharSummary
              playerStats={playerStats}
              onDeleteCharacter={onDeleteCharacter}
              onEditCharacter={onEditCharacter}
              onUploadClick={onUploadClick}
              onSaveClick={onSaveClick}
              campaignName={campaignName}
              onLongRest={() => setForceRefresh(utils.guid())}
              exhaustionLevel={exhaustionLevel}
              onExhaustionChange={setExhaustionLevel}
              conditionEffects={conditionEffects}
              onConditionsChange={handleConditionsChange}
            ></CharSummary><hr />
              <CharAbilities
                allAbilityScores={allAbilityScores}
                playerStats={playerStats}
                campaignName={campaignName}
                exhaustionPenalty={exhaustionPenalty}
                conditionEffects={conditionEffects}
              ></CharAbilities><hr />

               <CharActions
                 playerStats={playerStats}
                 campaignName={campaignName}
                 exhaustionPenalty={exhaustionPenalty}
                 conditionAttackMode={conditionAttackMode}
                 cannotAct={cannotAct}
                 mapName={activeMapName}
               ></CharActions><hr />
              <CharReactions
                playerStats={playerStats}
                campaignName={campaignName}
                cannotAct={cannotAct}
              ></CharReactions>
            {playerSummary.rules === '2024'
  ? <CharSpells playerStats={playerStats} campaignName={campaignName} exhaustionPenalty={exhaustionPenalty} conditionAttackMode={conditionAttackMode} cannotAct={cannotAct}></CharSpells>
  : <CharSpells playerStats={playerStats} handleTogglePreparedSpells={(spellName) => handleTogglePreparedSpells(spellName)} campaignName={campaignName} exhaustionPenalty={exhaustionPenalty} conditionAttackMode={conditionAttackMode} cannotAct={cannotAct}></CharSpells>
}<hr />
            <CharSpecialActions playerStats={playerStats}></CharSpecialActions><hr />
            <CharInventory playerStats={playerStats}></CharInventory><hr />
            <div className='no-print'><CharCharacterAdvancement playerStats={playerStats}></CharCharacterAdvancement></div>
            <Subscriber campaignName={campaignName} handleEvent={handleEvent}></Subscriber>
        </div>}
    </React.Fragment>)
}

export default CharSheet
