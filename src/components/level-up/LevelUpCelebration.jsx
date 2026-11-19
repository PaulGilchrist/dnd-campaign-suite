// Roadmap Item 8 — the LEVEL UP moment. Pure presentation reacting to the
// SAME writes every other consumer reads: zero new stores, zero new routes,
// zero XP semantics. Two detection lanes, one per advancement mode:
//
//  • experience mode — a character's cumulative XP crossing a threshold on the
//    canonical ladder (services/character/levelProgression). Read through
//    useRuntimeValue(char, 'xp') with the character JSON `xp` as the cold-boot
//    fallback, so BOTH the writing client (local notify) and every other client
//    (the `change-<campaign>-<char>` full-bucket SSE echo adopted via
//    replaceRuntimeObject → notify) observe the identical prev → new value
//    pair. The previous value is the store's own prior read — no second source
//    of truth is threaded through the award lanes (loot Award, auto-rewards,
//    the sheet XP modal), which stay byte-unchanged.
//  • milestone mode — the GM grants a level explicitly, i.e. the wizard's
//    Basic-Information level bump (useCharacterWizard.handleEditWizardComplete
//    confirms "Change <name>'s level from A to B"). That PUT publishes a
//    `character-update-*` echo and every client's roster entry carries the new
//    `level` — comparing the roster's prev/new level celebrates that seam on
//    all screens, not just the saving tab.
//
// One lane per mode by construction: an experience-mode level bump is the
// wizard handoff of an XP crossing already celebrated, so it never double-
// fires. Multi-level jumps display honestly ("Level 1 → 3"); the ladder caps
// at 20, so past-max XP never celebrates.
//
// The XP lane floors every award at the character's ACTUAL roster level, the
// same ground truth the milestone lane compares: an implied level that does
// not exceed `character.level` is XP-lane catch-up (e.g. a milestone
// character's first-ever XP write under a Level-8 roster), never an award —
// it adopts silently, and the banner's starting level is the roster truth,
// never the implied-from-0 "Level 1" a character never had.
//
// Celebration state is per-client ephemeral UI state (like showModal) — never
// the runtime store. Dismissal is by click only: the × / Continue buttons or
// the wizard handoff; no timers (AGENTS no-game-timers law).
//
// The wizard handoff reuses the EXISTING level-up editing entry: the sheet's
// "Edit" lane (App.handleEditCharacter on the roster character, which opens
// the edit wizard whose first visible step is exactly the level field). A
// multi-character award shows ONE banner naming every character (a row each —
// the Victory banner's victory-line row idiom, the simplest existing shape).

import React from 'react';
import './LevelUpCelebration.css';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { impliedLevelFromXp } from '../../services/character/levelProgression.js';
import { playCue } from '../../services/ui/audioCues.js';

const XP_MODE_EXPERIENCE = 'experience';

function resolveXp(runtimeXp, characterXp) {
    const value = Number(runtimeXp ?? characterXp);
    return Number.isFinite(value) ? value : 0;
}

function CharacterLevelWatcher({ character, campaignName, armed, onCrossing }) {
    const runtimeXp = useRuntimeValue(character.name, 'xp', campaignName);
    const runtimeXpMode = useRuntimeValue(character.name, 'xpMode', campaignName);
    const observed = React.useRef(null);

    React.useEffect(() => {
        const level = Number(character.level);
        const snapshot = {
            level: Number.isFinite(level) ? level : null,
            xp: resolveXp(runtimeXp, character.xp),
            inXpMode: (runtimeXpMode ?? character.xpMode ?? 'milestone') === XP_MODE_EXPERIENCE,
        };
        const previous = observed.current;
        observed.current = snapshot;
        // Cold load / campaign (re)select / seed landing: record a baseline,
        // never celebrate. `armed` only flips true once App has seeded the
        // runtime buckets from change-data, so pre-arm moves are invisible.
        if (!armed || !previous) return;
        if (previous.inXpMode && snapshot.inXpMode) {
            // Floor at the character's actual roster level: an implied level
            // that never exceeds it is the XP lane catching up (sync import),
            // not a level-up — silent adopt, and never advertise a starting
            // level the character never had.
            const floor = Math.max(impliedLevelFromXp(previous.xp), snapshot.level ?? 1);
            const to = impliedLevelFromXp(snapshot.xp);
            if (to > floor) onCrossing({ name: character.name, from: floor, to });
        }
        if (!previous.inXpMode && !snapshot.inXpMode
            && previous.level != null && snapshot.level != null && snapshot.level > previous.level) {
            onCrossing({ name: character.name, from: previous.level, to: snapshot.level });
        }
    }, [character.name, character.level, character.xp, character.xpMode,
        runtimeXp, runtimeXpMode, armed, onCrossing]);

    return null;
}

export default function LevelUpCelebration({ campaignName, characters, armed, onOpenWizard }) {
    const [crossings, setCrossings] = React.useState([]);

    // A celebration belongs to the campaign that earned it; switching
    // campaigns (or a roster reload for another one) never carries banners over.
    React.useEffect(() => {
        setCrossings([]);
    }, [campaignName]);

    const recordCrossing = React.useCallback((entry) => {
        setCrossings((prev) => {
            const existing = prev.find((c) => c.name === entry.name);
            if (!existing) return [...prev, entry];
            // Same character crossing again while un-dismissed: honest merged
            // span — keep the original `from`, extend to the newest `to`.
            return prev.map((c) => (c.name === entry.name ? { ...c, to: Math.max(c.to, entry.to) } : c));
        });
    }, []);

    const dismissAll = () => setCrossings([]);
    const dismissOne = (name) => setCrossings((prev) => prev.filter((c) => c.name !== name));

    // Level-up flourish (roadmap Item 10 audio seam): one cue at the moment
    // the banner APPEARS — a boolean edge, so multi-character merges and
    // later crossings under the same banner never re-chime; dismissal is the
    // only thing that re-arms it.
    const bannerVisible = crossings.length > 0;
    React.useEffect(() => {
        if (bannerVisible) playCue('levelup');
    }, [bannerVisible]);

    const openWizard = (name) => {
        const character = (characters || []).find((c) => c.name === name);
        dismissOne(name);
        if (character) onOpenWizard(character);
    };

    return (
        <>
            {(characters || []).map((character) => (
                <CharacterLevelWatcher
                    key={character.name}
                    character={character}
                    campaignName={campaignName}
                    armed={armed}
                    onCrossing={recordCrossing}
                />
            ))}
            {crossings.length > 0 && (
                <div className="level-up-banner" role="status">
                    <div className="level-up-card">
                        <button
                            type="button"
                            className="level-up-close"
                            aria-label="Dismiss level-up banner"
                            title="Dismiss"
                            onClick={dismissAll}
                        >
                            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                        </button>
                        <div className="level-up-title">
                            <i className="fa-solid fa-arrow-up"></i>
                            LEVEL UP!
                        </div>
                        {crossings.map((crossing) => (
                            <div key={crossing.name} className="level-up-line">
                                <span className="level-up-name">{crossing.name}</span>
                                <span className="level-up-levels">Level {crossing.from} → {crossing.to}</span>
                                <button
                                    type="button"
                                    className="level-up-open"
                                    onClick={() => openWizard(crossing.name)}
                                >
                                    <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                                    Open wizard
                                </button>
                            </div>
                        ))}
                        <div className="level-up-prompt">Open the wizard to choose your new features.</div>
                        <button type="button" className="level-up-dismiss" onClick={dismissAll}>Continue</button>
                    </div>
                </div>
            )}
        </>
    );
}
