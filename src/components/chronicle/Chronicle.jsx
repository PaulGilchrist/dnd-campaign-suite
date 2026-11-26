import { useMemo } from 'react';
import { saveAs } from 'file-saver';
import useLog from '../../hooks/runtime/useLog.js';
import { renderMarkdown } from '../../services/ui/sanitize.js';
import {
  composeChronicle,
  chronicleToMarkdown,
  chronicleFileName,
  formatChronicleDate,
  formatChronicleTime,
  UNSESSIONED_TITLE,
} from '../../services/ui/chronicleService.js';
import './Chronicle.css';

// The ONE markdown sink for prose beats — the same marked+DOMPurify renderer
// the Log narrative rows use (services/ui/sanitize.js), never a second one.
function ProseBeat({ beat }) {
  const html = renderMarkdown(beat.markdown);
  return (
    <article className={`chronicle-beat chronicle-prose${beat.isRecap ? ' chronicle-recap' : ''}`}>
      {beat.isRecap && (
        <div className="chronicle-recap-title">
          <i className="fas fa-scroll"></i> Session Recap{beat.recapSession ? ` — ${beat.recapSession}` : ''}
        </div>
      )}
      {beat.speaker && <div className="chronicle-speaker">{beat.speaker}</div>}
      <div className="chronicle-prose-text" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

// One-line story beat: icon + label + plain detail + quiet timestamp.
function LineBeat({ icon, label, cls, children, timestamp }) {
  return (
    <div className={`chronicle-beat chronicle-line ${cls}`}>
      <span className="chronicle-line-icon"><i className={`fas ${icon}`}></i></span>
      <span className="chronicle-line-label">{label}</span>
      <span className="chronicle-line-text">{children}</span>
      <span className="chronicle-beat-time no-print">{formatChronicleTime(timestamp)}</span>
    </div>
  );
}

const xpPhrase = (xp) => ` — ${xp.toLocaleString()} XP per character`;

function MilestoneBeat({ beat }) {
  return (
    <LineBeat icon="fa-flag-checkered" label={beat.label} cls="chronicle-milestone" timestamp={beat.timestamp}>
      {beat.text}
    </LineBeat>
  );
}

function EncounterBeat({ beat }) {
  return (
    <LineBeat
      icon={beat.action === 'started' ? 'fa-skull' : 'fa-trophy'}
      label={beat.label}
      cls={`chronicle-encounter chronicle-encounter-${beat.action}`}
      timestamp={beat.timestamp}
    >
      {beat.encounterName}
      {beat.action === 'started' && beat.monsters.length > 0 && ` — ${beat.monsters.join(', ')}`}
      {beat.action === 'completed' && beat.xpPerChar > 0 && xpPhrase(beat.xpPerChar)}
    </LineBeat>
  );
}

function LootBeat({ beat }) {
  return (
    <LineBeat icon="fa-coins" label="Loot Awarded" cls="chronicle-loot" timestamp={beat.timestamp}>
      {beat.xpPerChar > 0 && <span className="chronicle-loot-xp">{beat.xpPerChar.toLocaleString()} XP per character</span>}
      {beat.lootItems.length > 0 && (
        <ul className="chronicle-loot-items">
          {beat.lootItems.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
    </LineBeat>
  );
}

function RestBeat({ beat }) {
  return (
    <LineBeat
      icon={beat.long ? 'fa-moon' : 'fa-bed'}
      label={beat.label}
      cls={beat.long ? 'chronicle-rest-long' : 'chronicle-rest-short'}
      timestamp={beat.timestamp}
    >
      {beat.text}
    </LineBeat>
  );
}

function TravelBeat({ beat }) {
  const where = [beat.hex, beat.terrain, beat.weather].filter(Boolean).join(' · ');
  return (
    <LineBeat icon="fa-route" label={beat.label} cls="chronicle-travel" timestamp={beat.timestamp}>
      {where}
      {beat.eventTitle && <span className="chronicle-travel-event">{beat.eventType ? `${beat.eventType}: ` : ''}{beat.eventTitle}</span>}
    </LineBeat>
  );
}

// kind → renderer, mirroring the compose model's kinds (unknown kinds can
// only mean a model bug — render nothing rather than a broken row).
const BEAT_COMPONENTS = {
  prose: ProseBeat,
  milestone: MilestoneBeat,
  encounter: EncounterBeat,
  loot: LootBeat,
  rest: RestBeat,
  travel: TravelBeat,
};

function ChronicleBeat({ beat }) {
  const BeatComponent = BEAT_COMPONENTS[beat.kind];
  if (!BeatComponent) return null;
  return <BeatComponent beat={beat} />;
}

/**
 * The Chronicle (learnability-engagement backlog Item 2): a read-only,
 * long-form telling of the campaign composed from the existing log alone —
 * grouped by session, forward in time, with a Markdown export and a print
 * face. Pure shared-table read: no authoring affordances, no AI dependency.
 */
export default function Chronicle({ campaignName }) {
  const { logEntries, initialized } = useLog(campaignName);
  const chronicle = useMemo(() => composeChronicle(logEntries), [logEntries]);

  const handleExport = () => {
    const markdown = chronicleToMarkdown(campaignName, chronicle);
    saveAs(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), chronicleFileName(campaignName));
  };

  const hasStory = chronicle.sections.length > 0;
  return (
    <div className="campaign-tool chronicle-view ct-container" data-testid="chronicle-view">
      <div className="chronicle-toolbar">
        <h2><i className="fas fa-book-open"></i> Chronicle</h2>
        <div className="chronicle-actions no-print">
          {/* Labeled primaries (F12 lesson): export and paper are this view's verbs. */}
          <button type="button" className="ct-btn ct-btn-primary" onClick={handleExport} disabled={!hasStory} title="Download the chronicle as a Markdown file">
            <i className="fas fa-download"></i> Export Markdown
          </button>
          <button type="button" className="ct-btn" onClick={() => window.print()} disabled={!hasStory} title="Print the chronicle">
            <i className="fas fa-print"></i> Print
          </button>
        </div>
      </div>

      {!initialized && <div className="chronicle-loading ct-empty-state no-print">Reading the campaign log...</div>}
      {initialized && !hasStory && (
        <div className="chronicle-empty ct-empty-state">
          <i className="fas fa-feather-pointed"></i>
          <span>Your story will unfold here — post narrative notes in the Log and they’ll appear here.</span>
        </div>
      )}

      {hasStory && chronicle.sections.map(section => (
        <section key={section.name === null ? UNSESSIONED_TITLE : section.name} className="chronicle-session">
          <h3 className="chronicle-session-header">
            <i className={`fas ${section.name === null ? 'fa-book-open' : 'fa-calendar-check'}`}></i>
            {section.name === null ? UNSESSIONED_TITLE : section.name}
            <span className="chronicle-session-date">{formatChronicleDate(section.startTimestamp)}</span>
          </h3>
          <div className="chronicle-section-beats">
            {section.beats.map(beat => <ChronicleBeat key={beat.id} beat={beat} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
