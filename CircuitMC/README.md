# CircuitMC

CircuitMC is a from-scratch Minecraft instance launcher for Windows, built with
Electron. Every instance you create — any Minecraft version, any mod loader —
gets its own isolated folder for mods, worlds, resource packs, shaderpacks and
config, while shared files (libraries, assets, the game jars themselves) are
cached once and reused, exactly like the vanilla launcher and tools such as
MultiMC/Prism do.

## Features

- **Instance creation wizard** — name it, pick any Minecraft version from the
  official Mojang manifest (releases + snapshots), choose Vanilla / Fabric /
  Forge / NeoForge, and pick a loader build. Only combinations that are
  actually published get shown, pulled live from each project's real metadata:
  - Minecraft versions: Mojang's `version_manifest_v2.json`
  - Fabric: `meta.fabricmc.net` (loader builds pre-filtered per game version)
  - Forge: the official `maven-metadata.xml` + `promotions_slim.json`
  - NeoForge: the official NeoForge maven metadata
- **Real installs, not stubs** — vanilla and Fabric are installed directly
  (client jar, libraries with OS/arch rules applied, natives, full asset
  index/objects, all hash-verified). Forge and NeoForge are installed by
  downloading the *official* installer jar and running it headlessly
  (`--installClient`), the same install path those projects ship themselves.
- **Isolated instances** — each instance has its own `mods/`, `config/`,
  `resourcepacks/`, `shaderpacks/`, `saves/`, `screenshots/`, Java path,
  memory settings and JVM args. Duplicate, export (as a `.zip`) and import
  instances to move them between machines.
- **Groups** — organize instances into collapsible, renameable groups; drag
  tiles between groups or use "Change Group".
- **Mod manager** — enable/disable mods without deleting them (renames to
  `.disabled`), delete, or drop files in via "Open Folder".
- **Java handling** — scans common Windows Java install locations plus
  `JAVA_HOME`/`PATH`, recommends the right major version per Minecraft
  version, and lets you override globally or per-instance.
- **Accounts** — offline accounts work immediately (uses the same
  `OfflinePlayer:<name>` UUID algorithm as the vanilla client). Microsoft/Xbox
  sign-in is implemented (full device-code → Xbox Live → XSTS → Minecraft
  services chain) but needs your own Azure AD app client ID pasted into
  Settings, since CircuitMC doesn't ship with one registered.
- **Custom UI** — a compact, dark grey/black desktop-app interface with its
  own traditional menu bar, a contextual action sidebar, a grouped instance
  grid, and a toolbar + status bar footer. Not a reskin of any existing
  launcher.

## Running from source

```bash
npm install
npm start
```

Pass `--dev` to also open DevTools:

```bash
npm run dev
```

### Previewing the UI without Electron

`src/renderer/index.html` can be opened directly in a browser (or served
statically) for quick UI iteration — it automatically falls back to an
in-memory mock backend (`src/renderer/scripts/mockApi.js`) with sample data
whenever `window.circuitmc` (the real Electron preload bridge) isn't present.
This is dev tooling only; the shipped app always talks to the real backend.

## Building a Windows installer

```bash
npm run dist          # both NSIS installer + portable .exe
npm run dist:nsis      # installer only
npm run dist:portable  # portable only
```

Output lands in `release/`. Building for Windows from a non-Windows host
works because `electron-builder` cross-builds NSIS installers, but you'll get
the most reliable results building on Windows itself (or CI).

## Project layout

```
src/
  main/              Electron main process
    mc/              Mojang/Fabric/Forge/NeoForge integration, downloader,
                      installer, launcher, Java detection, auth
    instances/        Instance + group CRUD, content (mods/etc) management
    ipc/              IPC handlers exposed to the renderer
    paths.js, store.js, settings.js, logger.js
  preload/           contextBridge API surface (window.circuitmc)
  renderer/          UI (plain HTML/CSS/JS, no framework/bundler)
    styles/          base/layout/components/dialogs CSS
    scripts/
      views/          menu bar, toolbar, status bar, sidebar, instance grid,
                       instance detail (mods/resource packs/shaders/worlds/
                       java settings/console tabs)
      dialogs/        Add Instance wizard, Settings, generic prompt/confirm
      mockApi.js      browser-preview-only fallback backend
tools/gen-icons.js    procedurally draws the app icon (no image deps)
build/                electron-builder resources (icon.ico/png)
```

## Design notes

- **Shared vs. per-instance data**: libraries, assets and the Minecraft/loader
  version jars live in one shared cache (`%APPDATA%/CircuitMC/shared`) keyed
  by version/hash, since those files are byte-identical no matter which
  instance uses them. Everything that actually makes an instance *yours* —
  mods, worlds, configs, resource/shader packs, screenshots, Java/JVM
  settings — lives entirely inside that instance's own folder. This mirrors
  how MultiMC/Prism/the vanilla launcher are built, and is what makes
  "isolated instances" both correct and fast.
- **Launching** is unified around Mojang's version-json format: vanilla,
  Fabric profiles, and the version json Forge/NeoForge's installer produces
  are all resolved through the same `inheritsFrom`-merging code path, so one
  launcher implementation handles every loader.
- **No bundled credentials**: CircuitMC intentionally ships with no
  Microsoft/Azure client ID baked in — offline accounts are the default and
  work with zero setup; real Microsoft sign-in is there in full but requires
  the user (or a fork) to supply their own registered app ID.
