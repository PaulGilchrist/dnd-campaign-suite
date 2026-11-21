import { useEffect, useMemo, useState } from 'react';
import useLog from '../../hooks/runtime/useLog.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import './Log.css';
import { filterLogEntries, formatEntryTypeLabel, getRollTypeOptions, buildAuthorOptions, LOG_WINDOW_SIZE } from './log-utils.js';
import { GenericEntry } from './LogGenericEntry.jsx';
// Type→component dispatch registry, extracted to a plain .js module so the
// server allowlist pin test can derive the rendered types (see entryComponents.js).
import { ENTRY_COMPONENTS } from './entryComponents.js';

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

// The compose card — author census by origin, GM-only Note|Narrative type,
// and the disabled-with-hint face for a visitor in a character-less campaign
// (the server mirrors this refusal on note/narrative POSTs). Presentational:
// all state lives in Log.
function LogComposer({ isLocalhost, authorGroups, author, composeType, noteText, onSelectAuthor, onComposeType, onNoteText, onPost, onKeyDown }) {
  const canPost = authorGroups.length > 0;
  return (
    <>
      <div className="log-add-note no-print">
        {canPost && (
          <>
            <label className="log-post-as-label" htmlFor="log-note-author">Post as:</label>
            <select
              id="log-note-author"
              value={author}
              onChange={(e) => onSelectAuthor(e.target.value)}
            >
              {authorGroups.map(group => group.label === null ? (
                // Flat visitor face: plain options, no optgroup chrome.
                group.options.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))
              ) : (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {isLocalhost && (
              <>
                <label className="log-post-as-label" htmlFor="log-note-type">As:</label>
                <select
                  id="log-note-type"
                  value={composeType}
                  onChange={(e) => onComposeType(e.target.value)}
                  title="Notes are shared tabletop chatter; narrative is GM/storytelling prose"
                >
                  <option value="note">Note</option>
                  <option value="narrative">Narrative</option>
                </select>
              </>
            )}
          </>
        )}
        <textarea
          placeholder="Add a note to the log..."
          value={noteText}
          onChange={(e) => onNoteText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!canPost}
        />
        <button className="log-add-btn" onClick={onPost} disabled={!canPost || !noteText.trim()} title="Post note" aria-label="Post note"><i className="fas fa-plus"></i></button>
      </div>
      {!canPost && (
        <div className="log-post-disabled-hint no-print">
          <i className="fas fa-circle-info"></i> A player character must exist in this campaign before you can post to the log.
        </div>
      )}
    </>
  );
}

export default function Log({ campaignName, characters, isLocalhost }) {
  const { logEntries, initialized, addEntry } = useLog(campaignName);
  const [noteText, setNoteText] = useState('');
  const [composeType, setComposeType] = useState('note');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  // Display-only filter + render-window state (local UI state per server-first policy)
  const [filters, setFilters] = useState({ text: '', type: '', character: '', rollType: '' });
  const [windowSize, setWindowSize] = useState(LOG_WINDOW_SIZE);
  const [creatureNames, setCreatureNames] = useState([]);

  const characterNames = useMemo(() => characters.map(ch => ch.name), [characters]);
  const authorGroups = useMemo(
    () => buildAuthorOptions({ isLocalhost, characterNames, creatureNames }),
    [isLocalhost, characterNames, creatureNames]
  );
  // An unselected composer falls to the FIRST option across the groups in
  // render order: 'GM' on the GM tab, the first character for a visitor.
  // No groups (a visitor in a character-less campaign) means there is
  // nothing to post as at all.
  const author = selectedAuthor || authorGroups[0]?.options[0] || '';

  // Initiative-tracker creature census (GM tab only — visitors never author
  // creatures). Mount read plus SSE mirror of the combatSummary change-data
  // key, the same source the Initiative board renders from.
  useEffect(() => {
    if (!isLocalhost || !campaignName) return undefined;
    let cancelled = false;
    const applyCensus = (summary) => {
      if (!cancelled) setCreatureNames((summary?.creatures || []).map(c => c.name).filter(Boolean));
    };
    loadCombatSummary(campaignName)
      .then(applyCensus)
      .catch(err => console.error('Failed to load initiative creatures for the log author list:', err));
    const unsubscribe = subscribeToSSE(campaignName, (event) => {
      if (event.key !== `change-${campaignName}-combatSummary`) return;
      applyCensus(event.data);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [campaignName, isLocalhost]);

  const handleAddNote = async () => {
    if (!noteText.trim() || !author) return;
    const text = noteText.trim();
    await addEntry(composeType === 'narrative' && isLocalhost
      ? { type: 'narrative', characterName: author, description: text }
      : { type: 'note', characterName: author, noteText: text });
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

        <LogComposer
          isLocalhost={isLocalhost}
          authorGroups={authorGroups}
          author={author}
          composeType={composeType}
          noteText={noteText}
          onSelectAuthor={setSelectedAuthor}
          onComposeType={setComposeType}
          onNoteText={setNoteText}
          onPost={handleAddNote}
          onKeyDown={handleKeyDown}
        />

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
