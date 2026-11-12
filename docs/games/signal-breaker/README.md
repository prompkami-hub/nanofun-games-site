# Signal Breaker

Original NanoFun first-person robot-combat game. Cross a twilight solar outpost, shut down three relay stations and extract at the starting pad. Procedural meshes, UI, robot models, sound synthesis, collision/combat and game rules are authored for this game. No Saltline game source, models, text, levels or audio were copied. User-supplied mirrors are research references only; the Chinese archive explicitly states its MIT declaration cannot substitute for an unverified original license.

Runtime uses locally vendored Three.js 0.160.1 under vendor/THREE-LICENSE.txt. No external fonts, CDN dependencies, analytics, ads, login or credentials inside the game.

WASD/arrows move, mouse aim, left click fire, R reload, Shift sprint, hold E beside a relay. On touch: left joystick movement, right drag aim, Fire, Reload and hold Link. Mouse capture occurs only on explicit Enter/Resume or canvas click. Escape, loss of focus or parent wallet pauses; resume is free. One new/restarted mission calls the existing parent NanoArcade.requestMatch authorization gate and fails closed if unavailable. Death and extraction finish the current mission; opening a cabinet costs nothing.

Deploy only this runtime directory to nanofun-games-site/docs/games/signal-breaker. Tests: node --test tests/signal-breaker.test.cjs.
