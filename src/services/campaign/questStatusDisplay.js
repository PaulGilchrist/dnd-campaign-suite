/**
 * Quest status display canon — the ONE definition of the three statuses the
 * GM Quests planner authors (Quests.jsx STATUS_OPTIONS) and of how each one
 * reads (label + pill CSS modifier). Shared by the GM planner rows and the
 * read-only player quest board; pill colors live in QuestStatusPill.css so
 * both surfaces render byte-identical chips from one source.
 */

export const QUEST_STATUSES = ['active', 'completed', 'failed'];

/** Rows are authored against the three options; anything else is treated as
 *  active (mirrors the GM planner's pre-existing pill fallback). */
export function normalizeQuestStatus(status) {
  return QUEST_STATUSES.includes(status) ? status : 'active';
}

export function questStatusLabel(status) {
  const normalized = normalizeQuestStatus(status);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/** CSS modifier shared by QuestStatusPill.css and the board's group headers. */
export function questStatusClass(status) {
  return `quest-status-pill--${normalizeQuestStatus(status)}`;
}
