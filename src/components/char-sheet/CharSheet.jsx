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

            setPlayerStats(stats);
        };
        fetchData();
    }, [allAbilityScores, allClasses, allClasses2024, allEquipment, allMagicItems, allRaces, allSpells, allSpells2024, playerSummary, allRaces2024, allMagicItems2024]);

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
    const conditionEffects = computeConditionEffects(activeConditions, allSaveModifiers, myTargetEffects, isRaging);
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
    }
    // Reckless Attack: enemies have Advantage on attack rolls against you
    if (Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'advantage_attacks_disadvantage_against')) {
        conditionEffects.targetAdvantageCount = (conditionEffects.targetAdvantageCount || 0) + 1;
    }

    const cannotAct = activeConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c))
    const conditionAttackMode = getNetAttackMode(conditionEffects.attackAdvantageCount, conditionEffects.attackDisadvantageCount)

    const handleReroll = React.useCallback(() => {
        if (playerStats) {
            setRuntimeValue(playerStats.name, 'fanaticalFocusUsed', true, campaignName);
        }
    }, [playerStats, campaignName]);

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
            <div className='no-print'><CharCharacterAdvancement playerStats={playerStats}></CharCharacterAdvancement></div>
        </div>}
    </React.Fragment>)
}

export default CharSheet
