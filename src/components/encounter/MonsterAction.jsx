import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { formatDamageTypes } from '../../services/rules/combat/damageUtils.js';
import { extractDamageDiceFromDescription } from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';

function formatDamageTypeList(types) {
  return types.length > 0 ? formatDamageTypes(types) : '';
}

function ActionDamageLinks({ action, actionDamageFormula, actionDamageTypeLabel, onDamage }) {
  if (action.save_dc != null || action.attack_bonus != null) return null;
  const hasSecondary = action.damage_dice_secondary != null;
  if (!actionDamageFormula && !hasSecondary) return null;
  return (
    <>
      {actionDamageFormula && (
        <span className="mc-dice-link" onClick={() => onDamage(action.name, actionDamageFormula, actionDamageTypeLabel, action)} role="button" tabIndex={0}>
          <i className="fa-solid fa-dice" /> {actionDamageFormula}
        </span>
      )}
      {hasSecondary && (
        <span className="mc-dice-link" onClick={() => onDamage(action.name, action.damage_dice_secondary, actionDamageTypeLabel, action)} role="button" tabIndex={0}>
          <i className="fa-solid fa-dice" /> {action.damage_dice_secondary}
        </span>
      )}
    </>
  );
}

function ActionSaveRoll({ action, attackerCannotAct, onSaveRoll }) {
  if (action.save_dc == null) return null;
  const saveDamageFormula = extractDamageDiceFromDescription(action?.description, action?.damage_dice_primary);
  const saveConditions = extractConditionsFromSaveEffect(action?.save_effect);
  const handleSaveRoll = () => {
    onSaveRoll(action, saveDamageFormula, saveConditions);
  };
  if (saveDamageFormula) {
    return (
      <span className="mc-dice-link" role="button" tabIndex={0} onClick={handleSaveRoll}>
        <i className="fa-solid fa-dice" /> {saveDamageFormula}
      </span>
    );
  }
  const clickable = !action.attack_bonus && !attackerCannotAct;
  return (
    <span className={`mc-dice-link ${clickable ? 'mc-dice-link-save mc-dice-link-save-clickable' : 'mc-dice-link-save'}`} onClick={clickable ? handleSaveRoll : undefined} role="button" tabIndex={0}>
      DC {action.save_dc} {action.save_type}
    </span>
  );
}

export function MonsterAction({ action, index, attackerCannotAct, onAttack, onDamage, onSaveRoll }) {
  const actionHasSave = action.save_dc != null;
  const actionHasAttack = action.attack_bonus != null;
  const actionDamageFormula = extractDamageDiceFromDescription(action?.description, action?.damage_dice_primary);
  const actionDamageType = action?.damage_type_primary ? [action.damage_type_primary] : [];
  const actionDamageTypeLabel = formatDamageTypeList(actionDamageType);

  return (
    <div key={index} className={`mc-action ${attackerCannotAct ? 'mc-action-disabled' : ''}`}>
      <strong>{action.name}.</strong>{' '}
      {attackerCannotAct && <span className="mc-incapacitated-label">(Incapacitated)</span>}
      {actionHasAttack && !attackerCannotAct && (
        <span className="mc-dice-link" onClick={() => onAttack(action.name, action.attack_bonus, action)} role="button" tabIndex={0}>
          <i className="fa-solid fa-dice-d20" /> +{action.attack_bonus}
        </span>
      )}
      <ActionDamageLinks action={action} actionDamageFormula={actionDamageFormula} actionDamageTypeLabel={actionDamageTypeLabel} onDamage={onDamage} />
      {actionHasSave && <ActionSaveRoll action={action} attackerCannotAct={attackerCannotAct} onSaveRoll={onSaveRoll} />}
      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.description) }} />
      {action.usage && <em> ({String(action.usage)})</em>}
      {action.recharge && <em> ({String(action.recharge)})</em>}
    </div>
  );
}
