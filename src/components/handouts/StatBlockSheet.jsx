import MarkdownPreview from '../common/MarkdownPreview.jsx';

/**
 * The shared 5e stat-block face used by the printed Monster and NPC cards
 * (backlog Item 4). Pure presentation, assembled by thin adapters
 * (MonsterStatCard / NpcStatCard) from their own data models — one layout,
 * no duplication. Action descriptions flow through the ONE markdown sink
 * (MarkdownPreview: marked + DOMPurify), never a second renderer.
 */
export default function StatBlockSheet({ name, subtitle, rules, abilities, sections }) {
  return (
    <div className="handout-statblock">
      <h2 className="handout-name">{name}</h2>
      {subtitle && <p className="handout-meta">{subtitle}</p>}
      <hr className="handout-rulebreak" />

      {(rules || []).map(rule => (
        <p key={rule.lead} className="handout-rule">
          <span className="handout-rule-lead">{rule.lead}&nbsp;</span>{rule.value}
        </p>
      ))}

      {abilities && abilities.length > 0 && (
        <div className="handout-abilities">
          {abilities.map(cell => (
            <div key={cell.label} className="handout-ability">
              <div className="handout-ability-label">{cell.label}</div>
              <div className="handout-ability-score">{cell.score}</div>
              <div className="handout-ability-mod">{cell.mod}</div>
            </div>
          ))}
        </div>
      )}

      {(sections || []).map(section => (
        (section.items || []).length > 0 && (
          <div key={section.title} className="handout-section">
            {section.title && <h3 className="handout-section-title">{section.title}</h3>}
            {section.items.map((item, i) => (
              <div key={`${section.title}-${item.name || i}`} className="handout-action">
                {item.name && <strong>{item.name}. </strong>}
                <MarkdownPreview className="handout-action-text" text={item.description || ''} />
              </div>
            ))}
          </div>
        )
      ))}
    </div>
  );
}
