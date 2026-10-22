import { formatTimestamp } from './log-utils.js';

// Condition entry action presentation (#876 producer census — actions are inline literals at emit sites):
//   'applied'               saveProcessing.js:530, handlePlainDamage.js:309, createEffectAdderHandlers.js:23, spell handlers
//   'target-effect-applied' createEffectAdderHandlers.js:52
//   'concentration-started' createEffectAdderHandlers.js:64
//   'kept'                  createRollConditionSaveHandler.js:226 — failed repeat save, effect continues
//   'maintained'          applyDamage.js:181 — concentration survives damage
//   'broken'              createAutoBreakConditionHandler.js:29
//   'removed'           saveResultHandlers.js:44, concentrationService.js:239, turnEndConditionRemoval.js:48, others
//   'ended'               clearExpirationEffects.js:269
//   'turn_start_behavior' turnStartEffects.js:627
// Applied-family legs render the condition's save DC/ability; resolved/kept legs render the source tag.
// 'removed' keeps the 'Condition Broken' bytes — pinned fall-through contract (#862 LogCondition.test.jsx).
const CONDITION_PRESENTATION = {
  'applied': { label: 'Condition Applied', cls: 'log-condition-applied', icon: 'fa-circle-exclamation', showSaveDetails: true },
  'target-effect-applied': { label: 'Effect Applied', cls: 'log-condition-applied', icon: 'fa-circle-exclamation', showSaveDetails: true },
  'concentration-started': { label: 'Concentration Started', cls: 'log-condition-applied', icon: 'fa-link', showSaveDetails: true },
  'kept': { label: 'Condition Maintained', cls: 'log-condition-kept', icon: 'fa-link', showSaveDetails: false },
  'maintained': { label: 'Condition Maintained', cls: 'log-condition-kept', icon: 'fa-link', showSaveDetails: false },
  'broken': { label: 'Condition Broken', cls: 'log-condition-broken', icon: 'fa-circle-check', showSaveDetails: false },
  'removed': { label: 'Condition Broken', cls: 'log-condition-broken', icon: 'fa-circle-check', showSaveDetails: false },
  'ended': { label: 'Condition Ended', cls: 'log-condition-broken', icon: 'fa-circle-check', showSaveDetails: false },
  'turn_start_behavior': { label: 'Condition Behavior', cls: 'log-condition-neutral', icon: 'fa-circle-question', showSaveDetails: false },
};

// No-fallbacks convention: unknown actions log loudly and render a neutral generic label — never silently 'Broken'.
const UNKNOWN_PRESENTATION = { label: 'Condition Update', cls: 'log-condition-neutral', icon: 'fa-circle-info', showSaveDetails: false };

export function ConditionEntry({ entry }) {
   const presentation = CONDITION_PRESENTATION[entry.action];
   if (!presentation) {
      console.error(`[ConditionEntry] Unhandled condition action: ${entry.action}`, entry);
   }
   const { label, cls, icon, showSaveDetails } = presentation ?? UNKNOWN_PRESENTATION;
   return (
      <div className={`log-entry log-condition ${cls}`}>
        <div className="log-entry-header">
          <span className="log-icon">
            <i className={`fas ${icon}`}></i>
          </span>
          <span className="log-character">{entry.characterName}</span>
          <span className="log-name">{label}</span>
          <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
        </div>
        <div className="log-condition-details">
          <span className="log-condition-name">{entry.condition}</span>
          {showSaveDetails && entry.dc && (
            <span className="log-condition-dc">DC {entry.dc}</span>
          )}
          {showSaveDetails && entry.ability && (
            <span className="log-condition-ability">{entry.ability.toUpperCase()} save</span>
          )}
          {!showSaveDetails && entry.sourceName && (
            <span className="log-condition-source">by {entry.sourceName}</span>
          )}
        </div>
      </div>
    );
 }
