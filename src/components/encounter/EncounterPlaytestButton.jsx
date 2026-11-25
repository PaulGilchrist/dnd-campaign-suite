// Playtest Encounter CTA (playtest plan 2026-11-25): snapshot → stage the
// battle map (reusable Travel Encounter Stage, fresh randomized cover) →
// join the board through the normal EB lane → the PlaytestBanner ribbon
// carries the End/rollback affordance from then on. Own component (EB is at
// the eslint complexity ceiling — EncounterValidationBanner idiom) and rides
// the shared DeleteConfirmModal role="dialog" tier for its pre-flight
// confirm (non-delete reuse precedent: NpcUnarmedConfirmModal). One test at
// a time: while a `playtest` stamp is active the button locks with the cause
// in its title (a second snapshot would move the restore point MID-test).
import { useState } from 'react';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { PLAYTEST_KEY } from '../../services/automation/common/campaignKeys.js';
import { formatEncounterName } from '../../services/encounters/encountersService.js';
import { startEncounterPlaytest } from '../../services/encounters/playtestService.js';
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';

function EncounterPlaytestButton({
    campaignName,
    encounterTitle,
    currentEncounterName,
    selectedMonsters,
    characters,
    onStarted,
    onToast,
}) {
    const stamp = useRuntimeValue('campaign', PLAYTEST_KEY, campaignName);
    const [confirming, setConfirming] = useState(false);
    const [starting, setStarting] = useState(false);

    // Display name for the confirm copy + the session stamp (the parent
    // passes raw state so no branch lands in EncounterBuilder — it is at
    // its eslint ceiling). Null on an unnamed draft; the service then stamps
    // its 'Unnamed Encounter' canonical fallback.
    const encounterName = currentEncounterName
        ? formatEncounterName(currentEncounterName)
        : (encounterTitle !== 'Encounter Builder' ? encounterTitle : null);

    const active = stamp?.active === true;
    const title = active
        ? 'End the current playtest before starting a new one'
        : 'Snapshot, stage a cover map, and play-test this encounter — all changes roll back';

    const handleStart = async () => {
        setConfirming(false);
        setStarting(true);
        try {
            await startEncounterPlaytest({
                campaignName,
                encounterName,
                selectedMonsters,
                characters,
            });
            onStarted();
        } catch (err) {
            console.error('Failed to start encounter playtest:', err);
            onToast(`Failed to start playtest: ${err.message}`, true);
        } finally {
            setStarting(false);
        }
    };

    return (
        <>
            <button
                className="ct-btn encounter-playtest-btn"
                onClick={() => setConfirming(true)}
                disabled={active || starting}
                title={title}
            >
                <i className="fa-solid fa-vial" aria-hidden="true"></i>
                {starting ? 'Staging…' : 'Playtest'}
            </button>
            {confirming && (
                <DeleteConfirmModal
                    titleId="encounter-playtest-confirm-title"
                    title="Playtest Encounter"
                    confirmLabel="Start Playtest"
                    onCancel={() => setConfirming(false)}
                    onConfirm={handleStart}
                >
                    {`Play-test "${encounterName || 'this encounter'}" with the full party on a staged battle map with randomized cover. A restore point is taken NOW; when you press End Playtest, every change since — campaign log, character HP, XP, loot, maps and overlays — is rolled back. This is a GM-solo test: no player tabs should be connected.`}
                </DeleteConfirmModal>
            )}
        </>
    );
}

export default EncounterPlaytestButton;
