// Crop plots: plant seeds, water, harvest crops.
window.Farm = (function () {
  function plot(i) { return State.state.farm[i]; }

  function tickGrowth() {
    const now = State.state.day * 24 * 60 + State.state.minutes;
    for (const p of State.state.farm) {
      if (p.seed && !p.ready) {
        const seed = DATA.ITEMS[p.seed];
        const elapsed = now - p.plantedAt;
        if (elapsed >= seed.growHours * 60) p.ready = true;
      }
    }
  }

  function open() {
    const seeds = Object.keys(State.state.inventory).filter(id => DATA.ITEMS[id]?.kind === "seed");
    let html = `<p>Six plots. Plant seeds, wait for them to ripen, then harvest.</p>`;
    html += `<div class="grid">`;
    State.state.farm.forEach((p, i) => {
      let status, action;
      if (!p.seed) { status = "Empty"; action = `<button data-act="plant" data-i="${i}">Plant…</button>`; }
      else if (!p.ready) {
        const seed = DATA.ITEMS[p.seed];
        const remain = Math.max(0, seed.growHours * 60 - (State.state.day * 24 * 60 + State.state.minutes - p.plantedAt));
        status = `${seed.emoji} ${DATA.ITEMS[seed.growsTo].name} growing — ${Math.ceil(remain / 60)}h left`;
        action = `<button data-act="cancel" data-i="${i}">Uproot</button>`;
      } else {
        const seed = DATA.ITEMS[p.seed];
        status = `🌟 Ready: ${DATA.ITEMS[seed.growsTo].emoji} ${DATA.ITEMS[seed.growsTo].name}`;
        action = `<button data-act="harvest" data-i="${i}">Harvest</button>`;
      }
      html += `<div class="card"><div class="name">Plot ${i + 1}</div><div class="meta">${status}</div>${action}</div>`;
    });
    html += `</div>`;
    if (!seeds.length) html += `<p><em>No seeds. Buy some at the Market.</em></p>`;

    const d = UI.dialog({
      title: "🌾 Farm",
      body: html,
      actions: [{ label: "Close", onClick: UI.closeDialog }],
    });
    d.body.addEventListener("click", (e) => {
      const t = e.target.closest("button[data-act]");
      if (!t) return;
      const i = parseInt(t.dataset.i, 10);
      const act = t.dataset.act;
      if (act === "plant") plantPrompt(i);
      else if (act === "cancel") { State.state.farm[i] = { seed: null, plantedAt: null, ready: false }; UI.closeDialog(); open(); }
      else if (act === "harvest") harvest(i);
    });
  }

  function plantPrompt(i) {
    const seeds = Object.keys(State.state.inventory).filter(id => DATA.ITEMS[id]?.kind === "seed");
    if (!seeds.length) return UI.toast("No seeds in bag", "bad");
    let html = `<p>Choose a seed for plot ${i + 1}.</p><div class="grid">`;
    for (const id of seeds) {
      const it = DATA.ITEMS[id];
      html += `<div class="card"><div class="name">${it.emoji} ${it.name} ×${State.state.inventory[id]}</div>
        <div class="meta">→ ${DATA.ITEMS[it.growsTo].emoji} ${DATA.ITEMS[it.growsTo].name} · ${it.growHours}h</div>
        <button data-pick="${id}">Plant</button></div>`;
    }
    html += `</div>`;
    const d = UI.dialog({
      title: `Plant Plot ${i + 1}`,
      body: html,
      actions: [{ label: "Back", onClick: () => { UI.closeDialog(); open(); } }],
    });
    d.body.addEventListener("click", (e) => {
      const t = e.target.closest("button[data-pick]");
      if (!t) return;
      const id = t.dataset.pick;
      if (!State.removeItem(id, 1)) return UI.toast("Out of seed", "bad");
      State.state.farm[i] = {
        seed: id,
        plantedAt: State.state.day * 24 * 60 + State.state.minutes,
        ready: false,
      };
      UI.log(`Planted ${DATA.ITEMS[id].name} in plot ${i + 1}.`);
      World.passTime(5);
      UI.closeDialog(); open();
    });
  }

  function harvest(i) {
    const p = State.state.farm[i];
    if (!p?.ready) return;
    const seed = DATA.ITEMS[p.seed];
    const yieldN = U.randi(1, 3);
    State.addItem(seed.growsTo, yieldN);
    UI.log(`Harvested ${yieldN}× ${DATA.ITEMS[seed.growsTo].name}.`, "good");
    State.state.farm[i] = { seed: null, plantedAt: null, ready: false };
    World.passTime(10);
    UI.closeDialog(); open();
  }

  return { open, tickGrowth };
})();
