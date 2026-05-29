
import React from 'react'
import { cloneDeep } from 'lodash';
import utils from '../../services/utils.js'
import storage from '../../services/storage.js'
import { getMonsterImageUrl, getMonsterData } from '../../services/monsterUtils.js';
import { rollD20 } from '../../services/diceRoller.js';
import { getAbilitySaveBonus, getAbilityLabel, getDefaultAbility, CONDITIONS } from '../../services/conditionUtils.js';
import { computeConditionEffects, CONDITIONS_THAT_CANNOT_ACT, CONDITIONS_THAT_SPEED_ZERO } from '../../services/conditionEffects.js';
import MonsterCardModal from '../encounter/MonsterCardModal.jsx';
import AvatarImage from '../common/AvatarImage.jsx';
import Subscriber from '../common/Subscriber.jsx';
import MonsterNameAutocomplete from '../common/MonsterNameAutocomplete.jsx';
import { computePlayerAc, computeAcEstimate } from '../../services/damageUtils.js';
import { loadNPCs } from '../../services/npcsService.js';
import { npcToMonsterFormat, npcHasStatBlock } from '../../services/npcStatBlockUtils.js';
import Popup from '../common/Popup.jsx';
import DiceRollResult from '../char-sheet/DiceRollResult.jsx';
import HiddenInput from '../common/HiddenInput.jsx';
import './initiative.css'

function NpcAvatar({ name, imageUrl, imagePath, onClick }) {
    const src = imagePath || imageUrl;
    if (src) {
        return (
            <div className="npc-avatar" onClick={onClick}>
                <AvatarImage name={name} imagePath={src} size={150} />
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

function HpBar({ current, max }) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    const color = pct > 50 ? '#2ecc71' : pct > 25 ? '#f1c40f' : '#e74c3c';
    return (
        <div className="hp-bar-container">
            <div className="hp-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
    );
}

function CreatureHp({ creature, isLocalhost, onChange }) {
    const { currentHp, maxHp, type } = creature;
    const isDead = currentHp <= 0;
    const isBloodied = currentHp > 0 && currentHp <= Math.floor(maxHp / 2);

    if (type === 'npc' && !isLocalhost) {
        return (
            <div className="creature-hp">
                <div className="hp-bar-row">
                    <HpBar current={currentHp} max={maxHp} />
                </div>
                <div className="hp-inline-row">
                    <span className="hp-status">
                        {isDead && <span className="status-badge dead">DEAD</span>}
                        {isBloodied && <span className="status-badge bloodied">BLOODIED</span>}
                        {!isDead && !isBloodied && <span className="status-badge healthy">OK</span>}
                    </span>
                </div>
            </div>
        );
    }

    if (type === 'npc' && isLocalhost) {
        return (
            <div className="creature-hp">
                <div className="hp-bar-row">
                    <HpBar current={currentHp} max={maxHp} />
                </div>
                <div className="hp-inline-row">
                    <span className="hp-label">HP</span>
                    <input
                        className="hp-inline-input"
                        type="number"
                        min="0"
                        value={currentHp}
                        onChange={(e) => onChange(creature.id, parseInt(e.target.value) || 0)}
                        aria-label={`${creature.name} current HP`}
                    />
                    <span className="hp-sep">/</span>
                    <input
                        className="hp-inline-input hp-max-input"
                        type="number"
                        min="1"
                        value={maxHp}
                        onChange={(e) => {
                            const newMax = parseInt(e.target.value) || 1;
                            creature.maxHp = newMax;
                            if (creature.currentHp > newMax) {
                                creature.currentHp = newMax;
                            }
                            onChange(creature.id, creature.currentHp);
                        }}
                        aria-label={`${creature.name} max HP`}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="creature-hp">
            <div className="hp-bar-row">
                <HpBar current={currentHp} max={maxHp} />
            </div>
            <div className="hp-inline-row">
                <span className="hp-label">HP</span>
                <input
                    className="hp-inline-input"
                    type="number"
                    min={0}
                    value={currentHp}
                    onChange={(e) => onChange(creature.id, parseInt(e.target.value) || 0)}
                    aria-label={`${creature.name} current HP`}
                />
                <span className="hp-sep">/</span>
                <span className="hp-max-val">{maxHp}</span>
            </div>
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

    const [conditionPickerTarget, setConditionPickerTarget] = React.useState(null);
    const [conditionPopup, setConditionPopup] = React.useState(null);
    const [conditionPickerDc, setConditionPickerDc] = React.useState(10);
    const [conditionPickerAbility, setConditionPickerAbility] = React.useState('con');
    const [conditionPickerSelected, setConditionPickerSelected] = React.useState(null);

    const [concentrationPickerTarget, setConcentrationPickerTarget] = React.useState(null);
    const [concentrationSpellName, setConcentrationSpellName] = React.useState('');
    const [concentrationDc, setConcentrationDc] = React.useState(10);

    const [campaignNpcs, setCampaignNpcs] = React.useState([]);

    const loadCreatureHp = React.useCallback((characterName, fallbackMaxHp) => {
        const stored = storage.getProperty(characterName, 'currentHitPoints', campaignName);
        if (stored != null) return stored;
        return fallbackMaxHp;
    }, [campaignName]);

    const loadCreatureMaxHp = React.useCallback((characterName, fallbackMaxHp) => {
        const stored = storage.getProperty(characterName, 'hitPoints', campaignName);
        if (stored != null) return stored;
        return fallbackMaxHp;
    }, [campaignName]);

    // Load campaign NPCs for stat block matching
    React.useEffect(() => {
        if (!campaignName) return;
        loadNPCs(campaignName).then(response => {
            const withStats = (response.npcs || []).filter(npcHasStatBlock);
            setCampaignNpcs(withStats);
        }).catch(() => {});
    }, [campaignName]);

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
        } else {
            const cs = combatSummaryRef.current;
            if (!cs) return;
            const charData = event.data;
            let changed = false;
            for (const creature of cs.creatures) {
                if (creature.type !== 'player') continue;
                if (creature.name !== dataKey) continue;
                if (charData.currentHitPoints != null && creature.currentHp !== charData.currentHitPoints) {
                    creature.currentHp = charData.currentHitPoints;
                    changed = true;
                }
                if (charData.hitPoints != null && creature.maxHp !== charData.hitPoints) {
                    creature.maxHp = charData.hitPoints;
                    changed = true;
                }
            }
            if (changed) {
                storage.set('combatSummary', cs, campaignName);
                setCombatSummary(cloneDeep(cs));
            }
        }
    }, [campaignName]);

    React.useEffect(() => {
        if (!combatSummary) return;
        const npcIds = combatSummary.creatures.filter(c => c.type === 'npc').map(c => c.id);
        const promises = npcIds.map(async (id) => {
            const creature = combatSummary.creatures.find(c => c.id === id);
            if (creature) {
                if (creature.imagePath) return { id, url: null };
                const url = await getMonsterImageUrl(creature.name, campaignNpcs);
                return { id, url };
            }
            return { id, url: null };
        });
        Promise.all(promises).then(results => {
            const newImages = {};
            results.forEach(({ id, url }) => { newImages[id] = url; });
            setNpcImages(newImages);
        });
    }, [combatSummary, campaignNpcs]);

    const setupCreatures = React.useCallback(() => {
        const creatureList = characters.map((character) => {
            const maxHp = character.hitPoints || 0;
            const finalMaxHp = loadCreatureMaxHp(utils.getFirstName(character.name), maxHp);
            const finalCurrentHp = loadCreatureHp(utils.getFirstName(character.name), maxHp);
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
                immunities: character.immunities || [],
                conditions: [],
                concentration: null,
                maxHp: loadCreatureMaxHp(utils.getFirstName(character.name), maxHp),
                currentHp: loadCreatureHp(utils.getFirstName(character.name), maxHp),
            };
        });
        creatureList.sort((a, b) => a.name.localeCompare(b.name));
        for (let i = 0; i < numOfNpc; i++) {
            creatureList.push({ id: utils.guid(), name: `NPC ${i + 1}`, type: 'npc', initiative: '', targetId: null, targetName: null, ac: 10, resistances: [], immunities: [], conditions: [], concentration: null, maxHp: 10, currentHp: 10 });
        }
        return creatureList;
    }, [characters, numOfNpc, loadCreatureHp, loadCreatureMaxHp]);

    const handleAddNpc = React.useCallback(() => {
        if (!combatSummary) return;
        const maxNpcNum = combatSummary.creatures
            .filter(c => c.type === 'npc')
            .reduce((max, c) => {
                const match = c.name.match(/^NPC (\d+)$/);
                return match ? Math.max(max, parseInt(match[1])) : max;
            }, 0);
        const nextNum = maxNpcNum + 1;
        combatSummary.creatures.push({ id: utils.guid(), name: `NPC ${nextNum}`, type: 'npc', initiative: '', targetId: null, targetName: null, ac: 10, resistances: [], immunities: [], conditions: [], concentration: null, maxHp: 10, currentHp: 10 });
        setNumOfNpc(nextNum);
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
    }, [combatSummary, campaignName]);

    const handleRemoveNpc = React.useCallback((creatureId) => {
        if (!combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.id === creatureId);
        if (!creature || creature.type !== 'npc') return;

        const needsConfirmation = creature.currentHp > 0 || creature.initiative !== '';
        if (needsConfirmation) {
            const msg = creature.currentHp > 0
                ? `${creature.name} has ${creature.currentHp} HP. Remove anyway?`
                : `${creature.name} has initiative assigned. Remove anyway?`;
            if (!window.confirm(msg)) return;
        }

        combatSummary.creatures = combatSummary.creatures.filter(c => c.id !== creatureId);
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
    }, [combatSummary, campaignName]);

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
                    const maxHp = loadCreatureMaxHp(c.name, character?.hitPoints || c.maxHp || 0);
                    return { ...c, conditions: c.conditions || [], concentration: c.concentration ?? null, imagePath: character?.imagePath || c.imagePath || '', ac: computeAcEstimate(character), currentHp: loadCreatureHp(c.name, maxHp), maxHp };
                }
                return { ...c, conditions: c.conditions || [], concentration: c.concentration ?? null, currentHp: c.currentHp ?? c.maxHp ?? 10, maxHp: c.maxHp ?? 10 };
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
    }, [characters, campaignName, setupCreatures, loadCreatureHp, loadCreatureMaxHp]);

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
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [combatSummary, activeCreatureId, handleAddCombatRound, handleAddNpc, handleNextCreature, handlePreviousCreature, handleRemoveCombatRound]);

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
    }, [combatSummary == null]);

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

    const handleCreatureHpChange = React.useCallback((creatureId, newValue) => {
        if (!combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.id === creatureId);
        if (!creature) return;
        creature.currentHp = newValue;
        if (creature.type === 'player') {
            storage.setProperty(creature.name, 'currentHitPoints', newValue, campaignName);
        }
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
    }, [combatSummary, campaignName]);

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
        getMonsterData(value, campaignNpcs).then(monster => {
            if (monster) {
                combatSummary.creatures[idx].ac = monster.armor_class || 10;
                combatSummary.creatures[idx].resistances = monster.damage_resistances || [];
                combatSummary.creatures[idx].immunities = monster.damage_immunities || [];
                combatSummary.creatures[idx].initiativeBonus = monster.initiative_details ? parseInt(monster.initiative_details) || 0 : 0;
                combatSummary.creatures[idx].maxHp = monster.hit_points || 10;
                combatSummary.creatures[idx].currentHp = monster.hit_points || 10;
                const matchedNpc = campaignNpcs.find(n => n.name?.toLowerCase() === value.toLowerCase());
                if (matchedNpc?.imagePath) {
                    combatSummary.creatures[idx].imagePath = matchedNpc.imagePath;
                }
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
    const handleRollNpcInitiative = (creatureId) => {
        if (!combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.id === creatureId);
        if (!creature || creature.type !== 'npc') return;
        const bonus = creature.initiativeBonus || 0;
        const roll = rollD20();
        const total = roll + bonus;
        creature.initiative = String(total);
        combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));

        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'roll',
                characterName: creature.name,
                rollType: 'initiative',
                name: 'Initiative',
                rolls: [roll],
                total: roll,
                bonus,
                mode: 'normal',
                isNatural20: roll === 20,
                isNatural1: roll === 1,
                timestamp: Date.now(),
                id: utils.guid(),
            })
        }).catch(() => {});
    };

    const handleNpcClick = async (creature) => {
        if (!isLocalhost) return;
        const npc = campaignNpcs.find(n => n.name?.toLowerCase() === creature.name?.toLowerCase());
        if (npc) {
            const formatted = npcToMonsterFormat(npc);
            if (formatted) {
                setViewingMonster(formatted);
                return;
            }
        }
        const monster = await getMonsterData(creature.name);
        if (monster) {
            setViewingMonster(monster);
        }
    };

    const openConditionPicker = (creature) => {
        if (!isLocalhost) return;
        setConditionPickerTarget(creature);
        setConditionPickerDc(10);
        setConditionPickerAbility('con');
        setConditionPickerSelected(null);
    };

    const handleApplyCondition = () => {
        if (!conditionPickerTarget || !conditionPickerSelected || !combatSummary) return;
        const conditionDef = CONDITIONS.find(c => c.key === conditionPickerSelected);
        if (!conditionDef) return;
        const creature = combatSummary.creatures.find(c => c.id === conditionPickerTarget.id);
        if (!creature) return;
        creature.conditions = creature.conditions.filter(c => c.key !== conditionDef.key);
        creature.conditions.push({
            id: utils.guid(),
            key: conditionDef.key,
            label: conditionDef.label,
            dc: conditionPickerDc,
            ability: conditionPickerAbility,
        });
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
        setConditionPickerTarget(null);
        setConditionPickerSelected(null);

        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'condition',
                action: 'applied',
                characterName: creature.name,
                condition: conditionDef.label,
                dc: conditionPickerDc,
                ability: conditionPickerAbility,
                timestamp: Date.now(),
                id: utils.guid(),
            })
        }).catch(() => {});
    };

    const handleRollConditionSave = async (creatureId, condition) => {
        if (!combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.id === creatureId);
        if (!creature) return;

        let saveBonus = 0;
        if (creature.type === 'player') {
            const character = characters.find(c => utils.getFirstName(c.name) === creature.name);
            saveBonus = getAbilitySaveBonus(character, condition.ability);
        } else {
            try {
                const monster = await getMonsterData(creature.name);
                if (monster?.saving_throws?.[condition.ability]) {
                    saveBonus = monster.saving_throws[condition.ability].modifier;
                } else if (monster?.ability_score_modifiers?.[condition.ability]) {
                    saveBonus = monster.ability_score_modifiers[condition.ability];
                }
            } catch { /* ignore */ }
        }

        const r1 = rollD20();
        const total = r1 + saveBonus;
        const success = total >= condition.dc;

        if (success) {
            creature.conditions = creature.conditions.filter(c => c.id !== condition.id);
        }

        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));

        setConditionPopup({
            type: 'd20',
            rollType: 'condition-save',
            name: getAbilityLabel(condition.ability),
            rolls: [r1],
            bonus: saveBonus,
            targetName: null,
            targetAc: null,
            hit: undefined,
            condition: condition.label,
            dc: condition.dc,
            success,
        });

        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'roll',
                rollType: 'condition-save',
                characterName: creature.name,
                name: getAbilityLabel(condition.ability),
                rolls: [r1],
                mode: 'normal',
                total: r1,
                bonus: saveBonus,
                condition: condition.label,
                dc: condition.dc,
                success,
                timestamp: Date.now(),
                id: utils.guid(),
            })
        }).catch(() => {});
    };

    const openConcentrationPicker = (creature) => {
        if (!isLocalhost) return;
        setConcentrationPickerTarget(creature);
        setConcentrationSpellName('');
        setConcentrationDc(10);
    };

    const handleApplyConcentration = () => {
        if (!concentrationPickerTarget || !concentrationSpellName.trim() || !combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.id === concentrationPickerTarget.id);
        if (!creature) return;
        creature.concentration = {
            id: utils.guid(),
            spell: concentrationSpellName.trim(),
            dc: concentrationDc,
        };
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
        setConcentrationPickerTarget(null);
        setConcentrationSpellName('');
        setConcentrationDc(10);

        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'condition',
                action: 'concentration-started',
                characterName: creature.name,
                condition: `Concentration: ${creature.concentration.spell}`,
                dc: concentrationDc,
                ability: 'con',
                timestamp: Date.now(),
                id: utils.guid(),
            })
        }).catch(() => {});
    };

    const handleRollConcentrationSave = async (creatureId) => {
        if (!combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.id === creatureId);
        if (!creature || !creature.concentration) return;

        const concentration = creature.concentration;

        let saveBonus = 0;
        if (creature.type === 'player') {
            const character = characters.find(c => utils.getFirstName(c.name) === creature.name);
            saveBonus = getAbilitySaveBonus(character, 'con');
        } else {
            try {
                const monster = await getMonsterData(creature.name);
                if (monster?.saving_throws?.con) {
                    saveBonus = monster.saving_throws.con.modifier;
                } else if (monster?.ability_score_modifiers?.con) {
                    saveBonus = monster.ability_score_modifiers.con;
                }
            } catch { /* ignore */ }
        }

        const r1 = rollD20();
        const total = r1 + saveBonus;
        const success = total >= concentration.dc;

        if (!success) {
            creature.concentration = null;
        }

        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));

        setConditionPopup({
            type: 'd20',
            rollType: 'condition-save',
            name: 'Concentration',
            rolls: [r1],
            bonus: saveBonus,
            targetName: null,
            targetAc: null,
            hit: undefined,
            condition: concentration.spell,
            dc: concentration.dc,
            success,
        });

        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'roll',
                rollType: 'concentration-save',
                characterName: creature.name,
                name: 'Constitution',
                rolls: [r1],
                mode: 'normal',
                total: r1,
                bonus: saveBonus,
                condition: `Concentration: ${concentration.spell}`,
                dc: concentration.dc,
                success,
                timestamp: Date.now(),
                id: utils.guid(),
            })
        }).catch(() => {});
    };

    const handleBreakConcentration = (creatureId) => {
        if (!combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.id === creatureId);
        if (!creature || !creature.concentration) return;
        const spell = creature.concentration.spell;
        creature.concentration = null;
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));

        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'condition',
                action: 'concentration-broken',
                characterName: creature.name,
                condition: `Concentration: ${spell}`,
                timestamp: Date.now(),
                id: utils.guid(),
            })
        }).catch(() => {});
    };

    const handleAutoBreakCondition = (creatureId, condition) => {
        if (!isLocalhost || !combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.id === creatureId);
        if (!creature) return;
        creature.conditions = creature.conditions.filter(c => c.id !== condition.id);
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));

        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'condition',
                action: 'broken',
                characterName: creature.name,
                condition: condition.label,
                timestamp: Date.now(),
                id: utils.guid(),
            })
        }).catch(() => {});
    };

    if (!combatSummary) return null;
    return (
        <div className='initiative'>
            <Subscriber campaignName={campaignName} handleEvent={handleEvent} />
            <h4>Initiative (round {combatSummary.round})</h4>
            <div className='carousel-container' ref={carouselRef}>
                {combatSummary?.creatures?.map((creature) => {
                    const isActive = creature.id === activeCreatureId;
                    const isUnconscious = creature.currentHp <= 0;
                    return (
                        <div key={creature.id} className={`creature-card ${creature.type} ${isActive ? 'active' : ''} ${isUnconscious ? 'creature-unconscious' : ''}`}>
                            {creature.type === 'npc' && isLocalhost && (
                                <button
                                    className="npc-remove-btn"
                                    onClick={() => handleRemoveNpc(creature.id)}
                                    type="button"
                                    title="Remove NPC"
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            )}
                            <div className='creature-avatar'>
                                {creature.type === 'player' ? (
                                    <AvatarImage name={creature.name} imagePath={creature.imagePath} size={150} />
                                ) : (
                                    <NpcAvatar name={creature.name} imageUrl={npcImages[creature.id]} imagePath={creature.imagePath} onClick={() => handleNpcClick(creature)} />
                                )}
                            </div>
                            <div className='creature-name'>
                              {creature.type === 'npc' ? (
                                      <MonsterNameAutocomplete
                                        value={creature.name}
                                        onChange={(newVal) => handleNameChange(creature.id, newVal)}
                                        npcs={campaignNpcs}
                                        showBadge={campaignNpcs.some(n => n.name?.toLowerCase() === creature.name?.toLowerCase())}
                                       />
                                  ) : (
                                    <span>{creature.name}</span>
                                )}
                            </div>
                            <CreatureHp
                                creature={creature}
                                isLocalhost={isLocalhost}
                                onChange={handleCreatureHpChange}
                            />
                            <div className='creature-initiative'>Initiative&nbsp;
                                {creature.type === 'npc' && creature.initiativeBonus != null && creature.initiativeBonus !== '' && creature.initiativeBonus !== 0 ? (
                                    <span
                                        className="initiative-roll-link"
                                        onClick={() => handleRollNpcInitiative(creature.id)}
                                        role="button"
                                        tabIndex={0}
                                        title={`Roll initiative (d20 + ${creature.initiativeBonus})`}
                                    >
                                        {creature.initiative || <i className="fa-solid fa-dice-d20" />}
                                    </span>
                                ) : (
                                    <input
                                        min="0"
                                        onChange={(event) => handleInitiativeChange(creature.id, event.target.value)}
                                        type="number"
                                        value={creature.initiative}
                                        placeholder="Init"
                                    />
                                )}
                            </div>
                            <div className='creature-target'>Target&nbsp;
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
                            <div className='creature-conditions'>
                                {creature.conditions?.map(cond => {
                                    const canRoll = creature.type === 'player' || isLocalhost;
                                    return (
                                        <div key={cond.id} className='condition-badge-wrapper'>
                                            <button
                                                className='condition-badge initiative-condition-badge'
                                                onClick={() => canRoll && handleRollConditionSave(creature.id, cond)}
                                                disabled={!canRoll}
                                                type='button'
                                                title={`${cond.label} (DC ${cond.dc} ${getAbilityLabel(cond.ability)})`}
                                            >
                                                {cond.label} DC {cond.dc}
                                            </button>
                                            {isLocalhost && (
                                                <button
                                                    className='condition-break-btn'
                                                    onClick={() => handleAutoBreakCondition(creature.id, cond)}
                                                    type='button'
                                                    title='Automatically break condition'
                                                >
                                                    <i className='fa-solid fa-xmark'></i>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                {(() => {
                                    const condKeys = (creature.conditions || []).map(c => c.key);
                                    const effects = computeConditionEffects(condKeys);
                                    const badges = [];
                                    if (effects.cannotAct) badges.push({ label: 'Can\'t Act', cls: 'effect-cannot-act', icon: 'fa-hand' });
                                    if (effects.speedZero) badges.push({ label: 'Speed 0', cls: 'effect-speed-zero', icon: 'fa-stop' });
                                    if (effects.autoCritWithin5ft) badges.push({ label: 'Auto-Crit', cls: 'effect-auto-crit', icon: 'fa-bolt' });
                                    if (effects.concentrationBroken) badges.push({ label: 'No Conc.', cls: 'effect-no-conc', icon: 'fa-spinner' });
                                    if (effects.autoFailSaves.length > 0) badges.push({ label: `Auto-Fail ${effects.autoFailSaves.join('/').toUpperCase()}`, cls: 'effect-auto-fail', icon: 'fa-shield' });
                                    if (effects.resistantToAll) badges.push({ label: 'Resist All', cls: 'effect-resist', icon: 'fa-shield-halved' });
                                    if (effects.attackDisadvantageCount > 0 || effects.abilityCheckDisadvantage) badges.push({ label: 'Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down' });
                                    if (effects.targetAdvantageCount > 0) badges.push({ label: 'Adv vs', cls: 'effect-target-adv', icon: 'fa-arrow-up' });
                                    return badges.map(b => (
                                        <div key={b.label} className={`condition-effect-badge ${b.cls}`} title={b.label}>
                                            <i className={`fa-solid ${b.icon}`}></i> {b.label}
                                        </div>
                                    ));
                                })()}
                                {isLocalhost && (
                                    <button
                                        className='condition-add-btn'
                                        onClick={() => openConditionPicker(creature)}
                                        type='button'
                                        title='Add condition'
                                    >
                                        <i className='fa-solid fa-plus'></i>
                                    </button>
                                )}
                                {creature.concentration ? (
                                    <div className='concentration-badge-wrapper'>
                                        <button
                                            className='initiative-concentration-badge'
                                            onClick={() => handleRollConcentrationSave(creature.id)}
                                            type='button'
                                            title={`Concentration: ${creature.concentration.spell} (DC ${creature.concentration.dc} Constitution)`}
                                        >
                                            <i className='fa-solid fa-spinner'></i> {creature.concentration.spell} DC {creature.concentration.dc}
                                        </button>
                                        <button
                                            className='concentration-break-btn'
                                            onClick={() => handleBreakConcentration(creature.id)}
                                            type='button'
                                            title='Break concentration'
                                        >
                                            <i className='fa-solid fa-xmark'></i>
                                        </button>
                                    </div>
                                ) : isLocalhost ? (
                                    <button
                                        className='concentration-add-btn'
                                        onClick={() => openConcentrationPicker(creature)}
                                        type='button'
                                        title='Add concentration'
                                    >
                                        <i className='fa-solid fa-spinner'></i>
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className='combat-controls'>
                <button className='clear-button' onClick={handleClear}>Clear</button>
                <button onClick={handleAddNpc}>+ NPC</button>
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
            {conditionPickerTarget && (
                <div className='condition-picker-overlay' onClick={() => setConditionPickerTarget(null)}>
                    <div className='condition-picker-modal' onClick={e => e.stopPropagation()}>
                        <h3>Add Condition to {conditionPickerTarget.name}</h3>
                        <div className='condition-picker-grid'>
                            {CONDITIONS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    className={`condition-badge condition-picker-badge ${conditionPickerSelected === key ? 'condition-picker-badge--selected' : ''}`}
                                    onClick={() => {
                                        setConditionPickerSelected(key);
                                        setConditionPickerAbility(getDefaultAbility(key) || 'str');
                                    }}
                                    type='button'
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className='condition-picker-fields'>
                            <label>
                                DC
                                <input
                                    type='number'
                                    min='1'
                                    value={conditionPickerDc}
                                    onChange={e => setConditionPickerDc(parseInt(e.target.value) || 10)}
                                />
                            </label>
                            <label>
                                Save
                                <select
                                    value={conditionPickerAbility}
                                    onChange={e => setConditionPickerAbility(e.target.value)}
                                >
                                    <option value='str'>Strength</option>
                                    <option value='dex'>Dexterity</option>
                                    <option value='con'>Constitution</option>
                                    <option value='int'>Intelligence</option>
                                    <option value='wis'>Wisdom</option>
                                    <option value='cha'>Charisma</option>
                                </select>
                            </label>
                        </div>
                        <div className='condition-picker-actions'>
                            <button onClick={() => setConditionPickerTarget(null)} type='button'>Cancel</button>
                            <button onClick={handleApplyCondition} disabled={!conditionPickerSelected} type='button'>Apply</button>
                        </div>
                    </div>
                </div>
            )}
            {concentrationPickerTarget && (
                <div className='condition-picker-overlay' onClick={() => setConcentrationPickerTarget(null)}>
                    <div className='condition-picker-modal' onClick={e => e.stopPropagation()}>
                        <h3>Concentration for {concentrationPickerTarget.name}</h3>
                        <div className='condition-picker-fields'>
                            <label>
                                Spell
                                <input
                                    type='text'
                                    value={concentrationSpellName}
                                    onChange={e => setConcentrationSpellName(e.target.value)}
                                    placeholder='Spell name'
                                    autoFocus
                                />
                            </label>
                            <label>
                                DC
                                <input
                                    type='number'
                                    min='1'
                                    value={concentrationDc}
                                    onChange={e => setConcentrationDc(parseInt(e.target.value) || 10)}
                                />
                            </label>
                        </div>
                        <div className='condition-picker-actions'>
                            <button onClick={() => setConcentrationPickerTarget(null)} type='button'>Cancel</button>
                            <button onClick={handleApplyConcentration} disabled={!concentrationSpellName.trim()} type='button'>Apply</button>
                        </div>
                    </div>
                </div>
            )}
            {conditionPopup && (
                <Popup onClickOrKeyDown={() => setConditionPopup(null)}>
                    <DiceRollResult
                        name={conditionPopup.condition ? `${conditionPopup.condition} — ${conditionPopup.name}` : conditionPopup.name}
                        type={conditionPopup.type}
                        rolls={conditionPopup.rolls}
                        bonus={conditionPopup.bonus}
                        targetName={conditionPopup.targetName}
                        targetAc={conditionPopup.targetAc}
                        hit={conditionPopup.hit}
                    >
                    </DiceRollResult>
                    <div className={`condition-save-result ${conditionPopup.success ? 'condition-save-success' : 'condition-save-failure'}`}>
                        {conditionPopup.success ? 'SAVE SUCCESSFUL' : 'SAVE FAILED'} (DC {conditionPopup.dc})
                    </div>
                </Popup>
            )}
        </div>
    )
}

export default Initiative
