import { renderMarkdown } from '../../services/ui/sanitize.js';

function spellMetaTexts(spell) {
  const texts = [];
  if (spell.school) texts.push(`School: ${spell.school}`);
  if (spell.casting_time) texts.push(`Casting: ${spell.casting_time}`);
  if (spell.ritual) texts.push('Ritual');
  if (spell.concentration) texts.push('Concentration');
  if (spell.duration) texts.push(`Duration: ${spell.duration}`);
  if (spell.components) texts.push(`Components: ${spell.components.join(', ')}`);
  if (spell.damage && spell.damage.damage_type) texts.push(`Damage: ${spell.damage.damage_type}`);
  if (spell.material) texts.push(`Material: ${spell.material}`);
  return texts;
}

function SpellDetails({ spell, expanded, onToggle }) {
  if (!spell) return null;
  return (
    <div className={`mi-spell-details ${expanded ? 'expanded' : ''}`}>
      <button className="mi-spell-details-toggle" onClick={onToggle}>
        <i className={`fa-solid ${expanded ? 'fa-caret-down' : 'fa-caret-right'}`}></i>
        {spell.name} details
      </button>
      {expanded && (
        <div className="mi-spell-details-content">
          {spell.description && spell.description[0] && (
            <div className="mi-spell-desc" dangerouslySetInnerHTML={{ __html: renderMarkdown(spell.description[0]) }} />
          )}
          <div className="mi-spell-meta">
            {spellMetaTexts(spell).map(text => <span key={text}>{text}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default SpellDetails;
