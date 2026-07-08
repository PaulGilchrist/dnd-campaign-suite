/**
 * SSE pipeline observers that broadcast milestones via SSE.
 * Each observer POSTs to /api/campaigns/:campaign/pipeline-event.
 * Observers fire on ALL pipeline events (step completions + pauses).
 *
 * Returns an array of { event, handler } objects compatible with the
 * pipeline's observe() method.
 */

// Mapping of pipeline step events to SSE broadcast keys
const EVENT_MAPPING = {
  'housekeeping:do': 'pipeline:started',
  'maneuvers:check': 'maneuvers:check',
  'maneuvers:handled': 'maneuvers:handled',
  'cunning:checked': 'cunning:checked',
  'bi:checked': 'bi:checked',
  'damage:rolled': 'damage:rolled',
  'context:built': 'context:built',
  'sneak:applied': 'sneak:applied',
  'twf:applied': 'twf:applied',
  'effects:applied': 'effects:applied',
  'superiority:applied': 'superiority:applied',
  'automation:applied': 'automation:applied',
  'weapon_hit:applied': 'weapon_hit:applied',
  'n20:applied': 'n20:applied',
  'celestial:applied': 'celestial:applied',
  'riders:applied': 'riders:applied',
  'overchannel:self-damage': 'overchannel:self-damage',
  'dmg_type:modified': 'dmg_type:modified',
  'damage:ready': 'damage:ready',
  'damage:applied': 'damage:applied',
  'cleave:done': 'cleave:done',
  'tactical:done': 'tactical:done',
  'mastery:done': 'mastery:done',
  'pipeline:complete': 'pipeline:complete',
  'spell:do': 'spell:do',
  'spell:context': 'spell:context',
  'spell:formulas': 'spell:formulas',
  'spell:rolled': 'spell:rolled',
  'spell:ready': 'spell:ready',
  'spell:applied': 'spell:applied',
  'generic:do': 'generic:do',
  'generic:ready': 'generic:ready',
  'generic:applied': 'generic:applied',
};

function createSseObservers(campaignName) {
  const observers = [];

  for (const [event, sseKey] of Object.entries(EVENT_MAPPING)) {
    observers.push({
      event,
      handler: async (ctx, result) => {
        try {
          await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/pipeline-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: sseKey, data: result || {} }),
          });
        } catch {
          // Pipeline continues even if SSE broadcast fails
        }
      },
    });
  }

  // Pipeline paused — broadcast modal:shown
  observers.push({
    event: '*',
    handler: async (ctx, result) => {
      if (!result?.modal) return;

      try {
        await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/pipeline-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'modal:shown', data: { step: ctx._pausedStep || result } }),
        });
      } catch {
        // Pipeline continues even if SSE broadcast fails
      }
    },
  });

  // Pipeline resumed — broadcast modal:dismissed
  observers.push({
    event: 'pipeline:resumed',
    handler: async (ctx, result) => {
      try {
        await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/pipeline-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'modal:dismissed', data: result || {} }),
        });
      } catch {
        // Pipeline continues even if SSE broadcast fails
      }
    },
  });

  return observers;
}

export { createSseObservers };
