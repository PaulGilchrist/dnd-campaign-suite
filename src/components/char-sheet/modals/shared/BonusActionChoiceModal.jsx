import { useState } from 'react';
import { applyBonusActionChoice } from '../../../../services/automation/handlers/combat/bonusActionChoiceHandler.js';
import { chargeSlot } from '../../../../services/combat/chargeEconomy.js';
import { addEntry } from '../../../../services/ui/logService.js';
import '../../CharSheet.css';

const INTERNAL_SKILL_CHECK_EVENT = 'internal-skill-check';

// CLA-067: per-option log suffix — the old fallback mislabeled Dash/Disengage/Hide
// as "Object use".
const CHOICE_LOG_SUFFIX = {
    Dash: 'Speed doubled until the end of the turn',
    Disengage: 'No Opportunity Attacks until the end of the turn',
    Hide: 'Dexterity (Stealth) check initiated',
    'Sleight of Hand': 'Dexterity (Sleight of Hand) check initiated',
    'Thieves\' Tools': 'Thieves\' Tools check initiated',
    'Use an Object': 'Object use',
};

function BonusActionChoiceModal({ action, options: optionsProp, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleApply = async () => {
        if (!selected) return;
        const res = await applyBonusActionChoice(action, playerStats, campaignName, selected);
        setResult(res);
        setApplied(true);
        // L5-002: deferred chooser-modal charge — useCharActionsAutomation gated
        // this row at click and deferred the economy stamp to this confirm seam
        // ('modal' results defer, plan §7.2; mirror of handleHordeBreakerTargetSelected).
        // No-op while enforcement/actionEconomy is off; Cancel never reaches here,
        // so an abandoned chooser still spends nothing. A no-result apply resolves
        // nothing — no charge, the chooser stays open for retry.
        if (res) {
            chargeSlot({ creatureName: playerStats.name, bucket: 'bonusAction', campaignName });
        }

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${selected} selected — ${CHOICE_LOG_SUFFIX[selected] || 'Bonus action used'}`,
        }).catch((e) => { console.error("[bonusActionChoiceModal:log-error]", e); });

        if (selected === 'Sleight of Hand') {
            window.dispatchEvent(new CustomEvent(INTERNAL_SKILL_CHECK_EVENT, {
                detail: { skillName: 'Sleight of Hand', checkType: 'skill' },
            }));
        }
        else if (selected === 'Thieves\' Tools') {
            window.dispatchEvent(new CustomEvent(INTERNAL_SKILL_CHECK_EVENT, {
                detail: { skillName: 'Thieves\' Tools', checkType: 'check' },
            }));
        }
    };

    // Removed (maintenance pass #177, ledger test-maintain-bugs.md:195): a cleanup-only
    // useEffect that reset applied/result/selected on unmount. React 18+ silently ignores
    // setState on unmounted components, and this effect registered no listeners or abort
    // handles (fix#145 house law N/A), so the resets were pure post-unmount no-ops.

    if (applied && result) {
        return (
            <div className="sp-overlay">
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-hand"></i> {action.name}
                    </div>
                    <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.payload?.description || '' }}>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    const options = optionsProp || action.automation?.options || [];

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-hand"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Choose a Bonus Action:</p>
                    <div className="choice-list">
                        {options.map((opt, i) => {
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} className={`choice-option${isSelected ? ' choice-selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="bonusActionChoice"
                                        checked={isSelected}
                                        onChange={() => setSelected(opt.name)}
                                    />
                                    <span className="choice-label">
                                        <strong>{opt.name}</strong>
                                        <span className="choice-description">— {opt.description}</span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-hand"></i> Use Bonus Action
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default BonusActionChoiceModal;
