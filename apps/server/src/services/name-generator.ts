const adjectives = [
  "Sparkly", "Toasty", "Fizzy", "Crispy", "Zesty",
  "Tangy", "Fluffy", "Crunchy", "Sizzling", "Breezy",
  "Snappy", "Peppy", "Jolly", "Quirky", "Jazzy",
  "Perky", "Zippy", "Whimsy", "Spicy", "Mellow",
  "Bouncy", "Cozy", "Dreamy", "Lively", "Swift",
  "Tiny", "Wispy", "Bold", "Rustic", "Golden",
];

const foods = [
  "Mango", "Pretzel", "Waffle", "Dumpling", "Taco",
  "Croissant", "Burrito", "Pancake", "Noodle", "Cupcake",
  "Biscuit", "Muffin", "Scone", "Truffle", "Macaron",
  "Brioche", "Strudel", "Parfait", "Sorbet", "Gelato",
  "Tempura", "Falafel", "Gnocchi", "Ramen", "Churro",
  "Baklava", "Ceviche", "Kimchi", "Poutine", "Cannoli",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomName(): string {
  return `${pick(adjectives)} ${pick(foods)}`;
}
