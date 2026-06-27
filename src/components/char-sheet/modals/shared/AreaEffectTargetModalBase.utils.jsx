import { addEntry } from '../../../../services/ui/logService.js';
import storage from '../../../../services/ui/storage.js';

export function renderTargetList({ eligibleTargets, selected, toggleTarget }) {
  return (
    <div className="abjure-targets-list">
      {eligibleTargets.map(c => (
        <label key={c.name} className={`abjure-target-row ${selected.has(c.name) ? 'abjure-target-selected' : ''}`}>
          <input
            type="checkbox"
            checked={selected.has(c.name)}
            onChange={() => toggleTarget(c.name)}
          />
          <span className="abjure-target-name">{c.name}</span>
          <span className="abjure-target-type">({c.type})</span>&nbsp;&nbsp;
        </label>
      ))}
      {eligibleTargets.length === 0 && (
        <p className="sp-note">No valid targets in range.</p>
      )}
    </div>
  );
}

export function renderResultsSection({ results, pendingPrompts, allResolved, saveType, saveDc, getResultText }) {
  return (
    <>
      <p>Resolving {saveType} saving throws (DC {saveDc})...</p>
      <div className="abjure-results-list">
        {results.map(r => (
          <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
            <strong>{r.targetName}</strong>: {typeof getResultText === 'function' ? getResultText(r) : (r.success ? 'Saved — unaffected' : 'Failed!')}
            {typeof r.roll === 'number' && <> (Roll: {r.roll}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = {r.total})</>}
          </div>
        ))}
        {pendingPrompts.map(p => (
          <div key={p.promptId} className="abjure-result abjure-result-pending">
            <strong>{p.targetName}</strong>: <em>Waiting for save roll...</em>
          </div>
        ))}
      </div>
      {allResolved && (
        <p className="sp-note" style={{ marginTop: '8px' }}>All targets resolved.</p>
      )}
    </>
  );
}

export function logSaveEntry(campaignName, featureName, attackerName, targetName, saveDc, saveType, success, total, rolls, bonus, formula) {
  addEntry(campaignName, {
    type: 'roll',
    name: featureName,
    characterName: attackerName,
    rollType: 'save-damage',
    targetName,
    saveDc,
    saveType,
    saveResult: success ? 'success' : 'failure',
    total,
    rolls,
    bonus,
    formula,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[AreaEffectModal] Error:', e); });
}

export function persistAndNotify(combatSummary, campaignName) {
  storage.set('combatSummary', combatSummary, campaignName);
  window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}
