# SuperCitycon V5 on main

The V5 integration includes the authored gameplay repairs in `32a8f3e` and preserves the shop layout and performance tooling from the previous main tip `7ed840f`.

- The merged source passed 704 game tests, 80 syntax checks, three level validations, and five GPU tooling tests. The dependency audit reported zero vulnerabilities.
- The cleared build excludes unverified 2D HUD art, its manifest, and the local publish warning.
- In desktop Chromium on Intel macOS, the repaired V5 gameplay opened all three authored maps, claimed the Old Bridge through Inspect, restored the edited terrain and checkpoint through Continue, emitted the wildfire effect, and rebuilt a fresh city through New Game.
- Cursor reviewed the V5 patch and accepted the follow-up evidence for Inspect and recovery from an authored load failure.

The merged release remains a **V5 release candidate**. The macOS automation environment denied Chromium's MachPort registration before the full acceptance suite could start. The targeted gameplay evidence above applies to the repair commit. The earlier 40-pass scenario and GPU results describe the original V5 candidate and should stay attributed to that run.

From the `game` directory, run `npm run verify:production -- --profile cleared` in an environment where Chromium can launch. Retain its output and screenshots against the exact revision being verified.
