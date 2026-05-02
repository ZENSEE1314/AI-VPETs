// Central game state + persistence.
window.State = (function () {
  const SAVE_KEY = "petworld.save.v2";

  const initial = () => ({
    gold: 50,
    day: 1,
    minutes: 8 * 60,
    tickAccum: 0,
    roster: [],            // array of pet objects (see pet.js)
    activePet: 0,          // index into roster
    inventory: { berry: 3, seed_berry: 2, ball: 2 },
    farm: Array.from({ length: 6 }, () => ({ seed: null, plantedAt: null, ready: false })),
    flags: { hiredOnce: false },
    log: [],
    costume: null,         // costume id (cosmetic for player avatar)
    ownedCostumes: [],     // ids
    dex: { seen: {}, caught: {} }, // monsterId -> true
    custom: { species: {}, monsters: {}, items: {}, costumes: {} }, // admin-added
    admin: false,
  });

  const state = initial();

  function reset() { Object.assign(state, initial()); }

  function getActivePet() { return state.roster[state.activePet] || null; }

  // Backwards-compat shim: legacy code reads State.state.pet
  Object.defineProperty(state, "pet", { get: getActivePet, enumerable: false, configurable: true });

  function save() {
    try {
      const copy = { ...state };
      delete copy.pet; // drop the getter
      localStorage.setItem(SAVE_KEY, JSON.stringify(copy));
      return true;
    } catch (e) { return false; }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const init = initial();
      Object.assign(state, init, data);
      // Re-apply getter (Object.assign drops it).
      Object.defineProperty(state, "pet", { get: getActivePet, enumerable: false, configurable: true });
      // Merge admin-added entries into runtime DATA so saved customs stay usable.
      mergeCustomsIntoData();
      return true;
    } catch (e) { return false; }
  }

  function clear() { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} }

  function mergeCustomsIntoData() {
    const c = state.custom || {};
    Object.assign(DATA.SPECIES, c.species || {});
    Object.assign(DATA.ITEMS, c.items || {});
    Object.assign(DATA.COSTUMES, c.costumes || {});
    // Custom monsters: merge by id into MONSTERS array.
    if (c.monsters) {
      const have = new Set(DATA.MONSTERS.map(m => m.id));
      for (const [id, m] of Object.entries(c.monsters)) {
        if (!have.has(id)) DATA.MONSTERS.push({ ...m, id });
      }
    }
  }

  function addItem(id, n = 1) {
    state.inventory[id] = (state.inventory[id] || 0) + n;
  }
  function removeItem(id, n = 1) {
    if ((state.inventory[id] || 0) < n) return false;
    state.inventory[id] -= n;
    if (state.inventory[id] <= 0) delete state.inventory[id];
    return true;
  }
  function hasItem(id, n = 1) { return (state.inventory[id] || 0) >= n; }
  function addGold(n) { state.gold = Math.max(0, state.gold + n); }

  function addCustom(kind, id, def) {
    state.custom[kind] = state.custom[kind] || {};
    state.custom[kind][id] = def;
    mergeCustomsIntoData();
  }

  return { state, reset, save, load, clear, addItem, removeItem, hasItem, addGold, getActivePet, addCustom };
})();
