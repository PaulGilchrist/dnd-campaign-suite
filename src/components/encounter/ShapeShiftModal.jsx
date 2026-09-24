import './ShapeShiftModal.css';
import { shapeShiftSpeedText, isTrueFormRequest } from '../../services/encounters/monsterShapeShift.js';

const FORM_ICONS = {
  'Rat': 'fa-paw',
  'Raven': 'fa-crow',
  'Spider': 'fa-spider',
  'True Form': 'fa-dragon',
};

function formSpeedLabel(form) {
  if (isTrueFormRequest(form)) return 'Returns to true form — Speed reverts to the stat block';
  return `Speed ${shapeShiftSpeedText(form)}`;
}

// MA-1020: Imp Shape-Shift form chooser — reuses the MA-0275
// AnimalSpiritVariantModal mc-overlay/sp-modal chrome byte-shape (smallest
// existing chooser). Chip press opens it; ONE row click stamps that form's
// Speed onto the combatSummary combatant (no save leg — the choice IS the
// resolution); backdrop/Cancel declines with an honest zero-write record.
export function ShapeShiftModal({ chooser, monsterName, onResolve, onSkip }) {
  const forms = chooser?.action?.automation?.forms;
  if (!Array.isArray(forms)) return null;
  return (
    <div className="mc-overlay mc-overlay--shape-shift" onClick={(e) => {
      if (e.target.closest('.sp-modal')) return;
      onSkip?.();
    }}>
      <div className="sp-modal">
        <div className="sp-header">
          <i className="fa-solid fa-shuffle"></i> Shape-Shift — Choose Form
        </div>
        <div className="sp-body">
          <p><strong>{monsterName}</strong> shape-shifts At Will — choose a form. Game statistics are the same in each form, except for Speed; equipment does not transform.</p>
          <p className="sp-note">No uses limit and no expiration clock (RAW: the new form lasts until it shifts back — pick "True Form" to revert).</p>
          <div className="secondary-target-list">
            {forms.map((form) => (
              <label
                key={form.name}
                className="secondary-target-row shape-shift-row"
                onClick={() => onResolve(form)}
              >
                <i className={`fa-solid ${FORM_ICONS[form.name] || 'fa-shuffle'}`}></i>
                <span className="secondary-target-name">
                  <strong>{form.name}</strong>
                  <br />
                  {formSpeedLabel(form)}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="sp-actions">
          <button className="sp-dismiss-btn" onClick={onSkip} type="button">
            Shape-shift without changing
          </button>
        </div>
      </div>
    </div>
  );
}
