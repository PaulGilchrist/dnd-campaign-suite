import './CreatureBadge.css'

function CreatureBadge({ icon, label, cls, tooltip, removable, onRemove, onClick, disabled }) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <div className='creature-badge-wrapper'>
      <Tag
        className={`creature-badge ${cls || ''}`}
        title={tooltip || (typeof label === 'string' ? label : '')}
        onClick={onClick}
        disabled={disabled}
        type={onClick ? 'button' : undefined}
        data-testid='creature-badge'
      >
        {icon && <i className={`fa-solid ${icon}`}></i>}
        {' '}{label}
      </Tag>
      {removable && onRemove && (
        <button
          className='creature-badge-remove'
          onClick={onRemove}
          type='button'
          title='Remove effect'
        >
          <i className='fa-solid fa-xmark'></i>
        </button>
      )}
    </div>
  )
}

export default CreatureBadge
