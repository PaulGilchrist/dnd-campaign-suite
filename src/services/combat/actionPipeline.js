/**
 * Action Pipeline — event-chain architecture
 *
 * Steps are linked by event names. Each step subscribes to an event,
 * runs its handler, and emits a new event. The runner chains steps by
 * matching emit → subscribe. Observers are decoupled handlers that
 * react to any event type (logging, SSE, etc.).
 *
 * Step:  { name, subscribe, emit, condition(ctx), handler(ctx) → result }
 * Event result: { data?, modal?, popup?, nextEvent? } | null (null aborts)
 * Observer: { event, handler(ctx, result) }
 */

export function createPipeline() {
  const steps = [];
  const observers = [];

  return {
    step(def) { steps.push(def); return this; },

    observe(event, handler) { observers.push({ event, handler }); return this; },

    async run(initialEvent, ctx, resumeRef) {
      let eventType = initialEvent;

      while (eventType) {
        const step = steps.find(s => s.subscribe === eventType);
        if (!step) break;

        if (step.condition && !step.condition(ctx)) {
          eventType = step.emit;
          continue;
        }

        const result = await step.handler(ctx);
        if (result === null) break;

        if (result.data) Object.assign(ctx, result.data);

        for (const obs of observers) {
          if (obs.event === eventType || obs.event === '*') {
            await obs.handler(ctx, result);
          }
        }

        if (result.modal) {
          resumeRef.current = {
            ...resumeRef.current,
            attack: ctx.attack,
            formula: ctx.formula,
            total: ctx.total,
            rolls: ctx.rolls,
            modifier: ctx.modifier,
            popupHtml: ctx.popupHtml,
            ...result.data,
            _pausedStep: step.name,
          };
          return;
        }

        if (result.popup) {
          ctx.setPopupHtml?.(result.popup);
        }

        eventType = result.nextEvent || step.emit;
      }
    },

    async resume(ctx, resumeRef) {
      const paused = resumeRef.current;
      if (!paused?._pausedStep) return;
      const step = steps.find(s => s.name === paused._pausedStep);
      if (!step) return;
      await this.run(step.emit, ctx, resumeRef);
    },
  };
}
