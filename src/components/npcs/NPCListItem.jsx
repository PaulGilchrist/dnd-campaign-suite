import { npcHasStatBlock } from '../../services/encounters/npcStatBlockUtils.js';
import { getAttitudeStyle } from '../../services/npcs/npcFormUtils.js';
import AvatarImage from '../common/AvatarImage.jsx';

function NPCListItem({ npc, onEdit, onAddToInitiative }) {
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
            <AvatarImage name={npc.name} imagePath={npc.imagePath} size={36} />
          )}
          <span className="ct-list-name">{npc.name}</span>
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
          {npcHasStatBlock(npc) && (
            <button
              className="npcs-init-btn"
              onClick={(e) => {
                e.stopPropagation();
                onAddToInitiative(npc);
              }}
              title="Add to Initiative"
            >
              <i className="fa-solid fa-shield-alt" /> Add to Initiative
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default NPCListItem;
