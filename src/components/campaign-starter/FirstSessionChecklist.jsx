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
 * The GM row additionally points at Admin → Regenerate adventure.
 */
function FirstSessionChecklist({ campaignName, onNavigate, isLocalhost = false }) {
  const [seed, setSeed] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSeed(null);
    loadStarterSeed(campaignName)
      .then(value => { if (!cancelled) setSeed(value); })
      .catch(() => { if (!cancelled) setSeed(null); });
    return () => { cancelled = true; };
  }, [campaignName]);

  if (dismissed || !seed?.entities) return null;

  const { settlement, hexMap, dungeonTitle, quests, encounters } = seed.entities;
  const steps = [
    { icon: 'fa-house', label: `Meet the folk of ${settlement}`, view: 'settlements' },
    { icon: 'fa-map', label: `Open ${hexMap.name} — the portal to ${dungeonTitle} waits`, view: 'mapsManager' },
    { icon: 'fa-scroll', label: `Review the starter quests (${quests.length} seeded)`, view: 'quests' },
    { icon: 'fa-dragon', label: `Join ${encounters[0]} when the party is ready`, view: 'encounter' },
    { icon: 'fa-list-ol', label: 'Roll initiative on the tracker', view: 'initiative' },
  ];
  if (isLocalhost) {
    steps.push({
      icon: 'fa-handshake',
      label: 'Use 🤝 Allies on the tracker to split teams (or betray them)',
      view: 'initiative',
    });
  }

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
            <button className="campaign-starter-step" onClick={() => onNavigate?.(step.view)}>
              <i className={`fa-solid ${step.icon}`}></i> {step.label}
            </button>
          </li>
        ))}
      </ol>
      {isLocalhost && (
        <p className="campaign-starter-checklist-note">
          Didn&apos;t like the roll? Admin → <strong>Regenerate adventure</strong> re-rolls the
          dungeon, monsters and treasure — the village and your party stay.
        </p>
      )}
    </div>
  );
}

export default FirstSessionChecklist;
