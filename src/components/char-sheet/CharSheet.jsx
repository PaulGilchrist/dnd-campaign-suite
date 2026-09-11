import React from 'react'
import { cloneDeep } from 'lodash';
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import rulesFactory from '../../services/rules/rulesFactory.js'
import { applyShieldOfFaith } from '../../services/automation/handlers/shieldOfFaithHandler.js'
import useSharedPopup from '../../hooks/combat/useSharedPopup.js'

import CharAbilities from './CharAbilities.jsx'
import CharActions from './CharActions.jsx'
import CharInventory from './CharInventory.jsx'
import CharReactions from './CharReactions.jsx'
import CharSpecialActions from './CharSpecialActions.jsx'
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx'
import CharSpells from './char-spells/CharSpells.jsx'
import CharSummary from './char-summary/CharSummary.jsx'
import { computeAuraComboEffects } from '../../services/combat/auras/auraComboEffects.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { computeCharConditionEffects } from './CharSheet.conditionEffects';
import { handleReroll, handleStrokeOfLuck, handleBardicInspiration, handleBiDefenseCombatSummary, handleBardicInspirationOffense, handleEmpoweredSpell, handlePuncture, handleSavageAttacker, handleSavageAttackerChoice, handleTacticalMind, handleDarkOnesLuck, handleSuperiorityManeuver, handlePsiBolsteredKnack } from './CharSheet.handlers';
import { ShieldOfFaithTargetSelectionModal, renderPopup } from './CharSheet.modals.jsx';
import { activateWildShape } from '../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js'
import { confirmPolymorphTransform } from '../../services/automation/handlers/spells/polymorphService.js'
import { confirmShapechangeTransform } from '../../services/automation/handlers/spells/shapechangeService.js'
import { applyAnimalShapes } from '../../services/automation/handlers/spells/animalShapesService.js'
import { confirmTruePolymorphTransform, applyObjectTransform } from '../../services/automation/handlers/spells/truePolymorphService.js'
import './CharSheet.css'
import './CharSheet.shieldOfFaith.css'

function findPassive(stats, predicate) {
    return (stats.automation?.passives || []).find(predicate);
}

function applyCotlLandType(processingSummary, cotlLandTypeRuntime) {
    if (!cotlLandTypeRuntime || !processingSummary.class) return;
    if (processingSummary.class.subclass) {
        processingSummary.class.subclass.type = cotlLandTypeRuntime;
    } else if (processingSummary.class.major) {
        processingSummary.class.major.type = cotlLandTypeRuntime;
    }
}

// Load prepared spells from runtime state (2024: only wizards track prepared vs known)
function applyPreparedSpells(stats, playerSummary) {
    if (playerSummary.rules !== '2024' || playerSummary.class?.name === 'Wizard') {
        const preparedSpells = getRuntimeValue(playerSummary.name, 'preparedSpells');
        const preparedSpellsArray = Array.isArray(preparedSpells) ? preparedSpells : [];

        if (preparedSpellsArray.length && stats.spellAbilities?.spells?.length) {
            try {
                const mutableSpells = stats.spellAbilities.spells.map(spell => cloneDeep(spell));
                mutableSpells.forEach(spell => {
                    if (preparedSpellsArray.includes(spell.name)) {
                        if (spell.prepared === '') {
                            spell.prepared = 'Prepared';
                        }
                    } else {
                        if (spell.prepared === 'Prepared') {
                            spell.prepared = '';
                        }
                    }
                });
                stats.spellAbilities = { ...stats.spellAbilities, spells: mutableSpells };
            } catch (e) {
                console.error('Error applying preparedSpells:', e, { preparedSpells, spellsLength: stats.spellAbilities?.spells?.length });
            }
        }
    }
}

// Apply Aspect of the Wilds passive effects
function applyAspectOfTheWilds(stats, aspectOption) {
    if (!aspectOption || stats.rules !== '2024') return;
    if (aspectOption === 'Owl') {
        const existingDv = stats.senses?.find(s => s.name === 'Darkvision');
        if (existingDv) {
            const rangeMatch = existingDv.value.match(/(\d+)/);
            if (rangeMatch) {
                existingDv.value = `${parseInt(rangeMatch[1], 10) + 60} ft.`;
            }
        } else {
            if (!stats.senses) stats.senses = [];
            stats.senses.push({ name: 'Darkvision', value: '60 ft.' });
        }
    } else if (aspectOption === 'Panther') {
        stats.climbSpeed = stats.race?.subrace?.speed || stats.race?.speed || 30;
    } else if (aspectOption === 'Salmon') {
        stats.swimSpeed = stats.race?.subrace?.speed || stats.race?.speed || 30;
    }
}

// Apply Roving (Ranger level 6): climb speed and swim speed equal to walking speed
// Roving increases speed by 10 and sets climb/swim speeds when not wearing heavy armor
function applyRovingSpeeds(stats) {
    const equippedItems = stats.inventory?.equipped || [];
    const allEquipmentList = stats.equipment || [];
    let isWearingHeavyArmor = false;
    for (const itemName of equippedItems) {
        const parsedName = itemName.includes('(') ? itemName.substring(0, itemName.indexOf('(')).trim() : itemName;
        const item = allEquipmentList.find(eq => eq.name === parsedName || eq.name === itemName);
        if (item && item.armor_category === 'Heavy') {
            isWearingHeavyArmor = true;
            break;
        }
    }
    if (isWearingHeavyArmor) return;
    if (!stats.climbSpeed) {
        stats.climbSpeed = (stats.speed || stats.race?.subrace?.speed || stats.race?.speed || 30) + 10;
    }
    if (!stats.swimSpeed) {
        stats.swimSpeed = (stats.speed || stats.race?.subrace?.speed || stats.race?.speed || 30) + 10;
    }
}

// Inject synthetic "Use Bardic Inspiration" feature if this character has an active BI die
function injectBardicInspirationFeatures(stats, playerSummary, campaignName) {
    const biDie = getRuntimeValue(playerSummary.name, 'bardicInspirationDie', campaignName);
    if (!biDie) return;
    if (!stats.specialActions) stats.specialActions = [];
    const grantedBy = getRuntimeValue(playerSummary.name, 'bardicInspirationGrantedBy', campaignName) || 'unknown';

    if (!stats.specialActions.some(f => f.name === 'Use Bardic Inspiration')) {
        stats.specialActions.unshift({
            name: 'Use Bardic Inspiration',
            description: `Roll your Bardic Inspiration die (1d${biDie}) and add the result to an ability check. Die granted by ${grantedBy}.`,
            automation: {
                type: 'bardic_inspiration_use',
            },
        });
    }

    // Combat Inspiration (College of Valor) options:
    // Defense — reaction to add BI die to AC when hit
    // Offense — add BI die to damage after hitting
    const combatOptRaw = getRuntimeValue(playerSummary.name, 'bardicInspirationCombatOptions', campaignName);
    let combatOpts = [];
    try { combatOpts = JSON.parse(combatOptRaw) || []; } catch (_e) { /* combatOpts is not valid JSON, ignore */ }

    if (!stats.reactions) stats.reactions = [];

    if (combatOpts.includes('defense_add_to_ac') &&
        !stats.reactions.some(f => f.name === 'Combat Inspiration - Defense')) {
        stats.reactions.unshift({
            name: 'Combat Inspiration - Defense',
            description: `Use your Reaction when hit by an attack roll to roll your Bardic Inspiration die (1d${biDie}) and add the number rolled to your AC. Die granted by ${grantedBy}.`,
            automation: {
                type: 'bardic_inspiration_defense',
            },
        });
    }

    if (combatOpts.includes('offense_add_to_damage') &&
        !stats.reactions.some(f => f.name === 'Combat Inspiration - Offense')) {
        stats.reactions.unshift({
            name: 'Combat Inspiration - Offense',
            description: `Use your Reaction after hitting a target with an attack roll to roll your Bardic Inspiration die (1d${biDie}) and add the number rolled to the attack's damage. Die granted by ${grantedBy}.`,
            automation: {
                type: 'bardic_inspiration_offense',
            },
        });
    }
}

function CharSheet({ allAbilityScores, allClasses, allClasses2024, allEquipment, allMagicItems, allRaces, allSpells, allSpells2024, playerSummary, allRaces2024, allMagicItems2024, onDeleteCharacter, onEditCharacter, onUploadClick, onSaveClick, campaignName, activeMapName, characters }) {
    const [playerStats, setPlayerStats] = React.useState(null);
    const [charActionsModalState, setCharActionsModalState] = React.useState({});
    const setModalState = React.useCallback((state) => {
        setCharActionsModalState(state);
    }, []);

    const { popupHtml, setPopupHtml, value, Provider } = useSharedPopup();

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const handleWildShapeConfirm = React.useCallback(async (action, beast, stats, campName) => {
        await activateWildShape(stats.name, beast, stats, campName);
    }, []);

    const handlePolymorphConfirm = React.useCallback(async (beast, popupData) => {
        await confirmPolymorphTransform({
            targetName: popupData.targetName,
            beast,
            casterName: popupData.casterName,
            spell: popupData.spell,
            spellLevel: popupData.spellLevel,
            playerStats,
            campaignName: popupData.campaignName,
        });
    }, [playerStats]);

    const handleShapechangeConfirm = React.useCallback(async (form, popupData) => {
        await confirmShapechangeTransform({
            targetName: popupData.targetName,
            form,
            casterName: popupData.casterName,
            spell: popupData.spell,
            spellLevel: popupData.spellLevel,
            playerStats,
            campaignName: popupData.campaignName,
        });
    }, [playerStats]);

    const handleAnimalShapesBeastConfirm = React.useCallback(async (targetBeastMap) => {
        setPopupHtml(null);
        await applyAnimalShapes({
            targetBeastMap,
            casterName: playerStats.name,
            spell: { name: 'Animal Shapes', level: 8 },
            playerStats,
            campaignName,
        });
    }, [playerStats, campaignName, setPopupHtml]);

    const handleTruePolymorphConfirm = React.useCallback(async (creature, popupData) => {
        await confirmTruePolymorphTransform({
            targetName: popupData.targetName,
            creature,
            casterName: popupData.casterName,
            spell: popupData.spell,
            spellLevel: popupData.spellLevel,
            playerStats,
            campaignName: popupData.campaignName,
            mode: popupData.mode || 'creature_to_creature',
        });
    }, [playerStats]);

    const handleObjectTransformConfirm = React.useCallback(async (objectType, popupData) => {
        const targetName = popupData.targetName || popupData.casterName;
        await applyObjectTransform(targetName, objectType, popupData.casterName, popupData.spell, popupData.campaignName, playerStats);
    }, [playerStats]);

    const biDieRuntime = useRuntimeValue(playerSummary?.name, 'bardicInspirationDie', campaignName);
    const biCombatOptRuntime = useRuntimeValue(playerSummary?.name, 'bardicInspirationCombatOptions', campaignName);
    const spellThiefStolenRuntime = useRuntimeValue(playerSummary?.name, '_spellThiefStolenList', campaignName);
    const spellThiefCasterBlockRuntime = useRuntimeValue(playerSummary?.name, '_spellThiefCasterBlock', campaignName);
    const cotlLandTypeRuntime = useRuntimeValue(playerSummary?.name, '_circleOfTheLandType', campaignName);
    const fiendishResilienceType = useRuntimeValue(playerSummary?.name, '_Fiendish_Resilience_chosenType', campaignName);
    const boonEnergyResistanceTypes = useRuntimeValue(playerSummary?.name, '_Energy_Resistances_chosenTypes', campaignName);
    React.useEffect(() => {
        const fetchData = async () => {
            const spellData = playerSummary.rules === '2024' ? allSpells2024 : allSpells;
            const effectiveClasses = playerSummary.rules === '2024' ? allClasses2024 : allClasses;
            const effectiveRaces = playerSummary.rules === '2024' ? allRaces2024 : allRaces;
            const effectiveMagicItems = playerSummary.rules === '2024' ? allMagicItems2024 : allMagicItems;
            const processingSummary = cloneDeep(playerSummary);
            applyCotlLandType(processingSummary, cotlLandTypeRuntime);
            const stats = await rulesFactory.getPlayerStats(effectiveClasses, allEquipment, effectiveMagicItems, effectiveRaces, spellData, processingSummary);

            applyPreparedSpells(stats, playerSummary);
            applyAspectOfTheWilds(stats, getRuntimeValue(playerSummary.name, 'aspectOfTheWildsOption'));

            // Apply Aquatic Affinity passive (Circle of the Sea level 6 swim speed + emanation range)
            const aquaticAffinityPassive = findPassive(stats, p => p.effect === 'aquatic_affinity');
            if (aquaticAffinityPassive) {
                if (!stats.swimSpeed) {
                    stats.swimSpeed = stats.race?.subrace?.speed || stats.race?.speed || 30;
                }
                await setRuntimeValue(playerSummary.name, 'aquaticAffinityEmanationRange', 10, campaignName);
            }

            // Apply Second-Storywork passive (Rogue level 3: climb speed = walk speed, jump uses DEX)
            const secondStoryworkPassive = findPassive(stats, p => p.effect === 'second_storywork');
            if (secondStoryworkPassive) {
                const speed = stats.race?.subrace?.speed || stats.race?.speed || 30;
                if (!stats.climbSpeed) {
                    stats.climbSpeed = speed;
                }
            }

            // Apply Athlete feat: climb speed equal to speed
            const athleteClimbPassive = findPassive(stats, p => p.effect === 'climb_speed');
            if (athleteClimbPassive && !stats.climbSpeed) {
                stats.climbSpeed = stats.speed || stats.race?.subrace?.speed || stats.race?.speed || 30;
            }

            // Apply Roving (Ranger level 6): climb speed and swim speed equal to walking speed
            if (findPassive(stats, p => p.name === 'Roving')) {
                applyRovingSpeeds(stats);
            }

            // Expose Athlete Hop Up flag: stand from prone with only 5 ft of movement
            if (findPassive(stats, p => p.effect === 'stand_from_prone')) {
                stats.athleteStandFromProne = true;
            }

            // Expose Athlete Jumping flag: running jump requires only 5 ft of movement
            if (findPassive(stats, p => p.effect === 'reduced_running_jump_requirement')) {
                stats.athleteReducedJumpRequirement = true;
            }

            injectBardicInspirationFeatures(stats, playerSummary, campaignName);

            setPlayerStats(stats);
        };
        fetchData();
    }, [allAbilityScores, allClasses, allClasses2024, allEquipment, allMagicItems, allRaces, allSpells, allSpells2024, playerSummary, allRaces2024, allMagicItems2024, biDieRuntime, biCombatOptRuntime, spellThiefStolenRuntime, spellThiefCasterBlockRuntime, cotlLandTypeRuntime, fiendishResilienceType, boonEnergyResistanceTypes, campaignName]);

    React.useEffect(() => {
        if (!playerStats) return;
        setRuntimeValue(playerStats.name, 'hitPoints', playerStats.hitPoints, campaignName);
    }, [playerStats, campaignName]);

    const handleTogglePreparedSpells = (spellName) => {
        const spell = playerStats.spellAbilities.spells.find(spell => spell.name === spellName);
        if (spell) {
            const mutableStats = cloneDeep(playerStats);
            const mutableSpell = mutableStats.spellAbilities.spells.find(s => s.name === spellName);
            if (mutableSpell) {
                if (mutableSpell.prepared === 'Prepared') {
                    mutableSpell.prepared = '';
                } else if (mutableSpell.prepared === '') {
                    const preparedSpellCount = mutableStats.spellAbilities.spells.filter(s => s.prepared === 'Prepared').length;
                    if (preparedSpellCount < mutableStats.spellAbilities.maxPreparedSpells) {
                        mutableSpell.prepared = 'Prepared';
                    }
                }
            }
            const preparedSpells = [];
            mutableStats.spellAbilities.spells.forEach(s => {
                if (s.prepared === 'Prepared') {
                    preparedSpells.push(s.name);
                }
            });
            setRuntimeValue(mutableStats.name, 'preparedSpells', preparedSpells, campaignName);
            setPlayerStats(mutableStats);
        }
    }

    // Don't render hooks or content until playerStats is ready
    if (!playerStats) {
        return null;
    }

    return (
        <CharSheetContent
            playerStats={playerStats}
            allAbilityScores={allAbilityScores}
            allClasses={allClasses}
            allClasses2024={allClasses2024}
            allEquipment={allEquipment}
            allMagicItems={allMagicItems}
            allRaces={allRaces}
            allSpells={allSpells}
            allSpells2024={allSpells2024}
            allRaces2024={allRaces2024}
            allMagicItems2024={allMagicItems2024}
            playerSummary={playerSummary}
            onDeleteCharacter={onDeleteCharacter}
            onEditCharacter={onEditCharacter}
            onUploadClick={onUploadClick}
            onSaveClick={onSaveClick}
            campaignName={campaignName}
            activeMapName={activeMapName}
            characters={characters}
            setCharActionsModalState={setCharActionsModalState}
            charActionsModalState={charActionsModalState}
            setModalState={setModalState}
            popupHtml={popupHtml}
            setPopupHtml={setPopupHtml}
            Provider={Provider}
            value={value}
            isLocalhost={isLocalhost}
            handleWildShapeConfirm={handleWildShapeConfirm}
            handlePolymorphConfirm={handlePolymorphConfirm}
            handleShapechangeConfirm={handleShapechangeConfirm}
            handleAnimalShapesBeastConfirm={handleAnimalShapesBeastConfirm}
            handleTruePolymorphConfirm={handleTruePolymorphConfirm}
            handleObjectTransformConfirm={handleObjectTransformConfirm}
            handleTogglePreparedSpells={handleTogglePreparedSpells}
        />
    );
}

function CharSheetContent({
    playerStats,
    allAbilityScores,
    playerSummary,
    campaignName,
    activeMapName,
    characters,
    setCharActionsModalState,
    charActionsModalState,
    setModalState,
    popupHtml,
    setPopupHtml,
    Provider,
    value,
    isLocalhost,
    handleWildShapeConfirm,
    handlePolymorphConfirm,
    handleShapechangeConfirm,
    handleAnimalShapesBeastConfirm,
    handleTruePolymorphConfirm,
    handleObjectTransformConfirm,
    handleTogglePreparedSpells,
    onDeleteCharacter,
    onEditCharacter,
    onUploadClick,
    onSaveClick,
}) {
    const handleConditionsChange = () => { }
    const handleBuffsChange = () => { }

    const activeBuffs = useRuntimeValue(playerSummary?.name, 'activeBuffs', campaignName) ?? [];
    // SP-109: subscribe to own activeConditions so the header Speed/AC recompute the moment
    // a condition (e.g. Slow) is applied or removed — no forced unrelated re-render needed.
    void useRuntimeValue(playerSummary?.name, 'activeConditions', campaignName);
    // CLA-230: subscribe to campaign targetEffects so that a one-shot next_attack_advantage
    // te consumed by attackPostProcessing after an attack roll recomputes
    // conditionAttackMode immediately (no sheet remount needed for the next attack).
    void useRuntimeValue('campaign', 'targetEffects', campaignName);
    const { conditionEffects, cannotAct, cannotActActions, cannotActReason, conditionAttackMode, isRaging, exhaustionPenalty } = computeCharConditionEffects(playerSummary, playerStats, campaignName, activeBuffs);

    const luckyAdvantageActive = useRuntimeValue(playerStats?.name, 'luckyAdvantageActive', campaignName);
    const luckyDisadvantageActive = useRuntimeValue(playerStats?.name, 'luckyDisadvantageActive', campaignName);
    const effectiveAttackMode = luckyAdvantageActive ? 'advantage' : conditionAttackMode;

    if (luckyAdvantageActive && conditionEffects) {
        conditionEffects.saveAdvantageCount = (conditionEffects.saveAdvantageCount || 0) + 1;
    }

    if (luckyDisadvantageActive && conditionEffects) {
        conditionEffects.luckyDisadvantage = true;
    }

    const handleRerollWrapped = React.useCallback((rerollInfo) => {
        handleReroll(playerStats, campaignName, conditionEffects, rerollInfo);
    }, [playerStats, campaignName, conditionEffects]);

    const handleStrokeOfLuckWrapped = React.useCallback((featureKey) => {
        handleStrokeOfLuck(playerStats, campaignName, popupHtml, featureKey);
    }, [playerStats, campaignName, popupHtml]);

    const handleBardicInspirationWrapped = React.useCallback(async (_dieValue, _dieSize) => {
        await handleBardicInspiration(playerStats, campaignName, popupHtml);
    }, [playerStats, campaignName, popupHtml]);

    const handleBiDefenseCombatSummaryWrapped = React.useCallback(async ({ dieValue: _dieValue, newAc: _newAc, willMiss: _willMiss }) => {
        await handleBiDefenseCombatSummary(playerStats, campaignName, { dieValue: _dieValue, newAc: _newAc, willMiss: _willMiss });
    }, [playerStats, campaignName]);

    const handleBardicInspirationOffenseWrapped = React.useCallback(async (dieValue, dieSize) => {
        await handleBardicInspirationOffense(playerStats, campaignName, characters, dieValue, dieSize);
    }, [playerStats, campaignName, characters]);

    const handleEmpoweredSpellWrapped = React.useCallback(async (lastEventData) => {
        return await handleEmpoweredSpell(playerStats, campaignName, characters, popupHtml, lastEventData);
    }, [playerStats, campaignName, characters, popupHtml]);

    const handlePunctureWrapped = React.useCallback(async (punctureData) => {
        return await handlePuncture(playerStats, campaignName, characters, popupHtml, setPopupHtml, punctureData);
    }, [playerStats, campaignName, characters, popupHtml, setPopupHtml]);

    const handleSavageAttackerWrapped = React.useCallback(async (savageData) => {
        return await handleSavageAttacker(playerStats, campaignName, characters, popupHtml, setPopupHtml, savageData);
    }, [playerStats, campaignName, characters, popupHtml, setPopupHtml]);

    const handleSavageAttackerChoiceWrapped = React.useCallback(async (choiceData) => {
        return await handleSavageAttackerChoice(playerStats, campaignName, characters, popupHtml, setPopupHtml, choiceData);
    }, [playerStats, campaignName, characters, popupHtml, setPopupHtml]);

    const handleTacticalMindWrapped = React.useCallback(async ({ dieValue, success }) => {
        await handleTacticalMind(playerStats, campaignName, { ...popupHtml, tacticalMindDie: dieValue, tacticalSuccess: success }, setPopupHtml);
    }, [playerStats, campaignName, popupHtml, setPopupHtml]);

    const handleDarkOnesLuckWrapped = React.useCallback(async (dieValue) => {
        await handleDarkOnesLuck(playerStats, campaignName, { ...popupHtml, darkOnesLuckValue: dieValue });
    }, [playerStats, campaignName, popupHtml]);

    const handleSuperiorityManeuverWrapped = React.useCallback(async (maneuverName, dieValue) => {
        await handleSuperiorityManeuver(playerStats, campaignName, setPopupHtml, popupHtml, maneuverName, dieValue);
    }, [playerStats, campaignName, setPopupHtml, popupHtml]);

    const handlePsiBolsteredKnackWrapped = React.useCallback(async ({ dieValue, dieSize, success }) => {
        await handlePsiBolsteredKnack(playerStats, campaignName, popupHtml, dieValue, dieSize, success, setPopupHtml);
    }, [playerStats, campaignName, popupHtml, setPopupHtml]);

    const handleShieldOfFaithTargetSelected = React.useCallback(async (targetName) => {
        const action = {
            name: 'Shield of Faith',
            spell: { duration: popupHtml.duration, range: popupHtml.range },
            automation: { type: 'shield_of_faith' },
        };
        const result = await applyShieldOfFaith(action, playerStats, campaignName, null, [targetName]);
        if (result) {
            setPopupHtml(result.payload);
        } else {
            setPopupHtml(null);
        }
    }, [playerStats, campaignName, popupHtml, setPopupHtml]);

    // Update Counterspell popup when save result is received
    React.useEffect(() => {
        const handler = (event) => {
            const { attackerName, spellName, saveDc, spellResult, counterspellResult } = event.detail;
            if (!attackerName || !spellName) return;
            setPopupHtml({
                type: 'automation_info',
                name: 'Counterspell',
                description: `${attackerName}'s '${spellName}' ${counterspellResult} — ${attackerName} ${spellResult} their CON save (DC ${saveDc}).`,
            });
        };
        window.addEventListener('counterspell-save-result', handler);
        return () => window.removeEventListener('counterspell-save-result', handler);
    }, [setPopupHtml]);

    // CLA-322: Update popup when the Dispel Magic ability check resolves on this caster
    React.useEffect(() => {
        if (!playerStats) return;
        const handler = (event) => {
            const { casterName, targetName, checkBonus, targetDC, total, checkFailed } = event.detail;
            if (casterName !== playerStats.name) return;
            setPopupHtml({
                type: 'automation_info',
                name: 'Dispel Magic',
                description: `${targetName}: ability check ${total} (${checkBonus >= 0 ? '+' : ''}${checkBonus}) vs DC ${targetDC} — ${checkFailed ? 'failed, spell not stopped' : 'spell ended'}.`,
            });
        };
        window.addEventListener('spell-result', handler);
        return () => window.removeEventListener('spell-result', handler);
    }, [playerStats, setPopupHtml]);

    React.useEffect(() => {
        if (!playerStats) return;
        if (!isRaging) {
            setRuntimeValue(playerStats.name, 'fanaticalFocusUsed', false, campaignName);
        }
    }, [isRaging, playerStats, campaignName]);

    const [auraComboEffects, setAuraComboEffects] = React.useState(null);
    React.useEffect(() => {
        if (!playerStats || !characters?.length) { setAuraComboEffects(null); return; }
        const combatSummary = getCombatSummary(campaignName);
        computeAuraComboEffects({
            targetName: playerStats.name,
            characters,
            campaignName,
            activeMapName,
            allCreatures: combatSummary?.creatures,
        }).then(setAuraComboEffects);
    }, [playerStats, characters, campaignName, activeMapName]);

    const popupHandlers = {
        onWildShapeConfirm: handleWildShapeConfirm,
        onPolymorphConfirm: handlePolymorphConfirm,
        onShapechangeConfirm: handleShapechangeConfirm,
        onAnimalShapesBeastConfirm: handleAnimalShapesBeastConfirm,
        onTruePolymorphConfirm: handleTruePolymorphConfirm,
        onObjectTransformConfirm: handleObjectTransformConfirm,
        onSuperiorityManeuver: handleSuperiorityManeuverWrapped,
        onTacticalMind: handleTacticalMindWrapped,
        onDarkOnesLuck: handleDarkOnesLuckWrapped,
        onPsiBolsteredKnack: handlePsiBolsteredKnackWrapped,
        onBardicInspiration: handleBardicInspirationWrapped,
        onBardicInspirationOffense: handleBardicInspirationOffenseWrapped,
        onEmpoweredSpell: handleEmpoweredSpellWrapped,
        onPuncture: handlePunctureWrapped,
        onSavageAttacker: handleSavageAttackerWrapped,
        onSavageAttackerChoice: handleSavageAttackerChoiceWrapped,
        onBiDefenseCombatSummary: handleBiDefenseCombatSummaryWrapped,
        onStrokeOfLuck: handleStrokeOfLuckWrapped,
        onReroll: handleRerollWrapped,
    };

    return (<Provider value={value}>
        <React.Fragment>
            <div className='char-sheet' data-testid='char-sheet'>
                <CharSummary
                    playerStats={playerStats}
                    onDeleteCharacter={onDeleteCharacter}
                    onEditCharacter={onEditCharacter}
                    onUploadClick={onUploadClick}
                    onSaveClick={onSaveClick}
                    campaignName={campaignName}
                    activeMapName={activeMapName}
                    characters={characters}
                    onLongRest={() => { }}
                    exhaustionLevel={exhaustionPenalty / 2}
                    conditionEffects={conditionEffects}
                    onConditionsChange={handleConditionsChange}
                    auraComboEffects={auraComboEffects}
                ></CharSummary>
                  <CharAbilities
                      allAbilityScores={allAbilityScores}
                      playerStats={playerStats}
                      campaignName={campaignName}
                      exhaustionPenalty={exhaustionPenalty}
                      conditionEffects={conditionEffects}
                      isRaging={isRaging}
                      onReroll={handleRerollWrapped}
                      onStrokeOfLuck={handleStrokeOfLuckWrapped}
                      characters={characters}
                      luckyDisadvantageActive={luckyDisadvantageActive}
                  ></CharAbilities>

                <CharActions
                    playerStats={playerStats}
                    campaignName={campaignName}
                    exhaustionPenalty={exhaustionPenalty}
                    conditionAttackMode={effectiveAttackMode}
                    conditionEffects={conditionEffects}
                    cannotAct={cannotActActions}
                    cannotActReason={cannotActReason}
                    mapName={activeMapName}
                    onBuffsChange={handleBuffsChange}
                    characters={characters}
                    onSpellModalStateChange={(state) => setCharActionsModalState(state)}
                    spellModalState={charActionsModalState}
                ></CharActions>
                <CharReactions
                    playerStats={playerStats}
                    campaignName={campaignName}
                    cannotAct={cannotAct}
                    mapName={activeMapName}
                    characters={characters}
                ></CharReactions>
                <CharSpells playerStats={playerStats} handleTogglePreparedSpells={(spellName) => handleTogglePreparedSpells(spellName)} campaignName={campaignName} exhaustionPenalty={exhaustionPenalty} conditionAttackMode={effectiveAttackMode} cannotAct={cannotActActions} mapName={activeMapName} characters={characters} setModalState={setModalState}></CharSpells>
                <CharInventory playerStats={playerStats}></CharInventory>
                <CharSpecialActions playerStats={playerStats} campaignName={campaignName} cannotAct={cannotActActions} characters={characters} mapName={activeMapName}></CharSpecialActions>
                <div className='no-print'><CharCharacterAdvancement playerStats={playerStats} campaignName={campaignName}></CharCharacterAdvancement></div>
            </div>
        </React.Fragment>
                {renderPopup(popupHtml, setPopupHtml, isLocalhost, playerStats, campaignName, characters, popupHandlers)}
                {popupHtml?.type === 'shield_of_faith_target_selection' && (
                    <ShieldOfFaithTargetSelectionModal popupHtml={popupHtml} setPopupHtml={setPopupHtml} playerStats={playerStats} campaignName={campaignName} handleShieldOfFaithTargetSelected={handleShieldOfFaithTargetSelected} />
                )}
    </Provider>)
}

export default CharSheet
