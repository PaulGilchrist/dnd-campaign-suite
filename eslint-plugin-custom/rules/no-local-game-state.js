/**
 * ESLint rule: no-local-game-state
 *
 * Warns when useState or useRef is used with names that suggest game state.
 * Game-affecting state should use useSyncedState or setRuntimeValue instead.
 *
 * Game-state keywords: pending, active, current, target, choice, modal, popup,
 * save, damage, attack, creature, condition, buff, debuff, effect, state, value
 *
 * This is a warn (not error) because some useState/useRef are legitimately local:
 * - Ephemeral UI state (isLoading, showDropdown)
 * - DOM refs (ref={useRef(null)} for focus/scroll)
 * - Event ordering guards (pendingPromptIdRef)
 *
 * Once all game state is migrated, this can be upgraded to 'error'.
 */
const GAME_STATE_KEYWORDS = [
  'pending',
  'active',
  'current',
  'target',
  'choice',
  'modal',
  'popup',
  'save',
  'damage',
  'attack',
  'creature',
  'condition',
  'buff',
  'debuff',
  'effect',
  'state',
  'value',
];

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Warn when useState/useRef is used with game-state-like names',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [],
    messages: {
      noLocalGameState:
        'This {{hook}} appears to track game state. Consider using useSyncedState or setRuntimeValue to ensure all clients see the same data via SSE.',
    },
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        // Match useState and useRef calls
        const init = node.init;
        if (!init) return;

        const isUseState =
          init.type === 'CallExpression' &&
          init.callee.type === 'Identifier' &&
          init.callee.name === 'useState';

        const isUseRef =
          init.type === 'CallExpression' &&
          init.callee.type === 'Identifier' &&
          init.callee.name === 'useRef';

        if (!isUseState && !isUseRef) return;

        // Get the variable name
        const paramName = node.id.type === 'Identifier' ? node.id.name : null;
        if (!paramName) return;

        // Skip refs that are clearly DOM refs
        if (paramName.endsWith('Ref') && paramName.length < 15) return;
        if (paramName.endsWith('Element')) return;

        // Check if the name contains game-state keywords
        const lowerName = paramName.toLowerCase();
        const isGameState = GAME_STATE_KEYWORDS.some(
          (keyword) => lowerName.includes(keyword),
        );

        if (isGameState) {
          context.report({
            node: node.id,
            messageId: 'noLocalGameState',
            data: {
              hook: isUseState ? 'useState' : 'useRef',
            },
          });
        }
      },
    };
  },
};
