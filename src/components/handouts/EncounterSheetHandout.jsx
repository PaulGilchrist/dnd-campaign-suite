import MarkdownPreview from '../common/MarkdownPreview.jsx';
import { calculateXPThreshold } from '../../services/encounters/encounterGenerator.js';
import { DIFFICULTY_LABELS, calculateDifficultyIndex } from '../../services/encounters/difficultyBands.js';
import { challengeRatingLabel, formatSpeed, formatPaperDate } from './handoutUtils.js';

/**
 * Printed encounter sheet (backlog Item 4): the saved-pool row is a {name,
 * savedAt, selectedMonsters[{index,name,qty}], description, effectiveXP}
 * document — the roster CR/XP columns are DERIVED live from the bestiary
 * rows the host already loaded, and the difficulty verdict uses the same
 * ratio bands as the on-screen builder (shared encounterGenerator math).
 * Nothing at the table needs the hidden-info face, so this is paper-safe
 * by construction.
 */

function rosterRows(encounter, monsters) {
  return (encounter.selectedMonsters || []).map(ref => {
    const monster = (monsters || []).find(m => m.index === ref.index);
    const qty = ref.qty || 1;
    return {
      name: monster?.name || ref.name || ref.index,
      qty,
      ac: monster ? String(monster.armor_class ?? '—') : '—',
      hp: monster ? String(monster.hit_points ?? '—') : '—',
      speed: monster ? formatSpeed(monster.speed) : '—',
      cr: monster ? challengeRatingLabel(monster.challenge_rating) : '—',
      xp: monster?.xp != null ? monster.xp * qty : null,
    };
  });
}

function RosterTable({ rows }) {
  if (rows.length === 0) {
    return <p className="handout-empty">This encounter has no monsters selected.</p>;
  }
  const totalXp = rows.every(row => row.xp != null)
    ? rows.reduce((sum, row) => sum + row.xp, 0)
    : null;
  return (
    <table className="handout-table handout-roster">
      <thead>
        <tr>
          <th>Monster</th>
          <th>Qty</th>
          <th>AC</th>
          <th>HP</th>
          <th>Speed</th>
          <th>CR</th>
          <th>XP</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={`${row.name}-${i}`} className="handout-roster-row">
            <td>{row.name}</td>
            <td>{row.qty}</td>
            <td>{row.ac}</td>
            <td>{row.hp}</td>
            <td>{row.speed}</td>
            <td>{row.cr}</td>
            <td>{row.xp != null ? row.xp.toLocaleString() : '—'}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={6}>Total XP (before party-size multiplier)</td>
          <td>{totalXp != null ? totalXp.toLocaleString() : '—'}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function PartySection({ partyLevels, effectiveXP }) {
  if (partyLevels.length === 0) {
    return <p className="handout-empty">No party levels selected — no difficulty verdict for this sheet.</p>;
  }
  const thresholds = DIFFICULTY_LABELS.map((_, i) => calculateXPThreshold(partyLevels, i));
  const difficultyLabel = effectiveXP != null
    ? DIFFICULTY_LABELS[calculateDifficultyIndex(effectiveXP, thresholds[1])]
    : null;
  return (
    <div className="handout-party">
      <h3 className="handout-section-title">Party</h3>
      <p className="handout-rule">
        <span className="handout-rule-lead">Levels&nbsp;</span>{partyLevels.join(', ')}
        {' '}({partyLevels.length} character{partyLevels.length === 1 ? '' : 's'})
      </p>
      <table className="handout-table handout-thresholds">
        <thead>
          <tr>
            {DIFFICULTY_LABELS.map(label => <th key={label}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            {thresholds.map((t, i) => <td key={i}>{t.toLocaleString()} XP</td>)}
          </tr>
        </tbody>
      </table>
      {difficultyLabel && (
        <p className="handout-rule">
          <span className="handout-rule-lead">Difficulty&nbsp;</span>
          {difficultyLabel}
          {` (${effectiveXP.toLocaleString()} effective XP)`}
        </p>
      )}
    </div>
  );
}

export default function EncounterSheetHandout({ encounter, monsters = [], partyLevels = [] }) {
  if (!encounter) {
    return <p className="handout-empty">No encounter selected to print.</p>;
  }
  const rows = rosterRows(encounter, monsters);
  const monsterCount = rows.reduce((sum, row) => sum + row.qty, 0);

  return (
    <div className="handout-encounter">
      <h2 className="handout-name">Encounter: {encounter.name}</h2>
      <p className="handout-meta">
        {encounter.savedAt ? `Saved ${formatPaperDate(encounter.savedAt)}` : 'Unsaved draft'}
        {monsterCount > 0 && ` · ${monsterCount} creature${monsterCount === 1 ? '' : 's'}`}
      </p>
      <hr className="handout-rulebreak" />

      <PartySection partyLevels={partyLevels} effectiveXP={encounter.effectiveXP} />

      <h3 className="handout-section-title">Roster</h3>
      <RosterTable rows={rows} />

      {(encounter.description || '').trim() && (
        <div className="handout-encounter-description">
          <h3 className="handout-section-title">Description</h3>
          <MarkdownPreview className="handout-md" text={encounter.description} />
        </div>
      )}
    </div>
  );
}
