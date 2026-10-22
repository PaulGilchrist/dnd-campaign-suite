import { formatTimestamp } from './log-utils.js';

// death_save presentation map (#877 producer census — every `result` value reaching a
// death_save log row; rolled saves omit `result` entirely):
//   absent       roll rows: DeathSavingThrows.jsx:84, useLoggedDiceRollEventHandlers.js:571,
//                reactionSaveHealHandler.js:211, relentlessRageService.js:181 — die shown,
//                polarity from the explicit `success` boolean
//   'stable'     DeathSavingThrows.jsx:109 — three successes, roll-less, good outcome
//   'dead'       DeathSavingThrows.jsx:120 — three failures, roll-less
//   'removed'    DeathSavingThrows.jsx:61 — GM clears the dying track ('Resurrect
//                character' button): the dying condition is removed — a rescue, never a
//                save failure. Family voice: Title-Case past participle
//                ('Effect Removed' LogBuffEntry.jsx:11, 'Condition Broken'
//                LogConditionEntry.jsx:22; revive parity 'Brought Back to Life'
//                LogHpHealingEntry.jsx:108).
// deathSaveRules.js emits result:'nat20'|'success'|'failure' on death-save-result
// events only — the log producers above fold those into `success`, never onto the
// log row's `result` field, so any other `result` here is unhandled.
const DEATH_SAVE_PRESENTATION = {
  'stable': { label: 'Stabilized!', cls: 'log-death-save-success', icon: 'fa-skull-crossbones', showRolls: false },
  'dead': { label: 'Has Perished!', cls: 'log-death-save-failure', icon: 'fa-skull', showRolls: false },
  'removed': { label: 'Dying Condition Removed', cls: 'log-death-save-success', icon: 'fa-skull-crossbones', showRolls: false },
};

// No-fallbacks convention (mirrors LogConditionEntry.jsx #876): unknown results log
// loudly and render a neutral generic label — never silently a red 'Death Save Failure'.
const UNKNOWN_PRESENTATION = { label: 'Death Save Update', cls: 'log-death-save-neutral', icon: 'fa-circle-info', showRolls: true };

// Explicit tri-state polarity (#877): red ONLY on an explicit failure — never from
// an omitted (undefined) success, which renders neutral.
function rollPolarityCls(success) {
  if (success === true) return 'log-death-save-success';
  if (success === false) return 'log-death-save-failure';
  return 'log-death-save-neutral';
}

function deathSaveRollTitle(isNat20, isNat1, success) {
  if (isNat20) return 'Natural 20 — Stabilized!';
  if (isNat1) return 'Natural 1 — Double Failure';
  if (success === true) return 'Death Save Success';
  if (success === false) return 'Death Save Failure';
  return 'Death Save';
}

// Roll rows (result absent) resolve to a synthesized view; finality rows read the map.
function resolvePresentation(entry) {
  if (entry.result == null) {
    return {
      label: deathSaveRollTitle(entry.isNatural20, entry.isNatural1, entry.success),
      cls: rollPolarityCls(entry.success),
      icon: 'fa-skull-crossbones',
      showRolls: true,
    };
  }
  const presentation = DEATH_SAVE_PRESENTATION[entry.result];
  if (!presentation) {
    console.error(`[DeathSaveEntry] Unhandled death save result: ${entry.result}`, entry);
    return UNKNOWN_PRESENTATION;
  }
  return presentation;
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
  const view = resolvePresentation(entry);
  const isNat20 = entry.isNatural20;
  const isNat1 = entry.isNatural1;
  const hasAdvantage = entry.rolls?.length === 2;
  const showRolls = view.showRolls;
  return (
    <div className={`log-entry log-death-save ${view.cls}`}>
      <div className="log-entry-header">
        <span className="log-icon">
          <i className={`fas ${view.icon}`}></i>
        </span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">{view.label}</span>
        {hasAdvantage && <span className="log-mode-badge advantage">ADVANTAGE</span>}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-death-save-details">
        {showRolls && hasAdvantage && <AdvantageDice rolls={entry.rolls} />}
        {showRolls && !hasAdvantage && entry.roll != null && <span className={`log-die ${entry.success === true ? 'log-die-selected' : ''}`}>({entry.roll})</span>}
        {isNat1 && <span className="log-nat-badge log-nat1">NAT 1</span>}
        {isNat20 && <span className="log-nat-badge log-nat20">NAT 20</span>}
        <DeathSaveTotals entry={entry} />
      </div>
    </div>
  );
}
