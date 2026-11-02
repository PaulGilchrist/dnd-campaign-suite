import { useEffect, useState } from 'react';
import { loadStarterSeed } from '../../services/campaign/starterSeedService.js';
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

  useEffect(() => {
    let cancelled = false;
    const refetch = () => loadStarterSeed(campaignName)
      .then(value => { if (!cancelled) setSeed(value); })
      .catch(() => { if (!cancelled) setSeed(null); });
    setSeed(null);
    refetch();
    // Regenerate adventure (Campaign Admin) re-rolls the layer and rewrites
    // the seed in place; refresh the named entities without a page reload.
    // Pure UI-local event (client-only, no game state, no timer).
    const onSeedChanged = (e) => {
      if (e.detail?.campaignName === campaignName) refetch();
    };
    window.addEventListener('starter-seed-changed', onSeedChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('starter-seed-changed', onSeedChanged);
    };
  }, [campaignName]);

  if (dismissed || !seed?.entities) return null;

  const { settlement, dungeonTitle, quests, encounters } = seed.entities;
  // Parent plan §4.2 walk: build a sheet → settlement lore → outdoor/fog move →
  // quests → join wave 1 → TV/teams → short rest → log; GM rows add the
  // betrayal tool and the regenerate deep link. Every step names the
  // GENERATED entities and deep-links a real view.
  const steps = [];
  if (onBuildHeroes) {
    steps.push({ icon: 'fa-user-plus', label: 'Build your heroes (+ Character)', action: onBuildHeroes });
  }
  steps.push(
    { icon: 'fa-house', label: `Meet the folk of ${settlement}`, view: 'settlements' },
    { icon: 'fa-map', label: `Lead your tokens from ${settlement} to the portal of ${dungeonTitle} through the fog`, view: 'mapsManager' },
    { icon: 'fa-scroll', label: `Review the starter quests (${quests.length} seeded)`, view: 'quests' },
    { icon: 'fa-dragon', label: `Join ${encounters[0]} when the party is ready`, view: 'encounter' },
    { icon: 'fa-list-ol', label: 'Roll initiative — hit TV for the living-room screen', view: 'initiative' },
    { icon: 'fa-heart-pulse', label: 'Patch up with a short rest between waves', view: 'charSheet' },
    { icon: 'fa-book-open', label: 'Read the story as it happens in the campaign log', view: 'campaignLog' },
  );
  if (isLocalhost) {
    steps.push(
      { icon: 'fa-handshake', label: 'Use 🤝 Allies on the tracker to split teams (or betray them)', view: 'initiative' },
      { icon: 'fa-dice', label: `Re-roll the adventure anytime — Admin → Regenerate (keeps ${settlement})`, view: 'campaignRepair' },
    );
  }

  const go = (step) => step.action ? step.action() : onNavigate?.(step.view);

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
            <button className="campaign-starter-step" onClick={() => go(step)}>
              <i className={`fa-solid ${step.icon}`}></i> {step.label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default FirstSessionChecklist;
