// Admin mode: create custom monsters, items, costumes, species. Persists in save.
window.Admin = (function () {
  function open() {
    if (!State.state.admin) return UI.toast("Admin mode is OFF (F2 to toggle)", "bad");
    let html = `<p>Admin tools (F2 to toggle off). All entries persist in your save.</p>
      <div class="grid">
        <div class="card"><div class="name">➕ New Monster</div><button data-act="mon">Create</button></div>
        <div class="card"><div class="name">➕ New Item</div><button data-act="item">Create</button></div>
        <div class="card"><div class="name">➕ New Costume</div><button data-act="cos">Create</button></div>
        <div class="card"><div class="name">➕ New Species (player-style pet)</div><button data-act="sp">Create</button></div>
        <div class="card"><div class="name">💰 +500 Gold</div><button data-act="gold">Add</button></div>
        <div class="card"><div class="name">🎁 Give Item…</div><button data-act="give">Give</button></div>
      </div>`;
    const d = UI.dialog({ title: "🛠 Admin", body: html, actions: [{ label: "Close", onClick: UI.closeDialog }] });
    d.body.addEventListener("click", (e) => {
      const t = e.target.closest("button[data-act]");
      if (!t) return;
      const a = t.dataset.act;
      UI.closeDialog();
      if (a === "mon") createMonster();
      else if (a === "item") createItem();
      else if (a === "cos") createCostume();
      else if (a === "sp") createSpecies();
      else if (a === "gold") { State.addGold(500); UI.toast("+500", "good"); UI.refreshHUD(); }
      else if (a === "give") giveItem();
    });
  }

  function form(fields) {
    const wrap = document.createElement("div");
    let html = "";
    for (const f of fields) {
      html += `<label style="display:block;margin:6px 0;font-size:12px;color:var(--muted)">${f.label}
        <input id="ad_${f.id}" value="${f.def ?? ""}" style="width:100%;padding:6px;background:#0a0d1f;color:var(--ink);border:1px solid var(--border);border-radius:6px"></label>`;
    }
    wrap.innerHTML = html;
    return wrap;
  }
  function val(wrap, id) { return wrap.querySelector("#ad_" + id).value.trim(); }

  function createMonster() {
    const f = form([
      { id: "id",      label: "ID (unique slug)",  def: "custom1" },
      { id: "name",    label: "Name",              def: "Custom Beast" },
      { id: "emoji",   label: "Emoji",             def: "🐲" },
      { id: "element", label: "Element (fire/leaf/water/spark/none)", def: "none" },
      { id: "level",   label: "Level",             def: "3" },
      { id: "hp",      label: "HP",                def: "30" },
      { id: "atk",     label: "ATK",               def: "8" },
      { id: "def",     label: "DEF",               def: "4" },
      { id: "exp",     label: "EXP reward",        def: "20" },
      { id: "gold",    label: "Gold reward",       def: "10" },
      { id: "drops",   label: "Drops (csv id:chance)", def: "fang:0.5,hide:0.3" },
    ]);
    UI.dialog({
      title: "➕ Custom Monster",
      body: f,
      actions: [
        { label: "Cancel", onClick: UI.closeDialog },
        { label: "Create", primary: true, onClick: () => {
          const drops = {};
          for (const part of val(f, "drops").split(",")) {
            const [k, v] = part.split(":").map(s => s && s.trim());
            if (k) drops[k] = parseFloat(v) || 0.3;
          }
          const id = val(f, "id");
          const m = {
            id, name: val(f, "name"), emoji: val(f, "emoji"), element: val(f, "element") || "none",
            level: parseInt(val(f, "level"), 10) || 1,
            hp: parseInt(val(f, "hp"), 10) || 20,
            atk: parseInt(val(f, "atk"), 10) || 5,
            def: parseInt(val(f, "def"), 10) || 2,
            exp: parseInt(val(f, "exp"), 10) || 10,
            gold: parseInt(val(f, "gold"), 10) || 5,
            drops,
          };
          State.addCustom("monsters", id, m);
          UI.toast(`Added monster ${m.name}`, "good");
          UI.closeDialog();
        } },
      ],
    });
  }

  function createItem() {
    const f = form([
      { id: "id",    label: "ID",             def: "custom_food" },
      { id: "name",  label: "Name",           def: "Mystery Stew" },
      { id: "emoji", label: "Emoji",          def: "🥘" },
      { id: "kind",  label: "Kind (food/material/weapon/tool/seed/crop/ball)", def: "food" },
      { id: "price", label: "Price",          def: "30" },
      { id: "hunger",label: "Hunger restore (food)", def: "40" },
      { id: "happy", label: "Happy restore (food)",  def: "10" },
      { id: "atk",   label: "Weapon ATK bonus",      def: "0" },
      { id: "def",   label: "Weapon DEF bonus",      def: "0" },
    ]);
    UI.dialog({
      title: "➕ Custom Item",
      body: f,
      actions: [
        { label: "Cancel", onClick: UI.closeDialog },
        { label: "Create", primary: true, onClick: () => {
          const id = val(f, "id");
          const kind = val(f, "kind") || "food";
          const it = { name: val(f, "name"), emoji: val(f, "emoji"), kind, price: parseInt(val(f, "price"), 10) || 10 };
          if (kind === "food") it.effect = { hunger: +val(f, "hunger") || 0, happy: +val(f, "happy") || 0 };
          if (kind === "weapon") it.bonus = { atk: +val(f, "atk") || 0, def: +val(f, "def") || 0 };
          State.addCustom("items", id, it);
          UI.toast(`Added item ${it.name}`, "good");
          UI.closeDialog();
        } },
      ],
    });
  }

  function createCostume() {
    const f = form([
      { id: "id",    label: "ID",        def: "cs_custom" },
      { id: "name",  label: "Name",      def: "Custom Suit" },
      { id: "emoji", label: "Emoji",     def: "🦄" },
      { id: "price", label: "Price",     def: "100" },
      { id: "base",  label: "Base species id (for catch-discount)", def: "slime" },
    ]);
    UI.dialog({
      title: "➕ Custom Costume",
      body: f,
      actions: [
        { label: "Cancel", onClick: UI.closeDialog },
        { label: "Create", primary: true, onClick: () => {
          const id = val(f, "id");
          const c = {
            name: val(f, "name"), emoji: val(f, "emoji"),
            price: parseInt(val(f, "price"), 10) || 100,
            baseSpecies: val(f, "base"),
          };
          State.addCustom("costumes", id, c);
          UI.toast(`Added costume ${c.name}`, "good");
          UI.closeDialog();
        } },
      ],
    });
  }

  function createSpecies() {
    const f = form([
      { id: "id",      label: "ID",      def: "sp_custom" },
      { id: "name",    label: "Name",    def: "Custom Pet" },
      { id: "emoji",   label: "Emoji",   def: "🦊" },
      { id: "element", label: "Element", def: "none" },
      { id: "hp",      label: "HP",      def: "26" },
      { id: "atk",     label: "ATK",     def: "6" },
      { id: "def",     label: "DEF",     def: "4" },
      { id: "spd",     label: "SPD",     def: "5" },
    ]);
    UI.dialog({
      title: "➕ Custom Species",
      body: f,
      actions: [
        { label: "Cancel", onClick: UI.closeDialog },
        { label: "Create", primary: true, onClick: () => {
          const id = val(f, "id");
          const sp = {
            name: val(f, "name"), emoji: val(f, "emoji"), color: "#ccccff",
            element: val(f, "element") || "none",
            base: { hp: +val(f, "hp") || 20, atk: +val(f, "atk") || 5, def: +val(f, "def") || 3, spd: +val(f, "spd") || 5 },
          };
          State.addCustom("species", id, sp);
          UI.toast(`Species ${sp.name} added — hire one at the Pet Shop!`, "good");
          UI.closeDialog();
        } },
      ],
    });
  }

  function giveItem() {
    let html = `<p>All items in the world (incl. customs):</p><div class="grid">`;
    for (const [id, it] of Object.entries(DATA.ITEMS)) {
      html += `<div class="card"><div class="name">${it.emoji} ${it.name}</div>
        <div class="meta">${it.kind} · 🪙${it.price}</div>
        <button data-give="${id}">+1</button></div>`;
    }
    html += `</div>`;
    const d = UI.dialog({ title: "🎁 Give Item", body: html, actions: [{ label: "Close", onClick: UI.closeDialog }] });
    d.body.addEventListener("click", (e) => {
      const t = e.target.closest("button[data-give]");
      if (!t) return;
      State.addItem(t.dataset.give, 1);
      UI.toast("+1 " + DATA.ITEMS[t.dataset.give].name, "good");
    });
  }

  return { open };
})();
