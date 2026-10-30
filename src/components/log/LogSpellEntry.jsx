import { formatTimestamp } from './log-utils.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';

export function SpellEntry({ entry }) {
  const hasMetamagic = entry.metamagic && entry.metamagic.length > 0;
  const hasTargets = entry.targets && entry.targets.length > 0;
  const hasTarget = entry.targetName;
  const hasDamage = entry.damageFormula && entry.damageType;
  const hasSaveDC = entry.saveDC;
  const isConcentration = entry.concentration;
  const hasDescription = entry.description;

  return (
    <div className="log-entry log-spell">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-wand-magic-sparkles"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">Cast {entry.spellName}</span>
        {hasTarget && <span className="log-target">→ {entry.targetName}</span>}
        {hasTargets && <span className="log-targets">→ {entry.targets.join(', ')}</span>}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-spell-details">
        <span className="log-spell-level">Level {entry.spellLevel}</span>
        <span className="log-spell-casting-time">{entry.castingTime}</span>
        {hasDamage && <span className="log-damage">{entry.damageFormula} {entry.damageType}</span>}
        {hasSaveDC && <span className="log-save-dc">Save DC {entry.saveDC}</span>}
        {isConcentration && <span className="log-concentration"><i className="fas fa-link"></i> Concentration</span>}
        {hasMetamagic ? (
          <span className="log-metamagic-list">
            {entry.metamagic.map((opt, i) => (
              <span key={i} className="log-metamagic-option">{opt}</span>
            ))}
            {entry.spCost > 0 && (
              <span className="log-metamagic-cost">{entry.spCost} SP</span>
            )}
          </span>
        ) : (
          <span className="log-no-metamagic">No Metamagic</span>
        )}
        {hasDescription && (
          <span className="log-spell-description" dangerouslySetInnerHTML={{ __html: sanitizeHtml(entry.description) }} />
        )}
      </div>
    </div>
  );
}

export function MetamagicEntry({ entry }) {
  const isEmpowered = entry.rollType === 'empowered-spell';
  const isPositive = entry.damageDifference > 0;
  const isNegative = entry.damageDifference < 0;

  if (isEmpowered) {
    return (
      <div className="log-entry log-metamagic">
        <div className="log-entry-header">
          <span className="log-icon"><i className="fas fa-dice"></i></span>
          <span className="log-character">{entry.characterName}</span>
          <span className="log-name">Empowered Spell — {entry.spellName}</span>
          <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
        </div>
        <div className="log-empowered-details">
          <span className="log-target">→ {entry.targetName}</span>
          <span className="log-empowered-damage">
            {entry.originalDamage} → {entry.newTotal}
          </span>
          <span className={`log-empowered-difference${isPositive ? ' log-empowered-positive' : ''}${isNegative ? ' log-empowered-negative' : ''}${!isPositive && !isNegative ? ' log-empowered-neutral' : ''}`}>
            {isPositive ? '+' : ''}{entry.damageDifference}
          </span>
          <span className="log-empowered-dice-info">
            Rerolled {entry.rerolledDiceCount} {entry.rerolledDiceCount === 1 ? 'die' : 'dice'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="log-entry log-metamagic">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-dice"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">Metamagic Applied</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-metamagic-details">
        <span className="log-metamagic-spell">Spell: {entry.spellName}</span>
        <span className="log-metamagic-list">
          {entry.options?.map((opt, i) => (
            <span key={i} className="log-metamagic-option">{opt}</span>
          ))}
        </span>
        {entry.sorceryPointsSpent > 0 && (
          <span className="log-metamagic-cost">{entry.sorceryPointsSpent} SP</span>
        )}
        {entry.remainingSorceryPoints != null && (
          <span className="log-remaining-sp">Remaining: {entry.remainingSorceryPoints} SP</span>
        )}
      </div>
    </div>
  );
}
