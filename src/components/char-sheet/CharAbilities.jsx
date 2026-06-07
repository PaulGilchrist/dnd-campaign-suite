
import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'
import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import { buildAbilityDetailHtml } from '../../hooks/useActionPopup.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import './CharAbilities.css'

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

function CharAbilities({ allAbilityScores, playerStats, campaignName, exhaustionPenalty = 0, conditionEffects }) {
     const abilityDesc = buildAbilityDetailHtml(allAbilityScores);
     const { popupHtml, setPopupHtml, rollAbilityCheck, rollSavingThrow, rollSkillCheck } = useLoggedDiceRoll(playerStats.name, campaignName);

     const makeCheckContext = () => {
       const forcedMode = conditionEffects?.abilityCheckDisadvantage ? 'disadvantage' : undefined
       return forcedMode ? { forcedMode } : undefined
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
          return { forcedMode, autoFail: autoFail || undefined, autoReroll: true, autoRerollCondition: conditionEffects.autoRerollCondition }
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
                         <DiceRollResult {...popupHtml} />}
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
                const checkContext = makeCheckContext()
                const saveContext = makeSaveContext(ability.name)
                const abbr = ability.name.substring(0, 3).toLowerCase()
                const autoFailSave = conditionEffects?.autoFailSaves?.includes(abbr)
                return <div key={ability.name} className='abilities'>
                    <div className='clickable left' onClick={() => setPopupHtml(abilityDesc(ability.name))}>{ability.name}</div>
                    <div>{ability.totalScore}</div>
                    <div className={'clickable' + (exhaustionPenalty > 0 || conditionEffects?.abilityCheckDisadvantage ? ' stat--penalized' : '')} onClick={() => rollAbilityCheck(ability.name, ability.bonus - exhaustionPenalty, checkContext)}>{signFormatter.format(ability.bonus - exhaustionPenalty)}</div>
                     <div className={'clickable' + (exhaustionPenalty > 0 || autoFailSave || conditionEffects?.saveDisadvantage?.length > 0 ? ' stat--penalized' : '') + (hasSaveAdvantage(ability.name) ? ' stat--buffed' : '')} onClick={() => !autoFailSave && rollSavingThrow(ability.name, ability.save - exhaustionPenalty, saveContext)}>{autoFailSave ? 'AUTO FAIL' : signFormatter.format(ability.save - exhaustionPenalty)}{hasSaveAdvantage(ability.name) ? ' (Adv)' : ''}</div>
                    <div className='left'>{ability.skills.map((skill) => {
                        return <span key={skill.name}>
                            <span className={'clickable' + (exhaustionPenalty > 0 || conditionEffects?.abilityCheckDisadvantage ? ' stat--penalized' : '')} onClick={() => rollSkillCheck(skill.name, skill.bonus - exhaustionPenalty, checkContext)}>{skill.name} ({signFormatter.format(skill.bonus - exhaustionPenalty)})</span>
                            {ability.skills.indexOf(skill) < ability.skills.length - 1 ? ', ' : ''}
                        </span>;
                    })}</div>
                </div>;
            })}
        </div>
    )
}

export default CharAbilities
