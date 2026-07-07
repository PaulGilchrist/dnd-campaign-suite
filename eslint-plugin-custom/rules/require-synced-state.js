/**
 * ESLint rule: require-synced-state
 *
 * When a component uses setRuntimeValue, warns if it also has useState/useRef
 * with names that suggest game state. This catches the common pattern where
 * some state is synced but not all.
 *
 * This is a warn (not error) during migration. Once all game state is synced,
 * this can be upgraded to 'error'.
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
      description:
        'Warn when a component uses setRuntimeValue but also has unsynced game-state useState/useRef',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [],
    messages: {
      requireSyncedState:
        'This component uses setRuntimeValue (server-first pattern) but also has {{name}} which appears to be game state. Consider using useSyncedState or setRuntimeValue for {{name}}.',
    },
  },
  create(context) {
    let hasSetRuntimeValue = false;
    let gameStateVariables = [];

    return {
      CallExpression(node) {
        // Check for setRuntimeValue usage
        if (
          node.callee.type === 'Identifier' &&
          (node.callee.name === 'setRuntimeValue' ||
            node.callee.name === 'setRuntimeBatch')
        ) {
          hasSetRuntimeValue = true;
        }
      },
      VariableDeclarator(node) {
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

        const paramName = node.id.type === 'Identifier' ? node.id.name : null;
        if (!paramName) return;

        // Skip DOM refs
        if (paramName.endsWith('Ref') && paramName.length < 15) return;
        if (paramName.endsWith('Element')) return;

        // Check if the name contains game-state keywords
        const lowerName = paramName.toLowerCase();
        const isGameState = GAME_STATE_KEYWORDS.some((keyword) =>
          lowerName.includes(keyword),
        );

        if (isGameState) {
          gameStateVariables.push({ name: paramName, node: node.id });
        }
      },
      Program: function () {
        if (hasSetRuntimeValue && gameStateVariables.length > 0) {
          for (const { name, node } of gameStateVariables) {
            context.report({
              node,
              messageId: 'requireSyncedState',
              data: {
                name,
              },
            });
          }
        }
      },
    };
  },
};
