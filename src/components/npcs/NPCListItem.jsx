import { npcHasStatBlock, npcHasAttacks } from '../../services/encounters/npcStatBlockUtils.js';
import { getAttitudeStyle } from '../../services/npcs/npcFormUtils.js';
import AvatarImage from '../common/AvatarImage.jsx';
import DraftFlag from '../common/DraftFlag.jsx';

function NPCListItem({ npc, campaignName, onEdit, onAddToInitiative }) {
  const hasStats = npcHasStatBlock(npc);
  const hasAttacks = npcHasAttacks(npc);
  const initButtonLabel = hasStats
    ? `Add ${npc.name} to Initiative`
    : `Fill in ${npc.name}'s AC and HP (Stats tab) before adding to Initiative`;
  return (
    <li
      className="ct-list-item"
      onClick={() => onEdit(npc)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onEdit(npc);
        }
      }}
      aria-label={`Edit NPC: ${npc.name}`}
    >
      <div className="ct-list-item-header npcs-list-header">
        <div className="npcs-list-name-row">
          {npc.imagePath && (
            <AvatarImage name={npc.name} imagePath={npc.imagePath} campaignName={campaignName} size={36} />
          )}
          <span className="ct-list-name">{npc.name}</span>
          <DraftFlag row={npc} />
        </div>
        <div className="ct-list-meta">
          {npcHasStatBlock(npc) && (
            <span className="npcs-stat-badge" title="Has stat block">
              <i className="fa-solid fa-shield" />
            </span>
          )}
          {npc.attitude && (
            <span
              className="ct-list-attitude npcs-list-attitude"
              style={getAttitudeStyle(npc.attitude)}
              title={npc.attitude}
            >
              {npc.attitude}
            </span>
          )}
        </div>
      </div>
      <div className="ct-list-details">
        {(npc.race || npc.classRole) && (
          <span className="npcs-list-subtitle">
            {npc.race && <span>{npc.race}</span>}
            {npc.race && npc.classRole && <span className="npcs-list-separator"> / </span>}
            {npc.classRole && <span>{npc.classRole}</span>}
          </span>
        )}
        <div className="npcs-list-actions-row">
          {npc.tags && (
            <span className="npcs-list-tags">
              <i className="fa-solid fa-tags" /> {npc.tags}
            </span>
          )}
          {hasStats && !hasAttacks && (
            <span
              className="npcs-no-attack-badge"
              title="No weapon attacks — this NPC would enter combat with only an Unarmed Strike"
            >
              <i className="fa-solid fa-hand-fist" /> No attacks
            </span>
          )}
          <button
            className="npcs-init-btn"
            disabled={!hasStats}
            onClick={(e) => {
              e.stopPropagation();
              onAddToInitiative(npc);
            }}
            title={initButtonLabel}
            aria-label={initButtonLabel}
          >
            <i className="fa-solid fa-shield-alt" /> Add {npc.name} to Initiative
          </button>
        </div>
      </div>
    </li>
  );
}

export default NPCListItem;
