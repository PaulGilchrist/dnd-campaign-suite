import { formatTimestamp } from './log-utils.js';

// Encounter entry action presentation (#878 producer census — every `action` value
// emitted on a type:'encounter' log row; actions are inline literals at emit sites):
//   'joined'        EncounterBuilder.jsx:315 handleJoinEncounter — players join an
//                   in-progress encounter; payload carries encounterName + monsters
//                   roster (render the roster, NEVER the completion trophy/xp/loot).
//   'loot_awarded'  useLootHandlers.js:60, autoRewardService.js:61 — rewards pushed
//                   onto a running encounter; payload carries xpPerChar + lootItems
//                   (autoRewardService adds totalEncounterXp + auto). Rewards leg.
//   'started'     legacy/test vocabulary — no live src producer found in this census
//                   (log-test-utils.jsx enc() default); leg bytes preserved byte-exact.
//   'completed'   legacy/test vocabulary — no live src producer found; owns the
//                   trophy/xp/loot end leg; fa-trophy stays reserved for completion.
// Producer payloads also duplicate onto type:'loot' (LogLootEntry.jsx owns those rows;
// 'fa-coins' + 'Loot & XP Awarded' is that component's family voice — mirrored here
// for the encounter-typed award leg).
// Family voice (fix#46/#47): Title-Case past participle — 'Condition Broken'
// LogConditionEntry.jsx:21, 'Effect Removed' LogDeathSaveEntry.jsx:22.
// Joined icon: someone-enters idiom fa-right-to-bracket (PartyInventory.jsx:316,676);
// the Join Encounter toolbar button itself is fa-skull (EncounterBuilder.jsx:579) but
// fa-skull is already the 'started' leg icon — arms must stay mutually
// distinguishable (#1348). Tone classes are unstyled in Log.css (status quo, same as
// log-encounter-start/end pre-fix — honest class names, no CSS bleed; fix#47
// unstyled-but-honest precedent).
const ENCOUNTER_PRESENTATION = {
  'started': { label: 'Encounter Started', cls: 'log-encounter-start', icon: 'fa-skull', showMonsters: true, showRewards: false },
  'joined': { label: 'Encounter Joined', cls: 'log-encounter-joined', icon: 'fa-right-to-bracket', showMonsters: true, showRewards: false },
  'completed': { label: 'Encounter Completed', cls: 'log-encounter-end', icon: 'fa-trophy', showMonsters: false, showRewards: true },
  'loot_awarded': { label: 'Loot Awarded', cls: 'log-encounter-rewards', icon: 'fa-coins', showMonsters: false, showRewards: true },
};

// No-fallbacks convention (mirrors LogConditionEntry.jsx:28 #876): unknown actions
// log loudly and render a neutral generic label — never silently 'Completed'+trophy.
const UNKNOWN_PRESENTATION = { label: 'Encounter Update', cls: 'log-encounter-neutral', icon: 'fa-circle-info', showMonsters: false, showRewards: false };

export function EncounterEntry({ entry }) {
  const presentation = ENCOUNTER_PRESENTATION[entry.action];
  if (!presentation) {
    console.error(`[EncounterEntry] Unhandled encounter action: ${entry.action}`, entry);
  }
  const { label, cls, icon, showMonsters, showRewards } = presentation ?? UNKNOWN_PRESENTATION;
  return (
    <div className={`log-entry log-encounter ${cls}`}>
      <div className="log-entry-header">
        <span className="log-icon">
          <i className={`fas ${icon}`}></i>
        </span>
        <span className="log-name">{label}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-encounter-details">
        <span className="log-encounter-name">{entry.encounterName}</span>
        {showMonsters && entry.monsters && entry.monsters.length > 0 && (
          <div className="log-encounter-monsters">
            {entry.monsters.map((m, i) => (
              <span key={i} className="log-encounter-monster">{m}{i < entry.monsters.length-1 ? ',' : ''}&nbsp;</span>
            ))}
          </div>
        )}
        {showRewards && entry.xpPerChar > 0 && (
          <span className="log-encounter-xp">
            <i className="fas fa-star"></i>&nbsp;{entry.xpPerChar.toLocaleString()} XP per character
          </span>
        )}
        {showRewards && entry.lootItems && entry.lootItems.length > 0 && (
          <ul className="log-encounter-loot">
            {entry.lootItems.map((item, i) => (
              <li key={i} className="log-encounter-loot-item">{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
