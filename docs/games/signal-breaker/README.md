# Shadow Grove — Signal Breaker environment / weapon variant

Original NanoFun first-person shuriken mission. Cross a rainy bamboo mountain village with pitched tile roofs, shrine gates, lanterns and paper/familiar sentinels. Break three ward seals, then return to the starting shrine gate. Existing cabinet ID / URL remains signal-breaker; this replaces its previous solar-outpost/carbine presentation.

Gameplay independently implements observed reference features: ranged flying / ground pursuing enemies, reinforcements after each objective (max9active), facing +2.4second seal interaction, finite12+48pouch, supply caches, jump/gravity, crouch, sprint and focused aim. Spinning shuriken travel at28units/s and use swept collision with targets/solid cover; no instant hitscan. No Saltline game source, art, text, layouts or audio copied. This is not claimed to be a complete or byte-identical Saltline port.

WASD/arrows move, mouse looks, left click throws, right click focuses/zooms, Space jumps, C/Control crouches, Shift sprints, R restocks, hold E while facing a nearby seal. Touch: left joystick, right drag look, hold Throw/Aim/Link and tap Jump/Restock. Pointer cancellation, blur, visibility changes and parent wallet pause clear active inputs. Resume is free. Each new/restarted mission awaits the existing parent NanoArcade round gate and fails closed if unavailable; wallet/payment/ad code is unchanged.

Procedural models, world, interface and sound synthesis are local. Three.js0.160.1 is vendored under vendor/THREE-LICENSE.txt. No CDN assets, tracking or ads inside the game. Public runtime exports to nanofun-games-site/docs/games/signal-breaker. Private source and tests stay here. Tests: node --test tests/signal-breaker.test.cjs.
