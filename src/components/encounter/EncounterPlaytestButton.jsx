// Playtest Encounter CTA (playtest plan 2026-11-25): snapshot → stage the
// battle map (reusable Travel Encounter Stage, fresh randomized cover) →
// join the board through the normal EB lane → the PlaytestBanner ribbon
// carries the End/rollback affordance from then on. Own component (EB is at
// the eslint complexity ceiling — EncounterValidationBanner idiom) and rides
// the shared DeleteConfirmModal role="dialog" tier for its pre-flight
// confirm (non-delete reuse precedent: NpcUnarmedConfirmModal). One test at
// a time: while a `playtest` stamp is active the button locks with the cause
// in its title (a second snapshot would move the restore point MID-test).
// Opening the confirm fetches the hub's OTHER-connected-clients count once
// (fetch-on-open, no timers) and shows a non-blocking warning notice naming
// the count — the start itself is never gated.
import { useState, useRef } from 'react';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { PLAYTEST_KEY } from '../../services/automation/common/campaignKeys.js';
import { formatEncounterName } from '../../services/encounters/encountersService.js';
import { startEncounterPlaytest, fetchOtherConnectedClients } from '../../services/encounters/playtestService.js';
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';

// Non-blocking heads-up copy for connected other tabs (names the count +
// what those tabs experience mid-test — they watch the staged board live and
// are rolled back with everything else). Single/plural share the one builder.
function otherTabsNotice(count) {
    if (count <= 0) return null;
    return count === 1
        ? '1 other tab is connected — this test rolls the whole campaign back when it ends. That tab watches the staged board live and is rolled back with it.'
        : `${count} other tabs are connected — this test rolls the whole campaign back when it ends. Those tabs watch the staged board live and are rolled back with it.`;
}

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
    const [otherClients, setOtherClients] = useState(0);
    // Fetch-on-open (no timers): each arm re-asks the hub and bumps the
    // sequence so a slow earlier answer can never stale a later dialog.
    const noticeSeq = useRef(0);

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

    const handleOpenConfirm = () => {
        const seq = noticeSeq.current + 1;
        noticeSeq.current = seq;
        setOtherClients(0);
        setConfirming(true);
        fetchOtherConnectedClients(campaignName)
            .then((count) => {
                if (noticeSeq.current === seq) setOtherClients(count);
            })
            .catch((err) => {
                // Heads-up is informational only — an unavailable count just
                // keeps today's no-notice face (benign, console.debug tier).
                if (noticeSeq.current === seq) setOtherClients(0);
                console.debug('[EncounterPlaytestButton] connected-clients heads-up unavailable:', err);
            });
    };

    const notice = otherTabsNotice(otherClients);

    return (
        <>
            <button
                className="ct-btn encounter-playtest-btn"
                onClick={handleOpenConfirm}
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
                    {notice && (
                        <span className="warning encounter-playtest-notice" role="status">
                            {notice}
                        </span>
                    )}
                </DeleteConfirmModal>
            )}
        </>
    );
}

export default EncounterPlaytestButton;
