import '../shared/SecondaryTargetModal.css';
import './ClockworkCavalcadeModal.css';
import { useOverlayEntranceFocus } from '../../../../hooks/ui/useOverlayEntranceFocus.js';
import { useRef } from 'react';

const OPTIONS = [
    {
        key: 'heal',
        icon: 'fa-heart',
        title: 'Heal',
        description: 'Restore up to 100 HP, divided as you choose among any number of creatures of your choice in the Cube.',
    },
    {
        key: 'repair',
        icon: 'fa-hammer',
        title: 'Repair',
        description: 'Damaged objects within the Cube are repaired instantly.',
    },
    {
        key: 'dispel',
        icon: 'fa-wand-magic-sparkles',
        title: 'Dispel',
        description: 'Every spell of level 6 and lower ends on creatures and objects of your choice in the Cube.',
    },
];

export default function ClockworkCavalcadeModal({
    featureName = 'Clockwork Cavalcade',
    onChoose,
    onClose,
}) {
    // Entrance focus + stranded-close restore (backlog 2026-11-17 sp-overlay adoption).
    const overlayRef = useRef(null);
    useOverlayEntranceFocus(overlayRef);
    return (
        <div className="sp-overlay" ref={overlayRef}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-gears"></i> {featureName}
                </div>
                <div className="sp-body">
                    <p>As a Magic action, you call forth the spirit of order from your body in a 30-foot Cube originating from you. Choose one of the following effects:</p>
                    <div className="secondary-target-list">
                        {OPTIONS.map(option => (
                            <button
                                key={option.key}
                                className="secondary-target-row clockwork-cavalcade-option"
                                onClick={() => onChoose(option.key)}
                                type="button"
                            >
                                <i className={`fa-solid ${option.icon}`}></i>
                                <span className="secondary-target-name">
                                    <strong>{option.title}</strong>
                                    <span className="secondary-target-hp">{option.description}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
