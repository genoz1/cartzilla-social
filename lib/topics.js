// Static golf-cart topic catalog for article / buying-guide generation.
// Used when Shopify is paused or disabled so publishing no longer depends
// on live store inventory. Topics are general categories — writers must
// not invent product specs, prices, or hands-on testing claims.

const TOPICS = [
  {
    id: 'topic_batteries_chargers',
    title: 'Golf Cart Batteries & Chargers',
    sampleProductTitles: ['deep cycle battery', 'onboard charger', 'battery tender', 'watering system'],
    amazonSearch: 'golf cart battery charger',
  },
  {
    id: 'topic_jump_starters',
    title: 'Jump Starters & Portable Power',
    sampleProductTitles: ['portable jump starter', '12V booster pack', 'battery pack'],
    amazonSearch: 'portable jump starter',
  },
  {
    id: 'topic_tire_inflators',
    title: 'Tire Inflators & Air Compressors',
    sampleProductTitles: ['portable tire inflator', '12V air compressor', 'digital tire gauge'],
    amazonSearch: 'portable tire inflator 12v',
  },
  {
    id: 'topic_dash_cameras',
    title: 'Dash Cameras & Vehicle Electronics',
    sampleProductTitles: ['dash cam', 'GPS tracker', 'USB charger', 'voltage meter'],
    amazonSearch: 'dash camera',
  },
  {
    id: 'topic_cleaning_detailing',
    title: 'Golf Cart Cleaning & Detailing',
    sampleProductTitles: ['all-purpose cleaner', 'microfiber towels', 'wheel cleaner', 'protectant spray'],
    amazonSearch: 'car detailing kit',
  },
  {
    id: 'topic_mirrors_lights',
    title: 'Mirrors, Lights & Visibility',
    sampleProductTitles: ['side mirror', 'LED headlight', 'taillight kit', 'turn signal kit'],
    amazonSearch: 'golf cart led lights',
  },
  {
    id: 'topic_seats_covers',
    title: 'Seats, Covers & Interior Accessories',
    sampleProductTitles: ['seat cover', 'steering wheel cover', 'floor mat', 'storage basket'],
    amazonSearch: 'golf cart seat covers',
  },
  {
    id: 'topic_brakes',
    title: 'Brakes & Brake Parts',
    sampleProductTitles: ['brake pads', 'brake cable', 'brake shoes', 'brake fluid'],
    amazonSearch: 'golf cart brake pads',
  },
  {
    id: 'topic_tires_wheels',
    title: 'Tires, Wheels & Hubcaps',
    sampleProductTitles: ['golf cart tire', 'alloy wheel', 'hubcap', 'lug nuts'],
    amazonSearch: 'golf cart tires',
  },
  {
    id: 'topic_lift_kits',
    title: 'Lift Kits & Suspension',
    sampleProductTitles: ['lift kit', 'shock absorber', 'leaf spring', 'spindle'],
    amazonSearch: 'golf cart lift kit',
  },
  {
    id: 'topic_solenoids_controllers',
    title: 'Solenoids, Controllers & Electrical',
    sampleProductTitles: ['solenoid', 'motor controller', 'forward reverse switch', 'key switch'],
    amazonSearch: 'golf cart solenoid',
  },
  {
    id: 'topic_tools',
    title: 'Automotive & Golf Cart Tools',
    sampleProductTitles: ['torque wrench', 'multimeter', 'socket set', 'wire brush'],
    amazonSearch: 'automotive tool set',
  },
  {
    id: 'topic_windshields',
    title: 'Windshields & Weather Protection',
    sampleProductTitles: ['folding windshield', 'enclosure', 'rain cover', 'sun top'],
    amazonSearch: 'golf cart windshield',
  },
  {
    id: 'topic_horns_safety',
    title: 'Horns, Alarms & Safety Accessories',
    sampleProductTitles: ['horn kit', 'backup alarm', 'reflectors', 'safety flag'],
    amazonSearch: 'golf cart horn',
  },
];

function listTopics() {
  return TOPICS.map((t) => ({
    id: t.id,
    title: t.title,
    sampleProductTitles: t.sampleProductTitles,
    amazonSearch: t.amazonSearch,
    url: null,
    imageUrl: null,
    source: 'static_topics',
  }));
}

function topicById(id) {
  return listTopics().find((t) => t.id === id) || null;
}

module.exports = { TOPICS, listTopics, topicById };
