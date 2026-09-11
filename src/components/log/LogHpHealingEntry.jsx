import { formatTimestamp } from './log-utils.js';

function formatHpDelta(delta) {
  return `${delta > 0 ? '+' : ''}${delta}`;
}

function NpcChangeName({ entry }) {
  return (
    <>
      {entry.threshold === 'dead' && 'Defeated'}
      {entry.threshold === 'bloodied' && 'Bloodied'}
      {entry.threshold === 'recovering' && 'Recovering'}
      {entry.delta !== 0 && ` (${formatHpDelta(entry.delta)})`}
    </>
  );
}

function PlayerChangeName({ entry, isDamage, isTemp }) {
  return (
    <>
      {entry.isUnconscious && 'Knocked Unconscious — '}
      {isDamage ? 'Takes Damage' : (isTemp ? 'Temporary Hit Points' : (entry.sourceName ? `Healed (${entry.sourceName})` : 'Healed'))}
      {entry.note && !isDamage && <span className="log-dice-formula">{entry.note}</span>}
      {entry.maximizeHealingDice && !isDamage && ' — Dice maximized by Supreme Healing'}
    </>
  );
}

function DamageBreakdown({ entry }) {
  return (
    <span className="log-hp-delta">
      {formatHpDelta(entry.delta)} HP
      {entry.damageBreakdown.map((db, i) => (
        <span key={i} className="log-damage-breakdown-item">
          {i > 0 && <span className="log-damage-breakdown-sep">, </span>}
          <span className="log-damage-type">{db.damageType}</span>
          {db.status === 'resistant' && <span className="log-resistance-badge">Resistance</span>}
          {db.status === 'immune' && <span className="log-immunity-badge">Immune</span>}
        </span>
      ))}
    </span>
  );
}

function BonusHealing({ details }) {
  return (
    <span className="log-bonus-healing">
      {' plus '}
      {details.map((d, i) => (
        <span key={i}>{i > 0 && ', '}{d.amount} [{d.name}]</span>
      ))}
    </span>
  );
}

function PlayerHpDetails({ entry, isDamage, isTemp }) {
  return (
    <>
      {entry.damageBreakdown && entry.damageBreakdown.length > 0 ? (
        <DamageBreakdown entry={entry} />
      ) : (
        <span className="log-hp-delta">{formatHpDelta(entry.delta)} HP</span>
      )}
      {!isTemp && <span className="log-hp-current"> {entry.currentHp}/{entry.maxHp} remaining</span>}
      {entry.rollInfo && !isDamage && <span className="log-roll-info"> ({entry.rollInfo})</span>}
      {entry.formula && !isDamage && <span className="log-dice-formula">{entry.formula}</span>}
      {entry.bonusDetails && entry.bonusDetails.length > 0 && !isDamage && <BonusHealing details={entry.bonusDetails} />}
    </>
  );
}

export function HpChangeEntry({ entry }) {
  const isDamage = entry.delta < 0;
  const isNpc = !!entry.threshold;
  const isTemp = entry.isTempHp;
  return (
    <div className={`log-entry log-hp-change ${isDamage ? 'log-hp-damage' : isTemp ? 'log-temp-hp' : 'log-healing'}`}>
      <div className="log-entry-header">
        <span className="log-icon">
          <i className={`fas ${isDamage ? 'fa-heart-crack' : isTemp ? 'fa-shield' : 'fa-heart'}`}></i>
        </span>
        <span className="log-character">{entry.targetName}</span>
        <span className="log-name">
          {isNpc ? <NpcChangeName entry={entry} /> : <PlayerChangeName entry={entry} isDamage={isDamage} isTemp={isTemp} />}
        </span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-hp-details">
        {isNpc ? (
          <span className="log-hp-delta">{formatHpDelta(entry.delta)} HP</span>
        ) : (
          <PlayerHpDetails entry={entry} isDamage={isDamage} isTemp={isTemp} />
        )}
      </div>
    </div>
  );
}

export function HealingEntry({ entry }) {
  const isResurrection = entry.resurrection;
  return (
    <div className={`log-entry log-healing${isResurrection ? ' log-resurrection' : ''}`}>
      <div className="log-entry-header">
        <span className="log-icon">
          <i className={`fas ${isResurrection ? 'fa-dove' : 'fa-heart'}`}></i>
        </span>
        <span className="log-character">{entry.targetName}</span>
        <span className="log-name">{isResurrection ? 'Brought Back to Life' : `Healed (${entry.sourceName || entry.healingName})`}</span>
        {isResurrection && <span className="log-resurrection-badge">Resurrection</span>}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-hp-details">
        {entry.popupText && <span>{entry.popupText}</span>}
        {entry.amount !== undefined && <span>{isResurrection ? 'Returns to life with' : 'Healed for'} {entry.amount} HP</span>}
      </div>
    </div>
  );
}
