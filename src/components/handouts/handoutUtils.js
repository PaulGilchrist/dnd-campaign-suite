/**
 * Shared derivations for the print-handout family (backlog Item 4). Pure
 * presentation math only — no store reads, no writes.
 */

export function formatModifier(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '+0';
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Ability SCORE -> signed modifier (the 5e (score − 10) ÷ 2 floor). */
export function scoreToModifier(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.floor((n - 10) / 2);
}

const CR_FRACTIONS = { '0.125': '1/8', '0.25': '1/4', '0.5': '1/2' };

export function challengeRatingLabel(cr) {
  if (cr === null || cr === undefined || cr === '') return '—';
  return CR_FRACTIONS[String(cr)] || String(cr);
}

/** { walk: '30 ft.', fly: '60 ft.' } -> '30 ft., fly 60 ft.' */
export function formatSpeed(speed) {
  if (!speed || typeof speed !== 'string') {
    if (speed && typeof speed === 'object') {
      const parts = Object.entries(speed)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
        .map(([mode, v]) => (mode === 'walk' ? String(v).trim() : `${mode} ${String(v).trim()}`));
      return parts.length ? parts.join(', ') : '—';
    }
    return '—';
  }
  return speed.trim() || '—';
}

export function formatBonusList(bonuses) {
  const entries = Object.entries(bonuses || {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;
  // Save keys are authored lowercase (str/dex/…); paper shows the 5e STR/DEX face.
  return entries
    .map(([name, v]) => `${name.toUpperCase()} ${formatModifier(typeof v === 'object' ? v.bonus ?? v.modifier ?? v : v)}`)
    .join(', ');
}

export function formatSkillList(skills) {
  const entries = Object.entries(skills || {});
  if (entries.length === 0) return null;
  return entries
    .map(([name, v]) => `${name} ${formatModifier(typeof v === 'object' ? v.modifier ?? v.bonus ?? v : v)}`)
    .join(', ');
}

export function joinOrDash(values) {
  const list = (values || []).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  return list.length ? list.join(', ') : null;
}

/** '2026-08-21T13:30:56.500Z' or '2026-11-30' -> '21 Aug 2026' (paper-safe).
 *  Date-only strings are split by hand: new Date('YYYY-MM-DD') parses UTC
 *  midnight and would shift a west-of-GMT GM's printed session date back a
 *  day. Full timestamps keep their own locale day. */
export function formatPaperDate(value) {
  if (!value) return null;
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
