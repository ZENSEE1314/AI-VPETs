// Forge: combine materials into weapons. Also a simple cook function for kitchen recipes.
window.Forge = (function () {
  function open() {
    const recipes = Object.entries(DATA.RECIPES).filter(([id]) => DATA.ITEMS[id].kind === "weapon");
    let html = `<p>Forge weapons from materials gathered in the Wilds.</p><div class="grid">`;
    for (const [out, ing] of recipes) {
      const oi = DATA.ITEMS[out];
      const need = Object.entries(ing).map(([k, n]) =>
        `${DATA.ITEMS[k].emoji}${k}×${n} (${State.state.inventory[k] || 0})`).join(" · ");
      const can = canMake(out);
      html += `<div class="card"><div class="name">${oi.emoji} ${oi.name}</div>
        <div class="meta">+${oi.bonus.atk||0} ATK / +${oi.bonus.def||0} DEF<br>${need}</div>
        <button data-act="forge" data-id="${out}" ${can ? "" : "disabled"}>Forge</button></div>`;
    }
    html += `</div>`;
    const d = UI.dialog({
      title: "⚒️ Forge",
      body: html,
      actions: [{ label: "Close", onClick: UI.closeDialog }],
    });
    d.body.addEventListener("click", (e) => {
      const t = e.target.closest("button[data-act='forge']");
      if (!t) return;
      forge(t.dataset.id);
      UI.closeDialog(); open();
    });
  }

  function canMake(out) {
    const ing = DATA.RECIPES[out];
    if (!ing) return false;
    return Object.entries(ing).every(([k, n]) => (State.state.inventory[k] || 0) >= n);
  }

  function forge(out) {
    const ing = DATA.RECIPES[out];
    if (!canMake(out)) return UI.toast("Missing materials", "bad");
    for (const [k, n] of Object.entries(ing)) State.removeItem(k, n);
    State.addItem(out, 1);
    World.passTime(20);
    UI.log(`Forged ${DATA.ITEMS[out].emoji} ${DATA.ITEMS[out].name}!`, "good");
  }

  function cook(itemId) {
    // itemId = a crop with cooksTo (e.g. wheat -> bread). Uses RECIPES if defined for the output.
    const it = DATA.ITEMS[itemId];
    if (!it?.cooksTo) return false;
    const out = it.cooksTo;
    const ing = DATA.RECIPES[out];
    if (!ing) return false;
    if (!canMake(out)) return false;
    for (const [k, n] of Object.entries(ing)) State.removeItem(k, n);
    State.addItem(out, 1);
    World.passTime(10);
    UI.log(`Cooked ${DATA.ITEMS[out].emoji} ${DATA.ITEMS[out].name}.`, "good");
    return true;
  }

  return { open, forge, cook, canMake };
})();
