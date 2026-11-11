# Drift Coast

Original procedural 3D arcade racing for NanoFun. Two closed circuits (Sunset Marina / Alpine Switchback), five AI opponents, one/three lap races, drifting charge, nitro and mini turbo. Custom track-coordinate driving physics; not a simulation or a copy of QQ Speed source/art/tracks. All car models, scenery and sound are generated locally by this implementation. Three.js 0.160.1 is vendored from npm under its included MIT license.

Keyboard: arrows/WASD, Shift drift, Space nitro, R reset, Esc pause. Coarse-pointer devices use automatic throttle, a captured slide steering area, Drift and Nitro controls. Pointer cancellation, blur and hiding the page clear inputs and pause. Race starts await the existing parent NanoArcade wallet gate; resume is free. No external ad or analytics scripts. Best laps stay browser-local. Public entry is via the arcade cabinet.

Run pure driving tests with `node --test tests/drift-coast.test.cjs`. Deploy only this runtime directory to the public website `docs/games/drift-coast/`, not the private source repository.
