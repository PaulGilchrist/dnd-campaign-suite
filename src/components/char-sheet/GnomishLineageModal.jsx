import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { useOverlayEntranceFocus } from '../../hooks/ui/useOverlayEntranceFocus.js';
import { useRef } from 'react';

function GnomishLineageModal({ gnomishLineageModal, handleGnomishLineageConfirm, handleGnomishLineageSkip }) {
    // Entrance focus + stranded-close restore (backlog 2026-11-17 sp-overlay adoption).
    const overlayRef = useRef(null);
    useOverlayEntranceFocus(overlayRef);
    if (!gnomishLineageModal) return null;
    const { action, playerStats, campaignName } = gnomishLineageModal;
    const options = action?.automation?.options || [];
    return (
        <div className="sp-overlay" ref={overlayRef}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-bolt"></i> {action?.name || 'Gnomish Lineage'}
                </div>
                <div className="sp-body">
                    <p><b>Choose your lineage:</b></p>
                    <p style={{ opacity: 0.8, fontSize: '0.9em' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(action?.description || '') }}></p>
                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        {options.map((opt, i) => {
                            const optName = typeof opt === 'string' ? opt : opt.name;
                            return (
                                <button
                                    key={optName || i}
                                    className="sp-roll-btn"
                                    style={{ margin: '0 6px 8px 6px' }}
                                    onClick={() => handleGnomishLineageConfirm(optName, playerStats, campaignName)}
                                >
                                    {optName}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={handleGnomishLineageSkip}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default GnomishLineageModal;
