import { normalizeQuestStatus, questStatusLabel } from '../../services/campaign/questStatusDisplay.js';

/**
 * Pure board derivations for the player quest board — the same idiom as
 * gm-screen/partyRowData.js. Grouping decision (documented): three sections
 * in ladder order Active → Completed → Failed, each hiding itself when empty.
 * A Failed section keeps its own group (its card carries the red pill) rather
 * than folding into "Completed" — one honest heading per authored status,
 * no renaming, no invented "Resolved" umbrella.
 */

// Ladder order for the board sections.
export const QUEST_BOARD_GROUPS = ['active', 'completed', 'failed'];

/**
 * Bucket rows by authored status (storage order preserved within each group;
 * an unknown status normalizes to active — the shared canon's fallback), then
 * drop empty groups so a fresh campaign shows no empty theatre.
 */
export function groupQuestsForBoard(quests) {
  const byStatus = new Map(QUEST_BOARD_GROUPS.map(status => [status, []]));
  for (const quest of quests || []) {
    byStatus.get(normalizeQuestStatus(quest?.status)).push(quest);
  }
  return QUEST_BOARD_GROUPS
    .map(status => ({ status, label: questStatusLabel(status), quests: byStatus.get(status) }))
    .filter(group => group.quests.length > 0);
}
