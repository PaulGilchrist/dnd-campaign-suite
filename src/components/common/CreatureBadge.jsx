import './CreatureBadge.css'

function CreatureBadge({ icon, label, cls, tooltip, ariaLabel, removable, onRemove, onClick, disabled }) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <div className='creature-badge-wrapper'>
      <Tag
        className={`creature-badge ${cls || ''}`}
        title={tooltip || (typeof label === 'string' ? label : '')}
        // Optional accessible name for badges whose `title` carries load-bearing
        // copy (title is invisible on touch + unreliable for screen readers).
        // Omitted (undefined) on every existing consumer — DOM bytes unchanged.
        aria-label={ariaLabel}
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
