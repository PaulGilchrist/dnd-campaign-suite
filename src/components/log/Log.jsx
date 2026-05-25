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
        {showBothDice && (
          <span className={`log-mode-badge ${entry.mode || 'normal'}`}>
            {(entry.mode || 'normal').toUpperCase()}
          </span>
        )}
        {entry.isNatural20 && <span className="log-nat-badge log-nat20">NAT 20</span>}
        {entry.isNatural1 && <span className="log-nat-badge log-nat1">FUMBLE</span>}
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
      <div className="log-note-text">{entry.message}</div>
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
            {entry.type === 'roll' ? <RollEntry entry={entry}/> : <NoteEntry entry={entry}/>}
          </div>
        ))}
      </div>
    </div>
  );
}
