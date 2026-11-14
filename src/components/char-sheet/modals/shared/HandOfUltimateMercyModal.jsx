import React, { useCallback, useState } from 'react'
import SecondaryTargetModal from './SecondaryTargetModal.jsx'
import '../../CharSheet.css'

// In-sheet corpse chooser for Hand of Ultimate Mercy (backlog 2026-11-14 NP:
// "HoUoM has no in-sheet target chooser"). NOT a new modal family — this is the
// exact HandOfHealingPickerStage chrome (HandOfHealingModal.jsx): the borrowed
// .short-rest-modal shell IS the dialog root (role/aria-modal/aria-labelledby →
// SecondaryTargetModal's visible .sp-header title via titleId, bc409413d tier
// law), the refusal note rides the same .healing-restriction-note seam, and the
// rows live-echo through SecondaryTargetModal's liveHp lane. Only the roster
// differs: the producer filtered it to bucket-0 board targets at dispatch, and
// confirmResurrect re-gates 0-HP at commit, so a corpse healed mid-dwell
// refuses inline with zero spend (criterion: honest refusal, never a
// silently-empty or wrong-spend commit).
// Skip button: HoUoM has no self-revive semantics, so the shared chooser's
// `Skip` is relabeled honestly `Cancel` and routes straight to the zero-spend
// dismiss (onClose clears only the local modal UI flag — no character POST,
// focus ladder untouched, no log row; the HoH picker's Cancel zero-spend label
// law). Escape rides the same dismiss lane.
function HandOfUltimateMercyModal({ featureName, creatureTargets, costAmount, confirmResurrect, campaignName, onResolved, onClose }) {
    const [refusalNote, setRefusalNote] = useState(null);

    const handleConfirm = useCallback(async (targetName) => {
        try {
            const result = await confirmResurrect?.(targetName);
            // Zero-spend refusal (revived mid-dwell / focus drained at commit):
            // keep the picker open with the note inline — mirrors the HoH
            // picker's refusalNote placement.
            if (result?.refusal) {
                setRefusalNote(result.refusal);
                return;
            }
            setRefusalNote(null);
            onResolved?.(result?.popup ?? null);
        } catch (e) {
            console.error('[HandOfUltimateMercyModal] confirm resurrect failed:', e);
            setRefusalNote(`${targetName} could not be resurrected. No Focus Points spent.`);
        }
    }, [confirmResurrect, onResolved]);

    React.useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className="short-rest-overlay no-print">
            <div
                className="short-rest-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hand-of-ultimate-mercy-target-modal-title"
            >
                {refusalNote && (
                    <p className="healing-restriction-note">{refusalNote}</p>
                )}
                <SecondaryTargetModal
                    title={`Choose corpse for ${featureName}`}
                    titleId="hand-of-ultimate-mercy-target-modal-title"
                    targets={creatureTargets || []}
                    onTargetSelected={handleConfirm}
                    onSkip={onClose}
                    skipLabel="Cancel"
                    featureDescription={`Return one creature at 0 Hit Points on the combat board to life. Costs ${costAmount} Focus Points.`}
                    confirmLabel="Revive"
                    confirmIcon="fa-hand-holding-heart"
                    showHp={true}
                    liveHp={true}
                    campaignName={campaignName}
                />
            </div>
        </div>
    );
}

export default HandOfUltimateMercyModal;
