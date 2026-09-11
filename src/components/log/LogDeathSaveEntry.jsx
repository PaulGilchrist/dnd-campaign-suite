import { formatTimestamp } from './log-utils.js';

function deathSaveTitle(isNat20, isNat1, isStable, isDead, isSuccess) {
  return (
    <>
      {isStable && 'Stabilized!'}
      {isDead && 'Has Perished!'}
      {isNat20 && !isStable && 'Natural 20 — Stabilized!'}
      {isNat1 && 'Natural 1 — Double Failure'}
      {!isNat20 && !isNat1 && !isStable && !isDead && (isSuccess ? 'Death Save Success' : 'Death Save Failure')}
    </>
  );
}

function AdvantageDice({ rolls }) {
  return (
    <>
      <span className={`log-die${rolls[0] >= rolls[1] ? ' log-die-selected' : ''}`}>({rolls[0]} {rolls[0] >= rolls[1] ? 'selected' : 'discarded'})</span>
      <span className={`log-die${rolls[1] > rolls[0] ? ' log-die-selected' : ''}`}>({rolls[1]} {rolls[1] > rolls[0] ? 'selected' : 'discarded'})</span>
    </>
  );
}

function DeathSaveTotals({ entry }) {
  if (entry.totalSuccesses == null && entry.totalFailures == null) return null;
  return (
    <span className="log-death-save-totals">
      {entry.totalSuccesses != null && <span className="log-death-save-total-successes">✓ {entry.totalSuccesses}</span>}
      {entry.totalFailures != null && <span className="log-death-save-total-failures">✗ {entry.totalFailures}</span>}
    </span>
  );
}

export function DeathSaveEntry({ entry }) {
  const isSuccess = entry.success;
  const isNat20 = entry.isNatural20;
  const isNat1 = entry.isNatural1;
  const isStable = entry.result === 'stable';
  const isDead = entry.result === 'dead';
  const hasAdvantage = entry.rolls?.length === 2;
  const showRolls = !isStable && !isDead;
  return (
    <div className={`log-entry log-death-save ${isSuccess ? 'log-death-save-success' : 'log-death-save-failure'}`}>
      <div className="log-entry-header">
        <span className="log-icon">
          <i className={`fas ${isDead ? 'fa-skull' : 'fa-skull-crossbones'}`}></i>
        </span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">{deathSaveTitle(isNat20, isNat1, isStable, isDead, isSuccess)}</span>
        {hasAdvantage && <span className="log-mode-badge advantage">ADVANTAGE</span>}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-death-save-details">
        {showRolls && hasAdvantage && <AdvantageDice rolls={entry.rolls} />}
        {showRolls && !hasAdvantage && <span className={`log-die ${isSuccess ? 'log-die-selected' : ''}`}>({entry.roll})</span>}
        {isNat1 && <span className="log-nat-badge log-nat1">NAT 1</span>}
        {isNat20 && <span className="log-nat-badge log-nat20">NAT 20</span>}
        <DeathSaveTotals entry={entry} />
      </div>
    </div>
  );
}
