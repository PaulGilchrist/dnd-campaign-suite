import React from 'react'
import { cloneDeep } from 'lodash';
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { applyShieldOfFaith } from '../../services/automation/handlers/shieldOfFaithHandler.js'
import rulesFactory from '../../services/rules/rulesFactory.js'
import useSharedPopup from '../../hooks/combat/useSharedPopup.js'
import Popup from '../common/popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx'
import { sanitizeHtml } from '../../services/ui/sanitize.js'
import CharAbilities from './CharAbilities.jsx'
import CharActions from './CharActions.jsx'
import CharInventory from './CharInventory.jsx'
import CharReactions from './CharReactions.jsx'
import CharSpecialActions from './CharSpecialActions.jsx'
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx'
import CharSpells from './char-spells/CharSpells.jsx'
import CharSummary from './char-summary/CharSummary.jsx'
import { computeAuraComboEffects } from '../../services/combat/auras/auraComboEffects.js';
import { computeConditionEffects, getNetAttackMode, CONDITIONS_THAT_CANNOT_ACT } from '../../services/combat/conditions/conditionEffects.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getDistanceFeet } from '../../services/rules/combat/rangeValidation.js';
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import { EXHAUSTION_LEVELS } from '../../services/combat/conditions/exhaustionRules.js';
import { isCreatureWarded } from '../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js';
import { addEntry } from '../../services/ui/logService.js';
import { getManeuversForRules, getSuperiorityDice } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import * as storageService from '../../services/ui/storage.js';
import './CharSheet.css'
import './CharSheet.shieldOfFaith.css'

function ShieldOfFaithTargetSelectionModal({ popupHtml, setPopupHtml, playerStats, campaignName }) {
    const targets = popupHtml?.creatureTargets?.map(name => ({ name, type: 'creature' })) || [];

    const handleTargetSelected = async (targetName) => {
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
    };

    return (
        <SecondaryTargetModal
            title="Shield of Faith"
            targets={targets}
            onTargetSelected={handleTargetSelected}
            onSkip={() => setPopupHtml(null)}
            description="Choose a creature within 60 feet to gain a +2 bonus to AC."
            confirmLabel="Cast"
            confirmIcon="fa-shield-halved"
        />
    );
}

function CharSheet({ allAbilityScores, allClasses, allClasses2024, allEquipment, allMagicItems, allRaces, allSpells, allSpells2024, playerSummary, allRaces2024, allMagicItems2024, onDeleteCharacter, onEditCharacter, onUploadClick, onSaveClick, campaignName, activeMapName, characters }) {
    const [playerStats, setPlayerStats] = React.useState(null);

    const { popupHtml, setPopupHtml, value, Provider } = useSharedPopup();

    const storedExhaustion = useRuntimeValue(playerSummary?.name, 'exhaustionLevel', campaignName);
    const exhaustionLevel = typeof storedExhaustion === 'number' ? Math.min(EXHAUSTION_LEVELS, Math.max(0, storedExhaustion)) : 0;

    const biDieRuntime = useRuntimeValue(playerSummary?.name, 'bardicInspirationDie', campaignName);
    const biCombatOptRuntime = useRuntimeValue(playerSummary?.name, 'bardicInspirationCombatOptions', campaignName);
    React.useEffect(() => {
        const fetchData = async () => {
            const spellData = playerSummary.rules === '2024' ? allSpells2024 : allSpells;
            const effectiveClasses = playerSummary.rules === '2024' ? allClasses2024 : allClasses;
            const effectiveRaces = playerSummary.rules === '2024' ? allRaces2024 : allRaces;
            const effectiveMagicItems = playerSummary.rules === '2024' ? allMagicItems2024 : allMagicItems;
            const stats = await rulesFactory.getPlayerStats(effectiveClasses, allEquipment, effectiveMagicItems, effectiveRaces, spellData, playerSummary);

            // Load prepared spells from runtime state (skip for 2024 ruleset where all spells are known/prepared)
            if (playerSummary.rules !== '2024') {
                const preparedSpells = getRuntimeValue(playerSummary.name, 'preparedSpells');

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

            // Apply Aspect of the Wilds passive effects
            const aspectOption = getRuntimeValue(playerSummary.name, 'aspectOfTheWildsOption');
            if (aspectOption && stats.rules === '2024') {
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

            // Apply Aquatic Affinity passive (Circle of the Sea level 6 swim speed + emanation range)
            const aquaticAffinityPassive = (stats.automation?.passives || []).find(p => p.effect === 'aquatic_affinity');
            if (aquaticAffinityPassive) {
                if (!stats.swimSpeed) {
                    stats.swimSpeed = stats.race?.subrace?.speed || stats.race?.speed || 30;
                }
                await setRuntimeValue(playerSummary.name, 'aquaticAffinityEmanationRange', 10, campaignName);
            }

            // Apply Second-Storywork passive (Rogue level 3: climb speed = walk speed, jump uses DEX)
            const secondStoryworkPassive = (stats.automation?.passives || []).find(p => p.effect === 'second_storywork');
            if (secondStoryworkPassive) {
                const speed = stats.race?.subrace?.speed || stats.race?.speed || 30;
                if (!stats.climbSpeed) {
                    stats.climbSpeed = speed;
                }
            }

            // Apply Athlete feat: climb speed equal to speed
            const athleteClimbPassive = (stats.automation?.passives || []).find(p => p.effect === 'climb_speed');
            if (athleteClimbPassive && !stats.climbSpeed) {
                stats.climbSpeed = stats.speed || stats.race?.subrace?.speed || stats.race?.speed || 30;
            }

            // Apply Roving (Ranger level 6): climb speed and swim speed equal to walking speed
            // Roving increases speed by 10 without heavy armor, then sets climb/swim to that speed
            const rovingPassive = (stats.automation?.passives || []).find(p => p.name === 'Roving');
            if (rovingPassive && !stats.climbSpeed) {
                stats.climbSpeed = (stats.speed || stats.race?.subrace?.speed || stats.race?.speed || 30) + 10;
            }
            if (rovingPassive && !stats.swimSpeed) {
                stats.swimSpeed = (stats.speed || stats.race?.subrace?.speed || stats.race?.speed || 30) + 10;
            }

            // Expose Athlete Hop Up flag: stand from prone with only 5 ft of movement
            const athleteHopUpPassive = (stats.automation?.passives || []).find(p => p.effect === 'stand_from_prone');
            if (athleteHopUpPassive) {
                stats.athleteStandFromProne = true;
            }

            // Expose Athlete Jumping flag: running jump requires only 5 ft of movement
            const athleteJumpPassive = (stats.automation?.passives || []).find(p => p.effect === 'reduced_running_jump_requirement');
            if (athleteJumpPassive) {
                stats.athleteReducedJumpRequirement = true;
            }

            // Inject synthetic "Use Bardic Inspiration" feature if this character has an active BI die
            const biDie = getRuntimeValue(playerSummary.name, 'bardicInspirationDie', campaignName);
            if (biDie) {
                if (!stats.characterAdvancement) stats.characterAdvancement = [];
                const grantedBy = getRuntimeValue(playerSummary.name, 'bardicInspirationGrantedBy', campaignName) || 'unknown';

                if (!stats.characterAdvancement.some(f => f.name === 'Use Bardic Inspiration')) {
                    stats.characterAdvancement.unshift({
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

                if (combatOpts.includes('defense_add_to_ac') &&
                    !stats.characterAdvancement.some(f => f.name === 'Bardic Inspiration: Defense')) {
                    stats.characterAdvancement.unshift({
                        name: 'Bardic Inspiration: Defense',
                        description: `Use your Reaction when hit by an attack roll to roll your Bardic Inspiration die (1d${biDie}) and add the number rolled to your AC. Die granted by ${grantedBy}.`,
                        automation: {
                            type: 'bardic_inspiration_defense',
                        },
                    });
                }

                if (combatOpts.includes('offense_add_to_damage') &&
                    !stats.characterAdvancement.some(f => f.name === 'Bardic Inspiration: Offense')) {
                    stats.characterAdvancement.unshift({
                        name: 'Bardic Inspiration: Offense',
                        description: `Immediately after hitting a target with an attack roll, roll your Bardic Inspiration die (1d${biDie}) and add the number rolled to the attack's damage. Die granted by ${grantedBy}.`,
                        automation: {
                            type: 'bardic_inspiration_offense',
                        },
                    });
                }
            }

            setPlayerStats(stats);
        };
        fetchData();
    }, [allAbilityScores, allClasses, allClasses2024, allEquipment, allMagicItems, allRaces, allSpells, allSpells2024, playerSummary, allRaces2024, allMagicItems2024, biDieRuntime, biCombatOptRuntime, campaignName]);

    React.useEffect(() => {
        if (!playerStats) return;
        setRuntimeValue(playerStats.name, 'hitPoints', playerStats.hitPoints, campaignName);
    }, [playerStats, campaignName]);

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
            setRuntimeValue(playerStats.name, 'preparedSpells', preparedSpells, campaignName);
            setPlayerStats(cloneDeep(playerStats));
        }
    }

    const handleConditionsChange = () => { }
    const handleBuffsChange = () => { }

    const exhaustionPenalty = 2 * exhaustionLevel;

    const storedConditions = useRuntimeValue(playerSummary?.name, 'activeConditions', campaignName);
    const activeConditions = Array.isArray(storedConditions) ? storedConditions : [];
    // Merge save modifiers from active combat stances (e.g. Rage STR save advantage)
    const activeBuffs = useRuntimeValue(playerSummary?.name, 'activeBuffs', campaignName) ?? [];
    const stanceSaveModifiers = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.advantages?.length).flatMap(b =>
            b.advantages
                .filter(a => a.toLowerCase().includes('saves'))
                .map(a => {
                    const abilityMatch = a.match(/^(\w{3})\s+saves/);
                    return abilityMatch
                        ? { source: b.name, target: 'saving_throw', condition: 'stance_active', effect: 'advantage', abilities: [abilityMatch[1].toUpperCase()] }
                        : null;
                })
                .filter(Boolean)
        )
        : [];

    // Protection from Evil and Good: check if spell is active
    const pfeagActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'protection_from_evil_and_good');

    // Protection from Evil and Good: if already charmed/frightened by a warded creature,
    // the target has Advantage on any new saving throw against the relevant effect
    const pfeagSaveAdvantage = [];
    if (pfeagActive && playerStats) {
        const hasCharmed = activeConditions.includes('charmed');
        const hasFrightened = activeConditions.includes('frightened');
        if (hasCharmed || hasFrightened) {
            pfeagSaveAdvantage.push({
                source: 'Protection from Evil and Good',
                target: 'saving_throw',
                condition: 'pfeag_save_advantage',
                effect: 'advantage',
            });
        }
    }
    const allSaveModifiers = [...(playerStats?.saveModifiers || []), ...stanceSaveModifiers, ...pfeagSaveAdvantage];
    const allTargetEffects = useRuntimeValue(campaignName, 'targetEffects') ?? [];
    const myTargetEffects = allTargetEffects.filter(te => te.target === (playerSummary?.name));
    const isRaging = Array.isArray(activeBuffs) && activeBuffs.some(b => b.damageBonusExpression);
    const shapeShiftActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shape_shift');
    const isPeerlessAthlete = getRuntimeValue(playerStats?.name, 'peerlessAthleteActive', campaignName);
    const isLargeFormActive = getRuntimeValue(playerStats?.name, 'largeFormActive', campaignName);
    const seeInvisibilityActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'see_invisibility');
    const combatContext = getCombatSummary(campaignName);
    const conditionEffects = computeConditionEffects(activeConditions, allSaveModifiers, myTargetEffects, isRaging, shapeShiftActive, isPeerlessAthlete, isLargeFormActive, combatContext, seeInvisibilityActive);
    if (playerStats) {
        const speedHalvedTime = getRuntimeValue(playerStats.name, 'stunned_speedHalved', campaignName);
        if (speedHalvedTime) conditionEffects.speedHalved = true;
    }
    if (conditionEffects.autoRerollBonus && playerStats) {
        conditionEffects.autoRerollBonus = evaluateAutoExpression(conditionEffects.autoRerollBonus, playerStats);
    }
    if (playerStats) {
        const fanaticalFocusUsed = getRuntimeValue(playerStats.name, 'fanaticalFocusUsed', campaignName);
        if (fanaticalFocusUsed && conditionEffects.autoReroll) {
            conditionEffects.autoReroll = false;
            conditionEffects.autoRerollBonus = null;
        }
        const indomitableUses = Number(getRuntimeValue(playerStats.name, 'indomitableUses', campaignName) ?? 0);
        const indomitableMax = playerStats.level >= 17 ? 3 : playerStats.level >= 13 ? 2 : 1;
        if (indomitableUses >= indomitableMax && conditionEffects.autoReroll) {
            conditionEffects.autoReroll = false;
            conditionEffects.autoRerollBonus = null;
        }
        const disciplinedSurvivorUsed = getRuntimeValue(playerStats.name, 'disciplinedSurvivorUsed', campaignName);
        if (disciplinedSurvivorUsed && conditionEffects.autoReroll) {
            conditionEffects.autoReroll = false;
            conditionEffects.autoRerollBonus = null;
        }
        const strokeOfLuckUsed = getRuntimeValue(playerStats.name, 'strokeOfLuckUsed', campaignName);
        if (strokeOfLuckUsed && conditionEffects.strokeOfLuck) {
            conditionEffects.strokeOfLuck = false;
        }
    }
    // Reckless Attack: enemies have Advantage on attack rolls against you
    if (Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'advantage_attacks_disadvantage_against')) {
        conditionEffects.targetAdvantageCount = (conditionEffects.targetAdvantageCount || 0) + 1;
    }

    // Blessing of the Trickster: Advantage on Dexterity (Stealth) checks
    const hasTricksterBlessing = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'advantage_on_stealth');
    if (hasTricksterBlessing) {
        conditionEffects.abilityCheckAdvantage = true;
        conditionEffects.abilityCheckAdvantageSkill = 'Stealth';
    }

    // Buff-ally effects (e.g., Zealous Presence): Advantage on attack rolls and saving throws
    const buffAllyActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'advantage_attacks_and_saves');
    if (buffAllyActive) {
        conditionEffects.attackAdvantageCount = (conditionEffects.attackAdvantageCount || 0) + 1;
        conditionEffects.saveAdvantageCount = (conditionEffects.saveAdvantageCount || 0) + 1;
    }

    // Cloak of Shadows: Invisibility grants attack advantage and target disadvantage
    const cloakOfShadowsActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'cloak_of_shadows');
    if (cloakOfShadowsActive) {
        conditionEffects.attackAdvantageCount = (conditionEffects.attackAdvantageCount || 0) + 1;
        conditionEffects.targetDisadvantageCount = (conditionEffects.targetDisadvantageCount || 0) + 1;
    }

    // Blade Ward: Attackers subtract 1d4 from attack rolls against you
    const bladeWardActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'blade_ward');
    if (bladeWardActive) {
        conditionEffects.targetDisadvantageCount = (conditionEffects.targetDisadvantageCount || 0) + 1;
    }

    // Shield: +5 AC until start of next turn, immune to Magic Missile
    const shieldActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield');
    if (shieldActive) {
        conditionEffects.shieldAcBonus = 5;
        conditionEffects.magicMissileImmune = true;
    }

    // Warding Bond: +1 AC and +1 to all saving throws (only if within 60 feet)
    let wardingBondAcBonus = 0;
    let wardingBondSaveBonus = 0;
    for (const buff of activeBuffs) {
        if (buff.effect === 'warding_bond' && buff.sourceCharacter) {
            const casterName = buff.sourceCharacter;
            if (casterName === playerSummary?.name) continue;
            const casterCreature = combatContext?.creatures?.find(c => c.name === casterName);
            const targetCreature = combatContext?.creatures?.find(c => c.name === playerSummary?.name);
            const distance = casterCreature && targetCreature ? getDistanceFeet(casterCreature.position, targetCreature.position) : null;
            if (distance === null || distance <= 60) {
                if (buff.acBonus) {
                    wardingBondAcBonus += buff.acBonus;
                }
                if (buff.saveBonus) {
                    wardingBondSaveBonus += buff.saveBonus;
                }
            }
        }
    }
    if (wardingBondAcBonus > 0) {
        conditionEffects.wardingBondAcBonus = wardingBondAcBonus;
    }
    if (wardingBondSaveBonus > 0) {
        conditionEffects.saveAdvantageCount = (conditionEffects.saveAdvantageCount || 0) + wardingBondSaveBonus;
    }

    // Shield of Faith: +2 AC for duration (Concentration, up to 10 minutes)
    const shieldOfFaithActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield_of_faith');
    if (shieldOfFaithActive) {
        conditionEffects.shieldOfFaithAcBonus = 2;
    }

    // Alert: Other creatures don't gain advantage on attack rolls against you from being unseen
    if (playerStats?.unseenAttackerAdvantageNegate) {
        conditionEffects.noAdvantageAgainst = true;
    }

    // Protection from Evil and Good: warded creature types have Disadvantage on attack rolls,
    // target can't be charmed/frightened/possessed by them, advantage on new saves against existing effects
    if (pfeagActive && playerStats && combatContext) {
        const attackerName = combatContext.attackerName;
        if (attackerName) {
            const attackerCreature = combatContext.creatures?.find(c => c.name === attackerName);
            if (attackerCreature && isCreatureWarded(attackerCreature.type, playerStats.name, campaignName)) {
                conditionEffects.targetDisadvantageCount = (conditionEffects.targetDisadvantageCount || 0) + 1;
            }
        }
    }

    // Haste: Advantage on Dexterity saving throws
    const hasteActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'haste');
    if (hasteActive) {
        conditionEffects.saveAdvantageCount = (conditionEffects.saveAdvantageCount || 0) + 1;
    }

    // Holy Nimbus: Holy Ward grants advantage on saving throws against Fiends/Undead
    if (playerStats) {
        const holyNimbusActive = getRuntimeValue(playerStats.name, 'holyNimbusActive', campaignName);
        if (holyNimbusActive) {
            conditionEffects.saveAdvantageCount = (conditionEffects.saveAdvantageCount || 0) + 1;
        }
    }

    // Precise Hunter: Advantage on attack rolls against Hunter's Mark target (level 17+ Ranger)
    if (playerStats && playerStats.class?.name === 'Ranger' && playerStats.level >= 17) {
        conditionEffects.attackAdvantageCount = (conditionEffects.attackAdvantageCount || 0) + 1;
    }

    // Defensive Tactics: Escape the Horde — all attacks against you have Disadvantage
    if (playerStats) {
        const defensiveChoice = getRuntimeValue(playerStats.name, '_Defensive_Tactics_choice', campaignName);
        if (defensiveChoice === 'Escape the Horde') {
            conditionEffects.targetDisadvantageCount = (conditionEffects.targetDisadvantageCount || 0) + 1;
        }
    }

    // Elusive: No attack roll can have Advantage against you unless you have the Incapacitated condition
    if (playerStats) {
        const hasElusive = [
            ...(playerStats.actions || []),
            ...(playerStats.bonusActions || []),
            ...(playerStats.reactions || []),
            ...(playerStats.specialActions || [])
        ].some(a => a.name === 'Elusive');
        const isIncapacitated = activeConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c));
        if (hasElusive && !isIncapacitated) {
            conditionEffects.targetDisadvantageCount = (conditionEffects.targetDisadvantageCount || 0) + 1;
        }
    }

    const cannotAct = activeConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c))
    const conditionAttackMode = getNetAttackMode(conditionEffects.attackAdvantageCount, conditionEffects.attackDisadvantageCount)

    const handleReroll = React.useCallback(() => {
        if (playerStats) {
            if (conditionEffects.autoRerollCondition === 'raging') {
                setRuntimeValue(playerStats.name, 'fanaticalFocusUsed', true, campaignName);
            } else if (conditionEffects.autoRerollCondition === 'disciplined_survivor') {
                const currentFocus = Number(getRuntimeValue(playerStats.name, 'focusPoints', campaignName) ?? playerStats.focusPoints);
                if (currentFocus <= 0) {
                    return;
                }
                setRuntimeValue(playerStats.name, 'focusPoints', currentFocus - 1, campaignName);
                setRuntimeValue(playerStats.name, 'disciplinedSurvivorUsed', true, campaignName);
            } else {
                const current = Number(getRuntimeValue(playerStats.name, 'indomitableUses', campaignName) ?? 0);
                setRuntimeValue(playerStats.name, 'indomitableUses', current + 1, campaignName);
            }
        }
    }, [playerStats, campaignName, conditionEffects.autoRerollCondition]);

    const handleStrokeOfLuck = React.useCallback(() => {
        if (playerStats) {
            setRuntimeValue(playerStats.name, 'strokeOfLuckUsed', true, campaignName);
        }
    }, [playerStats, campaignName]);

    const handleTacticalMind = React.useCallback(async (dieResult) => {
        if (!playerStats) return;
        const playerName = playerStats.name;
        let currentUses = Number(getRuntimeValue(playerName, 'secondWindUses', campaignName) ?? 0);
        const maxUses = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1]?.second_wind || 0;
        if (currentUses <= 0) {
            currentUses = maxUses;
            await setRuntimeValue(playerName, 'secondWindUses', currentUses, campaignName);
        }
        if (currentUses <= 0) return;
        await setRuntimeValue(playerName, 'secondWindUses', currentUses - 1, campaignName);
        const checkName = popupHtml?.name || 'Ability Check';
        const d20 = popupHtml?.rolls?.[0] || 0;
        const bonus = popupHtml?.bonus || 0;
        const originalTotal = d20 + bonus;
        const modifiedTotal = originalTotal + dieResult;
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Tactical Mind',
            description: `${playerName} used Tactical Mind: +${dieResult} to ${checkName} (d20 ${d20} + ${bonus} = ${originalTotal} → ${modifiedTotal}).`,
            d10Roll: dieResult,
            timestamp: Date.now(),
        });
    }, [playerStats, campaignName, popupHtml]);

    const handleSuperiorityManeuver = React.useCallback(async (maneuverName, dieValue) => {
        if (!playerStats) return;
        try {
            await getManeuversForRules(playerStats.rules || '2024');
            const allManeuvers = await getManeuversForRules(playerStats.rules || '2024');
            const maneuver = allManeuvers.find(m => m.name === maneuverName);
            if (!maneuver) return;

            const superiorityDice = getSuperiorityDice(playerStats, campaignName);
            if (superiorityDice <= 0) return;

            await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);

            const skillName = popupHtml?.name || 'Ability Check';
            const oldTotal = popupHtml?.rolls?.[0] + (popupHtml?.bonus || 0);
            const newTotal = oldTotal + dieValue;

            // Update initiative tracker if this was an initiative roll
            if (skillName === 'Initiative' || popupHtml?.rollType === 'initiative') {
                const cs = await loadCombatSummary(campaignName);
                if (cs) {
                    const creature = cs.creatures.find(
                        c => c.type === 'player' && c.name === playerStats.name
                    );
                    if (creature) {
                        creature.initiative = String(newTotal);
                        cs.creatures.sort((a, b) => b.initiative - a.initiative);
                        storageService.default.set('combatSummary', cs, campaignName);
                    }
                }
                window.dispatchEvent(new CustomEvent('initiative-rolled', {
                    detail: { characterName: playerStats.name, roll: newTotal },
                }));
            }

            const logEntry = {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: maneuverName,
                description: `Used ${maneuverName} on ${skillName} check. Superiority die rolled ${dieValue}. Adjusted total: ${oldTotal} → ${newTotal}.`,
            };

            // Show result popup
            const desc = `<b>${maneuverName}</b><br/>Rolled d12 for ${dieValue}.<br/>${skillName}: ${oldTotal} → <b>${newTotal}</b> (+${dieValue})`;
            setPopupHtml({
                type: 'automation_info',
                name: maneuverName,
                description: desc,
            });

            try {
                await addEntry(campaignName, logEntry);
            } catch (e) {
                console.error('[CharSheet] Error logging superiority maneuver:', e);
            }
        } catch (e) {
            console.error('[CharSheet] Superiority maneuver execution failed:', e);
        }
    }, [playerStats, campaignName, setPopupHtml, popupHtml]);

    React.useEffect(() => {
        if (!playerStats) return;
        if (!isRaging) {
            setRuntimeValue(playerStats.name, 'fanaticalFocusUsed', false, campaignName);
        }
    }, [isRaging, playerStats, campaignName]);

    const [auraComboEffects, setAuraComboEffects] = React.useState(null);
    React.useEffect(() => {
        if (!playerStats || !characters?.length) { setAuraComboEffects(null); return; }
        computeAuraComboEffects({
            targetName: playerStats.name,
            characters,
            campaignName,
            activeMapName,
        }).then(setAuraComboEffects);
    }, [playerStats, characters, campaignName, activeMapName]);

    return (<Provider value={value}>
        <React.Fragment>
            {playerStats && <div className='char-sheet' data-testid='char-sheet'>
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
                    exhaustionLevel={exhaustionLevel}
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
                    onReroll={handleReroll}
                    onStrokeOfLuck={handleStrokeOfLuck}
                ></CharAbilities>

                <CharActions
                    playerStats={playerStats}
                    campaignName={campaignName}
                    exhaustionPenalty={exhaustionPenalty}
                    conditionAttackMode={conditionAttackMode}
                    cannotAct={cannotAct}
                    mapName={activeMapName}
                    onBuffsChange={handleBuffsChange}
                    characters={characters}
                ></CharActions>
                <CharReactions
                    playerStats={playerStats}
                    campaignName={campaignName}
                    cannotAct={cannotAct}
                    mapName={activeMapName}
                    characters={characters}
                ></CharReactions>
                {playerSummary.rules === '2024'
                    ? <CharSpells playerStats={playerStats} campaignName={campaignName} exhaustionPenalty={exhaustionPenalty} conditionAttackMode={conditionAttackMode} cannotAct={cannotAct} mapName={activeMapName} characters={characters}></CharSpells>
                    : <CharSpells playerStats={playerStats} handleTogglePreparedSpells={(spellName) => handleTogglePreparedSpells(spellName)} campaignName={campaignName} exhaustionPenalty={exhaustionPenalty} conditionAttackMode={conditionAttackMode} cannotAct={cannotAct} mapName={activeMapName} characters={characters}></CharSpells>

                }
                <CharInventory playerStats={playerStats}></CharInventory>
                <CharSpecialActions playerStats={playerStats} campaignName={campaignName} cannotAct={cannotAct} characters={characters}></CharSpecialActions>
                <div className='no-print'><CharCharacterAdvancement playerStats={playerStats} campaignName={campaignName}></CharCharacterAdvancement></div>
            </div>}
        </React.Fragment>
                {popupHtml && (
            <Popup onClickOrKeyDown={() => setPopupHtml(null)}>
                {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> :
                    popupHtml.html ? <div className="dice-roll-result"><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml.html) }}></div><div className="dice-roll-hint">click to dismiss</div></div> :
                    popupHtml.type === 'shield_of_faith_target_selection' ? null :
                    popupHtml.type === 'automation_info' ? <div className="dice-roll-result"><div className="dice-roll-header"><i className="fa-solid fa-info-circle"></i>{popupHtml.name}</div><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml.description) }}></div><div className="dice-roll-hint">click to dismiss</div></div> :
                        popupHtml.type === 'empowered_spell' ?
                            <div className="dice-roll-result">
                                <div className="dice-roll-header">
                                    <i className="fa-solid fa-wand-magic-sparkles"></i>{popupHtml.name}
                                </div>
                                <div className="dice-roll-breakdown">
                                    SP: {popupHtml.currentSP}/{popupHtml.maxSP} | Cha Mod: +{popupHtml.chaMod}
                                </div>
                                {popupHtml.lastEvent && (
                                    <div className="dice-roll-breakdown">
                                        {popupHtml.lastEvent.damageInfo?.map((d, i) => (
                                            <div key={i}>{d.formula}: {d.rolls.join(', ')} = {d.total} {d.type}</div>
                                        ))}
                                    </div>
                                )}
                                {popupHtml.error ? (
                                    <div className="dice-roll-crit dice-roll-crit-miss">{popupHtml.error}</div>
                                ) : popupHtml.lastEvent && !popupHtml.error ? (
                                    <div className="dice-roll-reroll">
                                        <button className="dice-roll-reroll-btn" onClick={() => {
                                            setPopupHtml({
                                                ...popupHtml,
                                                lastEvent: { ...popupHtml.lastEvent, completed: true }
                                            });
                                        }}>
                                            <i className="fa-solid fa-check"></i> Apply Reroll
                                        </button>
                                    </div>
                                ) : null}
                                <div className="dice-roll-hint">click to dismiss</div>
                            </div> :
                            <DiceRollResult {...popupHtml} onSuperiorityManeuver={popupHtml?.availableSuperiorityManeuvers ? handleSuperiorityManeuver : undefined} onTacticalMind={popupHtml?.tacticalMind ? handleTacticalMind : undefined} />
                }
            </Popup>
        )}
                {popupHtml?.type === 'shield_of_faith_target_selection' && (
                    <ShieldOfFaithTargetSelectionModal popupHtml={popupHtml} setPopupHtml={setPopupHtml} playerStats={playerStats} campaignName={campaignName} />
                )}
    </Provider>)
}

export default CharSheet
