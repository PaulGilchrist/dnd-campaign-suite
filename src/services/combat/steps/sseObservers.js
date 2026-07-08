/**
 * SSE pipeline observers that broadcast milestones via SSE.
 * Each observer POSTs to /api/campaigns/:campaign/pipeline-event.
 * Observers fire on ALL pipeline events (step completions + pauses).
 *
 * A wildcard observer broadcasts every event. Modal-specific observers
 * handle special post-processing (dismissal, etc.).
 *
 * Returns an array of { event, handler } objects compatible with the
 * pipeline's observe() method.
 */

function createSseObservers(campaignName) {
  const observers = [];

  // Wildcard observer — broadcasts every event to SSE
  observers.push({
    event: '*',
    handler: async (ctx, result, eventName) => {
      // Skip modal pauses — handled by the modal-specific observer
      if (result?.modal) return;

      try {
        await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/pipeline-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: eventName, data: result || {} }),
        });
      } catch {
        // Pipeline continues even if SSE broadcast fails
      }
    },
  });

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
