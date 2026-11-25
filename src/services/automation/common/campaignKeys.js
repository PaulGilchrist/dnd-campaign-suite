/**
 * Set of static campaign-level runtime keys.
 * These keys are stored at the campaign level (characterKey = 'campaign')
 * rather than under a character name or the campaign name.
 */
export const CAMPAIGN_KEYS = new Set([
    'targetEffects',
    // CLA-044: top-level activeCreatureName is truth (initiative Next writes it
    // via storage.set; SSE lands it in the campaign store — the cs mirror lags).
    'activeCreatureName',
    'pendingSavePrompts',
    'coverRefresh',
    'warCasterReactions',
    'quivering_palm',
    'pendingSaveListenerPrompts',
    // NOTE: the *-viewingMonster modal-open keys were removed 2026-11-07 —
    // the MonsterCardModal is GM-private per-tab presentation state now
    // (useState in Initiative/Map/EncounterBuilder). Synced, it broadcast the
    // GM's opened stat block to every player tab and TV screen.
    'cleavePending',
    'cleaveSecondTargets',
    'pipeline-pause',
    'travel-mode',
    'travel-pace',
    'travel-destination',
    'travel-path',
    'travel-pathIndex',
    'travel-accruedCost',
    'travel-dailyBudget',
    'travel-dayExhausted',
    'travel-forcedMarchHours',
    'travel-log',
    'travel-lastMessage',
    'travel-pendingEvent',
    'travel-eventFrequency',
    'travel-rerollsRemaining',
    'travel-horseback',
    // bug-hex-trip-clobbered-by-second-client: per-tab provenance stamp for
    // the live trip — the client that pressed Travel claims it, and a second
    // viewer's toggle interactions may never reset/cancel a trip it does not
    // own. UI-ownership byte (session token), lives beside the travel keys.
    'travel-started-by',
    // Improve 2026-10-29: GM loot-draft scratch state (panel text + generated
    // lootData) — survives Initiative view-switches like the travel keys.
    'loot-draft',
    'music',
    // Level 5 (L5-001): enforcement foundation — off-by-default flags and the
    // per-creature turn economy (see src/services/combat/turnState.js +
    // canTakeAction.js). (The assignable 'referee' key was removed
    // 2026-10-13 — localhost hosting means the GM machine is the referee.)
    'enforcement',
    'turnState',
    // L5 §7.5 'turnTimer' REMOVED (no-timers plan T1): real-time countdowns
    // are banned — the game advances only on player/GM action (AGENTS.md).
    // L5 Phase 4 (§10.1): session orchestration { phase, changedBy,
    // changedAt } — moves ONLY on action, never on wall-clock.
    'sessionState',
    // L5 Phase 3 (§9): AI service config { endpoint, model, temperature,
    // mode:'off'|'suggest'|'autopilot', provider } — LOCAL endpoint only,
    // server-validated; null/off ⇒ zero AI traffic (L1–4 parity).
    'aiConfig',
    // Victory/TV banner stamp (Phase 1): handleClear stamps it at the
    // combat-clear seam with characterKey='campaign' and useTvPresentation
    // reads it campaign-level. Unregistered, its OBJECT echo failed
    // isCampaignKey in applyStoreUpdate and was dispatched to a ghost
    // CHARACTER store named "lastCombatResult" — every already-mounted client
    // silently never showed the banner (only a reload hydrated it, since
    // hydrateCampaignRuntimeData adopts all top-level keys unfiltered).
    // bug-victory-stamp-not-sse-adopted-missing-campaign-key.
    'lastCombatResult',
    // Starry Chalice post-cast ally-heal handoff (sibling-key audit 2026-11-02,
    // same misroute family as the victory stamp): producer
    // (postCastHealService.triggerPostCastAllyHeals) stamps it campaign-level
    // and both readers (postCastHealService.applyStarryChaliceHeal,
    // spellCastService runGenericHealPath) read it campaign-level. Today's
    // lane runs producer+consumer on the SAME client, but unregistered, its
    // OBJECT echo failed isCampaignKey in applyStoreUpdate and was dispatched
    // to a ghost CHARACTER store named "pendingStarryChaliceHeal" on every
    // mounted client, with the null-clear echo dropped and stale nulls
    // lingering.
    // bug-victory-stamp-not-sse-adopted-missing-campaign-key (sibling verdict).
    'pendingStarryChaliceHeal',
    // Pending Opportunity-Attack trigger markers (bug-pending-oas-key-not-
    // registered-echo-misroutes — same misroute family as the two above):
    // the trigger seam writes campaign-level (pendingOpportunityAttacks.js
    // PENDING_OA_KEY via setRuntimeValue('campaign', …)) and both readers
    // subscribe campaign-level (CharReactions.jsx, useMonsterPendingOa.js).
    // Unregistered, the `change-<c>-pendingOAs` OBJECT echo failed
    // isCampaignKey in applyStoreUpdate and was dispatched to a ghost
    // CHARACTER store named "pendingOAs" no consumer reads — cross-client/
    // curl marker writes never live-updated a mounted tab (sheet press fell
    // to the legacy free-press lane; monster-card affordance never appeared
    // until a reload hydrated via the unfiltered seed pass), and the drain-
    // to-evict null DELETE echo was dropped too, so evictions never cleared
    // a settled tab's mirror either. Live-witnessed 2026-11-09: curl-seeded
    // marker stayed invisible on a settled Initiative tab (server GET showed
    // the row) and only a reload mounted the "Opportunity Attack on <mover>"
    // affordance.
    'pendingOAs',
    // GM Copilot settled tips (learnability plan Phase 1): written campaign-
    // level (useGmCopilot → setRuntimeValue('campaign','gmCopilot')); unreg-
    // istered, a dismissal on one GM browser would echo to a ghost CHARACTER
    // store (bug-victory-stamp-not-sse-adopted-missing-campaign-key family)
    // and only land on reload.
    'gmCopilot',
    // Sound-screen role (learnability plan Phase 5): claim writes campaign-
    // level (soundOwner.js); every other tab's mute chip and cue gate must
    // follow the claim live, not on reload (same misroute family as above).
    'soundOwner',
    // bug-lastattack-not-a-campaign-key-celebrates-clears-silently (same
    // misroute family as the victory stamp above): `lastAttack` is written
    // campaign-level by every roll lane (attackPostProcessing.js,
    // saveProcessing.js, useLoggedDiceRollAttack.js, handlePlainDamage.js,
    // executeActionManeuvers.js, …) and read campaign-level by 10+ consumers —
    // the Clear-seam victory bank (createCreatureHandlers.js `attackEvidence`),
    // Stunning Strike attribution, save-prompt origin, monster split/reaction
    // resolvers, Tactical Master. Unregistered, the `change-<c>-lastAttack`
    // OBJECT echo failed isCampaignKey in applyStoreUpdate and landed in a
    // ghost CHARACTER store named "lastAttack" — a mounted non-attacking tab
    // (tracker/TV) silently cleared with attackEvidence:null and never
    // celebrated. Live-witnessed 2026-11-24.
    'lastAttack',
    // Same-family audit additions (2026-11-24, diffed against every
    // setRuntimeValue('campaign', …) / useSyncedState('campaign', …) producer):
    // Tactical Master modal scratch (CharActions.jsx setter writes it,
    // useCharActionsCleave.js reads campaign-level) — sibling of the
    // registered cleavePending/cleaveSecondTargets pair.
    'tacticalMasterPending',
    // Leading Evasion chooser stamps (evasionUtils.js LEADING_EVASION_KEY =
    // { [promptId]: [targetName] }); SavePromptModal subscribes it
    // campaign-level via useRuntimeValue.
    'leadingEvasionSelections',
    // Cover-shot round stamp {attacker, target, round} (coverService.js
    // COVER_SHOT_KEY), read campaign-level during target-AC computation.
    '_cover_shot',
]);

/**
 * Check if a key is a campaign-level key (static or dynamic).
 * @param {string} key - The runtime key to check
 * @returns {boolean}
 */
export function isCampaignKey(key) {
    if (CAMPAIGN_KEYS.has(key)) return true;
    if (key.startsWith('_activeInvisibility_')) return true;
    if (key.startsWith('_activeFriends_')) return true;
    if (/^_.*_appliedTarget$/.test(key)) return true;
    // Dynamic campaign-scoped automation flags written per-instance via
    // setRuntimeValue('campaign', key, …) and read back campaign-level —
    // same adoption law as the static keys above (audit 2026-11-24,
    // bug-lastattack-not-a-campaign-key family). Greater Invisibility is the
    // twin of the _activeInvisibility_ line (restRules/invisibilityService/
    // buffHandler write it, concentrationService's INVISIBILITY_FLAG_PREFIXES
    // sweep reads it); _fleshToStone_/_prismaticSpray*_ per-target save
    // tracking rides CreatureCard badges + the concentration/clearAll sweeps;
    // _animalFriendship_ <caster>_<target> charms are ended from the
    // damage-dealt lane on whichever client rolls the hit.
    // NOTE: the *_prompt-* families (savePrompt-/deathSavePrompt-/
    // concentrationPrompt-/fleshToStonePrompt-) are NOT store-lane keys — each
    // prompt modal subscribes its own change-<c>-<prefix> SSE family directly,
    // so they intentionally stay OUT of this dispatch.
    if (key.startsWith('_activeGreaterInvisibility_')) return true;
    if (key.startsWith('_fleshToStone_')) return true;
    if (key.startsWith('_prismaticSprayIndigo_')) return true;
    if (key.startsWith('_prismaticSprayViolet_')) return true;
    if (key.startsWith('_animalFriendship_')) return true;
    return false;
}
