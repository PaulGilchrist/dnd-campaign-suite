// race-rules module
// Provides D&D 5e and 2024 race rules
// Usage:
//   import { rules5e, rules2024 } from './race-rules'
//   import { getRulesForVersion } from './race-rules'
//   const rules = getRulesForVersion('2024')

import rules5e from './5e.js';
import rules2024 from './2024.js';

export { rules5e, rules2024 };

export function getRulesForVersion(version) {
  switch (version) {
    case '5e':
    case '5E':
      return rules5e;
    case '2024':
      return rules2024;
    default:
      console.warn(`Unknown rules version: ${version}, defaulting to 2024`);
      return rules2024;
  }
}
