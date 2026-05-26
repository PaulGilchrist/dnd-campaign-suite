
import React from 'react'
import { cloneDeep } from 'lodash';
import utils from '../../services/utils.js'
import storage from '../../services/storage.js'
import { getMonsterImageUrl } from '../../services/monsterUtils.js';
import AvatarImage from '../common/AvatarImage.jsx';
import Subscriber from '../common/Subscriber.jsx';
import './initiative.css'

function NpcAvatar({ name, imageUrl }) {
    if (imageUrl) {
        return (
            <div className="npc-avatar">
                <img src={imageUrl} alt={name} className="avatar-image" />
            </div>
        );
    }
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return (
        <div className="npc-avatar">
            <span>{initial}</span>
        </div>
    );
}

function Initiative({ characters, campaignName, onNpcsChange }) {
    const [combatSummary, setCombatSummary] = React.useState(null);
    const [numOfNpc, setNumOfNpc] = React.useState(4);
    const [activeCreatureId, setActiveCreatureId] = React.useState(null);
    const [npcImages, setNpcImages] = React.useState({});
    const carouselRef = React.useRef(null);
    const combatSummaryRef = React.useRef(null);
    combatSummaryRef.current = combatSummary;

    const handleEvent = React.useCallback((event) => {
        if (event.key == null || event.data == null) return;
        if (!event.key.startsWith(`change-${campaignName}-`)) return;

        const dataKey = event.key.slice(`change-${campaignName}-`.length);

        if (dataKey === 'combatSummary') {
            localStorage.setItem('combatSummary', JSON.stringify(event.data));
            combatSummaryRef.current = event.data;
            setCombatSummary(event.data);
        } else if (dataKey === 'activeCreatureId') {
            localStorage.setItem('activeCreatureId', JSON.stringify(event.data));
            setActiveCreatureId(event.data);
        }
    }, [campaignName]);

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
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
    }, [combatSummary, numOfNpc, campaignName]);

    const handleRemoveNpc = React.useCallback(() => {
        if (!combatSummary) return;
        for (let i = combatSummary.creatures.length - 1; i >= 0; i--) {
            if (combatSummary.creatures[i].type === 'npc') {
                if (combatSummary.creatures[i].initiative == '' || window.confirm(`${combatSummary.creatures[i].name} has initiative assigned.  Remove anyway?`)) {
                    combatSummary.creatures.splice(i, 1);
                    setNumOfNpc(numOfNpc - 1);
                    storage.set('combatSummary', combatSummary, campaignName);
                    setCombatSummary(cloneDeep(combatSummary));
                }
                break;
            }
        }
    }, [combatSummary, numOfNpc, campaignName]);

    const handleAddCombatRound = React.useCallback(() => {
        if (!combatSummary) return;
        combatSummary.round++;
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary({...combatSummary});
    }, [combatSummary, campaignName]);

    const handleRemoveCombatRound = React.useCallback(() => {
        if (!combatSummary) return;
        combatSummary.round = Math.max(0, combatSummary.round - 1);
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary({...combatSummary});
    }, [combatSummary, campaignName]);

    const handleNextCreature = React.useCallback(() => {
        const cs = combatSummaryRef.current;
        if (!cs) return;
        const currentIndex = cs.creatures.findIndex((creature) => creature.id === activeCreatureId);
        if (currentIndex < cs.creatures.length - 1) {
            const nextId = cs.creatures[currentIndex + 1].id;
            storage.set('activeCreatureId', nextId, campaignName);
            setActiveCreatureId(nextId);
        } else {
            const firstId = cs.creatures[0].id;
            storage.set('activeCreatureId', firstId, campaignName);
            setActiveCreatureId(firstId);
        }
    }, [activeCreatureId, campaignName]);

    const handlePreviousCreature = React.useCallback(() => {
        const cs = combatSummaryRef.current;
        if (!cs) return;
        const currentIndex = cs.creatures.findIndex((creature) => creature.id === activeCreatureId);
        if (currentIndex > 0) {
            const prevId = cs.creatures[currentIndex - 1].id;
            storage.set('activeCreatureId', prevId, campaignName);
            setActiveCreatureId(prevId);
        } else {
            const lastId = cs.creatures[cs.creatures.length - 1].id;
            storage.set('activeCreatureId', lastId, campaignName);
            setActiveCreatureId(lastId);
        }
    }, [activeCreatureId, campaignName]);

    React.useEffect(() => {
        // Load existing combatSummary from localStorage if available (fast startup)
        const stored = localStorage.getItem('combatSummary');
        let initialSummary = null;
        if (stored) {
            try { initialSummary = JSON.parse(stored); } catch { /* ignore */ }
        }

        // Always regenerate creatures from the current characters to pick up new characters
        const creatures = setupCreatures();

        if (initialSummary) {
            // Merge: keep existing creature data but add any new characters
            const existingPlayerMap = new Map();
            for (const c of initialSummary.creatures) {
                if (c.type === 'player') existingPlayerMap.set(c.name, c);
            }
            const mergedCreatures = creatures.map(newC => {
                const existing = existingPlayerMap.get(newC.name);
                return existing ? { ...newC, initiative: existing.initiative } : newC;
            });
            // Keep NPCs from initial summary
            const npcs = initialSummary.creatures.filter(c => c.type === 'npc');
            mergedCreatures.push(...npcs);

            const summary = { round: initialSummary.round, creatures: mergedCreatures };
            setCombatSummary(summary);
            combatSummaryRef.current = summary;

            const storedActive = localStorage.getItem('activeCreatureId');
            if (storedActive) {
                setActiveCreatureId(JSON.parse(storedActive));
            } else {
                setActiveCreatureId(mergedCreatures[0]?.id || null);
            }
        } else {
            const newSummary = { round: 1, creatures };
            storage.set('combatSummary', newSummary, campaignName);
            setCombatSummary(newSummary);
            combatSummaryRef.current = newSummary;
            const firstId = creatures[0]?.id;
            storage.set('activeCreatureId', firstId, campaignName);
            setActiveCreatureId(firstId);
        }
    }, [characters, campaignName, setupCreatures]);

    React.useEffect(() => {
        if (!combatSummary || !onNpcsChange) return;
        const npcList = combatSummary.creatures
            .filter(c => c.type === 'npc')
            .map(c => ({ id: c.id, name: c.name, type: 'npc', imageUrl: npcImages[c.id] || null }));
        onNpcsChange(npcList);
    }, [combatSummary, onNpcsChange, npcImages]);

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
            const creatures = setupCreatures();
            const combatSummary = { round: 1, creatures };
            storage.set('combatSummary', combatSummary, campaignName);
            setCombatSummary(combatSummary);
            const firstCreatureId = creatures[0].id;
            storage.set('activeCreatureId', firstCreatureId, campaignName);
            setActiveCreatureId(firstCreatureId);
        }
    };
    const handleInitiativeChange = (id, value) => {
        if (!combatSummary) return;
        const index = combatSummary.creatures.findIndex((creature) => creature.id === id);
        combatSummary.creatures[index].initiative = value;
        combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
    };
    const handleNameChange = (id, value) => {
        if (!combatSummary) return;
        const idx = combatSummary.creatures.findIndex((creature) => creature.id === id);
        combatSummary.creatures[idx].name = value;
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
        setNpcImages(prev => ({ ...prev, [id]: null }));
    };
    if (!combatSummary) return null;
    return (
        <div className='initiative'>
            <Subscriber campaignName={campaignName} handleEvent={handleEvent} />
            <h4>Initiative (round {combatSummary.round})</h4>
            <div className='carousel-container' ref={carouselRef}>
                {combatSummary?.creatures?.map((creature) => {
                    const isActive = creature.id === activeCreatureId;
                    return (
                        <div key={creature.id} className={`creature-card ${creature.type} ${isActive ? 'active' : ''}`}>
                            <div className='creature-avatar'>
                                {creature.type === 'player' ? (
                                    <AvatarImage name={creature.name} imagePath={creature.imagePath} size={150} />
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
