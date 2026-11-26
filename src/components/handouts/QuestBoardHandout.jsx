import MarkdownPreview from '../common/MarkdownPreview.jsx';
import { groupQuestsForBoard } from '../quest-board/questBoardData.js';
import QuestStatusPill from '../common/QuestStatusPill.jsx';

/**
 * Printed quest board one-pager (backlog Item 4). PLAYER-FACING FIELDS ONLY:
 * the component reads exactly {name, status, description, rewards} from each
 * row, so the GM-only `notes` can never reach paper even if a caller passes
 * raw planner rows (pinned in QuestBoardHandout.test.jsx). Draft rows are
 * the GM's unpublished work — they mirror the /quests/board lane's filter
 * and never print. Grouping reuses the board's own Active→Completed→Failed
 * derivation; descriptions render expanded (no Show-more on paper).
 */
export default function QuestBoardHandout({ quests }) {
  const printable = (quests || []).filter(q => q && q.draft !== true).map(q => ({
    id: q.id,
    name: q.name,
    status: q.status,
    description: q.description,
    rewards: q.rewards,
  }));
  const groups = groupQuestsForBoard(printable);

  if (groups.length === 0) {
    return <p className="handout-empty">No player-facing quests to print.</p>;
  }

  return (
    <div className="handout-quest-board">
      <h2 className="handout-name">Quest Board</h2>
      <hr className="handout-rulebreak" />
      {groups.map(group => (
        <section key={group.status} className={`handout-quest-group handout-quest-group--${group.status}`}>
          <h3 className="handout-section-title">
            {group.label} <span className="handout-quest-count">({group.quests.length})</span>
          </h3>
          {group.quests.map(quest => (
            <article key={quest.id || quest.name} className="handout-quest">
              <header className="handout-quest-header">
                <h4 className="handout-quest-name">{quest.name}</h4>
                <QuestStatusPill status={quest.status} />
              </header>
              {(quest.description || '').trim() && (
                <MarkdownPreview className="handout-md" text={quest.description} />
              )}
              {(quest.rewards || '').trim() && (
                <div className="handout-quest-rewards">
                  <h5 className="handout-quest-rewards-title">Rewards</h5>
                  <MarkdownPreview className="handout-md" text={quest.rewards} />
                </div>
              )}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
