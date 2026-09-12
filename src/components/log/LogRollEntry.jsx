import { formatTimestamp, getRollIconType } from './log-utils.js';

const DAMAGE_ROLL_TYPES = ['damage', 'save-damage', 'aoe-damage', 'overchannel-damage', 'graze-damage'];

function isDamageRoll(entry) {
  return DAMAGE_ROLL_TYPES.includes(entry.rollType);
}

function showBothDiceRolls(entry) {
  const rollType = entry.rollType;
  return rollType !== 'damage' && rollType !== 'save-damage' && rollType !== 'aoe-damage' &&
    entry.rolls?.length === 2 && entry.mode && entry.mode !== 'normal';
}

function formatBonus(bonus) {
  if (bonus == null) return '';
  return bonus >= 0 ? `+${bonus}` : `${bonus}`;
}

function RollEntryHeader({ entry }) {
  return (
    <div className="log-entry-header">
      <span className="log-icon"><i className={`fas ${getRollIconType(entry.rollType)}`}></i></span>
      <span className="log-character">{entry.characterName}</span>
      <span className="log-name">{entry.name}</span>
      <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
    </div>
  );
}

function RollTargetBadges({ entry }) {
  const isSaveDamage = entry.rollType === 'save-damage';
  const isAoeDamage = entry.rollType === 'aoe-damage';
  return (
    <>
      {entry.targetName && !isSaveDamage && !isAoeDamage && (
        <span className="log-target">→ {entry.targetName}</span>
      )}
      {entry.targetName && isSaveDamage && (
        <span className="log-target">{entry.targetName}</span>
      )}
    </>
  );
}

function RollAttackBadges({ entry }) {
  if (entry.rollType !== 'attack') return null;
  return (
    <>
      {entry.hit !== undefined && (
        <span className={`log-hit-miss ${entry.hit ? 'log-hit' : 'log-miss'}`}>
          {entry.isAutoMiss ? 'AUTO-MISS' : (entry.hit ? 'HIT' : 'MISS')} {entry.targetAc != null ? `(AC ${entry.targetAc})` : ''}
        </span>
      )}
      {entry.isCrit && !entry.isNatural1 && (
        <span className="log-critical-hit">Critical Hit!</span>
      )}
      {entry.isNatural1 && (
        <span className="log-critical-miss">Critical Miss!</span>
      )}
    </>
  );
}

function RollCoverBadges({ entry }) {
  return (
    <>
      {entry.coverAcBonus > 0 && (
        <span className="log-cover">
          {entry.coverLevel === 'threeQuarter' ? '3/4' : '1/2'} Cover (+{entry.coverAcBonus} AC)
        </span>
      )}
      {entry.coverReason && (
        <span className="log-range-reason">{entry.coverReason}</span>
      )}
      {entry.rangeReason && (
        <span className="log-range-reason">{entry.rangeReason}</span>
      )}
    </>
  );
}

function RollModeBadges({ entry }) {
  return (
    <>
      {showBothDiceRolls(entry) && (
        <span className={`log-mode-badge ${entry.mode || 'normal'}`}>
          {(entry.mode || 'normal').toUpperCase()}
        </span>
      )}
      {entry.isNatural20 && <span className="log-nat-badge log-nat20">NAT 20</span>}
      {entry.isNatural1 && <span className="log-nat-badge log-nat1">FUMBLE</span>}
      {entry.damageType && isDamageRoll(entry) && (
        <span className="log-damage-type">{entry.damageType}</span>
      )}
    </>
  );
}

function SaveResultBadge({ success, roll, bonus }) {
  return (
    <span className={`log-save-result ${success ? 'log-condition-success' : 'log-condition-failure'}`}>
      {success ? 'SAVE SUCCESS' : 'SAVE FAILURE'}
      {roll != null && ` (d20 ${roll}${bonus != null ? `+${bonus}` : ''})`}
    </span>
  );
}

function SaveInfoBadge({ entry }) {
  if (!entry.saveType || !entry.saveDc) return null;
  return (
    <span className="log-save-info">
      {entry.saveType.toUpperCase()} save DC {entry.saveDc}&nbsp;
      {entry.mode === 'disadvantage' && (
        <span className="log-mode-badge disadvantage">DISADVANTAGE</span>
      )}
    </span>
  );
}

function SaveOutcomeBadge({ entry }) {
  if (entry.saveResult) {
    return <SaveResultBadge success={entry.saveResult === 'success'} roll={entry.saveRoll} bonus={entry.saveBonus} />;
  }
  if (entry.saveSuccess != null) {
    return <SaveResultBadge success={!!entry.saveSuccess} />;
  }
  return null;
}

function SaveTargetBadge({ entry }) {
  if (!entry.targetName) return null;
  if (entry.rollType === 'save' && entry.attackerName) {
    return <span className="log-target">{entry.targetName} vs {entry.attackerName}</span>;
  }
  if (entry.rollType === 'save-damage') {
    return <span className="log-target">vs {entry.targetName}</span>;
  }
  return null;
}

function RollSaveBadges({ entry }) {
  const isSave = entry.rollType === 'save';
  const isSaveDamage = entry.rollType === 'save-damage';
  const isAoeDamage = entry.rollType === 'aoe-damage';
  const showsOutcome = (isSave || isSaveDamage) && !!entry.saveResult;
  const showsLegacyOutcome = isSaveDamage && !entry.saveResult && entry.saveSuccess != null;
  return (
    <>
      {(isSave || isSaveDamage || isAoeDamage) && <SaveInfoBadge entry={entry} />}
      {(showsOutcome || showsLegacyOutcome) && <SaveOutcomeBadge entry={entry} />}
      <SaveTargetBadge entry={entry} />
    </>
  );
}

function LogDie({ value, selected }) {
  return <span className={`log-die${selected ? ' log-die-selected' : ''}`}>({value} {selected ? 'selected' : 'discarded'})</span>;
}

function DoubleDice({ rolls, keepHigher }) {
  const [first, second] = rolls;
  const firstSelected = keepHigher ? first >= second : first <= second;
  const secondSelected = keepHigher ? second > first : second < first;
  return (
    <>
      <LogDie value={first} selected={firstSelected} />
      <LogDie value={second} selected={secondSelected} />
    </>
  );
}

function RollPlainDice({ entry }) {
  const rollType = entry.rollType;
  if (rollType === 'damage' || rollType === 'save-damage' || rollType === 'aoe-damage' || entry.rolls?.length !== 2) return null;
  if (!showBothDiceRolls(entry)) return <span className="log-die log-die-selected">({entry.total})</span>;
  if (entry.mode === 'advantage') return <DoubleDice rolls={entry.rolls} keepHigher />;
  if (entry.mode === 'disadvantage') return <DoubleDice rolls={entry.rolls} />;
  return <span className="log-die log-die-selected">({entry.total})</span>;
}

function RollModifierBadges({ entry }) {
  return (
    <>
      {entry.baneRoll != null && (
        <span className="log-bane-penalty"> -1d4 [Bane]: -{entry.baneRoll}</span>
      )}
      {entry.blessRoll != null && (
        <span className="log-bless-bonus"> +1d4 [Bless]: +{entry.blessRoll}</span>
      )}
      {entry.gwfApplied && entry.gwfOriginalRolls && (
        <span className="log-gwf">
          <i className="fa-solid fa-shield-halved"></i> GWF: {entry.gwfOriginalRolls.join(', ')} → {entry.gwfDisplayRolls?.join(', ') || entry.rolls.join(', ')}
        </span>
      )}
      {entry.rayOfEnfeebleRoll != null && (
        <span className="log-ray-enfeeblement"> -1d8 [Enfeeblement]: -{entry.rayOfEnfeebleRoll}</span>
      )}
      {entry.resistanceRoll != null && (
        <span className="log-resistance"> -1d4 [Resistance]: -{entry.resistanceRoll}</span>
      )}
    </>
  );
}

function RollDiceValues({ entry }) {
  const isSave = entry.rollType === 'save';
  const damageRoll = isDamageRoll(entry);
  return (
    <div className="log-dice-values">
      <RollPlainDice entry={entry} />
      {damageRoll && entry.formula && (
        <span className="log-dice-formula">{entry.formula}</span>
      )}
      {!isSave && damageRoll && entry.rolls?.length > 0 && (
        <span className="log-dice-values-inline">
          ({entry.rolls.join(', ')})
        </span>
      )}
      <span className="log-total"><b>{entry.total}{damageRoll ? '' : formatBonus(entry.bonus)}{entry.bonusDetail ? ' ' + entry.bonusDetail : ''}</b></span>
      <RollModifierBadges entry={entry} />
    </div>
  );
}

function RollFinalDamage({ entry }) {
  if ((entry.rollType !== 'save-damage' && entry.rollType !== 'overchannel-damage') || entry.finalDamage == null || !entry.damageType) return null;
  return <span className="log-final-damage">→ {entry.finalDamage} {entry.damageType} damage</span>;
}

function RollSecondaryDamage({ entry }) {
  if (entry.secondaryFormula == null) return null;
  return (
    <div className="log-secondary-damage">
      <span className="log-secondary-label">Secondary:</span>
      {entry.secondaryFormula && <span className="log-dice-formula">{entry.secondaryFormula}</span>}
      <span className="log-total"><b>{entry.secondaryTotal}</b></span>
      {entry.secondaryDamageType && <span className="log-damage-type">{entry.secondaryDamageType}</span>}
      {entry.secondarySaveResult && (
        <SaveResultBadge success={entry.secondarySaveResult === 'success'} roll={entry.secondarySaveRoll} bonus={entry.secondarySaveBonus} />
      )}
    </div>
  );
}

function RollResistanceDetails({ entry }) {
  if ((entry.rollType !== 'damage' && entry.rollType !== 'save-damage') || !entry.resistanceDetails?.length) return null;
  return (
    <span className="log-resistance-details">
      {entry.resistanceDetails.map((rd, i) => (
        <span key={i} className={rd.status === 'immune' ? 'log-immune' : 'log-resistant'}>
          {rd.status === 'immune' ? 'Immune' : 'Resistant'} to {rd.damageType}
        </span>
      ))}
    </span>
  );
}

function RollAoeAffected({ entry }) {
  if (entry.rollType !== 'aoe-damage' || entry.affectedCount == null || !(entry.affectedCount > 0)) return null;
  return <span className="log-aoe-affect">{entry.affectedCount} creature{entry.affectedCount !== 1 ? 's' : ''} affected</span>;
}

function RollConditionSave({ entry }) {
  if (!entry.condition || entry.dc === undefined) return null;
  return (
    <span className={`log-condition-save ${entry.success ? 'log-condition-success' : 'log-condition-failure'}`}>
      vs {entry.condition} (DC {entry.dc}): {entry.success ? 'SUCCESS' : 'FAILURE'}
      {entry.mode === 'disadvantage' && (
        <span className="log-mode-badge disadvantage">DISADVANTAGE</span>
      )}
      {entry.mode === 'advantage' && (
        <span className="log-mode-badge advantage">ADVANTAGE{entry.advantageSources && entry.advantageSources.length > 0 ? ` (${entry.advantageSources.join(', ')})` : ''}</span>
      )}
    </span>
  );
}

function RollNotices({ entry }) {
  return (
    <>
      {entry.resistanceNotice && (
        <div className="log-resistance-notice">{entry.resistanceNotice}</div>
      )}
      {entry.hunterLoreNotice && (
        <div className="log-hunter-lore-notice">
          <i className="fa-solid fa-eye"></i> {entry.hunterLoreNotice}
        </div>
      )}
    </>
  );
}

export function RollEntry({ entry }) {
  return (
    <div className={`log-entry log-roll${entry.isNatural20 ? ' log-nat20' : ''}${entry.isNatural1 ? ' log-nat1' : ''}`}>
      <RollEntryHeader entry={entry} />
      <div className="log-roll-details">
        <RollTargetBadges entry={entry} />
        <RollAttackBadges entry={entry} />
        <RollCoverBadges entry={entry} />
        <RollModeBadges entry={entry} />
        <RollSaveBadges entry={entry} />
        <RollDiceValues entry={entry} />
        <RollFinalDamage entry={entry} />
        <RollSecondaryDamage entry={entry} />
        <RollResistanceDetails entry={entry} />
        <RollAoeAffected entry={entry} />
        <RollConditionSave entry={entry} />
        <RollNotices entry={entry} />
      </div>
    </div>
  );
}
