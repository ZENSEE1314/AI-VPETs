// HUD rendering, dialog system, toast notifications, log.
window.UI = (function () {
  const els = {
    gold: document.getElementById("hud-gold"),
    day:  document.getElementById("hud-day"),
    time: document.getElementById("hud-time"),
    zone: document.getElementById("hud-zone"),
    pet:  document.getElementById("hud-pet"),
    petCard: document.getElementById("pet-card"),
    log:  document.getElementById("log"),
    dialogRoot: document.getElementById("dialog-root"),
    toastRoot: document.getElementById("toast-root"),
  };

  let dialogOpen = null;

  function refreshHUD() {
    const s = State.state;
    els.gold.textContent = s.gold;
    els.day.textContent = s.day;
    els.time.textContent = U.fmtTime(s.minutes);
    els.zone.textContent = World.currentZone();
    if (s.pet) {
      els.pet.textContent = `${DATA.SPECIES[s.pet.species].emoji} ${s.pet.name} Lv${s.pet.level}`;
    } else {
      els.pet.textContent = "No pet yet";
    }
    refreshPetCard();
  }

  function bar(cls, val, max = 100) {
    const pct = Math.max(0, Math.min(100, (val / max) * 100));
    return `<div class="bar ${cls}"><span style="width:${pct}%"></span></div>`;
  }

  function refreshPetCard() {
    const p = State.state.pet;
    if (!p) {
      els.petCard.innerHTML = `<em>Visit the Pet Shop (🏠 in town) to hire a free starter pet.</em>`;
      return;
    }
    const sp = DATA.SPECIES[p.species];
    const w = p.weapon ? DATA.ITEMS[p.weapon] : null;
    els.petCard.innerHTML = `
      <div class="row"><b>${sp.emoji} ${p.name}</b><span>Lv ${p.level} · ${sp.element}</span></div>
      <div class="row"><span>HP</span><span>${Math.ceil(p.hp)} / ${p.maxHp}</span></div>${bar("hp", p.hp, p.maxHp)}
      <div class="row"><span>Hunger</span><span>${Math.round(p.hunger)}</span></div>${bar("hunger", p.hunger)}
      <div class="row"><span>Happy</span><span>${Math.round(p.happy)}</span></div>${bar("happy", p.happy)}
      <div class="row"><span>Clean</span><span>${Math.round(p.clean)}</span></div>${bar("clean", p.clean)}
      <div class="row"><span>Energy</span><span>${Math.round(p.energy)}</span></div>${bar("energy", p.energy)}
      <div class="row"><span>EXP</span><span>${p.exp} / ${Pet.expForNext(p.level)}</span></div>${bar("exp", p.exp, Pet.expForNext(p.level))}
      <div class="row"><span>ATK ${Pet.atk(p)} · DEF ${Pet.def(p)} · SPD ${sp.base.spd}</span></div>
      <div class="row"><span>Weapon: ${w ? w.emoji + " " + w.name : "—"}</span></div>
    `;
  }

  function log(msg, kind) {
    const li = document.createElement("li");
    li.textContent = `[Day ${State.state.day} ${U.fmtTime(State.state.minutes)}] ${msg}`;
    if (kind) li.style.color = kind === "good" ? "var(--good)" : kind === "bad" ? "var(--danger)" : "";
    els.log.prepend(li);
    while (els.log.children.length > 80) els.log.lastChild.remove();
    State.state.log.push(msg);
    if (State.state.log.length > 100) State.state.log.shift();
  }

  function toast(msg, kind = "") {
    const t = document.createElement("div");
    t.className = "toast " + kind;
    t.textContent = msg;
    els.toastRoot.appendChild(t);
    setTimeout(() => { t.style.opacity = 0; t.style.transition = "opacity .3s"; }, 1800);
    setTimeout(() => t.remove(), 2200);
  }

  function closeDialog() {
    if (!dialogOpen) return;
    dialogOpen.remove();
    dialogOpen = null;
  }

  // opts: { title, body (HTML string or node), actions: [{label, primary, danger, onClick}], onClose }
  function dialog(opts) {
    closeDialog();
    const wrap = document.createElement("div");
    wrap.className = "dialog";
    wrap.innerHTML = `<h2>${opts.title}</h2>`;
    const body = document.createElement("div");
    if (typeof opts.body === "string") body.innerHTML = opts.body; else body.appendChild(opts.body);
    wrap.appendChild(body);
    if (opts.actions && opts.actions.length) {
      const row = document.createElement("div");
      row.className = "actions";
      for (const a of opts.actions) {
        const b = document.createElement("button");
        b.textContent = a.label;
        if (a.primary) b.classList.add("primary");
        if (a.danger) b.classList.add("danger");
        b.onclick = () => { a.onClick && a.onClick(); };
        row.appendChild(b);
      }
      wrap.appendChild(row);
    }
    els.dialogRoot.appendChild(wrap);
    dialogOpen = wrap;
    return { close: closeDialog, body, refresh: (html) => { body.innerHTML = html; } };
  }

  function isDialogOpen() { return !!dialogOpen; }

  function openBag() {
    const inv = State.state.inventory;
    const ids = Object.keys(inv);
    let html = `<p>Gold: 🪙 <b>${State.state.gold}</b></p>`;
    if (!ids.length) html += `<p><em>Bag is empty.</em></p>`;
    else {
      html += `<div class="grid">`;
      for (const id of ids) {
        const it = DATA.ITEMS[id];
        if (!it) continue;
        html += `<div class="card"><div class="name">${it.emoji} ${it.name} ×${inv[id]}</div>
          <div class="meta">${it.kind}${it.bonus ? ` · +${it.bonus.atk||0}/+${it.bonus.def||0}` : ""}</div>`;
        if (it.kind === "food") html += `<button data-act="feed" data-id="${id}">Feed Pet</button>`;
        if (id === "soap") html += `<button data-act="bathe" data-id="${id}">Bathe Pet</button>`;
        if (it.kind === "weapon") html += `<button data-act="equip" data-id="${id}">Equip</button>`;
        if (it.cooksTo) html += `<button data-act="cook" data-id="${id}">Cook</button>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
    const d = dialog({
      title: "🎒 Bag",
      body: html,
      actions: [{ label: "Close", onClick: closeDialog }],
    });
    d.body.addEventListener("click", (e) => {
      const t = e.target.closest("button[data-act]");
      if (!t) return;
      const id = t.dataset.id;
      const act = t.dataset.act;
      if (act === "feed") Pet.feed(id);
      else if (act === "bathe") Pet.bathe();
      else if (act === "equip") Pet.equip(id);
      else if (act === "cook") {
        if (Forge.cook(id)) toast("Cooked!", "good"); else toast("Need ingredients", "bad");
      }
      closeDialog(); openBag();
    });
  }

  function openHelp() {
    dialog({
      title: "How to play",
      body: `
        <p>Welcome to <b>Pet World</b>! A top-down ecosystem where you raise pets, farm, trade, hunt, catch, and forge.</p>
        <ul>
          <li><b>Move</b>: WASD / Arrows. <b>Interact</b>: E or Space.</li>
          <li><b>🏠 Pet Shop</b>: hire your free starter (one-time), rest, play, work.</li>
          <li><b>🛒 Market</b>: buy items, costumes, catch balls, sell surplus. NPCs offer different prices.</li>
          <li><b>🌾 Farm</b>: plant seeds, harvest crops, feed your pet.</li>
          <li><b>⚒️ Forge</b>: turn drops into weapons that boost ATK/DEF.</li>
          <li><b>🌲 Wilds</b>: action-style. Spam <b>E/Space</b> — your swing hits ALL monsters in range. Press <b>C</b> to throw a Catch Ball at a weakened monster to add it to your roster.</li>
          <li>Active pet earns EXP & loot. Cycle pets via the Roster (R). Track progress in the Dex (X). Equip costumes to look like monsters.</li>
          <li><b>Admin (F2)</b>: create custom species, monsters, items, costumes. Saved with your game.</li>
        </ul>
      `,
      actions: [{ label: "Got it", primary: true, onClick: closeDialog }],
    });
  }

  function openPetMenu() {
    if (!State.state.pet) return toast("Hire a pet at the Pet Shop", "bad");
    dialog({
      title: `${DATA.SPECIES[State.state.pet.species]?.emoji || "🐾"} ${State.state.pet.name}`,
      body: `<p>Quick actions for your active pet:</p>
        <div class="grid">
          <div class="card"><div class="name">🎈 Play</div><button data-act="play">Play</button></div>
          <div class="card"><div class="name">🧼 Bathe</div><button data-act="bathe">Bathe</button></div>
          <div class="card"><div class="name">😴 Sleep</div><button data-act="sleep">Sleep</button></div>
          <div class="card"><div class="name">💼 Work</div><button data-act="work">Work</button></div>
        </div>`,
      actions: [{ label: "Close", onClick: closeDialog }],
    }).body.addEventListener("click", (e) => {
      const t = e.target.closest("button[data-act]");
      if (!t) return;
      closeDialog();
      const a = t.dataset.act;
      if (a === "play") Pet.play();
      else if (a === "bathe") Pet.bathe();
      else if (a === "sleep") Pet.sleep();
      else if (a === "work") Pet.work();
    });
  }

  function openRoster() {
    const r = State.state.roster;
    if (!r.length) return toast("No pets yet — hire one at the Pet Shop", "bad");
    let html = `<p>Your roster (${r.length}). Set active, train at the Pet Shop, or sell.</p><div class="grid">`;
    r.forEach((p, i) => {
      const sp = DATA.SPECIES[p.species] || { name: p.species, emoji: "🐾" };
      const isActive = i === State.state.activePet;
      const w = p.weapon ? DATA.ITEMS[p.weapon] : null;
      html += `<div class="card" style="${isActive ? "border-color:var(--accent)" : ""}">
        <div class="name">${sp.emoji} ${p.name} ${isActive ? "★" : ""}</div>
        <div class="meta">Lv ${p.level} · ${sp.element} · HP ${Math.ceil(p.hp)}/${p.maxHp}<br>
          ATK ${Pet.atk(p)} · DEF ${Pet.def(p)}<br>
          ${w ? w.emoji + " " + w.name : "no weapon"}</div>
        ${isActive ? "" : `<button data-act="active" data-i="${i}">Set Active</button>`}
        <button data-act="sell" data-i="${i}">Sell 🪙${30 + p.level * 25}</button>
        <button class="danger" data-act="release" data-i="${i}">Release</button>
      </div>`;
    });
    html += `</div>`;
    const d = dialog({ title: "🐾 Roster", body: html, actions: [{ label: "Close", onClick: closeDialog }] });
    d.body.addEventListener("click", (e) => {
      const t = e.target.closest("button[data-act]");
      if (!t) return;
      const i = parseInt(t.dataset.i, 10);
      if (t.dataset.act === "active") Pet.setActive(i);
      else if (t.dataset.act === "sell") Pet.sell(i);
      else if (t.dataset.act === "release") Pet.release(i);
      closeDialog(); openRoster();
    });
  }

  function openDex() {
    const all = DATA.MONSTERS;
    const seen = State.state.dex.seen, caught = State.state.dex.caught;
    const seenN = Object.keys(seen).length, caughtN = Object.keys(caught).length;
    let html = `<p>Seen ${seenN}/${all.length} · Caught ${caughtN}/${all.length}</p><div class="grid">`;
    for (const m of all) {
      const s = !!seen[m.id], c = !!caught[m.id];
      html += `<div class="card" style="opacity:${s ? 1 : 0.45}">
        <div class="name">${s ? m.emoji : "❓"} ${s ? m.name : "???"}</div>
        <div class="meta">${s ? `Lv ${m.level} ${m.element} · HP ${m.hp} ATK ${m.atk}` : "Not seen"}<br>
          ${c ? "✅ Caught" : s ? "Not caught" : ""}</div>
      </div>`;
    }
    html += `</div>`;
    dialog({ title: "📖 Monster Dex", body: html, actions: [{ label: "Close", onClick: closeDialog }] });
  }

  function openCostumes() {
    const owned = State.state.ownedCostumes || [];
    const cur = State.state.costume;
    let html = `<p>Costumes change how your character looks (cosmetic only). Buy from the wardrobe — caught monsters unlock matching looks at half price.</p>`;
    html += `<div class="grid">`;
    html += `<div class="card"><div class="name">🧍 No costume</div>
      <button data-act="wear" data-id="">Wear</button></div>`;
    for (const [id, c] of Object.entries(DATA.COSTUMES)) {
      const have = owned.includes(id);
      const caught = !!State.state.dex.caught[c.baseSpecies];
      const price = caught ? Math.ceil(c.price * 0.5) : c.price;
      html += `<div class="card" style="${cur === id ? "border-color:var(--accent)" : ""}">
        <div class="name">${c.emoji} ${c.name}</div>
        <div class="meta">${have ? "Owned" : `🪙 ${price}${caught ? " (caught discount)" : ""}`}</div>
        ${have
          ? `<button data-act="wear" data-id="${id}">${cur === id ? "Wearing" : "Wear"}</button>`
          : `<button data-act="buy" data-id="${id}">Buy</button>`}
      </div>`;
    }
    html += `</div>`;
    const d = dialog({ title: "👗 Wardrobe", body: html, actions: [{ label: "Close", onClick: closeDialog }] });
    d.body.addEventListener("click", (e) => {
      const t = e.target.closest("button[data-act]");
      if (!t) return;
      const id = t.dataset.id;
      if (t.dataset.act === "wear") {
        State.state.costume = id || null;
        log(`Wearing: ${id ? DATA.COSTUMES[id].name : "nothing"}.`);
      } else if (t.dataset.act === "buy") {
        const c = DATA.COSTUMES[id];
        const caught = !!State.state.dex.caught[c.baseSpecies];
        const price = caught ? Math.ceil(c.price * 0.5) : c.price;
        if (State.state.gold < price) return toast("Not enough gold", "bad");
        State.addGold(-price);
        State.state.ownedCostumes.push(id);
        log(`Bought ${c.name} for 🪙${price}.`, "good");
      }
      closeDialog(); openCostumes();
    });
  }

  return { refreshHUD, refreshPetCard, log, toast, dialog, closeDialog, isDialogOpen,
           openBag, openHelp, openPetMenu, openRoster, openDex, openCostumes };
})();
