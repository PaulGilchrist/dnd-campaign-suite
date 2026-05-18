
import React from 'react'
import { cloneDeep } from 'lodash';
import utils from '../../services/utils.js'
import storage from '../../services/storage.js'
import { loadMonsters } from '../../services/dataLoader.js'
import './initiative.css'

let monstersCache = null;

async function getMonsterImageUrl(npcName) {
    if (!npcName) return null;
    if (!monstersCache) {
        monstersCache = await loadMonsters();
    }
    // Strip trailing number (e.g., "Goblin 1" -> "Goblin")
    const baseName = npcName.replace(/\s+\d+$/, '');
    // Case-insensitive lookup by name
    const monster = monstersCache.find(m => m.name.toLowerCase() === baseName.toLowerCase());
    if (monster && monster.image === true) {
        return `https://paulgilchrist.github.io/dnd-tools/images/${monster.index}.jpg`;
    }
    return null;
}

function NpcAvatar({ name, imageUrl }) {
    if (imageUrl) {
        return (
            <div className="player-avatar">
                <img src={imageUrl} alt={name} className="avatar-image" />
            </div>
        );
    }
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return (
        <div className="npc-avatar" style={{ backgroundColor: '#e74c3c' }}>
            <span>{initial}</span>
        </div>
    );
}

function AvatarImage({ name, imagePath }) {
    if (imagePath) {
        return (
            <div className="player-avatar">
                <img src={imagePath} alt={name} className="avatar-image" />
            </div>
        );
    }
    return (
        <div className="player-avatar">
            <span className="avatar-initial">{name ? name.charAt(0).toUpperCase() : '?'}</span>
        </div>
    );
}

function Initiative({ characters }) {
    const [combatSummary, setCombatSummary] = React.useState(null);
    const [numOfNpc, setNumOfNpc] = React.useState(5);
    const [activeCreatureId, setActiveCreatureId] = React.useState(null);
    const [npcImages, setNpcImages] = React.useState({});
    const carouselRef = React.useRef(null);

    React.useEffect(() => {
        if (!combatSummary) return;
        const npcIds = combatSummary.creatures.filter(c => c.type === 'npc').map(c => c.id);
        const promises = npcIds.map(async (id) => {
            const npc = combatSummary.creatures.find(c => c.id === id);
            if (npc) {
                const url = await getMonsterImageUrl(npc.name);
                return { id, url };
            }
            return { id, url: null };
        });
        Promise.all(promises).then(results => {
            const newImages = {};
            results.forEach(({ id, url }) => { newImages[id] = url; });
            setNpcImages(newImages);
        });
    }, [combatSummary]);

    const setupCreatures = React.useCallback(() => {
        const creatureList = characters.map((character) => { return { id: utils.guid(), name: utils.getFirstName(character.name), type: 'player', imagePath: character.imagePath || '', initiative: '' } });
        creatureList.sort((a, b) => a.name.localeCompare(b.name)); // asc
        for (let i = 0; i < numOfNpc; i++) {
            creatureList.push({ id: utils.guid(), name: `NPC ${i + 1}`, type: 'npc', initiative: '' });
        }
        return creatureList;
    }, [characters, numOfNpc]);

    const handleAddNpc = React.useCallback(() => {
        if (!combatSummary) return;
        combatSummary.creatures.push({ id: utils.guid(), name: `NPC ${numOfNpc + 1}`, type: 'npc', initiative: '' });
        setNumOfNpc(numOfNpc + 1);
        storage.set('combatSummary', combatSummary);
        setCombatSummary(cloneDeep(combatSummary));
    }, [combatSummary, numOfNpc]);

    const handleRemoveNpc = React.useCallback(() => {
        if (!combatSummary) return;
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
        if (!combatSummary) return;
        combatSummary.round++;
        storage.set('combatSummary', combatSummary);
        setCombatSummary({...combatSummary});
    }, [combatSummary]);

    const handleRemoveCombatRound = React.useCallback(() => {
        if (!combatSummary) return;
        combatSummary.round = Math.max(0, combatSummary.round - 1);
        storage.set('combatSummary', combatSummary);
        setCombatSummary({...combatSummary});
    }, [combatSummary]);

    const handleNextCreature = React.useCallback(() => {
        if (!combatSummary) return;
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
    }, [combatSummary?.creatures, activeCreatureId]);

    const handlePreviousCreature = React.useCallback(() => {
        if (!combatSummary) return;
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
    }, [combatSummary?.creatures, activeCreatureId]);

    React.useEffect(() => {
        // Always regenerate creatures from the current characters
        const creatures = setupCreatures();
        const newSummary = {
            round: 1,
            creatures
        };
        storage.set('combatSummary', newSummary);
        setCombatSummary(newSummary);

        const firstId = creatures[0]?.id;
        storage.set('activeCreatureId', firstId);
        setActiveCreatureId(firstId);
    }, [characters]);

    React.useEffect(() => {
        if (!combatSummary) return;
        const handleKeyDown = (event) => {
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                handleAddCombatRound();
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                handleRemoveCombatRound();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                handleNextCreature();
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                handlePreviousCreature();
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

    React.useEffect(() => {
        if (!carouselRef.current || !activeCreatureId) return;
        const activeCard = carouselRef.current.querySelector('.creature-card.active');
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, [activeCreatureId]);

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
    const handleInitiativeChange = (id, value) => {
        if (!combatSummary) return;
        const index = combatSummary.creatures.findIndex((creature) => creature.id === id);
        combatSummary.creatures[index].initiative = value;
        combatSummary.creatures.sort((a, b) => b.initiative - a.initiative); // desc
        storage.set('combatSummary', combatSummary);
        setCombatSummary(cloneDeep(combatSummary));
    };
    const handleNameChange = (id, value) => {
        if (!combatSummary) return;
        const index = combatSummary.creatures.findIndex((creature) => creature.id === id);
        combatSummary.creatures[index].name = value;
        storage.set('combatSummary', combatSummary);
        setCombatSummary(cloneDeep(combatSummary));
        // Clear the cached image so it gets recomputed
        setNpcImages(prev => ({ ...prev, [id]: null }));
    };
    if (!combatSummary) return null;
    return (
        <div className='initiative'>
            <h4>Initiative (round {combatSummary.round})</h4>
            <div className='carousel-container' ref={carouselRef}>
                {combatSummary?.creatures?.map((creature) => {
                    const isActive = creature.id === activeCreatureId;
                    return (
                        <div key={creature.id} className={`creature-card ${creature.type} ${isActive ? 'active' : ''}`}>
                            <div className='creature-avatar'>
                                {creature.type === 'player' ? (
                                    <AvatarImage name={creature.name} imagePath={creature.imagePath} />
                                ) : (
                                    <NpcAvatar name={creature.name} imageUrl={npcImages[creature.id]} />
                                )}
                            </div>
                            <div className='creature-name'>
                                {creature.type === 'npc' ? (
                                    <input
                                        onChange={(event) => handleNameChange(creature.id, event.target.value)}
                                        type="text"
                                        value={creature.name}
                                        readOnly={!isActive}
                                        className="npc-name-input"
                                    />
                                ) : (
                                    <span>{creature.name}</span>
                                )}
                            </div>
                            <div className='creature-initiative'>
                                <input
                                    min="0"
                                    onChange={(event) => handleInitiativeChange(creature.id, event.target.value)}
                                    type="number"
                                    value={creature.initiative}
                                    placeholder="Init"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className='combat-controls'>
                <button className='clear-button' onClick={handleClear}>Clear</button>
                <button onClick={handleAddNpc}>+ NPC</button>
                <button onClick={handleRemoveNpc}>- NPC</button>
                <button onClick={handleAddCombatRound}>↑ Round</button>
                <button onClick={handleRemoveCombatRound}>Round ↓</button>
                <button onClick={handlePreviousCreature}>← Prev</button>
                <button onClick={handleNextCreature}>Next →</button>
            </div>
        </div>
    )
}

export default Initiative
