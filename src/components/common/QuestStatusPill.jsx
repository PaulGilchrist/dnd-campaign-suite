import { questStatusClass, normalizeQuestStatus } from '../../services/campaign/questStatusDisplay.js';
import './QuestStatusPill.css';

/**
 * The quest status pill — the shared chip the GM Quests planner rows and the
 * player quest board both render. Statuses/text/tone come from the display
 * canon (questStatusDisplay.js); colors from this component's CSS (the GM
 * planner's former inline STATUS_COLORS map moved here verbatim).
 */
function QuestStatusPill({ status }) {
  const normalized = normalizeQuestStatus(status);
  return (
    <span
      className={`quest-status-pill ${questStatusClass(normalized)}`}
      title={normalized}
    >
      {normalized}
    </span>
  );
}

export default QuestStatusPill;
