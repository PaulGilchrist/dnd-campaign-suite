
import React from 'react'
import { cloneDeep } from 'lodash';
import utils from '../../services/utils.js'
import storage from '../../services/storage.js'
import { getMonsterImageUrl, getMonsterData } from '../../services/monsterUtils.js';
import MonsterCardModal from '../encounter/MonsterCardModal.jsx';
import AvatarImage from '../common/AvatarImage.jsx';
import Subscriber from '../common/Subscriber.jsx';
import MonsterNameAutocomplete from '../common/MonsterNameAutocomplete.jsx';
import { computePlayerAc, computeAcEstimate } from '../../services/damageUtils.js';
import './initiative.css'

function NpcAvatar({ name, imageUrl, onClick }) {
    if (imageUrl) {
        return (
            <div className="npc-avatar" onClick={onClick}>
                <img src={imageUrl} alt={name} className="avatar-image" />
            </div>
        );
    }
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return (
        <div className="npc-avatar" onClick={onClick}>
            <span>{initial}</span>
        </div>
    );
}

function Initiative({ characters, campaignName, onNpcsChange, isLocalhost }) {
    const [combatSummary, setCombatSummary] = React.useState(null);
    const [numOfNpc, setNumOfNpc] = React.useState(4);
    const [activeCreatureId, setActiveCreatureId] = React.useState(null);
    const [npcImages, setNpcImages] = React.useState({});
    const [viewingMonster, setViewingMonster] = React.useState(null);
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
        const creatureList = characters.map((character) => {
            return {
                id: utils.guid(),
                name: utils.getFirstName(character.name),
                type: 'player',
                imagePath: character.imagePath || '',
                initiative: '',
                targetId: null,
                targetName: null,
                ac: computeAcEstimate(character),
                resistances: character.resistances || [],
                immunities: character.immunities || []
            };
        });
        creatureList.sort((a, b) => a.name.localeCompare(b.name)); // asc
        for (let i = 0; i < numOfNpc; i++) {
            creatureList.push({ id: utils.guid(), name: `NPC ${i + 1}`, type: 'npc', initiative: '', targetId: null, targetName: null, ac: 10, resistances: [], immunities: [] });
        }
        return creatureList;
    }, [characters, numOfNpc]);

    const handleAddNpc = React.useCallback(() => {
        if (!combatSummary) return;
        const maxNpcNum = combatSummary.creatures
            .filter(c => c.type === 'npc')
            .reduce((max, c) => {
                const match = c.name.match(/^NPC (\d+)$/);
                return match ? Math.max(max, parseInt(match[1])) : max;
            }, 0);
        const nextNum = maxNpcNum + 1;
        combatSummary.creatures.push({ id: utils.guid(), name: `NPC ${nextNum}`, type: 'npc', initiative: '', targetId: null, targetName: null, ac: 10, resistances: [], immunities: [] });
        setNumOfNpc(nextNum);
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
    }, [combatSummary, campaignName]);

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
        const stored = localStorage.getItem('combatSummary');
        let initialSummary = null;
        if (stored) {
            try { initialSummary = JSON.parse(stored); } catch { /* ignore */ }
        }

        if (initialSummary) {
            const characterNameSet = new Set(characters.map(c => utils.getFirstName(c.name)));
            const mergedCreatures = initialSummary.creatures.map(c => {
                if (c.type === 'player' && characterNameSet.has(c.name)) {
                    const character = characters.find(ch => utils.getFirstName(ch.name) === c.name);
                    return { ...c, imagePath: character?.imagePath || c.imagePath || '', ac: computeAcEstimate(character) };
                }
                return { ...c };
            });

            const npcCount = mergedCreatures.filter(c => c.type === 'npc').length;
            setNumOfNpc(npcCount);

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
            const creatures = setupCreatures();
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

    React.useEffect(() => {
        if (!combatSummary || characters.length === 0) return;
        let cancelled = false;
        (async () => {
            for (const creature of combatSummary.creatures) {
                if (creature.type !== 'player') continue;
                const character = characters.find(c => utils.getFirstName(c.name) === creature.name);
                if (character) {
                    const ac = await computePlayerAc(character);
                    if (cancelled) return;
                    creature.ac = ac;
                }
            }
            storage.set('combatSummary', combatSummary, campaignName);
            setCombatSummary(cloneDeep(combatSummary));
        })();
        return () => { cancelled = true; };
    }, [combatSummary == null]); // only run once when combatSummary is first set

    React.useEffect(() => {
        const handler = () => {
            const stored = localStorage.getItem('combatSummary');
            if (stored) {
                try {
                    const summary = JSON.parse(stored);
                    combatSummaryRef.current = summary;
                    setCombatSummary(summary);
                } catch (e) { /* ignore parse errors */ }
            }
        };
        window.addEventListener('initiative-rolled', handler);
        return () => window.removeEventListener('initiative-rolled', handler);
    }, []);

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
        // Look up monster data to update AC/resistances/immunities
        getMonsterData(value).then(monster => {
            if (monster) {
                combatSummary.creatures[idx].ac = monster.armor_class || 10;
                combatSummary.creatures[idx].resistances = monster.damage_resistances || [];
                combatSummary.creatures[idx].immunities = monster.damage_immunities || [];
                storage.set('combatSummary', combatSummary, campaignName);
                setCombatSummary(cloneDeep(combatSummary));
            }
        });
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
        setNpcImages(prev => ({ ...prev, [id]: null }));
    };
    const handleTargetChange = (id, targetId) => {
        if (!combatSummary) return;
        const idx = combatSummary.creatures.findIndex((creature) => creature.id === id);
        combatSummary.creatures[idx].targetId = targetId || null;
        const target = targetId ? combatSummary.creatures.find(c => c.id === targetId) : null;
        combatSummary.creatures[idx].targetName = target ? target.name : null;
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
    };
    const handleNpcClick = async (creature) => {
        if (!isLocalhost) return;
        const monster = await getMonsterData(creature.name);
        if (monster) {
            setViewingMonster(monster);
        }
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
                                    <NpcAvatar name={creature.name} imageUrl={npcImages[creature.id]} onClick={() => handleNpcClick(creature)} />
                                )}
                            </div>
                            <div className='creature-name'>
                              {creature.type === 'npc' ? (
                                      <MonsterNameAutocomplete
                                        value={creature.name}
                                        onChange={(newVal) => handleNameChange(creature.id, newVal)}
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
                            <div className='creature-target'>
                                <select
                                    value={creature.targetId || ''}
                                    onChange={(e) => handleTargetChange(creature.id, e.target.value)}
                                    disabled={creature.type === 'npc' && !isLocalhost}
                                >
                                    <option value="">— No Target —</option>
                                    {combatSummary.creatures
                                        .filter(c => c.id !== creature.id)
                                        .map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))
                                    }
                                </select>
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
            {viewingMonster && (
                <MonsterCardModal
                    monster={viewingMonster}
                    onClose={() => setViewingMonster(null)}
                    campaignName={campaignName}
                    creatures={combatSummary.creatures}
                />
            )}
        </div>
    )
}

export default Initiative
