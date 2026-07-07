/**
 * ESLint rule: no-window-access
 *
 * Disallows accessing `window` for application state.
 * The only legitimate uses are browser APIs (fetch, EventSource, etc.).
 * Application state should use the runtime store (setRuntimeValue/getRuntimeValue).
 *
 * This catches bugs where `window.__pendingSaves` or similar globals are used
 * instead of the proper SSE-synced runtime store.
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow window access for application state',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      noWindow: 'Do not use window for application state. Use the runtime store (setRuntimeValue/getRuntimeValue) instead.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        // Match `window.__anything` but not `window.fetch`, `window.EventSource`, etc.
        const object = node.object;
        const property = node.property;

        if (
          object.type === 'Identifier' &&
          object.name === 'window' &&
          property.type === 'Identifier' &&
          property.name.startsWith('__') &&
          property.name !== '__pendingResultHandlersInstalled'
        ) {
          context.report({
            node,
            messageId: 'noWindow',
          });
        }
      },
    };
  },
};
