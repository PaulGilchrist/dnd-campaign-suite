let nameCache = null;
let npcNameCache = null;
let descCache = null;
let shopNameCache = null;
let guildNameCache = null;
let rumorCache = null;

async function loadNameData() {
  if (nameCache) return nameCache;
  const response = await fetch('/data/settlement-names.json');
  nameCache = await response.json();
  return nameCache;
}

async function loadNpcNameData() {
  if (npcNameCache) return npcNameCache;
  const response = await fetch('/data/npc-names.json');
  npcNameCache = await response.json();
  return npcNameCache;
}

async function loadDescData() {
  if (descCache) return descCache;
  const response = await fetch('/data/settlement-descriptions.json');
  descCache = await response.json();
  return descCache;
}

async function loadShopNameData() {
  if (shopNameCache) return shopNameCache;
  const response = await fetch('/data/shop-names.json');
  shopNameCache = await response.json();
  return shopNameCache;
}

async function loadGuildNameData() {
  if (guildNameCache) return guildNameCache;
  const response = await fetch('/data/guild-names.json');
  guildNameCache = await response.json();
  return guildNameCache;
}

async function loadRumorData() {
  if (rumorCache) return rumorCache;
  const response = await fetch('/data/settlement-rumors.json');
  rumorCache = await response.json();
  return rumorCache;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const copy = [...arr];
  const result = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const SIZE_LABELS = ['village', 'town', 'city', 'metropolis'];

const POPULATION_RANGES = {
  village: ['50-100 souls', '100-200 souls', '200-400 souls', '400-800 souls'],
  town: ['800-1,500 souls', '1,500-3,000 souls', '3,000-5,000 souls'],
  city: ['5,000-12,000 souls', '12,000-25,000 souls', '25,000-50,000 souls'],
  metropolis: ['50,000-100,000 souls', '100,000-250,000 souls', '250,000+ souls'],
};

const SERVICE_TYPES_BY_SIZE = {
  village: { min: 1, max: 3, types: ['inn', 'blacksmith', 'general_store', 'temple'] },
  town: { min: 3, max: 5, types: ['inn', 'tavern', 'blacksmith', 'general_store', 'temple', 'alchemist', 'tailor'] },
  city: { min: 5, max: 8, types: ['inn', 'tavern', 'blacksmith', 'general_store', 'magic_shop', 'temple', 'guild', 'alchemist', 'bakery', 'butcher', 'tailor', 'stable'] },
  metropolis: { min: 8, max: 12, types: ['inn', 'tavern', 'blacksmith', 'general_store', 'magic_shop', 'temple', 'guild', 'alchemist', 'bakery', 'butcher', 'tailor', 'stable', 'bank'] },
};

const GUILD_TYPE_MAP = {
  guild: ['thieves', 'mages', 'merchants', 'fighters', 'assassins', 'bards', 'rangers', 'smugglers'],
};

const SERVICE_TYPE_LABELS = {
  inn: 'Inn',
  tavern: 'Tavern',
  blacksmith: 'Blacksmith',
  general_store: 'General Store',
  magic_shop: 'Magic Shop',
  temple: 'Temple',
  guild: 'Guild',
  alchemist: 'Alchemist',
  bakery: 'Bakery',
  butcher: 'Butcher',
  tailor: 'Tailor',
  stable: 'Stable',
  bank: 'Bank',
};

const SERVICE_DESCRIPTIONS = {
  inn: [
    'A quiet inn with clean rooms and a warm hearth. The rooms are modest but well-kept.',
    'A bustling inn catering to merchants and travelers. Aromatic stews simmer in the common room.',
    'A cozy roadside inn offering simple rooms and a lively common area. Local musicians play on weekends.',
    'A sturdy stone inn at the crossroads. Rooms are sparse but the beds are soft and the ale is good.',
    'An old inn with creaky floorboards. Despite its age, it\'s known for excellent meals and safe shelter.',
    'A newly built inn, the best in the area. Rooms feature real beds and privacy screens.',
    'A converted manor house now serving as an inn. The interior is surprisingly elegant.',
    'A modest boarding house attached to a stable. Popular with traders and caravan guards.',
    'A well-appointed inn with a reputation for attracting interesting guests. Every room has a story.',
    'An inn famous for its continental cuisine. The rooms above are basic but comfortable.',
  ],
  tavern: [
    'A rowdy tavern where locals gather after dark. The ale is cheap and the conversations are loud.',
    'A refined tavern catering to wealthy patrons. Crystal glasses and aged spirits line the shelves.',
    'A sailors\' tavern near the docks. Nautical charts and fishing nets decorate the walls.',
    'A quiet tavern tucked into a corner. A favorite spot for private conversations.',
    'A lively tavern with entertainment nightly. Minstrels, storytellers, and the occasional brawler.',
    'A tavern known for its exotic imports from distant lands. The drink menu is unusual and enticing.',
    'A burned-out tavern recently rebuilt. The new owner keeps a close eye on troublemakers.',
    'A basement tavern lit by flickering lanterns. The entrance is easy to miss unless you know where to look.',
    'A tavern run by a retired adventurer. Trophy heads and old swords decorate the walls.',
    'A tavern famous for its house ale, brewed locally. The secret recipe is closely guarded.',
  ],
  blacksmith: [
    'The smithy echoes with the ring of hammer on anvil. Quality ironwork at fair prices.',
    'A master blacksmith runs this forge, producing both tools and decorative ironwork.',
    'A small but busy smithy serving the local farming community. Repairs and tools are their specialty.',
    'A grand smithy with multiple forges. Specializes in fine steel and custom orders.',
    'A dwarven blacksmith operates this forge. Their metalwork is renowned for its durability.',
    'A no-nonsense smithy that closes promptly at sundown. Known for quick, reliable repairs.',
    'A smithy that doubles as a weapons dealer. A selection of common arms for sale.',
    'An amateur blacksmith still learning the trade. Prices are low but the work is rough.',
  ],
  general_store: [
    'A well-stocked general store carrying everything from rope to rations at reasonable prices.',
    'The only shop of its kind for miles. The owner marks up prices for the convenience.',
    'A surprisingly well-stocked store run by a trader who makes frequent supply runs.',
    'A cluttered shop where you can find almost anything if you\'re willing to search.',
    'A small general store next to the market square. Basic adventuring supplies are always in stock.',
    'A family-run general store that has served the community for three generations.',
    'A new general store struggling to compete with a larger supplier across town.',
  ],
  magic_shop: [
    'A dusty shop filled with scrolls, potions, and strange artifacts. The shopkeeper is eccentric but knowledgeable.',
    'A well-appointed mystic emporium. Enchanted items glow softly in glass cases.',
    'A cramped shop run by a hedge wizard. Potions bubble in strange colors behind the counter.',
    'An exclusive magic shop requiring an appointment. Only the serious buyer need apply.',
    'A front for magical research. The owner is more interested in acquiring rare components than selling.',
    'A shop specializing in divination services and warded items. Prices are steep but quality is guaranteed.',
    'A hidden magic shop, accessible only through an unmarked door in an alley.',
  ],
  temple: [
    'A small temple to the local patron deity. An acolyte offers blessings for a modest donation.',
    'A grand temple with stained glass and marble columns. A high priest oversees services.',
    'A humble shrine tended by a single devout cleric. Healing is offered freely to those in need.',
    'A temple that welcomes all faiths. A peaceful space for meditation and prayer.',
    'An ancient temple built on a site of power. Strange energies are said to linger in the walls.',
    'A converted chapel now serving as a temple. The congregation is small but devoted.',
    'A controversial temple whose teachings draw both followers and critics.',
  ],
  guild: [
    'A bustling guild hall where members gather to share contracts and rumors.',
    'A discreet guild office tucked behind an unassuming door. Serious inquiries only.',
    'A grand guild hall reflecting the wealth and influence of its members.',
    'A modest guild outpost, the only chapter in the region.',
    'A guild hall that doubles as a social club. Fine drinks and finer conversation.',
  ],
  alchemist: [
    'A cramped laboratory filled with bubbling flasks. The alchemist is brilliant but slightly mad.',
    'A well-organized alchemy shop with potions clearly labeled and priced.',
    'A rooftop laboratory where the alchemist conducts experiments day and night.',
    'A struggling alchemist studying in a back room shop. Promising results but limited supplies.',
    'A renowned alchemist whose potions are sought across the region.',
  ],
  bakery: [
    'A fragrant bakery that opens before dawn. Fresh bread is the house specialty.',
    'A small bakery run by a cheerful halfling. Pastries are the finest in the area.',
    'A baker\'s shop that serves as an informal gathering place for morning gossip.',
  ],
  butcher: [
    'A clean butcher shop with a rotating selection of fresh meats at fair prices.',
    'The local butcher also sells leather and bones for craft projects.',
  ],
  tailor: [
    'A skilled tailor who can create or repair garments in any style.',
    'A small clothing shop with ready-made items in common sizes.',
    'A high-end tailor catering to the wealthy with custom fittings.',
  ],
  stable: [
    'A large stable with clean stalls. Horses can be purchased, rented, or boarded.',
    'A modest stable with a few reliable mounts available for reasonable rates.',
    'A breeding stable known for quality warhorses. Premium prices for premium stock.',
  ],
  bank: [
    'A secure counting house that offers loans, currency exchange, and safe deposit vaults.',
    'A merchant bank operated by a consortium of Trade Prince families.',
    'The only bank in the region. Takes a percentage on all deposits but is considered trustworthy.',
  ],
};

const SIZE_CULTURE_MAP = {
  village: ['Human', 'Dwarven', 'Elven'],
  town: ['Human', 'Mixed', 'Dwarven'],
  city: ['Mixed', 'Human', 'Elven'],
  metropolis: ['Mixed', 'Human', 'Nomadic'],
};

export async function generateSettlement(existingSettlements = [], options = {}) {
  const [names, npcNames, descs, shopNames, guildNames, rumors] = await Promise.all([
    loadNameData(), loadNpcNameData(), loadDescData(), loadShopNameData(), loadGuildNameData(), loadRumorData(),
  ]);

  const size = options.size || pick(SIZE_LABELS);
  const culture = pick(SIZE_CULTURE_MAP[size]);

  let name = '';
  const cultureNames = names[culture];
  if (cultureNames && cultureNames[size] && cultureNames[size].length > 0) {
    name = pick(cultureNames[size]);
  } else {
    const fallback = names['Human'];
    name = pick(fallback[size] || fallback['town'] || []);
  }

  let uniqueName = name;
  let counter = 2;
  const existingNames = existingSettlements.map(s => s.name);
  while (existingNames.includes(uniqueName)) {
    uniqueName = `${name} ${counter}`;
    counter++;
  }

  const sizeDescs = descs[size] || descs.town;
  const description = pick(sizeDescs.descriptions || []);
  const atmosphere = pick(sizeDescs.atmospheres || []);
  const government = pick(sizeDescs.governments || '');
  const population = pick(POPULATION_RANGES[size]);

  const featureCount = randomInt(2, 4);
  const features = pickN(sizeDescs.features || [], featureCount);
  const threat = pick(sizeDescs.threats || []);

  const serviceConfig = SERVICE_TYPES_BY_SIZE[size];
  const serviceCount = randomInt(serviceConfig.min, serviceConfig.max);
  const serviceTypes = pickN(serviceConfig.types, serviceCount);

  const services = [];
  const notableNPCs = [];
  const usedShopNames = new Set();

  for (const svcType of serviceTypes) {
    let svcName = '';
    const typeNames = shopNames[svcType];
    if (typeNames && typeNames.length > 0) {
      const available = typeNames.filter(n => !usedShopNames.has(n));
      svcName = pick(available.length > 0 ? available : typeNames);
      usedShopNames.add(svcName);
    } else {
      svcName = serviceConfig.types.includes(svcType) ? `The ${SERVICE_TYPE_LABELS[svcType]}` : `Local ${SERVICE_TYPE_LABELS[svcType]}`;
    }

    const svcDesc = pick(SERVICE_DESCRIPTIONS[svcType] || ['A local establishment.']);

    const npcTypes = SERVICE_NPC_TYPES[svcType] || ['shopkeeper'];
    const npcRole = pick(npcTypes);

    const npcRace = pick(['Human', 'Elf', 'Dwarf', 'Halfling', 'Half-Elf', 'Half-Orc']);
    const npcGender = Math.random() > 0.5 ? 'male' : 'female';
    const npcNamePool = npcNames[npcRace] || npcNames['Human'];
    const npcFirstName = pick(npcNamePool[npcGender] || npcNamePool['male'] || []);

    const fullNpcName = `${npcFirstName}`;
    const npcNameUsed = new Set([...existingNames, ...notableNPCs.map(n => n.name)]);
    let uniqueNpcName = fullNpcName;
    let npcCounter = 2;
    while (npcNameUsed.has(uniqueNpcName)) {
      uniqueNpcName = `${fullNpcName} ${npcCounter}`;
      npcCounter++;
    }

    notableNPCs.push({
      name: uniqueNpcName,
      role: npcRole,
      description: `The ${npcRole} of ${svcName}. ${pick(SERVICE_NPC_DESCRIPTORS)}`,
    });

    let guildTypeName = '';
    if (svcType === 'guild') {
      const guildCategory = pick(GUILD_TYPE_MAP.guild);
      guildTypeName = pick(guildNames[guildCategory] || guildNames.merchants);
    }

    services.push({
      type: svcType,
      name: svcType === 'guild' && guildTypeName ? guildTypeName : svcName,
      description: svcDesc,
    });
  }

  const rumorCount = randomInt(1, 3);
  const allRumors = [
    ...(rumors.general || []),
    ...(rumors.quest_hooks || []),
    ...(rumors.faction_intrigue || []),
    ...(rumors.supernatural || []),
    ...(rumors.trade_economy || []),
  ];
  const selectedRumors = pickN(allRumors, rumorCount);

  const tags = [size, culture.toLowerCase() + '-culture'];
  if (services.length > 0) tags.push(services[0].type);
  if (services.length > 3) tags.push('many-services');

  return {
    name: uniqueName,
    size,
    description: `${description} ${features.map(f => f).join(' ')}`,
    atmosphere,
    government,
    population,
    services,
    notableNPCs,
    rumors: selectedRumors,
    tags: tags.join(', '),
    notes: '',
    threat: threat || '',
  };
}

const SERVICE_NPC_TYPES = {
  inn: ['Innkeeper', 'Barkeep', 'Host'],
  tavern: ['Tavern Owner', 'Barkeep', 'Publican'],
  blacksmith: ['Blacksmith', 'Smith', 'Forge-master'],
  general_store: ['Shopkeeper', 'Merchant', 'Proprietor'],
  magic_shop: ['Mage', 'Hedge Wizard', 'Occultist', 'Warlock'],
  temple: ['Priest', 'Acolyte', 'High Priest', 'Cleric'],
  guild: ['Guildmaster', 'Secretary', 'Seneschal', 'Lieutenant'],
  alchemist: ['Alchemist', 'Potion Brewer', 'Herbalist'],
  baker: ['Baker'],
  butcher: ['Butcher'],
  tailor: ['Tailor', 'Clothier', 'Seamstress'],
  stable: ['Stable Master', 'Groom', 'Hostler'],
  bank: ['Banker', 'Moneychanger', 'Factor'],
};

const SERVICE_NPC_DESCRIPTORS = [
  'Known for fair dealing and a dry sense of humor.',
  'Quiet and observant, seems to know everything happening in town.',
  'Talkative and friendly, eager to share local gossip.',
  'Gruff and business-like, but trustworthy.',
  'Warm and welcoming, treats every guest like family.',
  'Suspicious of outsiders but can be won over with coin or charm.',
  'Eccentric but knowledgeable, prone to rambling stories.',
  'Young and ambitious, looking to make a name.',
  'Old and weathered, has seen many things in their time.',
  'Cheerful and optimistic, regardless of circumstances.',
  'Secretive and private, reluctant to share information.',
  'Generous beyond their means, often gives credit to regulars.',
  'Sharp-eyed and calculating, always looking for an angle.',
  'Friendly but forgetful, writing everything down in a ledger.',
  'Hardworking and tired, but always has time for a conversation.',
];
