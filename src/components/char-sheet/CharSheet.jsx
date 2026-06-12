import React from 'react'
import { cloneDeep } from 'lodash';
import { setRuntimeValue, getRuntimeValue, useRuntimeValue } from '../../hooks/useRuntimeState.js'
import rulesFactory from '../../services/rules/rulesFactory.js'
import CharAbilities from './CharAbilities.jsx'
import CharActions from './CharActions.jsx'
import CharInventory from './CharInventory.jsx'
import CharReactions from './CharReactions.jsx'
import CharSpecialActions from './CharSpecialActions.jsx'
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx'
import CharSpells from './char-spells/CharSpells.jsx'
import CharSummary from './char-summary/CharSummary.jsx'
import { computeAuraComboEffects } from '../../services/combat/auraComboEffects.js';
import { computeConditionEffects, getNetAttackMode, CONDITIONS_THAT_CANNOT_ACT } from '../../services/combat/conditionEffects.js'
import { evaluateAutoExpression } from '../../services/combat/automationService.js'
import { EXHAUSTION_LEVELS } from '../../services/combat/exhaustionRules.js'
import './CharSheet.css'

function CharSheet({ allAbilityScores, allClasses, allClasses2024, allEquipment, allMagicItems, allRaces, allSpells, allSpells2024, playerSummary, allRaces2024, allMagicItems2024, onDeleteCharacter, onEditCharacter, onUploadClick, onSaveClick, campaignName, activeMapName, characters }) {
    const [playerStats, setPlayerStats] = React.useState(null);

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
                try { combatOpts = JSON.parse(combatOptRaw) || []; } catch (e) { /* combatOpts is not valid JSON, ignore */ }

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

    const handleConditionsChange = () => {}
    const handleBuffsChange = () => {}

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
    const allSaveModifiers = [...(playerStats?.saveModifiers || []), ...stanceSaveModifiers];
    const allTargetEffects = useRuntimeValue(campaignName, 'targetEffects') ?? [];
    const myTargetEffects = allTargetEffects.filter(te => te.target === (playerSummary?.name));
    const isRaging = Array.isArray(activeBuffs) && activeBuffs.some(b => b.damageBonusExpression);
    const shapeShiftActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shape_shift');
    const conditionEffects = computeConditionEffects(activeConditions, allSaveModifiers, myTargetEffects, isRaging, shapeShiftActive);
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

    return (<React.Fragment>
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
              onLongRest={() => {}}
              exhaustionLevel={exhaustionLevel}
              conditionEffects={conditionEffects}
              onConditionsChange={handleConditionsChange}
              auraComboEffects={auraComboEffects}
            ></CharSummary><hr />
              <CharAbilities
                allAbilityScores={allAbilityScores}
                playerStats={playerStats}
                campaignName={campaignName}
                exhaustionPenalty={exhaustionPenalty}
                conditionEffects={conditionEffects}
                isRaging={isRaging}
                onReroll={handleReroll}
              ></CharAbilities><hr />

               <CharActions
                  playerStats={playerStats}
                  campaignName={campaignName}
                  exhaustionPenalty={exhaustionPenalty}
                  conditionAttackMode={conditionAttackMode}
                  cannotAct={cannotAct}
                  mapName={activeMapName}
                  onBuffsChange={handleBuffsChange}
                  characters={characters}
                 ></CharActions><hr />
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

}<hr />
            <CharSpecialActions playerStats={playerStats}></CharSpecialActions><hr />
            <CharInventory playerStats={playerStats}></CharInventory><hr />
            <div className='no-print'><CharCharacterAdvancement playerStats={playerStats} campaignName={campaignName}></CharCharacterAdvancement></div>
        </div>}
    </React.Fragment>)
}

export default CharSheet
