import { useState } from 'react';
import {
  LINK_TYPES,
  CONTINGENCY_BRANCHES,
  getBranchDef,
  checklistProgress,
  buildXpBudgetPrompt,
  buildRumorPrompt,
  copyTextToClipboard,
} from '../../services/campaign/sessionPlannerUtils.js';

function LinkPicker({ linkType, options, linked, otherSessions, onAdd, onRemove, onMove, onQuickAction }) {
  const available = (options || []).filter(opt => !linked.includes(opt.value));
  const labelFor = (value) => {
    const found = (options || []).find(o => o.value === value);
    return found ? found.label : value;
  };

  return (
    <div className="sessions-link-section">
      <div className="sessions-link-title">
        <i className={`fa-solid ${linkType.icon}`} /> {linkType.label}
        <span className="sessions-link-count">{linked.length}</span>
      </div>
      {available.length > 0 && (
        <select
          className="ct-select sessions-link-select"
          value=""
          onChange={(e) => e.target.value && onAdd(linkType.key, e.target.value)}
          aria-label={`Link ${linkType.label}`}
        >
          <option value="">+ Link {linkType.label.toLowerCase()}…</option>
          {available.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
      {linked.map(name => (
        <div key={name} className="sessions-link-row">
          <span className="sessions-link-chip">{labelFor(name)}</span>
          {linkType.key === 'maps' && (
            <button
              className="ct-btn ct-btn-sm"
              onClick={() => onQuickAction(linkType.key, name)}
              title={`Activate ${name} as the active map`}
            >
              <i className="fa-solid fa-map-pin" /> Activate
            </button>
          )}
          {linkType.key === 'npcs' && (
            <button
              className="ct-btn ct-btn-sm"
              onClick={() => onQuickAction(linkType.key, name)}
              title={`Add ${name} to initiative`}
            >
              <i className="fa-solid fa-shield-halved" /> To Initiative
            </button>
          )}
          {otherSessions.length > 0 && (
            <select
              className="ct-select sessions-move-select"
              value=""
              onChange={(e) => e.target.value && onMove(linkType.key, name, e.target.value)}
              aria-label={`Move ${labelFor(name)} to another session`}
              title="Move to another session"
            >
              <option value="">Move to…</option>
              {otherSessions.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          )}
          <button
            className="ct-btn ct-btn-sm ct-btn-danger"
            onClick={() => onRemove(linkType.key, name)}
            title={`Unlink ${labelFor(name)}`}
          >
            <i className="fa-solid fa-link-slash" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ContingencySection({ contingencies, onAdd, onChange, onRemove }) {
  return (
    <div className="sessions-contingency-section">
      <h4 className="sessions-section-title">
        <i className="fa-solid fa-code-branch" /> Contingencies
      </h4>
      {contingencies.map((c, i) => {
        const branch = getBranchDef(c.branch);
        return (
          <div key={c.id} className={`sessions-contingency-row ${branch.cls}`}>
            <span className="sessions-contingency-if">If</span>
            <input
              type="text"
              className="ct-input sessions-contingency-if-input"
              value={c.ifText}
              onChange={(e) => onChange(c.id, 'ifText', e.target.value)}
              placeholder="Players do X…"
              aria-label={`Contingency ${i + 1} trigger`}
            />
            <span className="sessions-contingency-arrow"><i className="fa-solid fa-arrow-right" /></span>
            <input
              type="text"
              className="ct-input sessions-contingency-then-input"
              value={c.thenText}
              onChange={(e) => onChange(c.id, 'thenText', e.target.value)}
              placeholder="Then Y happens…"
              aria-label={`Contingency ${i + 1} outcome`}
            />
            <select
              className="ct-select sessions-contingency-branch"
              value={c.branch}
              onChange={(e) => onChange(c.id, 'branch', e.target.value)}
              aria-label={`Contingency ${i + 1} branch`}
            >
              {CONTINGENCY_BRANCHES.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
            <button
              className="ct-btn ct-btn-sm ct-btn-danger"
              onClick={() => onRemove(c.id)}
              title="Remove contingency"
            >
              <i className="fa-solid fa-trash-can" />
            </button>
          </div>
        );
      })}
      <button className="ct-btn ct-btn-sm" onClick={onAdd}>
        <i className="fa-solid fa-plus" /> Add Contingency
      </button>
    </div>
  );
}

function ChecklistSection({ checklist, onToggle, onAddItem, onRemoveItem }) {
  const [newItem, setNewItem] = useState('');
  const { done, total, pct } = checklistProgress(checklist);

  const handleAdd = () => {
    if (!newItem.trim()) return;
    onAddItem(newItem.trim());
    setNewItem('');
  };

  return (
    <div className="sessions-checklist-section">
      <h4 className="sessions-section-title">
        <i className="fa-solid fa-list-check" /> Session Checklist
      </h4>
      <div className="sessions-progress" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label={`Checklist ${done} of ${total} complete`}>
        <div className="sessions-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="sessions-progress-label">{done} of {total} ready</span>
      {checklist.map(item => (
        <label key={item.id} className={`sessions-checklist-item${item.done ? ' sessions-checklist-done' : ''}`}>
          <input
            type="checkbox"
            checked={!!item.done}
            onChange={() => onToggle(item.id)}
          />
          <span className="sessions-checklist-label">{item.label}</span>
          {item.auto && <span className="sessions-checklist-auto" title="Auto-generated from linked resources">auto</span>}
          {!item.auto && (
            <button
              className="ct-btn ct-btn-sm ct-btn-danger sessions-checklist-remove"
              onClick={() => onRemoveItem(item.id)}
              title="Remove checklist item"
            >
              <i className="fa-solid fa-trash-can" />
            </button>
          )}
        </label>
      ))}
      <div className="sessions-checklist-add-row">
        <input
          type="text"
          className="ct-input"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add your own checklist item…"
          aria-label="New checklist item"
        />
        <button className="ct-btn ct-btn-sm" onClick={handleAdd} disabled={!newItem.trim()}>
          <i className="fa-solid fa-plus" /> Add
        </button>
      </div>
    </div>
  );
}

function SessionModalFooter({
  editingSession, formData, saving, deleting,
  onClose, onSave, onDelete, onMarkPlayed,
}) {
  const canMarkPlayed = editingSession && editingSession.status !== 'played';
  return (
    <div className="ct-modal-footer no-print">
      <div className="ct-modal-actions">
        {editingSession && (
          <button
            className="ct-btn ct-btn-danger"
            onClick={onDelete}
            disabled={deleting}
          >
            <i className="fa-solid fa-trash-can" /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
        {canMarkPlayed && (
          <button className="ct-btn sessions-played-btn" onClick={onMarkPlayed}>
            <i className="fa-solid fa-circle-check" /> Mark as Played
          </button>
        )}
      </div>
      <div className="ct-modal-buttons">
        <button className="ct-btn" onClick={onClose} disabled={saving}>Cancel</button>
        <button
          className="ct-btn ct-btn-primary"
          onClick={onSave}
          disabled={saving || !formData.name.trim()}
        >
          <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function SessionPlannerModal({
  formData,
  editingSession,
  otherSessions,
  resourceOptions,
  characters = [],
  campaignName,
  saving,
  deleting,
  error,
  onClose,
  onSave,
  onDelete,
  onFormChange,
  onAddLink,
  onRemoveLink,
  onMoveLink,
  onQuickAction,
  onAddContingency,
  onContingencyChange,
  onRemoveContingency,
  onToggleChecklist,
  onAddChecklistItem,
  onRemoveChecklistItem,
  onMarkPlayed,
}) {
  const [copied, setCopied] = useState('');

  const handlePrompt = async (key, prompt) => {
    const ok = await copyTextToClipboard(prompt);
    if (ok) {
      setCopied(key);
      setTimeout(() => setCopied(''), 2500);
    }
  };

  const linked = (key) => formData.links?.[key] || [];

  return (
    <div className="ct-modal-overlay">
      <div className="ct-modal sessions-modal">
        <div className="ct-modal-header no-print">
          <h3>{editingSession ? `Plan Session — ${editingSession.name}` : 'New Session'}</h3>
          <button className="ct-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="ct-modal-body">
          {error && <div className="sessions-form-error">{error}</div>}

          <div className="sessions-form-row">
            <div className="sessions-form-col">
              <label htmlFor="session-name" className="ct-label">
                Name <span className="ct-required">*</span>
              </label>
              <input
                id="session-name"
                type="text"
                className="ct-input"
                value={formData.name}
                onChange={(e) => onFormChange('name', e.target.value)}
                placeholder={'e.g., "Session 7: Smuggler’s Cave"'}
                autoFocus
              />
            </div>
            <div className="sessions-form-col sessions-form-col-date">
              <label htmlFor="session-date" className="ct-label">Date</label>
              <input
                id="session-date"
                type="date"
                className="ct-input"
                value={formData.date || ''}
                onChange={(e) => onFormChange('date', e.target.value)}
              />
            </div>
          </div>

          <div className="sessions-ai-row">
            <button
              className="ct-btn ct-btn-sm sessions-ai-btn"
              onClick={() => handlePrompt('xp', buildXpBudgetPrompt(formData, characters))}
              title="Copy an XP budget prompt for your AI assistant"
            >
              <i className="fa-solid fa-wand-magic-sparkles" />
              {copied === 'xp' ? 'Prompt copied' : 'Suggest XP Budget'}
            </button>
            <button
              className="ct-btn ct-btn-sm sessions-ai-btn"
              onClick={() => handlePrompt('rumors', buildRumorPrompt(formData, campaignName))}
              title="Copy a rumor generation prompt for your AI assistant"
            >
              <i className="fa-solid fa-wand-magic-sparkles" />
              {copied === 'rumors' ? 'Prompt copied' : 'Generate Rumors'}
            </button>
          </div>

          <h4 className="sessions-section-title">
            <i className="fa-solid fa-link" /> Linked Resources
          </h4>
          {LINK_TYPES.map(linkType => (
            <LinkPicker
              key={linkType.key}
              linkType={linkType}
              options={resourceOptions[linkType.key] || []}
              linked={linked(linkType.key)}
              otherSessions={otherSessions}
              onAdd={onAddLink}
              onRemove={onRemoveLink}
              onMove={onMoveLink}
              onQuickAction={onQuickAction}
            />
          ))}

          <ContingencySection
            contingencies={formData.contingencies || []}
            onAdd={onAddContingency}
            onChange={onContingencyChange}
            onRemove={onRemoveContingency}
          />

          <ChecklistSection
            checklist={formData.checklist || []}
            onToggle={onToggleChecklist}
            onAddItem={onAddChecklistItem}
            onRemoveItem={onRemoveChecklistItem}
          />

          <label htmlFor="session-notes" className="ct-label">Notes</label>
          <textarea
            id="session-notes"
            className="ct-textarea"
            rows={3}
            value={formData.summary || ''}
            onChange={(e) => onFormChange('summary', e.target.value)}
            placeholder="Storyline notes, reminders, loose threads…"
          />
        </div>

        <SessionModalFooter
          editingSession={editingSession}
          formData={formData}
          saving={saving}
          deleting={deleting}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
          onMarkPlayed={onMarkPlayed}
        />
      </div>
    </div>
  );
}

export default SessionPlannerModal;
