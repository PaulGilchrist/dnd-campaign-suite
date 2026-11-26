import { useState, useEffect, useCallback } from 'react';
import { loadQuestBoard } from '../../services/campaign/questsService.js';
import { loadFactionStandings } from '../../services/campaign/factionsService.js';
import Subscriber from '../common/Subscriber.jsx';
import FactionStandingStrip from './FactionStandingStrip.jsx';
import QuestBoardCard from './QuestBoardCard.jsx';
import HandoutPreview from '../handouts/HandoutPreview.jsx';
import QuestBoardHandout from '../handouts/QuestBoardHandout.jsx';
import { groupQuestsForBoard } from './questBoardData.js';
import './QuestBoard.css';

/**
 * Player quest board — read-only progress theatre over the shared table.
 * Reads ONLY the field-whitelisted server lanes (/quests/board,
 * /factions/standings) through the campaign services; writes nothing, stores
 * nothing (expansion state is per-client display state). Live updates ride
 * the ONE shared SSE connection via <Subscriber>: quests-list-* re-fetches
 * the board rows (a GM flipping a quest to Completed re-groups here without
 * reload), factions-list-* re-fetches standings.
 */
function QuestBoard({ campaignName }) {
  const [quests, setQuests] = useState([]);
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [questsError, setQuestsError] = useState(null);
  const [standingsError, setStandingsError] = useState(null);

  const loadQuestRows = useCallback(async () => {
    try {
      setQuests(await loadQuestBoard(campaignName));
      setQuestsError(null);
    } catch (error) {
      console.error('Quest board load failed:', error);
      setQuestsError(error.message || 'Failed to load quests');
    }
  }, [campaignName]);

  const loadStandingRows = useCallback(async () => {
    try {
      setStandings(await loadFactionStandings(campaignName));
      setStandingsError(null);
    } catch (error) {
      console.error('Faction standings load failed:', error);
      setStandingsError(error.message || 'Failed to load faction standings');
    }
  }, [campaignName]);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([loadQuestRows(), loadStandingRows()])
      .finally(() => setLoading(false));
  }, [loadQuestRows, loadStandingRows]);

  // SSE list broadcasts mirror the GM planner lanes (server/routes/quests.js
  // and factions.js): refresh ONLY the lane that changed — status flips
  // re-group live, standing moves repaint live.
  const handleSSEEvent = useCallback((event) => {
    if (!event) return;
    if (event.key === `quests-list-${campaignName}`) {
      loadQuestRows();
    } else if (event.key === `factions-list-${campaignName}`) {
      loadStandingRows();
    }
  }, [campaignName, loadQuestRows, loadStandingRows]);

  const groups = groupQuestsForBoard(quests);
  // Item 4: the board's rows arrive field-whitelisted from /quests/board,
  // so what the GM flipped to Completed and what the players see on paper
  // are the same server-filtered rows — notes cannot be in this state.
  const [printBoardOpen, setPrintBoardOpen] = useState(false);

  return (
    <div className="ct-container quest-board">
      <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />

      <div className="ct-header">
        <h2 className="ct-title">
          <i className="fa-solid fa-scroll" /> Quest Board
        </h2>
        {/* Item 4 handout (F12: labeled). Nothing on the board yet → honest
            disabled face naming the cause. */}
        <button
          className="ct-btn quest-board-print-btn"
          onClick={() => setPrintBoardOpen(true)}
          disabled={loading || groups.length === 0}
          title={loading
            ? 'Loading the quest board…'
            : groups.length === 0
              ? 'No quests on the board to print yet'
              : 'Print the quest board as a one-pager'}
        >
          <i className="fa-solid fa-print" /> Print Quest Board
        </button>
      </div>

      <FactionStandingStrip factions={standings} error={standingsError} />

      {loading && (
        <div className="ct-empty-state">
          <i className="fa-solid fa-spinner fa-spin" /> Loading the quest board…
        </div>
      )}

      {!loading && questsError && (
        <div className="quest-board-error" role="alert">
          <i className="fa-solid fa-triangle-exclamation" /> {questsError}
        </div>
      )}

      {!loading && !questsError && groups.length === 0 && (
        <div className="ct-empty-state">
          <i className="fa-solid fa-scroll" /> No quests on the board yet.
        </div>
      )}

      {!loading && !questsError && groups.map(group => (
        <section
          key={group.status}
          className={`quest-board-group quest-board-group--${group.status}`}
          aria-label={`${group.label} quests`}
        >
          <h3 className="quest-board-group-title">
            {group.label}
            <span className="quest-board-group-count">{group.quests.length}</span>
          </h3>
          <div className="quest-board-cards">
            {group.quests.map(quest => (
              <QuestBoardCard key={quest.id} quest={quest} />
            ))}
          </div>
        </section>
      ))}

      {printBoardOpen && (
        <HandoutPreview
          label="Quest Board"
          campaignName={campaignName}
          onClose={() => setPrintBoardOpen(false)}
        >
          <QuestBoardHandout quests={quests} />
        </HandoutPreview>
      )}
    </div>
  );
}

export default QuestBoard;
