import { useEffect, useState } from 'react';
import MarkdownPreview from '../common/MarkdownPreview.jsx';
import { LINK_TYPES, CONTINGENCY_BRANCHES, checklistProgress } from '../../services/campaign/sessionPlannerUtils.js';
import { loadEncounters } from '../../services/encounters/encountersService.js';
import { loadNotes } from '../../services/campaign/notesService.js';
import { calculateXPThreshold } from '../../services/encounters/encounterGenerator.js';
import { DIFFICULTY_LABELS } from '../../services/encounters/difficultyBands.js';
import { formatPaperDate } from './handoutUtils.js';

// Same shape-tolerance as the Sessions picker batch: a service may hand back
// the array or an {encounters: []} wrap.
function asList(value, key) {
  return Array.isArray(value) ? value : (value?.[key] || []);
}

function branchLabel(branch) {
  return CONTINGENCY_BRANCHES.find(b => b.value === branch)?.label || branch;
}

function noteTitle(note) {
  return (note.description || '').replace(/[#*_>`]/g, '').trim().substring(0, 60) || note.id;
}

function LinksSection({ links, encounterRows, noteRows }) {
  const linked = key => links[key] || [];
  const nameFor = (key, value) => {
    if (key === 'notes') {
      const note = noteRows.find(n => n.id === value);
      return note ? noteTitle(note) : value;
    }
    if (key === 'encounters') {
      const enc = encounterRows.find(e => e.name === value);
      return enc?.effectiveXP != null ? `${value} (${enc.effectiveXP.toLocaleString()} XP)` : value;
    }
    return value;
  };
  return (
    <div className="handout-session-links">
      <h3 className="handout-section-title">Linked Resources</h3>
      {LINK_TYPES.every(type => linked(type.key).length === 0) && (
        <p className="handout-empty">Nothing linked to this session yet.</p>
      )}
      {LINK_TYPES.map(type => linked(type.key).length > 0 && (
        <p key={type.key} className="handout-rule">
          <span className="handout-rule-lead">{type.label}&nbsp;</span>
          {linked(type.key).map(name => nameFor(type.key, name)).join(', ')}
        </p>
      ))}
    </div>
  );
}

function ContingenciesSection({ contingencies }) {
  if ((contingencies || []).length === 0) return null;
  return (
    <div className="handout-session-contingencies">
      <h3 className="handout-section-title">Contingencies</h3>
      {contingencies.map((c, i) => (
        <p key={c.id || i} className="handout-rule handout-contingency">
          <span className="handout-rule-lead">If&nbsp;</span>{c.ifText || '…'}
          <span className="handout-rule-lead"> → then&nbsp;</span>{c.thenText || '…'}
          <span className="handout-contingency-branch"> ({branchLabel(c.branch)})</span>
        </p>
      ))}
    </div>
  );
}

function ChecklistSection({ checklist }) {
  const { done, total } = checklistProgress(checklist);
  if (total === 0) return null;
  return (
    <div className="handout-session-checklist">
      <h3 className="handout-section-title">
        Prep Checklist <span className="handout-checklist-progress">({done} of {total} ready)</span>
      </h3>
      {checklist.map(item => (
        <p key={item.id} className={`handout-checklist-item${item.done ? ' handout-checklist-done' : ''}`}>
          <span className="handout-checklist-box">{item.done ? '☑' : '☐'}</span> {item.label}
        </p>
      ))}
    </div>
  );
}

function XpGuideSection({ partyLevels }) {
  if (partyLevels.length === 0) return null;
  return (
    <div className="handout-session-xp">
      <h3 className="handout-section-title">XP Budget Guide</h3>
      <p className="handout-rule">
        <span className="handout-rule-lead">Party&nbsp;</span>
        {partyLevels.join(', ')} ({partyLevels.length} character{partyLevels.length === 1 ? '' : 's'})
      </p>
      <table className="handout-table handout-thresholds">
        <thead>
          <tr>
            {DIFFICULTY_LABELS.map(label => <th key={label}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            {DIFFICULTY_LABELS.map((label, i) => (
              <td key={label}>{calculateXPThreshold(partyLevels, i).toLocaleString()} XP</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Rumours a GM authored as linked notes land here in full — the planner has
// no separate rumour field, and this sheet invents no data it never wrote.
function LinkedNotesSection({ noteRows }) {
  if (noteRows.length === 0) return null;
  return (
    <div className="handout-session-notes">
      <h3 className="handout-section-title">Linked Notes</h3>
      {noteRows.map(note => (
        <div key={note.id} className="handout-linked-note">
          <h4 className="handout-linked-note-title">{noteTitle(note)}</h4>
          <MarkdownPreview className="handout-md" text={note.description || ''} />
        </div>
      ))}
    </div>
  );
}

/**
 * Printed session one-pager — the GM screen on paper (backlog Item 4).
 * Reads the saved session row and expands its links: linked encounter rows
 * carry their saved XP, linked notes print in full. The XP-budget section
 * is the same 5e threshold math the Encounter Builder shows, derived live
 * from the party rows. Sessions are a GM-only surface, so this sheet prints
 * everything the GM wrote by design; it still writes NOTHING.
 */
export default function SessionOnePager({ session, characters = [], campaignName }) {
  const [extras, setExtras] = useState({ encounters: null, notes: null });

  useEffect(() => {
    if (!campaignName) return undefined;
    let alive = true;
    Promise.allSettled([loadEncounters(campaignName), loadNotes(campaignName)]).then(
      ([encResult, notesResult]) => {
        if (!alive) return;
        setExtras({
          encounters: encResult.status === 'fulfilled' ? asList(encResult.value, 'encounters') : null,
          notes: notesResult.status === 'fulfilled' ? asList(notesResult.value, 'notes') : null,
        });
      }
    );
    return () => { alive = false; };
  }, [campaignName]);

  if (!session) {
    return <p className="handout-empty">No session selected to print.</p>;
  }

  const links = session.links || {};
  const played = session.status === 'played';
  const encounterRows = extras.encounters || [];
  const linkedNoteRows = (extras.notes || []).filter(n => (links.notes || []).includes(n.id));
  const partyLevels = characters.map(c => c.level).filter(l => Number.isFinite(l));

  return (
    <div className="handout-session">
      <h2 className="handout-name">Session: {session.name}</h2>
      <p className="handout-meta">
        {session.date ? `Date: ${formatPaperDate(session.date)}` : 'No date set'}
        {` · ${played ? 'Played' : 'Planned'}`}
      </p>
      <hr className="handout-rulebreak" />

      {(session.summary || '').trim() && (
        <div className="handout-session-summary">
          <h3 className="handout-section-title">Summary</h3>
          <MarkdownPreview className="handout-md" text={session.summary} />
        </div>
      )}

      <LinksSection links={links} encounterRows={encounterRows} noteRows={linkedNoteRows} />
      <ContingenciesSection contingencies={session.contingencies} />
      <ChecklistSection checklist={session.checklist || []} />
      <XpGuideSection partyLevels={partyLevels} />
      <LinkedNotesSection noteRows={linkedNoteRows} />

      {(session.notes || '').trim() && (
        <div className="handout-session-gmnotes">
          <h3 className="handout-section-title">GM Notes</h3>
          <MarkdownPreview className="handout-md" text={session.notes} />
        </div>
      )}
    </div>
  );
}
