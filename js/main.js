// Boot, input, render loop, button wiring, save/load.
(function () {
  function init() {
    const loaded = State.load();
    if (loaded) UI.toast("Save loaded", "good");

    document.addEventListener("keydown", (e) => {
      if (e.target && e.target.tagName === "INPUT") return;
      World.input(e);
    });

    document.getElementById("btn-bag").onclick     = () => UI.openBag();
    document.getElementById("btn-help").onclick    = () => UI.openHelp();
    document.getElementById("btn-pet").onclick     = () => UI.openPetMenu();
    document.getElementById("btn-roster").onclick  = () => UI.openRoster();
    document.getElementById("btn-dex").onclick     = () => UI.openDex();
    document.getElementById("btn-costume").onclick = () => UI.openCostumes();
    document.getElementById("btn-admin").onclick   = () => {
      if (!State.state.admin) { State.state.admin = true; UI.toast("Admin enabled (F2 to toggle)", "good"); }
      Admin.open();
    };
    document.getElementById("btn-save").onclick    = () => {
      if (State.save()) UI.toast("Saved", "good"); else UI.toast("Save failed", "bad");
    };

    if (!State.state.flags.hiredOnce) {
      UI.log("Welcome! Press ? for help. Visit the 🏠 Pet Shop to hire your free starter.", "good");
      UI.toast("Press ? for the rules.");
    }

    setInterval(() => State.save(), 30000);

    let lastT = performance.now();
    function frame(t) {
      const dt = t - lastT; lastT = t;
      State.state.tickAccum += dt;
      while (State.state.tickAccum > 1000) {
        State.state.tickAccum -= 1000;
        if (!UI.isDialogOpen() && !Arena.isActive()) World.passTime(1);
      }
      if (Arena.isActive() && !UI.isDialogOpen()) Arena.tick(dt);
      World.render();
      UI.refreshHUD();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
