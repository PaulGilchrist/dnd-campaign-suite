// Playtest-mode session banner (playtest plan 2026-11-25). Mounted app-level
// (App.jsx, every view) and driven SOLELY by the server-first `playtest`
// campaign stamp, so it survives a reload/crash mid-test and follows the
// stamp across GM tabs via SSE. GM-only display (isLocalhost), never on a TV
// screen. The End Playtest lane rides the shared DeleteConfirmModal
// role="dialog" tier (non-delete reuse precedent: NpcUnarmedConfirmModal) and
// then hands the tab through endEncounterPlaytest's postRestoreNotice + full
// reload — the same handoff the CampaignAdmin Restore rows take. When the
// restore point has been pruned (retention-4) the refusal surfaces inline
// with role="alert" and the banner STAYS: the campaign is still dirty and a
// silent banner-fade would hide that.
import { useState } from 'react';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { PLAYTEST_KEY } from '../../services/automation/common/campaignKeys.js';
import { endEncounterPlaytest } from '../../services/encounters/playtestService.js';import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';
import './PlaytestBanner.css';

export default function PlaytestBanner({ campaignName, isLocalhost }) {
    const stamp = useRuntimeValue('campaign', PLAYTEST_KEY, campaignName);
    const [confirming, setConfirming] = useState(false);
    const [ending, setEnding] = useState(false);
    const [error, setError] = useState('');

    if (stamp?.active !== true || !isLocalhost) return null;

    const handleEnd = async () => {
        setConfirming(false);
        setEnding(true);
        setError('');
        try {
            // Success never returns — the lane ends in a full page reload
            // into the restored campaign (postRestoreNotice handoff).
            await endEncounterPlaytest(campaignName);
        } catch (err) {
            console.error('[PlaytestBanner] End playtest failed:', err);
            setError(err.message);
            setEnding(false);
        }
    };

    return (
        <>
            <div className="playtest-banner" role="status">
                <span className="playtest-banner-label">
                    <i className="fa-solid fa-vial" aria-hidden="true"></i>
                    Playtest mode — “{stamp.encounterName}”
                </span>
                <span className="playtest-banner-note">
                    Every change (log, HP, XP, loot, maps) rolls back when you end the test.
                </span>
                {error && (
                    <span className="playtest-banner-error" role="alert">{error}</span>
                )}
                <button
                    type="button"
                    className="ct-btn playtest-banner-end"
                    onClick={() => setConfirming(true)}
                    disabled={ending}
                    title={`Roll the campaign back to ${stamp.snapshot}`}
                >
                    <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
                    {ending ? 'Rolling back…' : 'End Playtest'}
                </button>
            </div>
            {confirming && (
                <DeleteConfirmModal
                    titleId="playtest-end-confirm-title"
                    title="End Playtest"
                    confirmLabel="Roll back campaign"
                    onCancel={() => setConfirming(false)}
                    onConfirm={handleEnd}
                >
                    {`End the playtest of “${stamp.encounterName}” and roll the campaign back to the restore point ${stamp.snapshot}? Every change made since the test started — campaign log, character HP/conditions, XP, loot, maps and overlays — is permanently undone.`}
                </DeleteConfirmModal>
            )}
        </>
    );
}
