import { useCallback, useEffect, useState } from 'react';
import { loadStarterSeed } from '../../services/campaign/starterSeedService.js';
import { loadQuestBoard } from '../../services/campaign/questsService.js';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import './FirstSessionChecklist.css';

/**
 * First-session onboarding panel for starter campaigns (arena-starter plan
 * §3.3). Rendered whenever the campaign carries a starter seed; every step
 * deep-links into a real view and names the *generated* entities, so the
 * panel reads like "Open Thornwatch Countryside — the portal to <dungeon>
 * waits at the ruins", not generic advice.
 *
 * Pure onboarding: checking steps off and dismissing write NOTHING to the
 * server (dismissible state is per-client UI, exactly like showModal flags).
 * GM runs additionally get the betrayal tool row and the Regenerate deep link.
 */
function FirstSessionChecklist({ campaignName, onNavigate, onBuildHeroes, isLocalhost = false }) {
  const [seed, setSeed] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  // Live quest count from the board GET (backlog 2026-11-20 VN): the seed doc
  // is immutable, so its `quests` list goes stale the moment the GM deletes or
  // drafts a row. null = pending/failed — the step then shows NO number rather
  // than a fabricated seed-time one.
  const [questCount, setQuestCount] = useState(null);

  // Read-only re-fetch of the whitelisted board rows (same lane the QuestBoard
  // itself uses); a failed GET leaves questCount null (honest no-number face).
  const refreshQuestCount = useCallback(() => {
    loadQuestBoard(campaignName)
      .then(rows => setQuestCount(rows.length))
      .catch(error => {
        console.error('Starter checklist quest count refresh failed:', error);
        setQuestCount(null);
      });
  }, [campaignName]);

  useEffect(() => {
    setQuestCount(null);
    refreshQuestCount();
  }, [refreshQuestCount]);

  useEffect(() => {
    let cancelled = false;
    setSeed(null);
    loadStarterSeed(campaignName)
      .then(value => { if (!cancelled) setSeed(value); })
      .catch(() => { if (!cancelled) setSeed(null); });
    return () => {
      cancelled = true;
    };
  }, [campaignName]);

  // Regenerate adventure (Campaign Admin) and the create-time seed write
  // re-publish the whole document on `starter-seed-<campaign>` (see
  // server/routes/campaigns-starter-seed.js), so EVERY open tab — including
  // the one that issued the PUT — refreshes its named entities without a
  // reload. The payload is applied directly (never re-GET/re-POST the echo,
  // skipSync doctrine); subscription rides the ONE shared SSE client.
  // Quest add/delete/status flips broadcast `quests-list-<campaign>` (see
  // server/routes/quests.js) and re-fetch ONLY the board count — the sanctioned
  // read-only refresh pattern of the QuestBoard twin (a GET echo is not a
  // re-POST).
  useEffect(() => subscribeToSSE(campaignName, (event) => {
    if (!event) return;
    if (event.key === `starter-seed-${campaignName}`) {
      const updated = event.data?.seed;
      if (updated && typeof updated === 'object') setSeed(updated);
    } else if (event.key === `quests-list-${campaignName}`) {
      refreshQuestCount();
    }
  }), [campaignName, refreshQuestCount]);

  if (dismissed || !seed?.entities) return null;

  const { settlement, dungeonTitle, encounters } = seed.entities;
  // Quest step copy (backlog 2026-11-20 VN): the LIVE board count, never
  // seed.entities.quests.length — once the board answers it prints the honest
  // number; while the GET is pending or failed it prints NO number at all.
  const questStepLabel = questCount === null
    ? 'Review the starter quests'
    : `Review the starter quests (${questCount} on the board)`;
  // Parent plan §4.2 walk: build a sheet → settlement lore → outdoor/fog move →
  // quests → join wave 1 → TV/teams → short rest → log; GM rows add the
  // betrayal tool and the regenerate deep link. Every step names the
  // GENERATED entities and deep-links a real view.
  const steps = [];
  // GM-origin gate (LAN-visitor bug 2026-11-20): character creation is
  // localhost-only (sidebar door, empty-state card, server POST guard), so the
  // Build-heroes row consults isLocalhost exactly like the rows below it —
  // otherwise a visitor gets a door into a build that can never save.
  if (onBuildHeroes && isLocalhost) {
    steps.push({ icon: 'fa-user-plus', label: 'Build your heroes (+ Character)', action: onBuildHeroes });
  }
  steps.push(
    { icon: 'fa-house', label: `Meet the folk of ${settlement}`, view: 'settlements' },
    { icon: 'fa-map', label: `Lead your tokens from ${settlement} to the portal of ${dungeonTitle} through the fog`, view: 'mapsManager' },
    { icon: 'fa-scroll', label: questStepLabel, view: 'quests' },
    // backlog 2026-11-11 KW: the promise reads "Join <wave>", but saved waves
    // hide behind the builder's Load modal — the intent makes the deep link
    // open that wave list automatically (App wires it to a one-shot request
    // token consumed by EncounterBuilder).
    { icon: 'fa-dragon', label: `Join ${encounters[0]} when the party is ready`, view: 'encounter', intent: 'load' },
    { icon: 'fa-list-ol', label: 'Roll initiative — hit TV for the living-room screen', view: 'initiative' },
    { icon: 'fa-heart-pulse', label: 'Patch up with a short rest between waves', view: 'charSheet' },
    { icon: 'fa-book-open', label: 'Read the story as it happens in the campaign log', view: 'campaignLog' },
  );
  if (isLocalhost) {
    steps.push(
      { icon: 'fa-handshake', label: 'Use 🤝 Allies on the tracker to split teams (or betray them)', view: 'initiative' },
      // backlog 2026-11-04 CU: this deep-link step shared the accessible-name
      // token "Regenerate" with the Admin page's primary ct-btn, so a
      // /Regenerate/i role query could silently land here (a no-op view
      // switch). The aria-label names the ACTION (open Admin) without that
      // token; the visible label stays, and the testid pins the step itself.
      {
        icon: 'fa-dice',
        label: `Re-roll the adventure anytime — Admin → Regenerate (keeps ${settlement})`,
        view: 'campaignRepair',
        ariaLabel: `Open Campaign Admin to re-roll the adventure (keeps ${settlement})`,
        testId: 'starter-step-regenerate',
      },
    );
  }

  // Steps without an intent call onNavigate(view) exactly as before; only the
  // wave step adds the second argument (keeps every sibling deep-link lane
  // byte-unchanged).
  const go = (step) => step.action
    ? step.action()
    : (step.intent ? onNavigate?.(step.view, step.intent) : onNavigate?.(step.view));

  return (
    <div className="campaign-starter-checklist" role="complementary" aria-label="First-session checklist">
      <div className="campaign-starter-checklist-head">
        <h3><i className="fa-solid fa-seedling"></i> First session — {settlement}</h3>
        <button
          className="campaign-starter-checklist-dismiss"
          onClick={() => setDismissed(true)}
          title="Dismiss checklist"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <ol className="campaign-starter-checklist-steps">
        {steps.map((step) => (
          <li key={step.label}>
            <button
              className="campaign-starter-step"
              aria-label={step.ariaLabel}
              data-testid={step.testId}
              onClick={() => go(step)}
            >
              <i className={`fa-solid ${step.icon}`}></i> {step.label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default FirstSessionChecklist;
