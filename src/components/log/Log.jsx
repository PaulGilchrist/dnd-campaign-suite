import { useMemo, useState, useRef } from 'react';
import useLog from '../../hooks/runtime/useLog.js';
import './Log.css';
import { filterLogEntries, formatEntryTypeLabel, getRollTypeOptions, LOG_WINDOW_SIZE } from './log-utils.js';
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
import { MusicEntry } from './LogMusicEntry.jsx';
import { GenericEntry } from './LogGenericEntry.jsx';

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
  buff: BuffEntry,
  music: MusicEntry
};

function LogEntryRenderer({ entry }) {
  // Unregistered types fall back to a generic row so stored entries are never
  // silently invisible in the shared log (bug-log-api-ghost-entries).
  const EntryComponent = ENTRY_COMPONENTS[entry.type] || GenericEntry;
  return <div>{<EntryComponent entry={entry}/>}</div>;
}

// Presentational filter toolbar (display-only; state lives in Log via useState).
// The Roll type control is a contextual sub-facet: shown only while Type === 'roll'.
function LogFilterBar({ filters, typeOptions, rollTypeOptions, characterOptions, visibleCount, filteredCount, totalCount, onFilterChange, onClear }) {
  const hasActiveFilters = Boolean(filters.text || filters.type || filters.character || filters.rollType);
  return (
    <div className="log-filters no-print">
      <div className="log-filter-group log-filter-search-group">
        <label className="log-filter-label" htmlFor="log-filter-text">Search</label>
        <input
          id="log-filter-text"
          type="text"
          className="log-filter-input"
          placeholder="Search the log..."
          value={filters.text}
          onChange={(e) => onFilterChange('text', e.target.value)}
        />
      </div>
      <div className="log-filter-group">
        <label className="log-filter-label" htmlFor="log-filter-type">Type</label>
        <select
          id="log-filter-type"
          className="log-filter-select"
          value={filters.type}
          onChange={(e) => onFilterChange('type', e.target.value)}
        >
          <option value="">All types</option>
          {typeOptions.map(type => (
            <option key={type} value={type}>{formatEntryTypeLabel(type)}</option>
          ))}
        </select>
      </div>
      {filters.type === 'roll' && (
        <div className="log-filter-group">
          <label className="log-filter-label" htmlFor="log-filter-rolltype">Roll type</label>
          <select
            id="log-filter-rolltype"
            className="log-filter-select"
            value={filters.rollType}
            onChange={(e) => onFilterChange('rollType', e.target.value)}
          >
            <option value="">All roll types</option>
            {rollTypeOptions.map(rollType => (
              <option key={rollType} value={rollType}>{formatEntryTypeLabel(rollType)}</option>
            ))}
          </select>
        </div>
      )}
      <div className="log-filter-group">
        <label className="log-filter-label" htmlFor="log-filter-character">Character</label>
        <select
          id="log-filter-character"
          className="log-filter-select"
          value={filters.character}
          onChange={(e) => onFilterChange('character', e.target.value)}
        >
          <option value="">All characters</option>
          {characterOptions.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      {hasActiveFilters && (
        <button type="button" className="log-filter-clear" onClick={onClear}>
          <i className="fas fa-xmark"></i> Clear filters
        </button>
      )}
      <span className="log-filter-count">
        Showing {visibleCount} of {filteredCount}
        {filteredCount !== totalCount ? ` (of ${totalCount} total)` : ''}
      </span>
    </div>
  );
}

export default function Log({ campaignName, characters }) {
  const { logEntries, initialized, addEntry } = useLog(campaignName);
  const [noteText, setNoteText] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('');
  // Display-only filter + render-window state (local UI state per server-first policy)
  const [filters, setFilters] = useState({ text: '', type: '', character: '', rollType: '' });
  const [windowSize, setWindowSize] = useState(LOG_WINDOW_SIZE);
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

  const filteredEntries = useMemo(() => filterLogEntries(logEntries, filters), [logEntries, filters]);
  const typeOptions = useMemo(
    () => [...new Set(logEntries.map(entry => entry.type).filter(Boolean))].sort(),
    [logEntries]
  );
  const rollTypeOptions = useMemo(() => getRollTypeOptions(logEntries), [logEntries]);
  const characterOptions = useMemo(
    () => [...new Set(logEntries.map(entry => entry.characterName).filter(Boolean))].sort(),
    [logEntries]
  );
  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      // Switching Type away from Roll clears the sub-facet so no stale
      // rollType silently AND-narrows the new view.
      if (key === 'type' && value !== 'roll') next.rollType = '';
      return next;
    });
    setWindowSize(LOG_WINDOW_SIZE);
  };

  const clearFilters = () => {
    setFilters({ text: '', type: '', character: '', rollType: '' });
    setWindowSize(LOG_WINDOW_SIZE);
  };

  // Newest first, capped at the current render window; "Load older" extends it.
  const visibleEntries = [...filteredEntries].reverse().slice(0, windowSize);
  const hasOlderEntries = filteredEntries.length > windowSize;

  return (
    <div className="campaign-tool log-view">
      <div className="log-toolbar">
        <h2><i className="fas fa-scroll"></i> Campaign Log</h2>
      </div>

        <div className="log-add-note no-print">
            {characters.length > 0 && (
              <>
                <label className="log-post-as-label" htmlFor="log-note-author">Post as:</label>
                <select
                  id="log-note-author"
                  value={selectedCharacter}
                  onChange={(e) => setSelectedCharacter(e.target.value)}
                >
                  <option value="">Anonymous</option>
                  {characters.map(ch => (
                    <option key={ch.name} value={ch.name}>{ch.name}</option>
                  ))}
                </select>
              </>
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

      {initialized && logEntries.length > 0 && (
        <LogFilterBar
          filters={filters}
          typeOptions={typeOptions}
          rollTypeOptions={rollTypeOptions}
          characterOptions={characterOptions}
          visibleCount={visibleEntries.length}
          filteredCount={filteredEntries.length}
          totalCount={logEntries.length}
          onFilterChange={handleFilterChange}
          onClear={clearFilters}
        />
      )}

      {!initialized && <div className="log-loading no-print">Loading log...</div>}
      {initialized && logEntries.length === 0 && (
        <div className="log-empty no-print">No entries yet. Roll dice or add a note to get started.</div>
      )}
      {initialized && logEntries.length > 0 && filteredEntries.length === 0 && (
        <div className="log-empty no-print">No entries match the current filters.</div>
      )}

      <div className="log-entries">
        {!initialized ? null : visibleEntries.map(entry => (
          <LogEntryRenderer key={entry.id} entry={entry}/>
        ))}
      </div>

      {initialized && hasOlderEntries && (
        <div className="log-load-older-row no-print">
          <button type="button" className="log-load-older-btn" onClick={() => setWindowSize(size => size + LOG_WINDOW_SIZE)}>
            <i className="fas fa-angle-double-down"></i> Load older entries
          </button>
        </div>
      )}
    </div>
  );
}
