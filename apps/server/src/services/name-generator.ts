export function generateRandomName(): string {
  const adjectives = [
    'Sizzling',
    'Velvet',
    'Fuzzy',
    'Mighty',
    'Crispy',
    'Bright',
    'Quiet',
    'Lucky',
    'Swift',
    'Brisk',
  ];

  const nouns = [
    'Truffle',
    'Comet',
    'Breeze',
    'Canyon',
    'Lantern',
    'Orchid',
    'Atlas',
    'Meadow',
    'Orbit',
    'Dune',
  ];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adjective} ${noun}`;
}
