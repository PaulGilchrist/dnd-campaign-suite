export function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const ROLL_ICON_TYPES = {
  attack: 'fa-crosshairs',
  spell_attack: 'fa-wand-magic-sparkles',
  save: 'fa-shield-halved',
  'condition-save': 'fa-shield-halved',
  'save-ottos-dance': 'fa-shield-halved',
  'save-damage': 'fa-shield-halved',
  'save-banishment': 'fa-shield-halved',
  'save-polymorph': 'fa-paw',
  'save-animal-shapes': 'fa-paw',
  'save-prismatic-spray': 'fa-wand-magic-sparkles',
  'save-prismatic-spray-indigo': 'fa-eye',
  'save-prismatic-spray-violet': 'fa-door-open',
  'save-imprisonment': 'fa-shield-halved',
  'save-confusion': 'fa-shield-halved',
  'save-forcecage': 'fa-shield-halved',
  'save-forcecage-escape': 'fa-shield-halved',
  'save-maze': 'fa-shield-halved',
  'save-maze-escape': 'fa-shield-halved',
  'aoe-damage': 'fa-wand-magic-sparkles',
  initiative: 'fa-bolt',
  damage: 'fa-skull'
};

export function getRollIconType(rollType) {
  return ROLL_ICON_TYPES[rollType] || 'fa-dice-d20';
}
