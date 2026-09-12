import { useState, useRef } from 'react';
import useLog from '../../hooks/runtime/useLog.js';
import './Log.css';
import { RollEntry } from './LogRollEntry.jsx';
import { NoteEntry } from './LogNoteEntry.jsx';
import { LootEntry } from './LogLootEntry.jsx';
import { TravelEntry } from './LogTravelEntry.jsx';
import { ConditionEntry } from './LogConditionEntry.jsx';
import { EncounterEntry } from './LogEncounterEntry.jsx';
import { HpChangeEntry, HealingEntry } from './LogHpHealingEntry.jsx';
import { DeathSaveEntry } from './LogDeathSaveEntry.jsx';
import { SpellEntry, MetamagicEntry } from './LogSpellEntry.jsx';
import { HealingPoolEntry } from './LogHealingPoolEntry.jsx';
import { AbilityUseEntry } from './LogAbilityUseEntry.jsx';
import { RestEntry } from './LogRestEntry.jsx';
import { AutomationEntry } from './LogAutomationEntry.jsx';
import { SaveResultEntry } from './LogSaveResultEntry.jsx';
import { PsionicSorceryEntry } from './LogPsionicSorceryEntry.jsx';
import { SummonsEntry } from './LogSummonsEntry.jsx';
import { SpellEffectEntry } from './LogSpellEffectEntry.jsx';
import { BuffEntry } from './LogBuffEntry.jsx';

const ENTRY_COMPONENTS = {
  roll: RollEntry,
  note: NoteEntry,
  travel: TravelEntry,
  loot: LootEntry,
  condition: ConditionEntry,
  encounter: EncounterEntry,
  hp_change: HpChangeEntry,
  healing: HealingEntry,
  death_save: DeathSaveEntry,
  spell: SpellEntry,
  metamagic: MetamagicEntry,
  metamagic_use: MetamagicEntry,
  healing_pool: HealingPoolEntry,
  ability_use: AbilityUseEntry,
  short_rest: RestEntry,
  long_rest: RestEntry,
  automation: AutomationEntry,
  save_result: SaveResultEntry,
  psionic_sorcery: PsionicSorceryEntry,
  summons: SummonsEntry,
  spell_effect: SpellEffectEntry,
  buff: BuffEntry
};

function LogEntryRenderer({ entry }) {
  const EntryComponent = ENTRY_COMPONENTS[entry.type];
  return <div>{EntryComponent && <EntryComponent entry={entry}/>}</div>;
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
      noteText: noteText.trim()
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

        <div className="log-add-note no-print">
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

      {!initialized && <div className="log-loading no-print">Loading log...</div>}
      {initialized && logEntries.length === 0 && (
        <div className="log-empty no-print">No entries yet. Roll dice or add a note to get started.</div>
      )}

      <div className="log-entries">
        {!initialized ? null : [...logEntries].reverse().map(entry => (
          <LogEntryRenderer key={entry.id} entry={entry}/>
        ))}
      </div>
    </div>
  );
}
