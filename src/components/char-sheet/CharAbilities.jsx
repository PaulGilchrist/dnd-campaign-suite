
import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'
import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import { buildAbilityDetailHtml } from '../../hooks/useActionPopup.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { getRuntimeValue } from '../../hooks/useRuntimeState.js';
import './CharAbilities.css'

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

function CharAbilities({ allAbilityScores, playerStats, campaignName, exhaustionPenalty = 0, conditionEffects, isRaging = false, onReroll }) {
     const abilityDesc = buildAbilityDetailHtml(allAbilityScores);
     const { popupHtml, setPopupHtml, rollAbilityCheck, rollSavingThrow, rollSkillCheck } = useLoggedDiceRoll(playerStats.name, campaignName);

     const getCosmicOmenBonus = () => {
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
         } catch (e) { /* ignore */ }
         return 0;
     };

     const getPrimalKnowledgeSkills = () => {
         const automation = playerStats?.automation;
         return automation?.primalKnowledge || [];
     };

      const getSkillBonus = (skill) => {
          let bonus = skill.bonus - exhaustionPenalty;
          if (isRaging) {
              const primalSkills = getPrimalKnowledgeSkills();
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
          return bonus;
      };

        const makeCheckContext = (checkName) => {
           let forcedMode = undefined
           if (conditionEffects?.abilityCheckDisadvantage) forcedMode = 'disadvantage'
           if (conditionEffects?.abilityCheckAdvantage && (!conditionEffects?.abilityCheckAdvantageSkill || conditionEffects.abilityCheckAdvantageSkill === checkName)) {
             forcedMode = forcedMode === 'disadvantage' ? undefined : 'advantage'
           }
           // Check per-ability check advantage (e.g., Remarkable Athlete for STR)
           if (!forcedMode && conditionEffects?.abilityCheckAdvantageAbilities) {
             const abbr = checkName.substring(0, 3).toUpperCase();
             if (conditionEffects.abilityCheckAdvantageAbilities.includes(abbr)) {
               forcedMode = 'advantage'
             }
           }
           const ctx = forcedMode ? { forcedMode } : undefined
           if (conditionEffects?.strCheckReplace) {
             const strAbility = playerStats?.abilities?.find(a => a.name === 'Strength');
             return { ...ctx, strCheckReplace: true, strScore: strAbility?.totalScore || 10 }
           }
           if (conditionEffects?.wisCheckReplace) {
             const wisAbility = playerStats?.abilities?.find(a => a.name === 'Wisdom');
             const wisMod = wisAbility?.bonus || 0;
             const minBonus = Math.max(1, wisMod);
             return { ...ctx, wisCheckReplace: true, wisCheckMinBonus: minBonus }
           }
           if (conditionEffects?.tacticalMind) {
            return { ...ctx, tacticalMind: true, tacticalMindBonus: conditionEffects.tacticalMindBonus || null }
          }
          return ctx
        }

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
         if (conditionEffects?.strSaveReplace) {
            const strAbility = playerStats?.abilities?.find(a => a.name === 'Strength');
            return { forcedMode, autoFail: autoFail || undefined, strSaveReplace: true, strScore: strAbility?.totalScore || 10 }
          }
         return { forcedMode, autoFail: autoFail || undefined }
      }

        const hasSaveAdvantage = (abilityName) => {
         return (conditionEffects?.saveAdvantageCount || 0) > 0 || conditionEffects?.saveAdvantageAbilities?.includes(abilityName.substring(0, 3).toUpperCase());
        }

    return (
        <div className='abilities-popup-parent'>
                {popupHtml && (
                    <Popup onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)}>
                        {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> : 
                         <DiceRollResult {...popupHtml} onReroll={onReroll} />}
                    </Popup>
                )}
            <div className='abilities'>
                <div className='left'><b>Ability</b></div>
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
                    <div className={'clickable' + (exhaustionPenalty > 0 || conditionEffects?.abilityCheckDisadvantage ? ' stat--penalized' : '')} onClick={() => rollAbilityCheck(ability.name, ability.bonus - exhaustionPenalty + getCosmicOmenBonus(), makeCheckContext(ability.name))}>{signFormatter.format(ability.bonus - exhaustionPenalty + getCosmicOmenBonus())}</div>
                     <div className={'clickable' + (exhaustionPenalty > 0 || autoFailSave || conditionEffects?.saveDisadvantage?.length > 0 ? ' stat--penalized' : '') + (hasSaveAdvantage(ability.name) ? ' stat--buffed' : '')} onClick={() => !autoFailSave && rollSavingThrow(ability.name, ability.save - exhaustionPenalty + getCosmicOmenBonus(), saveContext)}>{autoFailSave ? 'AUTO FAIL' : signFormatter.format(ability.save - exhaustionPenalty + getCosmicOmenBonus())}{hasSaveAdvantage(ability.name) ? ' (Adv)' : ''}</div>
                    <div className='left'>{ability.skills.map((skill) => {
                        const skillBonus = getSkillBonus(skill);
                        return <span key={skill.name}>
                            <span className={'clickable' + (exhaustionPenalty > 0 || conditionEffects?.abilityCheckDisadvantage ? ' stat--penalized' : '')} onClick={() => rollSkillCheck(skill.name, skillBonus + getCosmicOmenBonus(), makeCheckContext(skill.name))}>{skill.name} ({signFormatter.format(skillBonus + getCosmicOmenBonus())})</span>
                            {ability.skills.indexOf(skill) < ability.skills.length - 1 ? ', ' : ''}
                        </span>;
                    })}</div>
                </div>;
            })}
        </div>
    )
}

export default CharAbilities
