
import { useEffect, useState, useCallback } from 'react';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js'
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js'
import { buildAbilityDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasSaveAdvantage } from '../../services/combat/conditions/conditionEffects.js';
import { loadEquipment } from '../../services/ui/dataLoader.js';
import { isProficientSkillOrToolCheck } from '../../services/rules/psiBolsteredKnack.js'
import './CharAbilities.css'

const INTERNAL_SKILL_CHECK_EVENT = 'internal-skill-check';

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

const SKILL_TO_ABILITY = {
    'Athletics': 'STR', 'Acrobatics': 'DEX', 'Sleight of Hand': 'DEX', 'Stealth': 'DEX',
    'Arcana': 'INT', 'History': 'INT', 'Investigation': 'INT', 'Nature': 'INT', 'Religion': 'INT',
    'Animal Handling': 'WIS', 'Insight': 'WIS', 'Medicine': 'WIS', 'Perception': 'WIS', 'Survival': 'WIS',
    'Deception': 'CHA', 'Intimidation': 'CHA', 'Performance': 'CHA', 'Persuasion': 'CHA',
    'Strength': 'STR', 'Dexterity': 'DEX', 'Constitution': 'CON', 'Intelligence': 'INT', 'Wisdom': 'WIS', 'Charisma': 'CHA',
};

const CHARISMA_SKILLS = ['Deception', 'Intimidation', 'Performance', 'Persuasion'];

const isStrCheckName = (checkName, abbr) => abbr === 'STR' || checkName === 'Strength';

function resolveCancelingForcedMode(ce, checkName) {
    let forcedMode = ce?.abilityCheckDisadvantage ? 'disadvantage' : undefined;
    if (ce?.abilityCheckAdvantage && (!ce?.abilityCheckAdvantageSkill || ce.abilityCheckAdvantageSkill === checkName)) {
        forcedMode = forcedMode === 'disadvantage' ? undefined : 'advantage';
    }
    return forcedMode;
}

const CHECK_FORCED_MODE_RULES = [
    // Peerless Athlete: skill-specific advantage (like expertise uses .includes(skill.name))
    { mode: 'advantage', guard: (ce, checkName) => ce?.peerlessAthleteAdvantageSkills?.includes(checkName) },
    // Check per-ability check advantage (e.g., Remarkable Athlete for STR)
    { mode: 'advantage', guard: (ce, checkName, abilityForCheck) => abilityForCheck && ce?.abilityCheckAdvantageAbilities?.includes(abilityForCheck) },
    // Check skill-specific advantage (e.g., Actor feat for Deception/Performance)
    { mode: 'advantage', guard: (ce, checkName) => ce?.abilityCheckAdvantageSkills?.includes(checkName) },
    // Powerful Build: advantage on STR checks to escape grapple
    { mode: 'advantage', guard: (ce, checkName, abilityForCheck, abbr) => ce?.strCheckAdvantage && (isStrCheckName(checkName, abbr) || checkName === 'Athletics') },
    // Ray of Enfeeblement: STR-based d20 tests have disadvantage
    { mode: 'disadvantage', guard: (ce, checkName, abilityForCheck, abbr) => ce?.strCheckDisadvantage && isStrCheckName(checkName, abbr) },
    // Hex: ability check disadvantage for chosen ability
    { mode: 'disadvantage', guard: (ce, checkName, abilityForCheck) => abilityForCheck && ce?.abilityCheckDisadvantageAbilities?.includes(abilityForCheck) },
];

function resolveCheckForcedMode(conditionEffects, checkName) {
    const ce = conditionEffects;
    const cancelingMode = resolveCancelingForcedMode(ce, checkName);
    if (cancelingMode) return cancelingMode;
    const abilityForCheck = SKILL_TO_ABILITY[checkName];
    const abbr = checkName.substring(0, 3).toUpperCase();
    for (const rule of CHECK_FORCED_MODE_RULES) {
        if (rule.guard(ce, checkName, abilityForCheck, abbr)) return rule.mode;
    }
    return undefined;
}

function applyAbilityCheckReplacements(ctx, conditionEffects, playerStats) {
    if (conditionEffects?.strCheckReplace) {
        const strAbility = playerStats?.abilities?.find(a => a.name === 'Strength');
        ctx.strCheckReplace = true;
        ctx.strScore = strAbility?.totalScore || 10;
    }
    if (conditionEffects?.wisCheckReplace) {
        const wisAbility = playerStats?.abilities?.find(a => a.name === 'Wisdom');
        const wisMod = wisAbility?.bonus || 0;
        ctx.wisCheckReplace = true;
        ctx.wisCheckMinBonus = Math.max(1, wisMod);
    }
}

function applyPsiBolsteredKnack(ctx, playerStats, cls, checkName) {
    const isSoulknife = cls.name === 'Rogue'
        && ((cls.major || {}).name || (cls.subclass || {}).name) === 'Soulknife';
    const level = playerStats?.level || 0;
    if (!isSoulknife || level < 3 || !isProficientSkillOrToolCheck(playerStats, checkName)) return;
    const classLevel = (cls.class_levels || []).find(cl => cl.level === playerStats.level);
    const energy = classLevel?.energy || {};
    ctx.psiBolsteredKnack = true;
    ctx.psiBolsteredKnackDieSize = energy.energy_die_type || 6;
}

function applyCheckFeatureContext(ctx, conditionEffects, playerStats, checkName, luckyDisadvantageActive) {
    const ce = conditionEffects || {};
    if (ce.tacticalMind) {
        ctx.tacticalMind = true;
        ctx.tacticalMindBonus = ce.tacticalMindBonus || null;
    }
    if (ce.darkOnesLuck) {
        ctx.darkOnesLuck = true;
    }
    // Reliable Talent floors ONLY proficient skill/tool checks (CLA-291) — raw ability checks excluded
    if (ce.reliableTalent && isProficientSkillOrToolCheck(playerStats, checkName)) {
        ctx.reliableTalent = true;
    }
    if (ce.strokeOfLuck) {
        ctx.strokeOfLuck = true;
    }
    if (ce.luckyAdvantage) {
        ctx.luckyAdvantage = true; ctx.luckyAdvantageType = 'advantage';
    }
    if (ce.luckyDisadvantage || luckyDisadvantageActive) {
        ctx.luckyDisadvantage = true; ctx.luckyDisadvantageType = 'disadvantage';
    }
    if (ce.d20Floor10) {
        ctx.d20Floor10 = true;
    }
    if (ce.autoRerollForChecks) {
        ctx.autoReroll = true;
        ctx.autoRerollCondition = ce.autoRerollCondition;
        ctx.autoRerollBonus = ce.autoRerollBonus || null;
    }
    applyPsiBolsteredKnack(ctx, playerStats, playerStats?.class || {}, checkName);
}

function spellResistanceSaveSource(conditionEffects, playerStats) {
    if (!conditionEffects?.saveAdvantage?.includes('against_spell')) return null;
    const saveModifiers = playerStats?.saveModifiers || playerStats?.computedStats?.saveModifiers || [];
    const spellResistMod = saveModifiers.find(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition === 'against_spell');
    return spellResistMod?.source || 'Spell Resistance';
}

function otherSaveAdvantageSource(conditionEffects, playerStats) {
    if ((conditionEffects?.saveAdvantageCount || 0) <= 0) return null;
    const saveModifiers = playerStats?.saveModifiers || playerStats?.computedStats?.saveModifiers || [];
    const mods = saveModifiers.filter(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition !== 'against_spell');
    return mods.length > 0 ? mods.map(m => m.source).join(', ') : null;
}

function wardingBondBonusParts(conditionEffects) {
    const parts = [];
    if (!conditionEffects?.saveBonusExpression) return parts;
    const match = conditionEffects.saveBonusExpression.match(/\+\s*(\d+)/g);
    if (match) {
        match.forEach(m => {
            const val = parseInt(m.replace(/\+\s*/, ''), 10);
            if (val > 0) parts.push(`+${val} [Warding Bond]`);
        });
    }
    return parts;
}

function resolveSaveForcedMode(conditionEffects, abbr, autoFail) {
    let forcedMode = undefined;
    const restoreBalance = conditionEffects?.restoreBalance;
    if (restoreBalance) {
        forcedMode = 'normal';
    } else if (!autoFail && conditionEffects?.saveDisadvantage?.includes(abbr)) {
        forcedMode = 'disadvantage';
    }
    if (!autoFail && !restoreBalance && !forcedMode && (conditionEffects?.saveAdvantageCount || 0) > 0) {
        forcedMode = 'advantage';
    }
    if (!autoFail && !restoreBalance && !forcedMode && conditionEffects?.saveAdvantageAbilities?.includes(abbr.toUpperCase())) {
        forcedMode = 'advantage';
    }
    return forcedMode;
}

function buildStrSaveReplaceExtras(_ce, playerStats) {
    const abilities = playerStats?.abilities || [];
    const strAbility = abilities.find(a => a.name === 'Strength');
    return { strSaveReplace: true, strScore: strAbility?.totalScore || 10 };
}

const SAVE_FEATURE_EXTRA_BUILDERS = [
    [ce => !!ce.autoRerollForSaves, ce => ({ autoReroll: true, autoRerollCondition: ce.autoRerollCondition, autoRerollBonus: ce.autoRerollBonus || null })],
    [ce => !!ce.strokeOfLuck, () => ({ strokeOfLuck: true })],
    [ce => !!ce.luckyAdvantage, () => ({ luckyAdvantage: true })],
    [ce => !!ce.luckyDisadvantage, () => ({ luckyDisadvantage: true })],
    [ce => !!ce.strSaveReplace, buildStrSaveReplaceExtras],
    [ce => !!ce.d20Floor10, () => ({ d20Floor10: true })],
    [ce => !!ce.darkOnesLuck, () => ({ darkOnesLuck: true })],
];

function buildSaveFeatureExtras(conditionEffects, playerStats, luckyDisadvantageActive) {
    const ce = {
        ...(conditionEffects || {}),
        luckyDisadvantage: !!(conditionEffects?.luckyDisadvantage || luckyDisadvantageActive),
    };
    for (const [matches, build] of SAVE_FEATURE_EXTRA_BUILDERS) {
        if (matches(ce)) return build(ce, playerStats);
    }
    return {};
}

function computeCharismaReplacedBonus(playerStats, skill, exhaustionPenalty) {
    const wisAbility = playerStats?.abilities?.find(a => a.name === 'Wisdom');
    const wisMod = wisAbility?.bonus || 0;
    const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
    let newBonus = Math.max(1, wisMod);
    if (playerStats.skillProficiencies?.includes(skill.name)) {
        newBonus += proficiency;
    }
    if (playerStats.expertise?.includes(skill.name)) {
        newBonus += proficiency;
    }
    return newBonus - exhaustionPenalty;
}

function computeRageSkillBonus(playerStats, skill, exhaustionPenalty) {
    const primalSkills = playerStats?.automation?.primalKnowledge || [];
    if (!primalSkills.includes(skill.name)) return undefined;
    const strengthAbility = playerStats?.abilities?.find(a => a.name === 'Strength');
    if (!strengthAbility) return undefined;
    const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
    let strengthBonus = strengthAbility.bonus;
    if (playerStats.skillProficiencies?.includes(skill.name)) {
        strengthBonus += proficiency;
    }
    if (playerStats.expertise?.includes(skill.name)) {
        strengthBonus += proficiency;
    }
    return strengthBonus - exhaustionPenalty;
}

function buildToolsByAbility(allInventoryItems, toolMap, proficiencySet, abilitiesByName, proficiency) {
    const toolsByAbility = {};
    for (const itemName of allInventoryItems) {
        const tool = toolMap[itemName];
        if (!tool) continue;
        const abilityName = tool.ability;
        const ability = abilitiesByName[abilityName];
        if (!ability) continue;
        const isProficient = proficiencySet.has(itemName);
        const bonus = isProficient
            ? ability.bonus + proficiency
            : ability.bonus;
        if (!toolsByAbility[abilityName]) {
            toolsByAbility[abilityName] = [];
        }
        if (!toolsByAbility[abilityName].some(t => t.name === itemName)) {
            toolsByAbility[abilityName].push({
                name: itemName,
                ability: abilityName,
                bonus,
                isProficient,
                utilize: tool.utilize,
            });
        }
    }
    return toolsByAbility;
}

function CharAbilities({ allAbilityScores, playerStats, campaignName, exhaustionPenalty = 0, conditionEffects, isRaging = false, _onReroll, _onStrokeOfLuck, characters, luckyDisadvantageActive }) {
      const abilityDesc = buildAbilityDetailHtml(allAbilityScores);
      const { setPopupHtml } = useDiceRollPopup();
      const { rollAbilityCheck, rollSavingThrow, rollSkillCheck } = useLoggedDiceRoll(playerStats.name, campaignName, { characters });

     const getAbilityCheckBonus = useCallback((ability, condEffects) => {
        if (condEffects?.wisCheckReplace && ability.name === 'Charisma') {
           const wisAbility = playerStats?.abilities?.find(a => a.name === 'Wisdom');
           const wisMod = wisAbility?.bonus || 0;
           return Math.max(1, wisMod);
        }
        return ability.bonus;
      }, [playerStats?.abilities]);

      const getSaveBonus = useCallback((abilityName) => {
         if (!conditionEffects?.saveBonusExpression) return 0;
         const abbr = abilityName.substring(0, 3).toUpperCase();
         if (conditionEffects.saveBonusAbilities && !conditionEffects.saveBonusAbilities.includes(abbr)) return 0;
         try {
             const parts = conditionEffects.saveBonusExpression.split('+').map(p => p.trim());
             let total = 0;
             for (const part of parts) {
                 if (part.includes('wisdom_modifier')) {
                     const wisAbility = playerStats?.abilities?.find(a => a.name === 'Wisdom');
                     total += wisAbility?.bonus || 0;
                 } else {
                     const parsed = parseInt(part, 10);
                     if (!isNaN(parsed)) total += parsed;
                 }
             }
             return total;
         } catch (_e) { return 0; }
      }, [playerStats?.abilities, conditionEffects?.saveBonusExpression, conditionEffects?.saveBonusAbilities]);

        const getSkillBonus = useCallback((skill) => {
            let bonus = skill.bonus - exhaustionPenalty;
            if (conditionEffects?.wisCheckReplace && CHARISMA_SKILLS.includes(skill.name)) {
                bonus = computeCharismaReplacedBonus(playerStats, skill, exhaustionPenalty);
            }
            if (isRaging) {
                const rageBonus = computeRageSkillBonus(playerStats, skill, exhaustionPenalty);
                if (rageBonus !== undefined) bonus = rageBonus;
            }
            const isJackOfAllTrades = playerStats?.automation?.passives?.some(
                p => p.type === 'jack_of_all_trades'
            );
            const isNotProficient = !playerStats?.skillProficiencies?.includes(skill.name);
            if (isJackOfAllTrades && isNotProficient) {
                const prof = Math.floor((playerStats.level - 1) / 4 + 2);
                bonus += Math.floor(prof / 2);
            }
            if (conditionEffects?.passWithoutTraceBonus && skill.name === 'Stealth') {
                bonus += parseInt(conditionEffects.passWithoutTraceBonus, 10);
            }
            return bonus;
        }, [exhaustionPenalty, isRaging, playerStats, conditionEffects?.passWithoutTraceBonus, conditionEffects?.wisCheckReplace]);

            const makeCheckContext = useCallback((checkName) => {
                const forcedMode = resolveCheckForcedMode(conditionEffects, checkName);
                const ctx = forcedMode ? { forcedMode } : {};
                applyAbilityCheckReplacements(ctx, conditionEffects, playerStats);
                applyCheckFeatureContext(ctx, conditionEffects, playerStats, checkName, luckyDisadvantageActive);
                return Object.keys(ctx).length > 0 ? ctx : undefined;
            }, [conditionEffects, playerStats, luckyDisadvantageActive]);

        const makeSaveContext = (abilityName) => {
           const abbr = abilityName.substring(0, 3).toLowerCase()
           const autoFail = conditionEffects?.autoFailSaves?.includes(abbr)
           const forcedMode = resolveSaveForcedMode(conditionEffects, abbr, autoFail)
           const featureExtras = buildSaveFeatureExtras(conditionEffects, playerStats, luckyDisadvantageActive)
           return { forcedMode, autoFail: autoFail || undefined, ...featureExtras }
        }

         const [toolEntries, setToolEntries] = useState([]);
         const [equipmentLoaded, setEquipmentLoaded] = useState(false);

           useEffect(() => {
               const loadTools = async () => {
                   const equipment = await loadEquipment();
                   const toolMap = {};
                   for (const item of equipment) {
                       if (item.equipment_category === 'Tools' && item.ability) {
                           toolMap[item.name] = item;
                       }
                   }
                   const proficiencySet = new Set(playerStats.toolProficiencies || []);
                   const allInventoryItems = [
                       ...(playerStats.inventory?.equipped || []),
                       ...(playerStats.inventory?.backpack || []),
                   ];
                   const abilitiesByName = {};
                   for (const ab of playerStats.abilities || []) {
                       abilitiesByName[ab.name] = ab;
                   }
                   const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
                   const toolsByAbility = buildToolsByAbility(allInventoryItems, toolMap, proficiencySet, abilitiesByName, proficiency);
                  const entries = [];
                  for (const ability of playerStats.abilities || []) {
                      if (toolsByAbility[ability.name]) {
                          entries.push({
                              ability: ability.name,
                              tools: toolsByAbility[ability.name],
                          });
                      }
                  }
                  setToolEntries(entries);
                  setEquipmentLoaded(true);
              };
              loadTools();
          }, [playerStats]);



          const getSaveAdvantageSource = () => {
           const parts = [];
           const spellSource = spellResistanceSaveSource(conditionEffects, playerStats);
           if (spellSource) parts.push(spellSource);
           const otherSource = otherSaveAdvantageSource(conditionEffects, playerStats);
           if (otherSource) parts.push(otherSource);
           parts.push(...wardingBondBonusParts(conditionEffects));
           return parts.length > 0 ? parts.join(', ') : null;
          }

         useEffect(() => {
             const handler = (e) => {
                 const { skillName, checkType } = e.detail || {};
                 if (!skillName) return;
                 if (checkType === 'check') {
                     const ability = playerStats?.abilities?.find(a => a.name === skillName);
                     if (ability) {
                         rollAbilityCheck(skillName, ability.bonus - exhaustionPenalty, makeCheckContext(skillName));
                     }
                 } else {
                      const skill = playerStats?.abilities?.flatMap(a => a.skills || []).find(s => s.name === skillName);
                      if (skill) {
                           rollSkillCheck(skillName, getSkillBonus(skill), makeCheckContext(skillName));
                      }
                 }
             };
             window.addEventListener(INTERNAL_SKILL_CHECK_EVENT, handler);
             return () => window.removeEventListener(INTERNAL_SKILL_CHECK_EVENT, handler);
           }, [playerStats, campaignName, exhaustionPenalty, conditionEffects, isRaging, rollSkillCheck, rollAbilityCheck, getSkillBonus, makeCheckContext]);

    return (
        <div className='char-abilities'>
            <div className='sectionHeader'>Abilities</div>
            <div className='tableHeader'>
                <div className='left'><b>Name</b></div>
                <div><b>Score</b></div>
                <div><b>Bonus</b></div>
                <div><b>Save</b></div>
                <div className='left'><b>Skills</b></div>
            </div>
            {playerStats.abilities.map((ability) => {
                const saveContext = makeSaveContext(ability.name)
                const abbr = ability.name.substring(0, 3).toLowerCase()
                const autoFailSave = conditionEffects?.autoFailSaves?.includes(abbr)
                return <div key={ability.name} className='abilities'>
                    <div className='clickable left' onClick={() => setPopupHtml(abilityDesc(ability.name))}>{ability.name}</div>
                    <div>{ability.totalScore}</div>
                    <div className={'clickable' + (exhaustionPenalty > 0 || conditionEffects?.abilityCheckDisadvantage || (conditionEffects?.abilityCheckDisadvantageAbilities?.includes(ability.name)) ? ' stat--penalized' : '')} onClick={() => {
                          const checkCtx = { ...makeCheckContext(ability.name) };
                          const biDie = getRuntimeValue(playerStats.name, 'bardicInspirationDie', campaignName);
                          if (biDie) {
                            checkCtx.bardicInspiration = true;
                            checkCtx.bardicInspirationDie = biDie;
                          }
                          const checkBonus = getAbilityCheckBonus(ability, conditionEffects);
                          rollAbilityCheck(ability.name, checkBonus - exhaustionPenalty, checkCtx);
                        }}>{signFormatter.format(getAbilityCheckBonus(ability, conditionEffects) - exhaustionPenalty)}</div>
                       <div className={'clickable' + (exhaustionPenalty > 0 || autoFailSave || conditionEffects?.saveDisadvantage?.length > 0 ? ' stat--penalized' : '') + (hasSaveAdvantage(conditionEffects, ability.name, conditionEffects?.restoreBalance) ? ' stat--buffed' : '')} onClick={() => {
                           if (!autoFailSave) {
                             const saveCtx = { ...saveContext };
                             const biDie = getRuntimeValue(playerStats.name, 'bardicInspirationDie', campaignName);
                             if (biDie) {
                               saveCtx.bardicInspiration = true;
                               saveCtx.bardicInspirationDie = biDie;
                             }
                             const saveBonus = getSaveBonus(ability.name);
                              rollSavingThrow(ability.name, ability.save + saveBonus - exhaustionPenalty, saveCtx);
                            }
                          }} title={getSaveAdvantageSource()}>{autoFailSave ? 'AUTO FAIL' : signFormatter.format(ability.save + getSaveBonus(ability.name) - exhaustionPenalty)}{hasSaveAdvantage(conditionEffects, ability.name, conditionEffects?.restoreBalance) ? ' (Adv)' : ''}</div>
                      <div className='left'>{(() => {
                            const allSkills = ability.skills;
                            const toolList = equipmentLoaded
                                ? (toolEntries.find(e => e.ability === ability.name)?.tools || [])
                                : [];
                            const allItems = [...allSkills, ...toolList];
                            return allItems.map((item, idx) => {
                                if (allSkills.includes(item)) {
                                    const skill = item;
                                    const skillBonus = getSkillBonus(skill);
                                    const isExpert = playerStats.expertise?.includes(skill.name);
                                    return <span key={skill.name} className='skills'>
                                        <span className={'clickable' + (exhaustionPenalty > 0 || conditionEffects?.abilityCheckDisadvantage || (conditionEffects?.abilityCheckDisadvantageAbilities?.includes(ability.name)) ? ' stat--penalized' : '')} onClick={() => {
                                            const checkCtx = { ...makeCheckContext(skill.name) };
                                            const biDie = getRuntimeValue(playerStats.name, 'bardicInspirationDie', campaignName);
                                            if (biDie) {
                                                checkCtx.bardicInspiration = true;
                                                checkCtx.bardicInspirationDie = biDie;
                                            }
                                            rollSkillCheck(skill.name, skillBonus, checkCtx);
                                        }}>{skill.name}{isExpert ? ' (Expert)' : ''} ({signFormatter.format(skillBonus)})</span>
                                        {idx < allItems.length - 1 ? ', ' : ''}
                                    </span>;
                                } else {
                                    const tool = item;
                                    const toolBonus = tool.bonus - exhaustionPenalty;
                                    return <span key={tool.name}>
                                        <span className={'clickable' + (exhaustionPenalty > 0 || conditionEffects?.abilityCheckDisadvantage || (conditionEffects?.abilityCheckDisadvantageAbilities?.includes(ability.name)) ? ' stat--penalized' : '')} onClick={() => {
                                            const checkCtx = { ...makeCheckContext(tool.name) };
                                            const biDie = getRuntimeValue(playerStats.name, 'bardicInspirationDie', campaignName);
                                            if (biDie) {
                                                checkCtx.bardicInspiration = true;
                                                checkCtx.bardicInspirationDie = biDie;
                                            }
                                            rollAbilityCheck(tool.name, toolBonus, checkCtx);
                                        }}>{tool.name} ({signFormatter.format(toolBonus)})</span>
                                        {idx < allItems.length - 1 ? ', ' : ''}
                                    </span>;
                                }
                            });
                        })()}</div>
                </div>;
            })}
        </div>
    )
}

export default CharAbilities
