import { sanitizeHtml } from '../../services/ui/sanitize.js';

function FeatureChoiceModal({ featureChoiceModal, handleFeatureChoiceConfirm, handleFeatureChoiceSkip }) {
    if (!featureChoiceModal) return null;
    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-bolt"></i> {featureChoiceModal.action.name}
                </div>
                <div className="sp-body">
                    <p><b>Choose your option:</b></p>
                    <p style={{ opacity: 0.8, fontSize: '0.9em' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(featureChoiceModal.action.description) }}></p>
                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        {featureChoiceModal.options.map((opt, i) => {
                            const optName = typeof opt === 'string' ? opt : opt.name;
                            return (
                                <button
                                    key={optName || i}
                                    className="sp-roll-btn"
                                    style={{ margin: '0 6px 8px 6px' }}
                                    onClick={() => handleFeatureChoiceConfirm(optName)}
                                >
                                    {optName}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={handleFeatureChoiceSkip}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default FeatureChoiceModal;
