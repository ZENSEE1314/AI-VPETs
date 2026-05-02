// Marketplace: buy seeds/food/tools, sell anything. NPCs give different prices.
window.Market = (function () {
  // Default market sells these.
  const STALL = ["berry", "bread", "fish", "cake", "seed_berry", "seed_wheat", "seed_carrot", "soap", "ball", "superball"];

  function open() {
    let html = `<p>Town Market — buy supplies, sell surplus.</p>`;
    html += `<h3 style="color:var(--accent)">Buy</h3><div class="grid">`;
    for (const id of STALL) {
      const it = DATA.ITEMS[id];
      html += `<div class="card"><div class="name">${it.emoji} ${it.name}</div>
        <div class="meta">${it.kind} · 🪙 ${it.price}</div>
        <button data-act="buy" data-id="${id}">Buy 1</button></div>`;
    }
    html += `</div>`;

    const sellable = Object.keys(State.state.inventory).filter(id => {
      const it = DATA.ITEMS[id]; return it && it.kind !== "weapon"; // keep weapons safe
    });
    html += `<h3 style="color:var(--accent);margin-top:10px">Sell</h3><div class="grid">`;
    if (!sellable.length) html += `<p><em>Nothing to sell.</em></p>`;
    for (const id of sellable) {
      const it = DATA.ITEMS[id];
      html += `<div class="card"><div class="name">${it.emoji} ${it.name} ×${State.state.inventory[id]}</div>
        <div class="meta">market 🪙 ${Math.floor(it.price * 0.6)} ea</div>
        <button data-act="sell" data-id="${id}">Sell 1</button></div>`;
    }
    html += `</div>`;

    const d = UI.dialog({
      title: "🛒 Market",
      body: html,
      actions: [{ label: "Close", onClick: UI.closeDialog }],
    });
    d.body.addEventListener("click", (e) => {
      const t = e.target.closest("button[data-act]");
      if (!t) return;
      const id = t.dataset.id;
      if (t.dataset.act === "buy") buy(id, 1);
      else if (t.dataset.act === "sell") sell(id, 1);
      UI.closeDialog(); open();
    });
  }

  function buy(id, n = 1, mul = 1.0) {
    const it = DATA.ITEMS[id];
    const cost = Math.ceil(it.price * mul) * n;
    if (State.state.gold < cost) return UI.toast("Not enough gold", "bad");
    State.addGold(-cost);
    State.addItem(id, n);
    UI.log(`Bought ${n}× ${it.name} for 🪙${cost}.`);
  }

  function sell(id, n = 1, mul = 0.6) {
    const it = DATA.ITEMS[id];
    if (!State.removeItem(id, n)) return UI.toast("None to sell", "bad");
    const earn = Math.floor(it.price * mul) * n;
    State.addGold(earn);
    UI.log(`Sold ${n}× ${it.name} for 🪙${earn}.`);
  }

  // NPC trade dialog
  function trade(npc) {
    const tr = npc.trade;
    let html = `<p><b>${npc.emoji} ${npc.name}</b>: "${npc.line}"</p>`;
    if (tr.sells) {
      html += `<h3 style="color:var(--accent)">${npc.name} sells (×${tr.priceMul})</h3><div class="grid">`;
      for (const id of tr.sells) {
        const it = DATA.ITEMS[id];
        const price = Math.ceil(it.price * tr.priceMul);
        html += `<div class="card"><div class="name">${it.emoji} ${it.name}</div>
          <div class="meta">🪙 ${price} ${tr.priceMul < 1 ? "(deal!)" : ""}</div>
          <button data-act="nbuy" data-id="${id}">Buy 1</button></div>`;
      }
      html += `</div>`;
    }
    if (tr.buys) {
      html += `<h3 style="color:var(--accent);margin-top:10px">${npc.name} pays for (×${tr.priceMul})</h3><div class="grid">`;
      for (const id of tr.buys) {
        const it = DATA.ITEMS[id];
        const price = Math.floor(it.price * tr.priceMul);
        const have = State.state.inventory[id] || 0;
        html += `<div class="card"><div class="name">${it.emoji} ${it.name} ×${have}</div>
          <div class="meta">🪙 ${price} ea ${tr.priceMul > 1 ? "(premium!)" : ""}</div>
          <button data-act="nsell" data-id="${id}" ${have ? "" : "disabled"}>Sell 1</button></div>`;
      }
      html += `</div>`;
    }
    const d = UI.dialog({
      title: `Trade with ${npc.name}`,
      body: html,
      actions: [{ label: "Leave", onClick: UI.closeDialog }],
    });
    d.body.addEventListener("click", (e) => {
      const t = e.target.closest("button[data-act]");
      if (!t) return;
      const id = t.dataset.id;
      if (t.dataset.act === "nbuy") buy(id, 1, tr.priceMul);
      else if (t.dataset.act === "nsell") sell(id, 1, tr.priceMul);
      UI.closeDialog(); trade(npc);
    });
  }

  return { open, buy, sell, trade };
})();
