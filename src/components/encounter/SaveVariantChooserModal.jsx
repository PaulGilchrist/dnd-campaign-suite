import './SaveVariantChooserModal.css';

const VARIANT_ICONS = {
  charming: 'fa-heart',
  frightening: 'fa-ghost',
};

// MA-1436: generic GM-chosen save-variant chooser (Satyr Revelmaster Fey
// Melody) — rows that author a structured variants[] array open this chooser
// at chip-click, BEFORE any save prompt; the picked variant's own
// conditions/damage/dc_success resolve at the save outcome seam (MA-0275
// Animal-Spirit chooser byte shape, generic payload).
export function SaveVariantChooserModal({ chooser, monsterName, onResolve, onSkip }) {
  if (!chooser || !chooser.variants) return null;
  return (
    <div className="mc-overlay mc-overlay--save-variant">
      <div className="sp-modal">
        <div className="sp-header">
          <i className="fa-solid fa-music"></i> {chooser.action.name} — Choose Variant
        </div>
        <div className="sp-body">
          <p><strong>{monsterName}</strong> targets <strong>{chooser.target?.name || 'each creature in the area'}</strong> with {chooser.action.name} (DC {chooser.action.save_dc} {chooser.action.save_type} save).</p>
          <p className="sp-note">Choose one variant — its conditions and damage resolve at the save outcome. Cancel applies nothing and rolls no save.</p>
          <div className="secondary-target-list">
            {chooser.variants.map((variant) => (
              <label
                key={variant.key}
                className="secondary-target-row save-variant-row"
                onClick={() => onResolve(variant)}
              >
                <i className={`fa-solid ${VARIANT_ICONS[variant.key] || 'fa-music'}`}></i>
                <span className="secondary-target-name">
                  <strong>{variant.label}</strong>
                  <br />
                  {variant.description}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="sp-actions">
          <button className="sp-dismiss-btn" onClick={onSkip} type="button">
            Use without variant
          </button>
        </div>
      </div>
    </div>
  );
}
