import { useState } from 'react';
import MarkdownPreview from '../common/MarkdownPreview.jsx';
import QuestStatusPill from '../common/QuestStatusPill.jsx';

// Heuristic for WHEN a description earns a Show more / Show less control;
// the collapsed state itself clamps visually via CSS (the same line-clamp
// idiom as the planner's .quests-list-subtitle), so no markdown string is
// ever cut mid-syntax for the preview.
const DESCRIPTION_PREVIEW_CHARS = 140;

/**
 * One read-only quest card: name, shared status pill, markdown description
 * (collapsed preview with expand), and rewards — the exact field whitelist
 * the /quests/board lane serves. GM notes never reach this component (they
 * are dropped server-side, one filter, in the lane handler).
 */
function QuestBoardCard({ quest }) {
  const [expanded, setExpanded] = useState(false);
  const description = quest.description || '';
  const rewards = quest.rewards || '';
  const collapsible = description.length > DESCRIPTION_PREVIEW_CHARS;

  return (
    <article className="quest-board-card">
      <header className="quest-board-card-header">
        <h4 className="quest-board-card-name">{quest.name}</h4>
        <QuestStatusPill status={quest.status} />
      </header>
      {description.trim() && (
        <div className="quest-board-card-description">
          <MarkdownPreview
            className={`quest-board-description${collapsible && !expanded ? ' quest-board-description--clamped' : ''}`}
            text={description}
          />
          {collapsible && (
            <button
              type="button"
              className="ct-btn ct-btn-sm quest-board-toggle"
              aria-expanded={expanded}
              onClick={() => setExpanded(prev => !prev)}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
      {rewards.trim() && (
        <div className="quest-board-card-rewards">
          <h5 className="quest-board-rewards-title">
            <i className="fa-solid fa-gift" /> Rewards
          </h5>
          <MarkdownPreview className="quest-board-rewards-text" text={rewards} />
        </div>
      )}
    </article>
  );
}

export default QuestBoardCard;
