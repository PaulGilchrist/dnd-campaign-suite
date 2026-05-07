
import React from 'react'
import { cloneDeep, isEqual } from 'lodash';
import utils from '../../services/utils'
import storage from '../../services/storage'
import Subscriber from '../common/subscriber';

import './combat-tracking.css'

function CombatTracking({ characters }) {
    const [combatSummary, setCombatSummary] = React.useState(1);
    const [numOfNpc, setNumOfNpc] = React.useState(5);
    const [forceRefresh, setForceRefresh] = React.useState(0);
    const [activeCreatureId, setActiveCreatureId] = React.useState(null);

    const setupCreatures = React.useCallback(() => {
        const creatureList = characters.map((character) => { return { id: utils.guid(), name: utils.getFirstName(character.name), type: 'player', initiative: '', notes: '' } });
        creatureList.sort((a, b) => a.name.localeCompare(b.name)); // asc
        for (let i = 0; i < numOfNpc; i++) {
            creatureList.push({ id: utils.guid(), name: `NPC ${i + 1}`, type: 'npc', initiative: '', notes: '' });
        }
        return creatureList;
    }, [characters, numOfNpc]);

    const handleAddNpc = React.useCallback(() => {
        combatSummary.creatures.push({ id: utils.guid(), name: `NPC ${numOfNpc + 1}`, type: 'npc', initiative: '', notes: '' });
        setNumOfNpc(numOfNpc + 1);
        storage.set('combatSummary', combatSummary);
        setCombatSummary(cloneDeep(combatSummary));
    }, [combatSummary, numOfNpc]);

    const handleRemoveNpc = React.useCallback(() => {
        for (let i = combatSummary.creatures.length - 1; i >= 0; i--) {
            if (combatSummary.creatures[i].type === 'npc') {
                if (combatSummary.creatures[i].initiative == '' || window.confirm(`${combatSummary.creatures[i].name} has initiative assigned.  Remove anyway?`)) {
                    combatSummary.creatures.splice(i, 1);
                    setNumOfNpc(numOfNpc - 1);
                    storage.set('combatSummary', combatSummary);
                    setCombatSummary(cloneDeep(combatSummary));
                }
                break;
            }
        }
    }, [combatSummary, numOfNpc]);

    const handleAddCombatRound = React.useCallback(() => {
        combatSummary.round++;
        storage.set('combatSummary', combatSummary);
        setCombatSummary({...combatSummary});
    }, [combatSummary]);

    const handleRemoveCombatRound = React.useCallback(() => {
        combatSummary.round--;
        storage.set('combatSummary', combatSummary);
        setCombatSummary({...combatSummary});
    }, [combatSummary]);

    const handleNextCreature = React.useCallback(() => {
        const currentIndex = combatSummary.creatures.findIndex((creature) => creature.id === activeCreatureId);
        if (currentIndex < combatSummary.creatures.length - 1) {
            const nextId = combatSummary.creatures[currentIndex + 1].id;
            storage.set('activeCreatureId', nextId);
            setActiveCreatureId(nextId);
        } else {
            const firstId = combatSummary.creatures[0].id;
            storage.set('activeCreatureId', firstId);
            setActiveCreatureId(firstId);
        }
    }, [combatSummary.creatures, activeCreatureId]);

    const handlePreviousCreature = React.useCallback(() => {
        const currentIndex = combatSummary.creatures.findIndex((creature) => creature.id === activeCreatureId);
        if (currentIndex > 0) {
            const prevId = combatSummary.creatures[currentIndex - 1].id;
            storage.set('activeCreatureId', prevId);
            setActiveCreatureId(prevId);
        } else {
            const lastId = combatSummary.creatures[combatSummary.creatures.length - 1].id;
            storage.set('activeCreatureId', lastId);
            setActiveCreatureId(lastId);
        }
    }, [combatSummary.creatures, activeCreatureId]);

    React.useEffect(() => {
        let combatSummary = storage.get('combatSummary');
        if (!combatSummary) {
            combatSummary = {
                round: 1,
                creatures: setupCreatures()
            }
            storage.set('combatSummary', combatSummary);
        }
        setCombatSummary(combatSummary);

        let activeId = storage.get('activeCreatureId');
        if (!activeId) {
            activeId = combatSummary.creatures[0]?.id;
            storage.set('activeCreatureId', activeId);
        }
        setActiveCreatureId(activeId);
    }, [characters, forceRefresh, setupCreatures]);

    React.useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                handlePreviousCreature();
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                handleNextCreature();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                handleAddCombatRound();
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                handleRemoveCombatRound();
            } else if (event.key === '+') {
                event.preventDefault();
                handleAddNpc();
            } else if (event.key === '-') {
                event.preventDefault();
                handleRemoveNpc();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [combatSummary, activeCreatureId, handleAddCombatRound, handleAddNpc, handleNextCreature, handlePreviousCreature, handleRemoveCombatRound, handleRemoveNpc]);

    const handleClear = () => {
        if (window.confirm('Are you sure you want to clear all combat status?')) {
            const combatSummary = {
                round: 1,
                creatures: setupCreatures()
            }
            storage.set('combatSummary', combatSummary);
            setCombatSummary(combatSummary);
            const firstCreatureId = setupCreatures()[0].id;
            storage.set('activeCreatureId', firstCreatureId);
            setActiveCreatureId(firstCreatureId);
        }
    };
    const handleEvent = (event) => {
        if (!isEqual(storage.get(event.key), event.data)) { // We may have made this change ourselves

            if (event.key === 'combatTrackedCreatures' || event.key === 'combatSummary') {
                setForceRefresh(utils.guid()); // Force Refresh after debounce
            }
        }
    }
    const handleInitiativeChange = (id, value) => {
        const index = combatSummary.creatures.findIndex((creature) => creature.id === id);
        combatSummary.creatures[index].initiative = value;
        combatSummary.creatures.sort((a, b) => b.initiative - a.initiative); // desc
        storage.set('combatSummary', combatSummary);
        setCombatSummary(cloneDeep(combatSummary));
    };
    const handleNameChange = (id, value) => {
        const index = combatSummary.creatures.findIndex((creature) => creature.id === id);
        combatSummary.creatures[index].name = value;
        storage.set('combatSummary', combatSummary);
        setCombatSummary(cloneDeep(combatSummary));
    };
    const handleNotesChange = (id, value) => {
        const index = combatSummary.creatures.findIndex((creature) => creature.id === id);
        combatSummary.creatures[index].notes = value;
        storage.set('combatSummary', combatSummary);
        setCombatSummary(cloneDeep(combatSummary));
    };

    return (
        <div className='combat-tracking'>
            <h4>Combat Tracking (round {combatSummary.round})</h4>
            <div className='creatures'>
                <header>Name</header>
                <header className="initiative">Initiative</header>
                <header>Notes</header>
                {combatSummary.creatures && combatSummary.creatures.map((creature) => {
                    const isActive = creature.id === activeCreatureId;
                    return <React.Fragment key={creature.id}>
                        {creature.type === 'player' && <div className={isActive ? 'active-text active-row active-name' : ''} style={{paddingLeft: '10px'}}>{creature.name}</div>}
                        {creature.type === 'npc' && <div className={isActive ? 'active-row active-name' : ''}>
                            <input
                                onChange={(event) => handleNameChange(creature.id, event.target.value)}
                                tabIndex={0}
                                type="text"
                                value={creature.name}
                            />
                        </div>}
                        <div className={isActive ? 'active-row active-initiative' : ''}>
                            <input
                                min="0"
                                onChange={(event) => handleInitiativeChange(creature.id, event.target.value)}
                                tabIndex={0}
                                type="number"
                                value={creature.initiative}
                            />
                        </div>
                        <div className={isActive ? 'active-row notes' : 'notes'}>
                            <input
                                onChange={(event) => handleNotesChange(creature.id, event.target.value)}
                                tabIndex={0}
                                type="text"
                                value={creature.notes}
                            />
                        </div>
                    </React.Fragment>;
                })}
            </div>
            <br />
            <div className='combat-tracking-buttons'>
                <button className='clear-button' onClick={handleClear}>Clear</button>
                <span className='up-down'>Add NPC <button onClick={handleAddNpc}>+</button><button onClick={handleRemoveNpc}>-</button></span>
                <span className='up-down'>Combat Round <button onClick={handleRemoveCombatRound}>&#8592;</button><button onClick={handleAddCombatRound}>&#8594;</button></span>
                <span className='up-down'>Creature <button onClick={handlePreviousCreature}>&#8593;</button><button onClick={handleNextCreature}>&#8595;</button></span>
            </div>
            <Subscriber handleEvent={handleEvent}></Subscriber>
        </div>
    )
}

export default CombatTracking
