import './AnimalSpiritVariantModal.css';

const VARIANT_ICONS = {
  fortify: 'fa-shield-heart',
  marked_as_prey: 'fa-crosshairs',
  pesky_swarm: 'fa-bugs',
};

const VARIANT_DESCRIPTIONS = {
  fortify: 'The animal lord gains 20 Temporary Hit Points.',
  marked_as_prey: 'The animal lord has Advantage on attack rolls against the target until the start of its next turn.',
  pesky_swarm: 'The target has Disadvantage on attack rolls and ability checks until the end of its next turn.',
};

// MA-0275: Animal Spirit variant chooser — the row's three "Failure or
// Success" clauses are mutually exclusive by the lord's form (DM's choice),
// so the GM picks the form here; the chosen clause lands at the save
// outcome seam (saveProcessing) on either outcome.
export function AnimalSpiritVariantModal({ chooser, monsterName, onResolve, onSkip }) {
  if (!chooser || !chooser.variants) return null;
  return (
    <div className="mc-overlay mc-overlay--spirit-variant">
      <div className="sp-modal">
        <div className="sp-header">
          <i className="fa-solid fa-paw"></i> Animal Spirit — Choose Form
        </div>
        <div className="sp-body">
          <p><strong>{monsterName}</strong> targets <strong>{chooser.target?.name || 'no target'}</strong> with Animal Spirit (DC {chooser.action.save_dc} {chooser.action.save_type} save, {chooser.saveDamageFormula} {chooser.action.damage_type_primary}, half on success).</p>
          <p className="sp-note">The animal lord embodies one spirit form — choose the form. The variant effect lands on a failed OR successful save.</p>
          <div className="secondary-target-list">
            {chooser.variants.map((variant) => (
              <label
                key={variant.key}
                className="secondary-target-row spirit-variant-row"
                onClick={() => onResolve(variant)}
              >
                <i className={`fa-solid ${VARIANT_ICONS[variant.key] || 'fa-paw'}`}></i>
                <span className="secondary-target-name">
                  <strong>{variant.label}</strong> <span className="spirit-variant-form">({variant.form} form)</span>
                  <br />
                  {VARIANT_DESCRIPTIONS[variant.key]}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="sp-actions">
          <button className="sp-dismiss-btn" onClick={onSkip} type="button">
            Cast without variant
          </button>
        </div>
      </div>
    </div>
  );
}
