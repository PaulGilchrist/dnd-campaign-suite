
import { useEffect, useCallback } from 'react';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js'
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js'
import { buildAbilityDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import './CharAbilities.css'

const INTERNAL_SKILL_CHECK_EVENT = 'internal-skill-check';

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

function CharAbilities({ allAbilityScores, playerStats, campaignName, exhaustionPenalty = 0, conditionEffects, isRaging = false, _onReroll, _onStrokeOfLuck }) {
     const abilityDesc = buildAbilityDetailHtml(allAbilityScores);
     const { setPopupHtml } = useDiceRollPopup();
     const { rollAbilityCheck, rollSavingThrow, rollSkillCheck } = useLoggedDiceRoll(playerStats.name, campaignName);

    const getCosmicOmenBonus = useCallback(() => {
        const stored = getRuntimeValue(playerStats.name, 'cosmicOmenEffect', campaignName);
        if (!stored) return 0;
        try {
            const effect = JSON.parse(stored);
            if (effect.type === 'Weal' && effect.isEven) {
                return effect.d6Value || 0;
            }
            if (effect.type === 'Woe' && !effect.isEven) {
                return -(effect.d6Value || 0);
            }
         } catch (_e) { /* ignore */ }
        return 0;
     }, [playerStats.name, campaignName]);

       const getSkillBonus = useCallback((skill) => {
            let bonus = skill.bonus - exhaustionPenalty;
            if (isRaging) {
                const primalSkills = playerStats?.automation?.primalKnowledge || [];
                if (primalSkills.includes(skill.name)) {
                    const strengthAbility = playerStats?.abilities?.find(a => a.name === 'Strength');
                    if (strengthAbility) {
                         const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
                         const proficient = playerStats.skillProficiencies?.includes(skill.name);
                         const expertise = playerStats.expertise?.includes(skill.name);
                        let strengthBonus = strengthAbility.bonus;
                        if (proficient) {
                            strengthBonus += proficiency;
                        }
                        if (expertise) {
                            strengthBonus += proficiency;
                        }
                        bonus = strengthBonus - exhaustionPenalty;
                    }
                }
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
        }, [exhaustionPenalty, isRaging, playerStats, conditionEffects?.passWithoutTraceBonus]);

           const makeCheckContext = useCallback((checkName) => {
              let forcedMode = undefined
              if (conditionEffects?.abilityCheckDisadvantage) forcedMode = 'disadvantage'
              if (conditionEffects?.abilityCheckAdvantage && (!conditionEffects?.abilityCheckAdvantageSkill || conditionEffects.abilityCheckAdvantageSkill === checkName)) {
                forcedMode = forcedMode === 'disadvantage' ? undefined : 'advantage'
              }
                 // Check per-ability check advantage (e.g., Remarkable Athlete for STR)
                 if (!forcedMode && conditionEffects?.abilityCheckAdvantageAbilities) {
                   const skillToAbility = {
                     'ATH': 'STR', 'STR': 'STR', 'Strength': 'STR',
                     'ACR': 'DEX', 'DEX': 'DEX', 'Sle': 'DEX', 'Ste': 'DEX', 'Dexterity': 'DEX',
                     'CON': 'CON', 'Constitution': 'CON',
                     'ARC': 'INT', 'INT': 'INT', 'His': 'INT', 'Inv': 'INT', 'Nat': 'INT', 'Rel': 'INT',
                     'Animal Handling': 'WIS', 'Ins': 'WIS', 'WIS': 'WIS', 'Med': 'WIS', 'Per': 'WIS', 'Sur': 'WIS',
                      'Dec': 'CHA', 'Int': 'CHA', 'Perf': 'CHA', 'PER': 'CHA', 'Pers': 'CHA', 'CHA': 'CHA', 'Charisma': 'CHA',
                   };
                   const abbr = checkName.substring(0, 3).toUpperCase();
                   const abilityForCheck = skillToAbility[checkName] || skillToAbility[abbr];
                   if (abilityForCheck && conditionEffects.abilityCheckAdvantageAbilities.includes(abilityForCheck)) {
                     forcedMode = 'advantage'
                   }
                 }
              // Ray of Enfeeblement: STR-based d20 tests have disadvantage
              if (!forcedMode && conditionEffects?.strCheckDisadvantage) {
                const abbr = checkName.substring(0, 3).toUpperCase();
                if (abbr === 'STR' || checkName === 'Strength') {
                  forcedMode = 'disadvantage'
                }
              }
             const ctx = forcedMode ? { forcedMode } : {}
             if (conditionEffects?.strCheckReplace) {
               const strAbility = playerStats?.abilities?.find(a => a.name === 'Strength');
               ctx.strCheckReplace = true;
               ctx.strScore = strAbility?.totalScore || 10
             }
             if (conditionEffects?.wisCheckReplace) {
               const wisAbility = playerStats?.abilities?.find(a => a.name === 'Wisdom');
               const wisMod = wisAbility?.bonus || 0;
               const minBonus = Math.max(1, wisMod);
               ctx.wisCheckReplace = true;
               ctx.wisCheckMinBonus = minBonus
             }
              if (conditionEffects?.tacticalMind) {
                ctx.tacticalMind = true;
                ctx.tacticalMindBonus = conditionEffects.tacticalMindBonus || null
              }
              if (conditionEffects?.reliableTalent) {
                ctx.reliableTalent = true
              }
                if (conditionEffects?.strokeOfLuck) {
                  ctx.strokeOfLuck = true
                }
                if (conditionEffects?.luckyAdvantage) {
                  ctx.luckyAdvantage = true; ctx.luckyAdvantageType = 'advantage'
                }
                if (conditionEffects?.luckyDisadvantage) {
                  ctx.luckyDisadvantage = true; ctx.luckyDisadvantageType = 'disadvantage'
                }
               if (conditionEffects?.d20Floor10) {
                  ctx.d20Floor10 = true
                }
                const isSoulknife = playerStats?.class?.name === 'Rogue' && playerStats?.class?.major?.name === 'Soulknife';
                const hasPsiBolsteredKnack = isSoulknife && (playerStats?.level || 0) >= 3;
                if (hasPsiBolsteredKnack) {
                  const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
                  ctx.psiBolsteredKnack = true;
                  ctx.psiBolsteredKnackDieSize = classLevel?.energy?.energy_die_type || 6;
                }
                return Object.keys(ctx).length > 0 ? ctx : undefined
          }, [conditionEffects, playerStats]);

       const makeSaveContext = (abilityName) => {
          const abbr = abilityName.substring(0, 3).toLowerCase()
          const autoFail = conditionEffects?.autoFailSaves?.includes(abbr)
          let forcedMode = undefined
          if (!autoFail && conditionEffects?.saveDisadvantage?.includes(abbr)) {
            forcedMode = 'disadvantage'
          }
           if (!autoFail && !forcedMode && (conditionEffects?.saveAdvantageCount || 0) > 0) {
            forcedMode = 'advantage'
             }
           if (!autoFail && !forcedMode && conditionEffects?.saveAdvantageAbilities?.includes(abilityName.substring(0, 3).toUpperCase())) {
            forcedMode = 'advantage'
           }
           if (conditionEffects?.autoReroll) {
             return { forcedMode, autoFail: autoFail || undefined, autoReroll: true, autoRerollCondition: conditionEffects.autoRerollCondition, autoRerollBonus: conditionEffects.autoRerollBonus || null }
           }
             if (conditionEffects?.strokeOfLuck) {
               return { forcedMode, autoFail: autoFail || undefined, strokeOfLuck: true }
             }
             if (conditionEffects?.luckyAdvantage) {
               return { forcedMode, autoFail: autoFail || undefined, luckyAdvantage: true }
             }
            if (conditionEffects?.luckyDisadvantage) {
              return { forcedMode, autoFail: autoFail || undefined, luckyDisadvantage: true }
            }
           if (conditionEffects?.strSaveReplace) {
             const strAbility = playerStats?.abilities?.find(a => a.name === 'Strength');
             return { forcedMode, autoFail: autoFail || undefined, strSaveReplace: true, strScore: strAbility?.totalScore || 10 }
           }
          if (conditionEffects?.d20Floor10) {
            return { forcedMode, autoFail: autoFail || undefined, d20Floor10: true }
          }
          return { forcedMode, autoFail: autoFail || undefined }
      }

        const hasSaveAdvantage = (abilityName) => {
          return (conditionEffects?.saveAdvantageCount || 0) > 0 || conditionEffects?.saveAdvantageAbilities?.includes(abilityName.substring(0, 3).toUpperCase());
         }

        const getSaveAdvantageSource = () => {
          if (conditionEffects?.saveAdvantage?.includes('against_spell')) {
            const saveModifiers = playerStats?.saveModifiers || playerStats?.computedStats?.saveModifiers || [];
            const spellResistMod = saveModifiers.find(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition === 'against_spell');
            return spellResistMod?.source || 'Spell Resistance';
          }
          if ((conditionEffects?.saveAdvantageCount || 0) > 0) {
            const saveModifiers = playerStats?.saveModifiers || playerStats?.computedStats?.saveModifiers || [];
            const mods = saveModifiers.filter(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition !== 'against_spell');
            if (mods.length > 0) return mods.map(m => m.source).join(', ');
          }
           return null;
         }

         useEffect(() => {
             const handler = (e) => {
                 const { skillName, checkType } = e.detail || {};
                 if (!skillName) return;
                 if (checkType === 'check') {
                     const ability = playerStats?.abilities?.find(a => a.name === skillName);
                     if (ability) {
                         rollAbilityCheck(skillName, ability.bonus - exhaustionPenalty + getCosmicOmenBonus(), makeCheckContext(skillName));
                     }
                 } else {
                     const skill = playerStats?.abilities?.flatMap(a => a.skills || []).find(s => s.name === skillName);
                     if (skill) {
                         rollSkillCheck(skillName, getSkillBonus(skill) + getCosmicOmenBonus(), makeCheckContext(skillName));
                     }
                 }
             };
             window.addEventListener(INTERNAL_SKILL_CHECK_EVENT, handler);
             return () => window.removeEventListener(INTERNAL_SKILL_CHECK_EVENT, handler);
          }, [playerStats, campaignName, exhaustionPenalty, conditionEffects, isRaging, rollSkillCheck, rollAbilityCheck, getCosmicOmenBonus, getSkillBonus, makeCheckContext]);

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
                    <div className={'clickable' + (exhaustionPenalty > 0 || conditionEffects?.abilityCheckDisadvantage ? ' stat--penalized' : '')} onClick={() => {
                          const checkCtx = { ...makeCheckContext(ability.name) };
                          const biDie = getRuntimeValue(playerStats.name, 'bardicInspirationDie', campaignName);
                          if (biDie) {
                            checkCtx.bardicInspiration = true;
                            checkCtx.bardicInspirationDie = biDie;
                          }
                          rollAbilityCheck(ability.name, ability.bonus - exhaustionPenalty + getCosmicOmenBonus(), checkCtx);
                        }}>{signFormatter.format(ability.bonus - exhaustionPenalty + getCosmicOmenBonus())}</div>
                      <div className={'clickable' + (exhaustionPenalty > 0 || autoFailSave || conditionEffects?.saveDisadvantage?.length > 0 ? ' stat--penalized' : '') + (hasSaveAdvantage(ability.name) ? ' stat--buffed' : '')} onClick={() => {
                          if (!autoFailSave) {
                            const saveCtx = { ...saveContext };
                            const biDie = getRuntimeValue(playerStats.name, 'bardicInspirationDie', campaignName);
                            if (biDie) {
                              saveCtx.bardicInspiration = true;
                              saveCtx.bardicInspirationDie = biDie;
                            }
                            rollSavingThrow(ability.name, ability.save - exhaustionPenalty + getCosmicOmenBonus(), saveCtx);
                          }
                        }} title={getSaveAdvantageSource()}>{autoFailSave ? 'AUTO FAIL' : signFormatter.format(ability.save - exhaustionPenalty + getCosmicOmenBonus())}{hasSaveAdvantage(ability.name) ? ' (Adv)' : ''}</div>
                    <div className='left'>{ability.skills.map((skill) => {
                         const skillBonus = getSkillBonus(skill);
                         return <span key={skill.name}>
                               <span className={'clickable' + (exhaustionPenalty > 0 || conditionEffects?.abilityCheckDisadvantage ? ' stat--penalized' : '')} onClick={() => {
                                  const checkCtx = { ...makeCheckContext(skill.name) };
                                  const biDie = getRuntimeValue(playerStats.name, 'bardicInspirationDie', campaignName);
                                  if (biDie) {
                                    checkCtx.bardicInspiration = true;
                                    checkCtx.bardicInspirationDie = biDie;
                                  }
                                  rollSkillCheck(skill.name, skillBonus + getCosmicOmenBonus(), checkCtx);
                                }}>{skill.name} ({signFormatter.format(skillBonus + getCosmicOmenBonus())})</span>
                             {ability.skills.indexOf(skill) < ability.skills.length - 1 ? ', ' : ''}
                         </span>;
                     })}</div>
                </div>;
            })}
        </div>
    )
}

export default CharAbilities
