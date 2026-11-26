/**
 * Chronicle compose model (learnability-engagement backlog Item 2).
 *
 * Pure, testable logic that turns the raw campaign log (server/routes/log.js
 * rows, read client-side through useLog/logService) into a readable long-form
 * story: story beats selected by entry type, grouped by the server-stamped
 * `session` field, ordered FORWARD in time (the Log view renders newest-first;
 * the chronicle reads like a book). No AI, no extra fetches, no timers — the
 * view works with AI fully off; world-keeper recap rows simply appear when
 * they exist.
 *
 * ── Include/exclude doctrine (documented decision list; pinned by tests) ──
 * INCLUDE — clearly story-worthy rows:
 *   narrative        GM/referee prose (composer or world lane) — markdown body
 *   session_recap    the per-session recap (markdown body, titled by subject)
 *   session-played   "Session X marked as played — recap" milestone row
 *   encounter        ONLY action 'started' / 'completed' — the narrative seams
 *   loot             loot & XP awards (the per-line record owner)
 *   short_rest / long_rest    camp beats between the seams
 *   travel           overland story beats (advance/arrived/camp/weather…),
 *                    minus the event-menu bookkeeping legs below
 * EXCLUDE — mechanics noise, audit lanes and chatter (never rendered):
 *   note             shared tabletop chatter, not canon prose
 *   roll, hp_change, healing, healing_pool, death_save, condition, spell,
 *   spell_effect, metamagic, metamagic_use, buff, ability_use, save_result,
 *   summons, psionic_sorcery, automation, automation_info, action_complete,
 *   concentration_lost, material_consumed, ward_absorbed   combat bookkeeping
 *   encounter action 'joined' / 'loot_awarded'             roster + duplicate
 *                                                          award legs (the
 *                                                          loot rows own those)
 *   travel actions event_accept / event_skip / event_reroll / cancel  menu
 *                    plumbing around a travel event, not the event itself
 *   info, inventory_transfer                               ledger chatter
 *   session_active, session_phase                          state plumbing — the
 *                    `session` stamp + section headers already carry this
 *   music                                                  ambience operations
 *   write_rejected, enforcement_*                          referee refusals
 *   ai_*                                                   AI audit trail
 *   adventure_regenerated, map_regenerated                 generation audits
 *
 * Any type not named above is excluded by construction (SELECT is a whitelist).
 */
import { getEntryText } from '../../components/log/log-utils.js';

// Row types that always compose into the chronicle, each mapped to its beat
// builder in BEAT_BUILDERS below (encounter/travel refine per action — see the
// doctrine above).

// Only these encounter legs are narrative seams; 'joined' is roster plumbing
// and 'loot_awarded' duplicates the dedicated loot rows.
const STORY_ENCOUNTER_ACTIONS = new Set(['started', 'completed']);

// Travel menu/cancel legs are plumbing around an event, not story.
const TRAVEL_BOOKKEEPING_ACTIONS = new Set(['event_accept', 'event_skip', 'event_reroll', 'cancel']);

// Canonical encounter-seam labels (mirrors LogEncounterEntry's presentation —
// one phrasing shared by the view and the markdown export).
const ENCOUNTER_ACTION_LABELS = {
  started: 'Encounter Started',
  completed: 'Encounter Completed',
};

// Travel action → readable verb phrase, mirroring TravelActionConfig labels in
// the Log view so both surfaces tell the same story the same way.
const TRAVEL_ACTION_LABELS = {
  advance: 'Advanced to',
  advance_with_event: 'Event triggered at',
  arrived: 'Arrived at',
  camp: 'Camped at',
  forced_march: 'Forced march at',
  extreme_weather: 'Weather halted travel at',
  day_exhausted: 'Budget exhausted at',
};

// The heading for rows written while no session was tracked.
export const UNSESSIONED_TITLE = 'Campaign-span';

// Travel text may ride `text` (info-lane field, see getEntryText's documented
// scope) — the chronicle is a consumer of those rows too, so it reads it here
// after the canonical accessor finds nothing. This is NOT a legacy fallback:
// `text` is the one field session-played rows canonically carry.
function chronicleText(entry) {
  const canonical = getEntryText(entry);
  if (canonical && canonical.trim()) return canonical;
  return typeof entry.text === 'string' && entry.text.trim() ? entry.text : null;
}

const asStringList = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : []);

/**
 * One log row → one chronicle beat, or null when the row is not story.
 * Beat `kind` drives both the view renderer and the markdown writer, so the
 * export and the page are built from the SAME composed model. Dispatch is a
 * whitelist map keyed by the story types only — any other type (including
 * future ones) composes OUT by construction.
 */
function proseBeat(entry, isRecap) {
  const markdown = chronicleText(entry);
  if (!markdown) return null;
  return {
    kind: 'prose',
    id: entry.id,
    timestamp: Number(entry.timestamp),
    author: entry.characterName || 'GM',
    // narrative rows may carry an in-world speaker label (npc_dialogue law)
    speaker: !isRecap && entry.name ? entry.name : null,
    isRecap,
    // session_recap subjects key off recapSession (the WHEN stamp lives on
    // `session`, same law the Log recap renderer follows).
    recapSession: isRecap ? (entry.recapSession || null) : null,
    markdown,
  };
}

function milestoneBeat(entry) {
  const text = chronicleText(entry);
  if (!text) return null;
  return { kind: 'milestone', id: entry.id, timestamp: Number(entry.timestamp), label: 'Session Played', text };
}

function encounterBeat(entry) {
  // Only the narrative seams; 'joined' is roster plumbing and 'loot_awarded'
  // duplicates the dedicated loot rows.
  if (!STORY_ENCOUNTER_ACTIONS.has(entry.action)) return null;
  return {
    kind: 'encounter',
    id: entry.id,
    timestamp: Number(entry.timestamp),
    action: entry.action,
    label: ENCOUNTER_ACTION_LABELS[entry.action],
    encounterName: entry.encounterName || 'Encounter',
    monsters: entry.action === 'started' ? asStringList(entry.monsters) : [],
    xpPerChar: entry.action === 'completed' && entry.xpPerChar > 0 ? entry.xpPerChar : 0,
  };
}

function lootBeat(entry) {
  const lootItems = asStringList(entry.lootItems);
  const xpPerChar = entry.xpPerChar > 0 ? entry.xpPerChar : 0;
  // An award row with neither items nor XP is pure noise — skip the beat.
  if (!lootItems.length && !xpPerChar) return null;
  return { kind: 'loot', id: entry.id, timestamp: Number(entry.timestamp), xpPerChar, lootItems };
}

function restBeat(entry) {
  const long = entry.type === 'long_rest';
  return {
    kind: 'rest',
    id: entry.id,
    timestamp: Number(entry.timestamp),
    long,
    label: long ? 'Long Rest' : 'Short Rest',
    text: getEntryText(entry),
  };
}

function travelBeat(entry) {
  // Event-menu/cancel legs are plumbing around a travel event, not story.
  if (TRAVEL_BOOKKEEPING_ACTIONS.has(entry.action)) return null;
  return {
    kind: 'travel',
    id: entry.id,
    timestamp: Number(entry.timestamp),
    action: entry.action,
    label: TRAVEL_ACTION_LABELS[entry.action] || 'Travelled',
    hex: entry.hex && Number.isFinite(entry.hex.q) && Number.isFinite(entry.hex.r) ? `(${entry.hex.q}, ${entry.hex.r})` : null,
    terrain: entry.terrain || null,
    weather: entry.weather || null,
    eventTitle: entry.eventTitle || null,
    eventType: entry.eventType || null,
  };
}

const BEAT_BUILDERS = {
  narrative: (entry) => proseBeat(entry, false),
  session_recap: (entry) => proseBeat(entry, true),
  'session-played': milestoneBeat,
  encounter: encounterBeat,
  loot: lootBeat,
  short_rest: restBeat,
  long_rest: restBeat,
  travel: travelBeat,
};

export function chronicleBeatFor(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const build = BEAT_BUILDERS[entry.type];
  return build ? build(entry) : null;
}

/**
 * Compose the whole chronicle. Returns
 *   { sections: [{ name, startTimestamp, beats: [...] }], beatCount }
 * Sessions group by the server-stamped `session` value; each section is dated
 * by its earliest beat; sections run forward in time and the unsessioned
 * ("Campaign-span", `name: null`) section — the rows written outside any
 * tracked session — closes the chronicle.
 */
export function composeChronicle(entries) {
  const bySession = new Map();
  const unsessioned = [];
  let beatCount = 0;

  for (const entry of Array.isArray(entries) ? entries : []) {
    const beat = chronicleBeatFor(entry);
    if (!beat) continue;
    beatCount += 1;
    const name = typeof entry.session === 'string' && entry.session.trim() ? entry.session.trim() : null;
    if (name === null) {
      unsessioned.push(beat);
      continue;
    }
    if (!bySession.has(name)) bySession.set(name, []);
    bySession.get(name).push(beat);
  }

  const toSection = (name, beats) => {
    // Forward in time inside the section regardless of arrival order (the
    // shared log is append-order, but SSE-less fixtures and exports must not
    // depend on that).
    const sorted = [...beats].sort((a, b) => a.timestamp - b.timestamp);
    return { name, startTimestamp: sorted[0].timestamp, beats: sorted };
  };

  const sessions = [...bySession.entries()]
    .map(([name, beats]) => toSection(name, beats))
    .sort((a, b) => a.startTimestamp - b.startTimestamp);
  const sections = unsessioned.length ? [...sessions, toSection(null, unsessioned)] : sessions;
  return { sections, beatCount };
}

/** Long readable date for session headers ("25 November 2026"). */
export function formatChronicleDate(timestamp) {
  return new Date(timestamp).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Short time-of-day for quiet beat timestamps ("14:05"). */
export function formatChronicleTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// beat.kind → markdown line (keeps the export and the page phrased alike).
function proseToMarkdown(beat) {
  const heading = beat.isRecap
    ? `### Session Recap${beat.recapSession ? ` — ${beat.recapSession}` : ''}`
    : (beat.speaker ? `*${beat.speaker}:*` : null);
  const parts = [];
  if (heading) parts.push(heading);
  if (beat.markdown) parts.push(beat.markdown.trim());
  return parts.join('\n\n');
}

function encounterToMarkdown(beat) {
  const parts = [`- **${beat.label}** — ${beat.encounterName}`];
  if (beat.action === 'started' && beat.monsters.length) parts.push(` (${beat.monsters.join(', ')})`);
  if (beat.action === 'completed' && beat.xpPerChar) parts.push(` — ${beat.xpPerChar.toLocaleString()} XP per character`);
  return parts.join('');
}

function lootToMarkdown(beat) {
  const lines = [`- **Loot Awarded**${beat.xpPerChar ? ` — ${beat.xpPerChar.toLocaleString()} XP per character` : ''}`];
  for (const item of beat.lootItems) lines.push(`  - ${item}`);
  return lines.join('\n');
}

function travelToMarkdown(beat) {
  const where = [beat.hex, beat.terrain, beat.weather].filter(Boolean).join(' · ');
  const lines = [`- **${beat.label}**${where ? ` ${where}` : ''}`];
  if (beat.eventTitle) lines.push(`  - Event: ${[beat.eventType, beat.eventTitle].filter(Boolean).join(' — ')}`);
  return lines.join('\n');
}

const BEAT_MARKDOWN_WRITERS = {
  prose: proseToMarkdown,
  milestone: (beat) => `- **${beat.label}** — ${beat.text.trim()}`,
  encounter: encounterToMarkdown,
  loot: lootToMarkdown,
  rest: (beat) => `- **${beat.label}**${beat.text ? ` — ${beat.text.trim()}` : ''}`,
  travel: travelToMarkdown,
};

function beatToMarkdownLine(beat) {
  const write = BEAT_MARKDOWN_WRITERS[beat.kind];
  return write ? write(beat) : null;
}

/**
 * Render the composed chronicle as a standalone sanitized Markdown document
 * (prose bodies are the already-sanitized markdown sources posted through the
 * GM composer / recap endpoint; milestone beats are plain log text written as
 * list lines). One `.md` export per campaign.
 */
export function chronicleToMarkdown(campaignName, chronicle) {
  const { sections } = chronicle;
  const parts = [`# ${campaignName} — Chronicle`];
  for (const section of sections) {
    const heading = section.name === null
      ? `## ${UNSESSIONED_TITLE}`
      : `## ${section.name} — ${formatChronicleDate(section.startTimestamp)}`;
    const body = section.beats.map(beatToMarkdownLine).filter(Boolean);
    parts.push(heading, body.join('\n\n'));
  }
  return `${parts.join('\n\n').trim()}\n`;
}

/** Filesystem-safe campaign slug for the export filename. */
export function chronicleFileName(campaignName) {
  const slug = String(campaignName || 'campaign')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'campaign'}-chronicle.md`;
}
