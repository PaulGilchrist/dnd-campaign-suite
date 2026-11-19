// @maintained-by-ai
/**
 * Confirm modal for the ruleset switch in the character wizard (roadmap Item 2
 * — ruleset-switch data-loss guard). Arms at the exact moment a '5e' ↔ '2024'
 * switch would have wiped choices, and names byte-honestly what survives:
 * every kept/dropped spell, feat and background row comes from the live
 * keep/drop classification (rulesetSwitchPreview.js) over the TARGET
 * ruleset's data — never a canned warning. Cancel is fully inert (the wizard
 * mutates nothing); confirm applies exactly the preview shown here.
 *
 * Rides the shared common/DeleteConfirmModal role="dialog" tier (same
 * non-delete reuse precedent as FriendlyFireConfirmModal/SpellOverlayConfirm):
 * .modal-shell-* chrome + focus trap + Escape/backdrop dismiss come from it.
 * Its body slot renders children inside a <p>, so every line here is a
 * display:block <span> — valid inline content, styled by this component's
 * own scoped CSS (no inline styles, house convention).
 */
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';
import { RULESET_LABELS, NAME_LIST_VISIBLE_CAP } from '../../services/character/rulesetSwitchPreview.js';
import './RulesetSwitchConfirmModal.css';

// One row of the kept/dropped ledger. Dropped rows carry the classifier's
// honest detail (why the target ruleset data refuses them) beside the name.
function LedgerRow({ row }) {
  if (row.kept) {
    return (
      <span className="ruleset-switch-row ruleset-switch-row-kept">
        <i className="fa-solid fa-check" aria-hidden="true"></i>
        <span className="ruleset-switch-name">{row.name}</span>
      </span>
    );
  }
  return (
    <span className="ruleset-switch-row ruleset-switch-row-dropped">
      <i className="fa-solid fa-xmark" aria-hidden="true"></i>
      <span className="ruleset-switch-name">{row.name}</span>
      <span className="ruleset-switch-reason">{row.detail}</span>
    </span>
  );
}

// Capped row list: first NAME_LIST_VISIBLE_CAP rows by name, remainder folded
// into an honest "+N more" line (the kept/removed counts above never cap).
function CappedRows({ rows, singular }) {
  const visible = rows.slice(0, NAME_LIST_VISIBLE_CAP);
  const overflow = rows.length - visible.length;
  return (
    <>
      {visible.map(row => (
        <LedgerRow key={`${row.kept ? 'kept' : 'drop'}-${row.name}`} row={row} />
      ))}
      {overflow > 0 && (
        <span className="ruleset-switch-more">+{overflow} more {singular.toLowerCase()}{overflow > 1 ? 's' : ''}</span>
      )}
    </>
  );
}

function toRows(group) {
  return [
    ...(group.kept || []).map(name => ({ name, kept: true })),
    ...group.dropped.map(row => ({ name: row.name, kept: false, detail: row.detail })),
  ];
}

function GroupBlock({ icon, title, rows, counts, singular }) {
  if (rows.length === 0) return null;
  return (
    <span className="ruleset-switch-group">
      <span className="ruleset-switch-group-title">
        <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
        {' '}{title} — {counts.kept} kept, {counts.removed} removed
      </span>
      <CappedRows rows={rows} singular={singular} />
    </span>
  );
}

function RulesetSwitchConfirmModal({ preview, onCancel, onConfirm }) {
  const targetLabel = RULESET_LABELS[preview.targetRuleset];
  const spellRows = toRows(preview.spells);
  const featRows = toRows(preview.feats);
  const backgroundRows = preview.background.selected.length === 0
    ? []
    : preview.background.kept
      ? [{ name: preview.background.kept, kept: true }]
      : preview.background.dropped.map(row => ({ name: row.name, kept: false, detail: row.detail }));

  return (
    <DeleteConfirmModal
      titleId="ruleset-switch-confirm-title"
      title={`Switch to ${targetLabel}?`}
      confirmLabel="Yes, switch ruleset"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <span className="ruleset-switch-intro">
        Every choice is re-checked against the {targetLabel} rules data:{' '}
        <strong>{preview.keptCount} kept, {preview.droppedCount} removed</strong>.
        {preview.droppedCount === 0
          ? ' Nothing is removed — everything you picked already exists there and stays legal for this character.'
          : ' Removed rows are named below; the wizard restarts at Basic Information so every step can be re-confirmed.'}
      </span>
      {!preview.targetDataLoaded && (
        <span className="ruleset-switch-row ruleset-switch-row-dropped">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <span className="ruleset-switch-reason">
            The {targetLabel} rules data did not load — nothing can be verified, so every row would be dropped.
          </span>
        </span>
      )}
      <GroupBlock
        icon="fa-hat-wizard"
        title="Spells"
        rows={spellRows}
        counts={{ kept: preview.spells.kept.length, removed: preview.spells.dropped.length }}
        singular="Spell"
      />
      <GroupBlock
        icon="fa-star"
        title="Feats"
        rows={featRows}
        counts={{ kept: preview.feats.kept.length, removed: preview.feats.dropped.length }}
        singular="Feat"
      />
      <GroupBlock
        icon="fa-campground"
        title="Background"
        rows={backgroundRows}
        counts={{ kept: preview.background.kept ? 1 : 0, removed: preview.background.dropped.length }}
        singular="Choice"
      />
    </DeleteConfirmModal>
  );
}

export default RulesetSwitchConfirmModal;
