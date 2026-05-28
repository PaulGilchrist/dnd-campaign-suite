import { useState, useRef } from 'react';
import useLog from '../../hooks/useLog.js';
import './Log.css';

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getRollIconType(rollType) {
  switch (rollType) {
    case 'attack': return 'fa-crosshairs';
    case 'spell_attack': return 'fa-wand-magic-sparkles';
    case 'save': return 'fa-shield-halved';
    case 'condition-save': return 'fa-shield-halved';
    case 'initiative': return 'fa-bolt';
    case 'damage': return 'fa-skull';
    default: return 'fa-dice-d20';
   }
}

function RollEntry({ entry }) {
  const isDamage = entry.rollType === 'damage';
  const showBothDice = !isDamage && entry.rolls?.length === 2;

  return (
    <div className={`log-entry log-roll${entry.isNatural20 ? ' log-nat20' : ''}${entry.isNatural1 ? ' log-nat1' : ''}`}>
      <div className="log-entry-header">
        <span className="log-icon"><i className={`fas ${getRollIconType(entry.rollType)}`}></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">{entry.name}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-roll-details">
        {entry.targetName && (
          <span className="log-target">→ {entry.targetName}</span>
        )}
        {entry.hit !== undefined && (
          <span className={`log-hit-miss ${entry.hit ? 'log-hit' : 'log-miss'}`}>
            {entry.hit ? 'HIT' : 'MISS'} (AC {entry.targetAc})
          </span>
        )}
        {showBothDice && (
          <span className={`log-mode-badge ${entry.mode || 'normal'}`}>
            {(entry.mode || 'normal').toUpperCase()}
          </span>
        )}
        {entry.isNatural20 && <span className="log-nat-badge log-nat20">NAT 20</span>}
        {entry.isNatural1 && <span className="log-nat-badge log-nat1">FUMBLE</span>}
        {entry.damageType && (
          <span className="log-damage-type">{entry.damageType}</span>
        )}
        <div className="log-dice-values">
          {!isDamage && (
            <>
              <span className={`log-die${entry.rolls[0] === entry.total ? ' log-die-selected' : ''}`}>({entry.rolls[0]})</span>
              <span className={`log-die${entry.rolls[1] === entry.total ? ' log-die-selected' : ''}`}>({entry.rolls[1]})</span>
            </>
          )}
          {isDamage && (
            <span className="log-dice-formula">{entry.formula}</span>
          )}
          <span className="log-total"><b>{entry.total}{isDamage ? '' : (entry.bonus >= 0 ? `+${entry.bonus}` : `${entry.bonus}`)}</b></span>
        </div>
        {entry.condition && entry.dc !== undefined && (
          <span className={`log-condition-save ${entry.success ? 'log-condition-success' : 'log-condition-failure'}`}>
            vs {entry.condition} (DC {entry.dc}): {entry.success ? 'SUCCESS' : 'FAILURE'}
          </span>
        )}
        {entry.resistanceNotice && (
          <div className="log-resistance-notice">{entry.resistanceNotice}</div>
        )}
      </div>
    </div>
  );
}

function NoteEntry({ entry }) {
   return (
      <div className="log-entry log-note">
        <div className="log-entry-header">
          <span className="log-icon"><i className="fas fa-comment-dots"></i></span>
          <span className="log-character">{entry.characterName}</span>
          <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
        </div>
        <div className="log-note-text">{entry.noteText}</div>
      </div>
   );
}

 function LootEntry({ entry }) {
   return (
      <div className="log-entry log-loot">
        <div className="log-entry-header">
          <span className="log-icon"><i className="fas fa-coins"></i></span>
          <span className="log-name">Loot &amp; XP Awarded</span>
          <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
        </div>
        <div className="log-loot-details">
           {entry.xpPerChar && entry.xpPerChar > 0 && (
             <span className="log-loot-xp">
               <i className="fas fa-star"></i>&nbsp;{entry.xpPerChar.toLocaleString()} XP per character
             </span>
            )}
          {entry.lootItems && entry.lootItems.length > 0 && (
            <ul className="log-loot-items">
              {entry.lootItems.map((item, i) => (
                <li key={i} className="log-loot-item">{item}</li>
                 ))}
             </ul>
            )}
        </div>
      </div>
     );
    }

 const TRAVEL_ACTION_CONFIG = {
  advance:           { icon: 'fa-person-walking',     label: 'Advanced to',        color: '#4a90d9' },
  advance_with_event:{ icon: 'fa-bolt',               label: 'Event triggered at', color: '#e87040' },
  arrived:           { icon: 'fa-flag-checkered',     label: 'Arrived at',         color: '#4CAF50' },
  camp:              { icon: 'fa-campground',          label: 'Camped at',          color: '#8ab' },
  forced_march:      { icon: 'fa-person-running',     label: 'Forced march at',    color: '#e87040' },
  event_accept:      { icon: 'fa-check',              label: 'Accepted event at',  color: '#4CAF50' },
  event_skip:        { icon: 'fa-xmark',              label: 'Skipped event at',   color: '#888' },
  event_reroll:      { icon: 'fa-dice',               label: 'Re-rolled event at', color: '#b99' },
  extreme_weather:   { icon: 'fa-triangle-exclamation', label: 'Weather halted travel at', color: '#f44336' },
  day_exhausted:     { icon: 'fa-tent',               label: 'Budget exhausted at', color: '#e87040' },
  cancel:            { icon: 'fa-ban',                label: 'Travel cancelled at', color: '#888' },
};

function TravelEntry({ entry }) {
  const config = TRAVEL_ACTION_CONFIG[entry.action] || TRAVEL_ACTION_CONFIG.advance;
  const hexStr = entry.hex ? `(${entry.hex.q}, ${entry.hex.r})` : '';

  return (
    <div className="log-entry log-travel" style={{ borderLeftColor: config.color }}>
      <div className="log-entry-header">
        <span className="log-icon" style={{ color: config.color }}>
          <i className={`fas ${config.icon}`}></i>
        </span>
        <span className="log-travel-action" style={{ color: config.color }}>
          {config.label}
        </span>
        {hexStr && <span className="log-travel-coords">{hexStr}</span>}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-travel-details">
        {entry.terrain && (
          <span className="log-travel-terrain">
            <i className="fas fa-mountain"></i> {entry.terrain}
          </span>
        )}
        {entry.weather && (
          <span className="log-travel-weather">
            <i className={`fas fa-${entry.weatherIcon || 'sun'}`}></i> {entry.weather}
          </span>
        )}
      </div>
      {entry.eventTitle && (
        <div className="log-travel-event">
          <span className="log-travel-event-type">{entry.eventType}</span>
          <span className="log-travel-event-title">{entry.eventTitle}</span>
        </div>
      )}
    </div>
  );
}

function ConditionEntry({ entry }) {
  const isApplied = entry.action === 'applied';
  return (
    <div className={`log-entry log-condition ${isApplied ? 'log-condition-applied' : 'log-condition-broken'}`}>
      <div className="log-entry-header">
        <span className="log-icon">
          <i className={`fas ${isApplied ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i>
        </span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">{isApplied ? 'Condition Applied' : 'Condition Broken'}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-condition-details">
        <span className="log-condition-name">{entry.condition}</span>
        {isApplied && entry.dc && (
          <span className="log-condition-dc">DC {entry.dc}</span>
        )}
        {isApplied && entry.ability && (
          <span className="log-condition-ability">{entry.ability.toUpperCase()} save</span>
        )}
      </div>
    </div>
  );
}

export default function Log({ campaignName, characters }) {
  const { logEntries, initialized, addEntry } = useLog(campaignName);
  const [noteText, setNoteText] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const noteRef = useRef(null);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addEntry({
      type: 'note',
      characterName: selectedCharacter || 'Anonymous',
      message: noteText.trim()
    });
    setNoteText('');
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAddNote();
       }
     };

  return (
    <div className="campaign-tool log-view">
      <div className="log-toolbar">
        <h2><i className="fas fa-scroll"></i> Campaign Log</h2>
      </div>

        <div className="log-add-note">
            {characters.length > 0 && (
              <select
                value={selectedCharacter}
                onChange={(e) => setSelectedCharacter(e.target.value)}
              >
                <option value="">Anonymous</option>
                {characters.map(ch => (
                  <option key={ch.name} value={ch.name}>{ch.name}</option>
                ))}
              </select>
            )}
            <textarea
              ref={noteRef}
              placeholder="Add a note to the log..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="log-add-btn" onClick={handleAddNote}><i className="fas fa-plus"></i></button>
          </div>

      {!initialized && <div className="log-loading">Loading log...</div>}
      {initialized && logEntries.length === 0 && (
        <div className="log-empty">No entries yet. Roll dice or add a note to get started.</div>
      )}

      <div className="log-entries">
        {!initialized ? null : [...logEntries].reverse().map(entry => (
          <div key={entry.id}>
            {entry.type === 'roll' && <RollEntry entry={entry}/>}
            {entry.type === 'note' && <NoteEntry entry={entry}/>}
              {entry.type === 'travel' && <TravelEntry entry={entry}/>}
              {entry.type === 'loot' && <LootEntry entry={entry}/>}
              {entry.type === 'condition' && <ConditionEntry entry={entry}/>}
              </div>
        ))}
      </div>
    </div>
  );
}
