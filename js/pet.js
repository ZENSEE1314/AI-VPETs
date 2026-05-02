// Pet creation, stat decay, actions: feed, play, clean, sleep, work, equip.
window.Pet = (function () {
  function expForNext(level) { return 20 + level * level * 10; }

  function create(species, name) {
    const sp = DATA.SPECIES[species];
    return {
      species, name,
      level: 1, exp: 0,
      maxHp: sp.base.hp, hp: sp.base.hp,
      atk: sp.base.atk, def: sp.base.def,
      hunger: 70, happy: 70, clean: 80, energy: 80,
      weapon: null,
      sleeping: false,
      bornDay: State.state.day,
    };
  }

  function atk(p) { return p.atk + (p.weapon ? (DATA.ITEMS[p.weapon].bonus.atk || 0) : 0); }
  function def(p) { return p.def + (p.weapon ? (DATA.ITEMS[p.weapon].bonus.def || 0) : 0); }

  function decay(elapsedMin) {
    const p = State.state.pet;
    if (!p) return;
    // Per minute decay rates.
    const rate = p.sleeping ? { hunger: 0.10, happy: 0.05, clean: 0.05, energy: -0.40 }
                            : { hunger: 0.20, happy: 0.15, clean: 0.10, energy: 0.10 };
    p.hunger = U.clamp(p.hunger - rate.hunger * elapsedMin, 0, 100);
    p.happy  = U.clamp(p.happy  - rate.happy  * elapsedMin, 0, 100);
    p.clean  = U.clamp(p.clean  - rate.clean  * elapsedMin, 0, 100);
    p.energy = U.clamp(p.energy - rate.energy * elapsedMin, 0, 100);
    // HP slowly regen if well cared for.
    const wellCared = p.hunger > 30 && p.happy > 30 && p.energy > 20;
    if (wellCared && p.hp < p.maxHp) p.hp = U.clamp(p.hp + 0.05 * elapsedMin, 0, p.maxHp);
    if (p.hunger < 5) p.hp = U.clamp(p.hp - 0.10 * elapsedMin, 0, p.maxHp);
  }

  function gainExp(n) {
    const p = State.state.pet;
    if (!p) return;
    p.exp += n;
    while (p.exp >= expForNext(p.level)) {
      p.exp -= expForNext(p.level);
      p.level += 1;
      const sp = DATA.SPECIES[p.species];
      const dHp = 4 + Math.floor(sp.base.hp * 0.1);
      p.maxHp += dHp; p.hp = p.maxHp;
      p.atk += 1 + (p.level % 2 === 0 ? 1 : 0);
      p.def += 1;
      UI.toast(`Lv up! ${p.name} is now Lv ${p.level}`, "good");
      UI.log(`${p.name} grew to Lv ${p.level} (+${dHp} HP)`, "good");
    }
  }

  function feed(itemId) {
    const p = State.state.pet;
    if (!p) return UI.toast("No pet", "bad");
    const it = DATA.ITEMS[itemId];
    if (!it || it.kind !== "food") return UI.toast("Not food", "bad");
    if (!State.removeItem(itemId, 1)) return UI.toast("None left", "bad");
    p.hunger = U.clamp(p.hunger + (it.effect.hunger || 0), 0, 100);
    p.happy  = U.clamp(p.happy  + (it.effect.happy  || 0), 0, 100);
    UI.log(`Fed ${p.name} ${it.emoji} ${it.name}.`);
    UI.refreshPetCard();
  }

  function play() {
    const p = State.state.pet;
    if (!p) return UI.toast("No pet", "bad");
    if (p.energy < 8) return UI.toast(`${p.name} is too tired`, "bad");
    p.happy = U.clamp(p.happy + 18, 0, 100);
    p.energy = U.clamp(p.energy - 8, 0, 100);
    p.hunger = U.clamp(p.hunger - 4, 0, 100);
    World.passTime(20);
    UI.log(`Played with ${p.name}. ✨`);
    UI.refreshPetCard();
  }

  function bathe() {
    const p = State.state.pet;
    if (!p) return UI.toast("No pet", "bad");
    if (!State.hasItem("soap")) {
      // Free splash in the well — slower and less effective.
      p.clean = U.clamp(p.clean + 25, 0, 100);
      World.passTime(20);
      UI.log(`Splashed ${p.name} clean (no soap).`);
    } else {
      State.removeItem("soap", 1);
      p.clean = U.clamp(p.clean + 60, 0, 100);
      p.happy = U.clamp(p.happy + 4, 0, 100);
      World.passTime(15);
      UI.log(`Bathed ${p.name} with 🧼 soap.`);
    }
    UI.refreshPetCard();
  }

  function sleep() {
    const p = State.state.pet;
    if (!p) return UI.toast("No pet", "bad");
    UI.dialog({
      title: "💤 Rest",
      body: `<p>Rest until morning? ${p.name} will recover energy and HP.</p>`,
      actions: [
        { label: "Cancel", onClick: UI.closeDialog },
        { label: "Sleep", primary: true, onClick: () => {
          UI.closeDialog();
          p.sleeping = true;
          // Skip time to next day 7am.
          const target = 7 * 60;
          let mins = (24 * 60 - State.state.minutes) + target;
          if (State.state.minutes < target) mins = target - State.state.minutes;
          World.passTime(mins);
          p.sleeping = false;
          p.energy = 100;
          p.hp = p.maxHp;
          UI.log(`${p.name} slept until morning. Fully rested.`, "good");
          UI.refreshHUD();
        } },
      ],
    });
  }

  function work() {
    const p = State.state.pet;
    if (!p) return UI.toast("No pet", "bad");
    if (p.energy < 25) return UI.toast(`${p.name} is too tired to work`, "bad");
    if (p.happy < 15) return UI.toast(`${p.name} refuses to work`, "bad");
    const earn = 8 + p.level * 4 + U.randi(0, 6);
    State.addGold(earn);
    p.energy = U.clamp(p.energy - 22, 0, 100);
    p.hunger = U.clamp(p.hunger - 12, 0, 100);
    p.happy  = U.clamp(p.happy  - 8,  0, 100);
    p.clean  = U.clamp(p.clean  - 10, 0, 100);
    gainExp(4);
    World.passTime(60);
    UI.log(`${p.name} worked a job. Earned 🪙${earn}.`, "good");
    UI.refreshHUD();
  }

  function equip(itemId) {
    const p = State.state.pet;
    if (!p) return UI.toast("No pet", "bad");
    const it = DATA.ITEMS[itemId];
    if (!it || it.kind !== "weapon") return UI.toast("Not a weapon", "bad");
    if (!State.hasItem(itemId)) return UI.toast("Not in bag", "bad");
    // Swap: put old weapon back in inventory.
    if (p.weapon) State.addItem(p.weapon, 1);
    State.removeItem(itemId, 1);
    p.weapon = itemId;
    UI.log(`Equipped ${it.emoji} ${it.name}.`, "good");
    UI.refreshPetCard();
  }

  function hire(species, name) {
    const p = create(species, name);
    State.state.roster.push(p);
    State.state.activePet = State.state.roster.length - 1;
    State.state.flags.hiredOnce = true;
    State.state.dex.caught[species] = true;
    State.state.dex.seen[species] = true;
    UI.log(`Hired ${name} (${DATA.SPECIES[species].name})!`, "good");
    UI.refreshHUD();
  }

  function adopt(species, name, level = 1) {
    // Add a caught wild as a pet in the roster.
    const sp = DATA.SPECIES[species] || { name: species, base: { hp: 20, atk: 5, def: 3, spd: 5 } };
    const p = create(species, name || sp.name);
    for (let i = 1; i < level; i++) {
      p.maxHp += 4 + Math.floor(sp.base.hp * 0.1); p.atk += 1; p.def += 1;
    }
    p.hp = p.maxHp;
    p.level = level;
    State.state.roster.push(p);
    State.state.dex.caught[species] = true;
    State.state.dex.seen[species] = true;
    UI.log(`${p.name} joined your roster!`, "good");
    UI.refreshHUD();
    return p;
  }

  function setActive(idx) {
    if (idx < 0 || idx >= State.state.roster.length) return;
    State.state.activePet = idx;
    UI.refreshHUD();
  }

  function release(idx) {
    const r = State.state.roster;
    if (idx < 0 || idx >= r.length) return;
    if (r.length === 1) return UI.toast("Can't release your only pet", "bad");
    const [removed] = r.splice(idx, 1);
    if (State.state.activePet >= r.length) State.state.activePet = r.length - 1;
    UI.log(`Released ${removed.name}.`);
    UI.refreshHUD();
  }

  function sell(idx) {
    const r = State.state.roster;
    if (idx < 0 || idx >= r.length || r.length === 1) return UI.toast("Need at least 1 pet", "bad");
    const p = r[idx];
    const price = 30 + p.level * 25;
    State.addGold(price);
    UI.log(`Sold ${p.name} for 🪙${price}.`, "good");
    r.splice(idx, 1);
    if (State.state.activePet >= r.length) State.state.activePet = r.length - 1;
    UI.refreshHUD();
  }

  return { create, hire, adopt, setActive, release, sell, feed, play, bathe, sleep, work, equip, gainExp, decay, atk, def, expForNext };
})();
