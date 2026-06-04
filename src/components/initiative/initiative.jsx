
import React from 'react'
import { cloneDeep } from 'lodash';
import utils from '../../services/utils.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import storage from '../../services/storage.js'
import { clearDeathSavePrompt } from '../../services/savePromptService.js'
import { getMonsterImageUrl, getMonsterData } from '../../services/monsterUtils.js';
import { rollD20 } from '../../services/diceRoller.js';
import * as concentrationRules from '../../services/concentrationRules.js';
import { computeAuraBonus } from '../../services/auraOfProtection.js';
import { getAbilitySaveBonus, getAbilityLabel, getDefaultAbility, CONDITIONS } from '../../services/conditionUtils.js';
import { computeConditionEffects } from '../../services/conditionEffects.js';
import MonsterCardModal from '../encounter/MonsterCardModal.jsx';
import AvatarImage from '../common/AvatarImage.jsx';
import Subscriber from '../common/Subscriber.jsx';
import MonsterNameAutocomplete from '../common/MonsterNameAutocomplete.jsx';
import { loadNPCs } from '../../services/npcsService.js';
import { npcToMonsterFormat, npcHasStatBlock } from '../../services/npcStatBlockUtils.js';
import Popup from '../common/Popup.jsx';
import DiceRollResult from '../char-sheet/DiceRollResult.jsx';
import * as mapsService from '../../services/mapsService.js';
import { OverlayShape } from '../../models/SpellOverlay.js';
import { expireStaleEffects } from '../../services/turnExpirations.js';
import { loadCombatSummary, getCombatSummary, getActiveCreatureName } from '../../services/combatData.js';
import './initiative.css'

const SHAPE_LABELS = {
    [OverlayShape.SPHERE]: 'Sphere',
    [OverlayShape.CYLINDER]: 'Cylinder',
    [OverlayShape.CUBE]: 'Cube',
    [OverlayShape.CONE]: 'Cone',
    [OverlayShape.LINE]: 'Line',
};

function getOverlayStorageKey(campaignName, mapName) {
    return `spellOverlays-${campaignName}-${mapName}`;
}

function loadOverlays(campaignName, mapName) {
    try {
        const stored = localStorage.getItem(getOverlayStorageKey(campaignName, mapName));
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

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
    const { currentHp: rawCurrentHp, maxHp: rawMaxHp, type } = creature;
    const currentHp = rawCurrentHp ?? 0;
    const maxHp = rawMaxHp ?? 1;
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
                        onChange={(e) => onChange(creature.name, parseInt(e.target.value) || 0)}
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
                            onChange(creature.name, creature.currentHp);
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
                    onChange={(e) => onChange(creature.name, parseInt(e.target.value) || 0)}
                    aria-label={`${creature.name} current HP`}
                />
                <span className="hp-sep">/</span>
                <span className="hp-max-val">{maxHp}</span>
            </div>
        </div>
    );
}

function Initiative({ characters, campaignName, onNpcsChange, isLocalhost, mapName }) {
    const [combatSummary, setCombatSummary] = React.useState(null);
    const [numOfNpc, setNumOfNpc] = React.useState(4);
    const [activeCreatureName, setActiveCreatureName] = React.useState(null);
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

    const [mapData, setMapData] = React.useState(null);
    const [overlays, setOverlays] = React.useState([]);

    const displayCreatures = React.useMemo(() => {
        if (!combatSummary) return [];
        return combatSummary.creatures.map(c => {
            if (c.type !== 'player') return c;
            const character = characters.find(ch => utils.getName(ch.name) === c.name);
            const stats = character?.computedStats || character;
            const maxHp = getRuntimeValue(c.name, 'hitPoints') ?? stats?.hitPoints ?? 0;
            const currentHp = getRuntimeValue(c.name, 'currentHitPoints') ?? maxHp;
            const runtimeConditions = getRuntimeValue(c.name, 'activeConditions') || [];
            const conditions = runtimeConditions.map((key, i) => ({
                id: `runtime-${key}-${i}`,
                key,
                label: key.charAt(0).toUpperCase() + key.slice(1),
                dc: 0,
                ability: 'con',
            }));
            return {
                ...c,
                imagePath: character?.imagePath || '',
                ac: stats?.armorClass ?? 10,
                resistances: stats?.resistances || [],
                immunities: stats?.immunities || [],
                currentHp,
                maxHp,
                conditions,
            };
        });
    }, [combatSummary, characters]);

    React.useEffect(() => {
        if (!combatSummary || !mapName) {
            setMapData(null);
            setOverlays([]);
            return;
        }
        setOverlays(loadOverlays(campaignName, mapName));
        mapsService.loadMapData(campaignName, mapName).then(data => {
            setMapData(data);
        }).catch(() => {
            setMapData(null);
        });
    }, [combatSummary, campaignName, mapName]);

    // Load campaign NPCs for stat block matching
    React.useEffect(() => {
        if (!campaignName) return;
        loadNPCs(campaignName).then(response => {
            const withStats = (response.npcs || []).filter(npcHasStatBlock);
            setCampaignNpcs(withStats);
        }).catch(() => {});
    }, [campaignName]);

    const handleOverlayEvent = React.useCallback((event) => {
        if (!event || !event.key || !event.key.startsWith('spell-overlay-')) return;
        if (event.key !== `spell-overlay-${campaignName}`) return;
        const { action, overlays: newOverlays, overlayId } = event.data || {};
        switch (action) {
            case 'add':
                if (newOverlays?.length) {
                    setOverlays(prev => {
                        const existingIds = new Set(prev.map(o => o.id));
                        const unique = newOverlays.filter(n => !existingIds.has(n.id));
                        return unique.length ? [...prev, ...unique] : prev;
                    });
                }
                break;
            case 'update':
                if (newOverlays?.length) {
                    setOverlays(prev => prev.map(o => {
                        const replacement = newOverlays.find(n => n.id === o.id);
                        return replacement || o;
                    }));
                }
                break;
            case 'remove':
                if (overlayId) {
                    setOverlays(prev => prev.filter(o => o.id !== overlayId));
                }
                break;
            case 'clear':
                setOverlays([]);
                break;
            default:
                break;
        }
    }, [campaignName]);

    const handleEvent = React.useCallback((event) => {
        if (event.key == null || event.data == null) return;

        // Handle spell overlay events
        if (event.key.startsWith('spell-overlay-')) {
            handleOverlayEvent(event);
            return;
        }

        if (!event.key.startsWith(`change-${campaignName}-`)) return;

        const dataKey = event.key.slice(`change-${campaignName}-`.length);

         if (dataKey === 'combatSummary') {
            const prevRound = combatSummaryRef.current?.round ?? 1;
             combatSummaryRef.current = event.data;
            setCombatSummary(event.data);
             if (event.data.round !== prevRound) expireStaleEffects(campaignName);
            } else if (dataKey === 'activeCreatureName') {
            setActiveCreatureName(event.data);
            expireStaleEffects(campaignName);
        } else {
            const cs = combatSummaryRef.current;
            if (!cs) return;
            setCombatSummary(cloneDeep(cs));
        }
    }, [campaignName, handleOverlayEvent]);

    React.useEffect(() => {
        if (!combatSummary) return;
        const npcs = combatSummary.creatures.filter(c => c.type === 'npc');
        const promises = npcs.map(async (creature) => {
            if (creature.imagePath) return { name: creature.name, url: null };
            const url = await getMonsterImageUrl(creature.name, campaignNpcs);
            return { name: creature.name, url };
        });
        Promise.all(promises).then(results => {
            const newImages = {};
            results.forEach(({ name, url }) => { newImages[name] = url; });
            setNpcImages(newImages);
        });
    }, [combatSummary, campaignNpcs]);

    const setupCreatures = React.useCallback(() => {
        const creatureList = characters.map((character) => {
            return {
                name: utils.getName(character.name),
                type: 'player',
                initiative: '',
                targetName: null,
                concentration: null,
            };
        });
        creatureList.sort((a, b) => a.name.localeCompare(b.name));
        for (let i = 0; i < numOfNpc; i++) {
            creatureList.push({ name: `NPC ${i + 1}`, type: 'npc', initiative: '', targetName: null, ac: 10, resistances: [], immunities: [], conditions: [], concentration: null, maxHp: 10, currentHp: 10, saveBonuses: {} });
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
        combatSummary.creatures.push({ name: `NPC ${nextNum}`, type: 'npc', initiative: '', targetName: null, ac: 10, resistances: [], immunities: [], conditions: [], concentration: null, maxHp: 10, currentHp: 10, saveBonuses: {} });
        setNumOfNpc(nextNum);
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
    }, [combatSummary, campaignName]);

    const handleRemoveNpc = React.useCallback((creatureName) => {
        if (!combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.name === creatureName);
        if (!creature || creature.type !== 'npc') return;

        const needsConfirmation = creature.currentHp > 0 || creature.initiative !== '';
        if (needsConfirmation) {
            const msg = creature.currentHp > 0
                ? `${creature.name} has ${creature.currentHp} HP. Remove anyway?`
                : `${creature.name} has initiative assigned. Remove anyway?`;
            if (!window.confirm(msg)) return;
        }

        combatSummary.creatures = combatSummary.creatures.filter(c => c.name !== creatureName);
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
    }, [combatSummary, campaignName]);

    const isPrevDisabled = !!(combatSummary && activeCreatureName === combatSummary.creatures[0]?.name && combatSummary.round === 1);

     const handleNextCreature = React.useCallback(() => {
         const cs = combatSummaryRef.current;
         if (!cs) return;
        const currentIndex = cs.creatures.findIndex((creature) => creature.name === activeCreatureName);
        const isLast = currentIndex >= cs.creatures.length - 1;
         if (!isLast) {
             const nextName = cs.creatures[currentIndex + 1].name;
            storage.set('activeCreatureName', nextName, campaignName);
            setActiveCreatureName(nextName);
           } else {
             cs.round++;
             const firstName = cs.creatures[0].name;
            storage.set('combatSummary', cs, campaignName);
            setCombatSummary(cloneDeep(cs));
            storage.set('activeCreatureName', firstName, campaignName);
             setActiveCreatureName(firstName);
           }
         expireStaleEffects(campaignName);
        }, [activeCreatureName, campaignName]);

    const handlePreviousCreature = React.useCallback(() => {
          if (isPrevDisabled) return;
         const cs = combatSummaryRef.current;
         if (!cs) return;
          const currentIndex = cs.creatures.findIndex((creature) => creature.name === activeCreatureName);
         if (currentIndex > 0) {
            const prevName = cs.creatures[currentIndex - 1].name;
             storage.set('activeCreatureName', prevName, campaignName);
            setActiveCreatureName(prevName);
           } else {
             if (cs.round > 1) {
                 cs.round--;
                storage.set('combatSummary', cs, campaignName);
                setCombatSummary(cloneDeep(cs));
               }
             const lastName = cs.creatures[cs.creatures.length - 1].name;
            storage.set('activeCreatureName', lastName, campaignName);
            setActiveCreatureName(lastName);
          }
         expireStaleEffects(campaignName);
        }, [activeCreatureName, campaignName, isPrevDisabled]);

     React.useEffect(() => {
        let cancelled = false;
        (async () => {
            const remote = await loadCombatSummary(campaignName);
            const stored = remote || getCombatSummary();
            let initialSummary = stored || null;

            if (initialSummary) {
                const characterNameSet = new Set(characters.map(c => utils.getName(c.name)));
                const mergedCreatures = initialSummary.creatures.map(c => {
                    if (c.type === 'player' && characterNameSet.has(c.name)) {
                        return { ...c, initiative: c.initiative ?? '', targetName: c.targetName ?? null, concentration: c.concentration ?? null };
                    }
                    return { ...c, conditions: c.conditions || [], concentration: c.concentration ?? null, currentHp: c.currentHp ?? c.maxHp ?? 10, maxHp: c.maxHp ?? 10, saveBonuses: c.saveBonuses || {} };
                });

                if (cancelled) return;
                const npcCount = mergedCreatures.filter(c => c.type === 'npc').length;
                setNumOfNpc(npcCount);

                const summary = { round: initialSummary.round, creatures: mergedCreatures };
                setCombatSummary(summary);
                combatSummaryRef.current = summary;

                const activeName = getActiveCreatureName();
                if (activeName) {
                    setActiveCreatureName(activeName);
                } else {
                    setActiveCreatureName(mergedCreatures[0]?.name || null);
                }
            } else {
                if (cancelled) return;
                const creatures = setupCreatures();
                const newSummary = { round: 1, creatures };
                storage.set('combatSummary', newSummary, campaignName);
                setCombatSummary(newSummary);
                combatSummaryRef.current = newSummary;
                const firstName = creatures[0]?.name;
                storage.set('activeCreatureName', firstName, campaignName);
                setActiveCreatureName(firstName);
            }
        })();
        return () => { cancelled = true; };
    }, [characters, campaignName]); // eslint-disable-line react-hooks/exhaustive-deps

    React.useEffect(() => {
        if (!combatSummary || !onNpcsChange) return;
        const npcList = combatSummary.creatures
            .filter(c => c.type === 'npc')
            .map(c => ({ name: c.name, type: 'npc', imageUrl: npcImages[c.name] || null }));
        onNpcsChange(npcList);
    }, [combatSummary, onNpcsChange, npcImages]);

    React.useEffect(() => {
        if (!combatSummary) return;
        const handleKeyDown = (event) => {
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                handleNextCreature();
              } else if (event.key === 'ArrowLeft' && !isPrevDisabled) {
                event.preventDefault();
                handlePreviousCreature();
              } else if (event.key === '+') {
                event.preventDefault();
                handleAddNpc();
              }
          };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
         }, [combatSummary, activeCreatureName, isPrevDisabled, handleAddNpc, handleNextCreature, handlePreviousCreature]);

    React.useEffect(() => {
        if (!carouselRef.current || !activeCreatureName) return;
        const activeCard = carouselRef.current.querySelector('.creature-card.active');
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, [activeCreatureName]);

    React.useEffect(() => {
        const handler = () => {
            const summary = getCombatSummary();
            if (summary) {
                combatSummaryRef.current = summary;
                setCombatSummary(summary);
              }
          };
        window.addEventListener('initiative-rolled', handler);
        window.addEventListener('combat-summary-updated', handler);
        return () => {
            window.removeEventListener('initiative-rolled', handler);
            window.removeEventListener('combat-summary-updated', handler);
          };
      }, []);

    React.useEffect(() => {
        const handler = (e) => {
            if (!combatSummary) return;
            const creature = combatSummary.creatures.find(c =>
                c.name === e.detail.targetName || c.name.startsWith(e.detail.targetName + ' ')
            );
            if (creature && !e.detail.success) {
                creature.concentration = null;
                storage.set('combatSummary', combatSummary, campaignName);
                setCombatSummary(cloneDeep(combatSummary));
            }
        };
        window.addEventListener('concentration-result', handler);
        return () => window.removeEventListener('concentration-result', handler);
    }, [combatSummary, campaignName]);

    React.useEffect(() => {
        const handler = (e) => {
            if (!combatSummary || !e.detail.restoredToHp) return;
            const creature = combatSummary.creatures.find(c =>
                c.name === e.detail.targetName || c.name.startsWith(e.detail.targetName + ' ')
            );
            if (creature) {
                setRuntimeValue(creature.name, 'currentHitPoints', e.detail.restoredToHp, campaignName);
                if (creature.type === 'npc') {
                    creature.currentHp = e.detail.restoredToHp;
                }
                storage.set('combatSummary', combatSummary, campaignName);
                setCombatSummary(cloneDeep(combatSummary));
            }
        };
        window.addEventListener('death-save-result', handler);
        return () => window.removeEventListener('death-save-result', handler);
    }, [combatSummary, campaignName]);

     const handleCreatureHpChange = React.useCallback((creatureName, newValue) => {
         if (!combatSummary) return;
         const creature = combatSummary.creatures.find(c => c.name === creatureName);
         if (!creature) return;

         const isPlayer = creature.type === 'player';
         const oldHp = isPlayer ? (getRuntimeValue(creature.name, 'currentHitPoints') ?? 0) : creature.currentHp;
         const delta = newValue - oldHp;
         if (delta === 0) return;

         if (isPlayer) {
            setRuntimeValue(creature.name, 'currentHitPoints', newValue, campaignName);
            if (oldHp <= 0 && newValue > 0) {
                setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
                setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);
                clearDeathSavePrompt(campaignName, creature.name);
            }

             const playerMaxHp = getRuntimeValue(creature.name, 'hitPoints') ?? 0;
             fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     type: 'hp_change',
                     targetName: creature.name,
                     delta,
                     currentHp: newValue,
                     maxHp: playerMaxHp,
                     isHealing: delta > 0,
                     isUnconscious: newValue <= 0,
                 })
             }).catch(() => {});
         } else {
             creature.currentHp = newValue;
             const wasBloodied = oldHp > 0 && oldHp <= Math.floor(creature.maxHp / 2);
             const isBloodied = newValue > 0 && newValue <= Math.floor(creature.maxHp / 2);
             const wasDead = oldHp <= 0;
             const isDead = newValue <= 0;

             let threshold;
             if (!wasDead && isDead) threshold = 'dead';
             else if (!wasBloodied && isBloodied) threshold = 'bloodied';
             else if (wasBloodied && !isBloodied && newValue > 0) threshold = 'recovering';

             if (threshold) {
                 fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({
                         type: 'hp_change',
                         targetName: creature.name,
                         delta,
                         threshold,
                         maxHp: creature.maxHp,
                     })
                 }).catch(() => {});
             }
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
            const firstCreatureName = creatures[0].name;
            storage.set('activeCreatureName', firstCreatureName, campaignName);
            setActiveCreatureName(firstCreatureName);
        }
    };
    const handleInitiativeChange = (creatureName, value) => {
        if (!combatSummary) return;
        const index = combatSummary.creatures.findIndex((creature) => creature.name === creatureName);
        combatSummary.creatures[index].initiative = value;
        combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
    };
    const handleNameChange = (oldName, newName) => {
        if (!combatSummary) return;
        const idx = combatSummary.creatures.findIndex((creature) => creature.name === oldName);
        if (idx === -1) return;
        combatSummary.creatures[idx].name = newName;
        getMonsterData(newName, campaignNpcs).then(monster => {
            if (monster) {
                combatSummary.creatures[idx].ac = typeof monster.armor_class === 'number' ? monster.armor_class : (console.error(`[AC] Monster "${newName}" has no armor_class defined. Defaulting to 10.`), 10);
                combatSummary.creatures[idx].resistances = monster.damage_resistances || [];
                combatSummary.creatures[idx].immunities = monster.damage_immunities || [];
                combatSummary.creatures[idx].initiativeBonus = monster.initiative_details ? parseInt(monster.initiative_details) || 0 : 0;
                combatSummary.creatures[idx].maxHp = monster.hit_points || 10;
                combatSummary.creatures[idx].currentHp = monster.hit_points || 10;
                combatSummary.creatures[idx].saveBonuses = buildMonsterSaveBonuses(monster);
                const matchedNpc = campaignNpcs.find(n => n.name?.toLowerCase() === newName.toLowerCase());
                if (matchedNpc?.imagePath) {
                    combatSummary.creatures[idx].imagePath = matchedNpc.imagePath;
                }
                storage.set('combatSummary', combatSummary, campaignName);
                setCombatSummary(cloneDeep(combatSummary));
            }
        }).catch(() => {});
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
        setNpcImages(prev => ({ ...prev, [newName]: null }));
    };
    const handleTargetChange = (creatureName, targetName) => {
        if (!combatSummary) return;
        const idx = combatSummary.creatures.findIndex((creature) => creature.name === creatureName);
        if (targetName && targetName.startsWith('overlay-')) {
            const overlayId = targetName.slice('overlay-'.length);
            const overlay = overlays.find(o => o.id === overlayId);
            if (overlay) {
                combatSummary.creatures[idx].targetName = targetName;
                const players = mapData?.players || [];
                const npcs = (mapData?.placedItems || []).filter(i => i.type === 'npc');
                try {
                    localStorage.setItem(`aoeContext-${campaignName}`, JSON.stringify({
                        overlay,
                        players,
                        npcs,
                    }));
                } catch { /* ignore */ }
            }
        } else {
            combatSummary.creatures[idx].targetName = targetName || null;
        }
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));
    };
    const handleRollNpcInitiative = (creatureName) => {
        if (!combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.name === creatureName);
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
        const creature = combatSummary.creatures.find(c => c.name === conditionPickerTarget.name);
        if (!creature) return;

        if (creature.type === 'player') {
            const conditions = getRuntimeValue(creature.name, 'activeConditions') || [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== conditionDef.key.toLowerCase());
            setRuntimeValue(creature.name, 'activeConditions', [...filtered, conditionDef.key], campaignName);
        } else {
            creature.conditions = creature.conditions.filter(c => c.key !== conditionDef.key);
            creature.conditions.push({
                id: utils.guid(),
                key: conditionDef.key,
                label: conditionDef.label,
                dc: conditionPickerDc,
                ability: conditionPickerAbility,
            });
        }
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

    const handleRollConditionSave = async (creatureName, condition) => {
        if (!combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.name === creatureName);
        if (!creature) return;

        let saveBonus = 0;
        if (creature.type === 'player') {
            const character = characters.find(c => utils.getName(c.name) === creature.name);
            saveBonus = getAbilitySaveBonus(character?.computedStats || character, condition.ability);
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

        const aura = await computeAuraBonus({ targetName: creatureName, characters, campaignName, activeMapName: mapName });
        const auraBonus = aura.bonus;
        const r1 = rollD20();
        const total = r1 + saveBonus + auraBonus;
        const success = total >= condition.dc;
        const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined;

        if (success) {
            if (creature.type === 'player') {
                const conditions = getRuntimeValue(creature.name, 'activeConditions') || [];
                const filtered = conditions.filter(c => String(c).toLowerCase() !== (condition.key || condition).toLowerCase());
                setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
            } else {
                creature.conditions = creature.conditions.filter(c => c.id !== condition.id);
            }
        }

        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummary(cloneDeep(combatSummary));

        setConditionPopup({
            type: 'd20',
            rollType: 'condition-save',
            name: getAbilityLabel(condition.ability),
            rolls: [r1],
            bonus: saveBonus + auraBonus,
            bonusDetail,
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
                bonus: saveBonus + auraBonus,
                bonusDetail,
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
        const creature = combatSummary.creatures.find(c => c.name === concentrationPickerTarget.name);
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

    const handleRollConcentrationSave = async (creatureName) => {
        if (!combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.name === creatureName);
        if (!creature || !creature.concentration) return;

        const concentration = creature.concentration;

        let saveBonus = 0;
        if (creature.type === 'player') {
            const character = characters.find(c => utils.getName(c.name) === creature.name);
            saveBonus = getAbilitySaveBonus(character?.computedStats || character, 'con');
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

        const aura = await computeAuraBonus({ targetName: creatureName, characters, campaignName, activeMapName: mapName });
        const auraBonus = aura.bonus;
        const effectiveSaveBonus = saveBonus + auraBonus;
        const { roll: r1, success } = concentrationRules.rollConcentrationSave(effectiveSaveBonus, concentration.dc);
        const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined;

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
            bonus: effectiveSaveBonus,
            bonusDetail,
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
                bonus: effectiveSaveBonus,
                bonusDetail,
                condition: `Concentration: ${concentration.spell}`,
                dc: concentration.dc,
                success,
                timestamp: Date.now(),
                id: utils.guid(),
            })
        }).catch(() => {});
    };

    const handleBreakConcentration = (creatureName) => {
        if (!combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.name === creatureName);
        if (!creature || !creature.concentration) return;
        const spell = creature.concentration.spell;
        creature.concentration = concentrationRules.breakConcentration(creature.concentration);
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

    const handleAutoBreakCondition = (creatureName, condition) => {
        if (!isLocalhost || !combatSummary) return;
        const creature = combatSummary.creatures.find(c => c.name === creatureName);
        if (!creature) return;
        if (creature.type === 'player') {
            const conditions = getRuntimeValue(creature.name, 'activeConditions') || [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== (condition.key || condition).toLowerCase());
            setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
        } else {
            creature.conditions = creature.conditions.filter(c => c.id !== condition.id);
        }
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
                {displayCreatures?.map((creature) => {
                    const isActive = creature.name === activeCreatureName;
                    const isUnconscious = creature.currentHp <= 0;
                    return (
                        <div key={creature.name} className={`creature-card ${creature.type} ${isActive ? 'active' : ''} ${isUnconscious ? 'creature-unconscious' : ''}`}>
                            {creature.type === 'npc' && isLocalhost && (
                                <button
                                    className="npc-remove-btn"
                                    onClick={() => handleRemoveNpc(creature.name)}
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
                                    <NpcAvatar name={creature.name} imageUrl={npcImages[creature.name]} imagePath={creature.imagePath} onClick={() => handleNpcClick(creature)} />
                                )}
                            </div>
                            <div className='creature-name'>
                              {creature.type === 'npc' ? (
                                      <MonsterNameAutocomplete
                                        value={creature.name}
                                        onChange={(newVal) => handleNameChange(creature.name, newVal)}
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
                                        onClick={() => handleRollNpcInitiative(creature.name)}
                                        role="button"
                                        tabIndex={0}
                                        title={`Roll initiative (d20 + ${creature.initiativeBonus})`}
                                    >
                                        {creature.initiative || <i className="fa-solid fa-dice-d20" />}
                                    </span>
                                ) : (
                                    <input
                                        min="0"
                                        onChange={(event) => handleInitiativeChange(creature.name, event.target.value)}
                                        type="number"
                                        value={creature.initiative}
                                        placeholder="Init"
                                    />
                                )}
                            </div>
                            <div className='creature-target'>Target&nbsp;
                                <select
                                    value={creature.targetName || ''}
                                    onChange={(e) => handleTargetChange(creature.name, e.target.value)}
                                    disabled={creature.type === 'npc' && !isLocalhost}
                                >
                                    <option value="">— No Target —</option>
                                    {combatSummary.creatures
                                        .filter(c => c.name !== creature.name)
                                        .map(c => (
                                            <option key={c.name} value={c.name}>{c.name}</option>
                                        ))
                                    }
                                    {overlays.length > 0 && (
                                        <optgroup label="─── Overlays ───">
                                            {overlays.map(o => {
                                                const label = o.label || `${SHAPE_LABELS[o.shape] || o.shape} (${o.radiusFt || o.distanceFt || o.sizeFt || 0}ft)`;
                                                return (
                                                    <option key={`overlay-${o.id}`} value={`overlay-${o.id}`}>
                                                        {label}
                                                    </option>
                                                );
                                            })}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                            <div className='creature-conditions'>
                                {creature.conditions?.map(cond => {
                                    const canRoll = creature.type === 'player' || isLocalhost;
                                    return (
                                        <div key={cond.id} className='condition-badge-wrapper'>
                                            <button
                                                className='condition-badge initiative-condition-badge'
                                                onClick={() => canRoll && handleRollConditionSave(creature.name, cond)}
                                                disabled={!canRoll}
                                                type='button'
                                                title={cond.dc ? `${cond.label} (DC ${cond.dc} ${getAbilityLabel(cond.ability)})` : cond.label}
                                            >
                                                {cond.dc ? `${cond.label} DC ${cond.dc}` : cond.label}
                                            </button>
                                            {isLocalhost && (
                                                <button
                                                    className='condition-break-btn'
                                                    onClick={() => handleAutoBreakCondition(creature.name, cond)}
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
                                            onClick={() => handleRollConcentrationSave(creature.name)}
                                            type='button'
                                            title={`Concentration: ${creature.concentration.spell} (DC ${creature.concentration.dc} Constitution)`}
                                        >
                                            <i className='fa-solid fa-spinner'></i> {creature.concentration.spell} DC {creature.concentration.dc}
                                        </button>
                                        <button
                                            className='concentration-break-btn'
                                            onClick={() => handleBreakConcentration(creature.name)}
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
                  <button onClick={handlePreviousCreature} disabled={isPrevDisabled}>← Prev</button>
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

function buildMonsterSaveBonuses(monster) {
  const map = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  const bonuses = {};
  for (const [abbr] of Object.entries(map)) {
    const monAbbr = abbr === 'cha' ? 'cha' : abbr;
    if (monster.saving_throws?.[monAbbr]?.modifier != null) {
      bonuses[abbr] = monster.saving_throws[monAbbr].modifier;
    } else if (monster.ability_score_modifiers?.[abbr] != null) {
      bonuses[abbr] = monster.ability_score_modifiers[abbr];
    } else {
      bonuses[abbr] = 0;
    }
  }
  return bonuses;
}

export default Initiative
