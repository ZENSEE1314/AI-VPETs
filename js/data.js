// Static data: pet species, items, monsters, recipes, crops.
window.DATA = (function () {
  const SPECIES = {
    flame_pup: { name: "Flame Pup",  emoji: "🔥🐶", color: "#ff8a4a", element: "fire",  base: { hp: 24, atk: 6, def: 3, spd: 5 } },
    leaf_kit:  { name: "Leaf Kit",   emoji: "🌿🦊", color: "#7cd17c", element: "leaf",  base: { hp: 26, atk: 5, def: 4, spd: 5 } },
    aqua_otter:{ name: "Aqua Otter", emoji: "💧🦦", color: "#6ab9ff", element: "water", base: { hp: 28, atk: 4, def: 5, spd: 4 } },
    spark_bat: { name: "Spark Bat",  emoji: "⚡🦇", color: "#ffd76a", element: "spark", base: { hp: 20, atk: 7, def: 2, spd: 7 } },
  };

  // Elemental matchups: attacker -> defender -> multiplier.
  const ELEMENT = {
    fire:  { leaf: 1.5, water: 0.7, spark: 1.0, fire: 1.0, none: 1.0 },
    leaf:  { water: 1.5, fire: 0.7, spark: 1.0, leaf: 1.0, none: 1.0 },
    water: { fire: 1.5, spark: 0.7, leaf: 1.0, water: 1.0, none: 1.0 },
    spark: { water: 1.5, leaf: 0.7, fire: 1.0, spark: 1.0, none: 1.0 },
    none:  { fire: 1.0, leaf: 1.0, water: 1.0, spark: 1.0, none: 1.0 },
  };

  // Items: kind = food | seed | crop | material | weapon | tool
  const ITEMS = {
    // Foods
    berry:    { name: "Berry",       emoji: "🫐", kind: "food", price: 6,  effect: { hunger: 18, happy: 4 } },
    bread:    { name: "Bread",       emoji: "🍞", kind: "food", price: 12, effect: { hunger: 35, happy: 2 } },
    fish:     { name: "Fish",        emoji: "🐟", kind: "food", price: 18, effect: { hunger: 45, happy: 8 } },
    cake:     { name: "Cake",        emoji: "🍰", kind: "food", price: 30, effect: { hunger: 25, happy: 30 } },
    // Seeds
    seed_berry:  { name: "Berry Seed",  emoji: "🌱", kind: "seed", price: 4,  growsTo: "berry",  growHours: 6  },
    seed_wheat:  { name: "Wheat Seed",  emoji: "🌾", kind: "seed", price: 7,  growsTo: "wheat",  growHours: 10 },
    seed_carrot: { name: "Carrot Seed", emoji: "🥕", kind: "seed", price: 10, growsTo: "carrot", growHours: 14 },
    // Crops (harvested raw — sellable or cookable)
    wheat:    { name: "Wheat",  emoji: "🌾", kind: "crop", price: 14, cooksTo: "bread" },
    carrot:   { name: "Carrot", emoji: "🥕", kind: "crop", price: 22, effect: { hunger: 30, happy: 6 } },
    // Materials (from combat drops)
    fang:     { name: "Fang",   emoji: "🦷", kind: "material", price: 14 },
    hide:     { name: "Hide",   emoji: "🟫", kind: "material", price: 10 },
    iron:     { name: "Iron",   emoji: "⛓️", kind: "material", price: 20 },
    crystal:  { name: "Crystal",emoji: "🔮", kind: "material", price: 35 },
    // Weapons (forged) — equip to pet for atk/def bonus
    claw_glove:  { name: "Claw Glove",  emoji: "🥊", kind: "weapon", price: 80,  bonus: { atk: 3, def: 0 } },
    bone_armor:  { name: "Bone Armor",  emoji: "🛡️", kind: "weapon", price: 90,  bonus: { atk: 0, def: 4 } },
    iron_blade:  { name: "Iron Blade",  emoji: "⚔️", kind: "weapon", price: 160, bonus: { atk: 6, def: 1 } },
    crystal_charm:{name: "Crystal Charm",emoji:"✨", kind: "weapon", price: 240, bonus: { atk: 4, def: 4 } },
    // Tools
    soap:     { name: "Soap",       emoji: "🧼", kind: "tool",  price: 8 },
    ball:     { name: "Catch Ball", emoji: "🔴", kind: "ball",  price: 25 },
    superball:{ name: "Super Ball", emoji: "🟣", kind: "ball",  price: 80 },
  };

  // Costumes — cosmetic; player avatar emoji becomes the monster's emoji.
  const COSTUMES = {
    cs_slime:    { name: "Slime Suit",    emoji: "🟢", price: 60,  baseSpecies: "slime"   },
    cs_rat:      { name: "Rat Hood",      emoji: "🐀", price: 80,  baseSpecies: "rat"     },
    cs_spark:    { name: "Spark Cloak",   emoji: "⚡", price: 140, baseSpecies: "spark"   },
    cs_mole:     { name: "Mole Helm",     emoji: "⛏️", price: 180, baseSpecies: "molefolk"},
    cs_wisp:     { name: "Wisp Robe",     emoji: "👻", price: 260, baseSpecies: "wisp"    },
    cs_warden:   { name: "Warden Mask",   emoji: "🦌", price: 360, baseSpecies: "warden"  },
  };

  // Forge recipes: output -> ingredients map.
  const RECIPES = {
    claw_glove:    { fang: 2, hide: 1 },
    bone_armor:    { hide: 3, fang: 1 },
    iron_blade:    { iron: 3, fang: 1 },
    crystal_charm: { crystal: 2, iron: 1 },
    bread:         { wheat: 2 },     // cookable at home
  };

  // Wild monsters in Wilds zone.
  const MONSTERS = [
    { id: "slime",   name: "Slime",   emoji: "🟢", element: "leaf",  level: 1, hp: 16, atk: 4, def: 2, exp: 8,  gold: 4,  drops: { hide: 0.6, fang: 0.2 } },
    { id: "rat",     name: "Cave Rat",emoji: "🐀", element: "none",  level: 2, hp: 22, atk: 6, def: 2, exp: 14, gold: 7,  drops: { hide: 0.5, fang: 0.4 } },
    { id: "spark",   name: "Sparkling",emoji:"⚡", element: "spark", level: 3, hp: 28, atk: 8, def: 3, exp: 22, gold: 11, drops: { fang: 0.3, iron: 0.3 } },
    { id: "molefolk",name: "Molefolk",emoji: "⛏️", element: "none",  level: 4, hp: 38, atk: 9, def: 5, exp: 32, gold: 16, drops: { iron: 0.6, hide: 0.3 } },
    { id: "wisp",    name: "Wisp",    emoji: "👻", element: "spark", level: 5, hp: 44, atk: 12,def: 4, exp: 48, gold: 22, drops: { crystal: 0.45, iron: 0.4 } },
    { id: "warden",  name: "Warden",  emoji: "🦌", element: "leaf",  level: 6, hp: 60, atk: 14,def: 7, exp: 70, gold: 32, drops: { crystal: 0.6, hide: 0.5, fang: 0.4 } },
  ];

  // NPC "players" you can meet on the map.
  const NPCS = [
    { id: "mira",   name: "Mira",   emoji: "👩‍🌾", line: "Berries grow fast in the meadow!", trade: { sells: ["berry", "seed_berry"], priceMul: 0.85 } },
    { id: "kobo",   name: "Kobo",   emoji: "🧑‍🍳", line: "Trade you crops for cash!",       trade: { buys: ["wheat", "carrot", "berry"], priceMul: 1.15 } },
    { id: "rizen",  name: "Rizen",  emoji: "🧙",   line: "Crystals fetch a fine price.",     trade: { buys: ["crystal", "iron"], priceMul: 1.20 } },
    { id: "tess",   name: "Tess",   emoji: "🧝",   line: "Want a rare seed? Carrots are mine.", trade: { sells: ["seed_carrot", "seed_wheat"], priceMul: 0.90 } },
  ];

  return { SPECIES, ELEMENT, ITEMS, RECIPES, MONSTERS, NPCS, COSTUMES };
})();
