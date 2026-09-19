'use strict';

// Fallback backend used only when this page is opened directly in a regular
// browser (no `window.circuitmc` from the Electron preload). This lets the
// UI be built and screenshotted without spinning up Electron, and gives
// anyone poking at the source a working demo. It is NEVER loaded inside the
// real app -- see api.js.
(function () {
  if (typeof window === 'undefined') return;

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => Math.random().toString(36).slice(2, 9);

  const listeners = { installProgress: [], instanceLog: [], instanceExit: [], logLine: [] };
  function emit(kind, payload) {
    for (const fn of listeners[kind]) fn(payload);
  }

  const MOCK_VERSIONS = [
    { id: '1.21.8', type: 'release' },
    { id: '1.21.1', type: 'release' },
    { id: '1.20.6', type: 'release' },
    { id: '1.20.1', type: 'release' },
    { id: '1.19.4', type: 'release' },
    { id: '1.18.2', type: 'release' },
    { id: '1.16.5', type: 'release' },
    { id: '1.12.2', type: 'release' },
    { id: '24w33a', type: 'snapshot' },
  ];

  const state = {
    settings: {
      theme: 'dark',
      defaultRamMin: 1024,
      defaultRamMax: 4096,
      globalJavaPath: '',
      accounts: [{ id: 'acc1', type: 'offline', username: 'Steve', uuid: '11111111-1111-1111-1111-111111111111', accessToken: '0' }],
      activeAccountId: 'acc1',
      msaClientId: '',
    },
    groups: [
      { id: 'default', name: 'Vanilla-like', order: 0 },
      { id: 'modpack', name: 'Modpack', order: 1 },
      { id: 'fabric-116', name: 'Fabric 1.16.5', order: 2 },
    ],
    instances: [
      { id: 'i1', name: 'Adrenaline', icon: 'vanilla', mcVersion: '1.19.3', loader: 'vanilla', loaderVersion: null, versionId: '1.19.3', installed: true, groupId: 'default', createdAt: Date.now() - 8e6, lastPlayed: Date.now() - 1e6, javaMinMb: 1024, javaMaxMb: 4096, jvmArgs: '', javaPath: '' },
      { id: 'i2', name: 'Fabulously Optimized', icon: 'fabric', mcVersion: '1.20.1', loader: 'fabric', loaderVersion: '0.15.11', versionId: 'fabric-loader-0.15.11-1.20.1', installed: true, groupId: 'default', createdAt: Date.now() - 7e6, lastPlayed: null, javaMinMb: 1024, javaMaxMb: 6144, jvmArgs: '', javaPath: '' },
      { id: 'i3', name: 'All the Mods 8', icon: 'forge', mcVersion: '1.20.1', loader: 'forge', loaderVersion: '47.2.0', versionId: '1.20.1-forge-47.2.0', installed: true, groupId: 'modpack', createdAt: Date.now() - 6e6, lastPlayed: Date.now() - 2e5, javaMinMb: 4096, javaMaxMb: 8192, jvmArgs: '', javaPath: '' },
      { id: 'i4', name: 'HexMC', icon: 'neoforge', mcVersion: '1.21.1', loader: 'neoforge', loaderVersion: '21.1.65', versionId: 'neoforge-21.1.65', installed: true, groupId: 'modpack', createdAt: Date.now() - 5e6, lastPlayed: Date.now() - 3e4, javaMinMb: 2048, javaMaxMb: 6144, jvmArgs: '', javaPath: '' },
      { id: 'i5', name: 'Horror Project', icon: 'fabric', mcVersion: '1.16.5', loader: 'fabric', loaderVersion: '0.14.24', versionId: 'fabric-loader-0.14.24-1.16.5', installed: true, groupId: 'fabric-116', createdAt: Date.now() - 4e6, lastPlayed: Date.now() - 9e5, javaMinMb: 1024, javaMaxMb: 4096, jvmArgs: '', javaPath: '' },
      { id: 'i6', name: 'Quilt 1.18.2', icon: 'fabric', mcVersion: '1.18.2', loader: 'fabric', loaderVersion: '0.23.0', versionId: 'fabric-loader-0.23.0-1.18.2', installed: true, groupId: 'fabric-116', createdAt: Date.now() - 3e6, lastPlayed: null, javaMinMb: 1024, javaMaxMb: 4096, jvmArgs: '', javaPath: '' },
    ],
  };
  state.mockContent = {
    mods: [
      { name: 'sodium-fabric-0.5.8.jar', isDirectory: false, sizeBytes: 1_240_000, enabled: true },
      { name: 'lithium-fabric-0.11.2.jar', isDirectory: false, sizeBytes: 512_000, enabled: true },
      { name: 'iris-1.6.9.jar', isDirectory: false, sizeBytes: 3_100_000, enabled: false },
    ],
    resourcepacks: [{ name: 'faithful-32x.zip', isDirectory: false, sizeBytes: 44_000_000, enabled: true }],
    shaderpacks: [{ name: 'ComplementaryReimagined.zip', isDirectory: false, sizeBytes: 900_000, enabled: true }],
    saves: [{ name: 'New World', isDirectory: true, sizeBytes: null, enabled: true }],
  };
  const runningSet = new Set();

  function ok(data) {
    return Promise.resolve(data);
  }

  window.__circuitmcMock = {
    app: {
      getVersion: () => ok('0.1.0-mock'),
      getPaths: () => ok({ root: '(browser preview)', instances: '(browser preview)' }),
      openInstancesRoot: () => ok(true),
    },
    window: {
      minimize: () => {},
      maximize: () => {},
      close: () => {},
      onMaximizedChange: () => () => {},
    },
    settings: {
      get: () => ok(state.settings),
      save: (partial) => {
        Object.assign(state.settings, partial);
        return ok(state.settings);
      },
    },
    instances: {
      list: () => ok(state.instances.map((i) => ({ ...i }))),
      get: (id) => ok(state.instances.find((i) => i.id === id)),
      create: async (opts) => {
        const inst = {
          id: uid(),
          name: opts.name,
          icon: opts.loader || 'vanilla',
          mcVersion: opts.mcVersion,
          loader: opts.loader || 'vanilla',
          loaderVersion: opts.loaderVersion || null,
          versionId: null,
          installed: false,
          groupId: opts.groupId || 'default',
          createdAt: Date.now(),
          lastPlayed: null,
          javaMinMb: state.settings.defaultRamMin,
          javaMaxMb: state.settings.defaultRamMax,
          jvmArgs: '',
          javaPath: '',
        };
        state.instances.push(inst);
        return ok(inst);
      },
      update: (id, patch) => {
        const inst = state.instances.find((i) => i.id === id);
        Object.assign(inst, patch);
        return ok(inst);
      },
      delete: (id) => {
        state.instances = state.instances.filter((i) => i.id !== id);
        return ok(true);
      },
      duplicate: (id, newName) => {
        const src = state.instances.find((i) => i.id === id);
        const clone = { ...src, id: uid(), name: newName, createdAt: Date.now(), lastPlayed: null };
        state.instances.push(clone);
        return ok(clone);
      },
      install: async (id) => {
        const inst = state.instances.find((i) => i.id === id);
        const phases = ['locating', 'client-jar', 'libraries', 'assets', 'done'];
        for (const phase of phases) {
          for (let pct = 0; pct <= 100; pct += 25) {
            emit('installProgress', { instanceId: id, phase, message: `${phase} ${pct}%`, completed: pct, total: 100 });
            await delay(60);
          }
        }
        inst.installed = true;
        inst.versionId = inst.mcVersion;
        return ok(inst);
      },
      launch: async (id) => {
        runningSet.add(id);
        emit('logLine', { level: 'info', message: `[mock] Launching ${id}...` });
        setTimeout(() => {
          emit('instanceLog', { instanceId: id, stream: 'stdout', text: '[main/INFO] Setting user: Steve\n' });
        }, 300);
        return ok(1234);
      },
      kill: (id) => {
        runningSet.delete(id);
        emit('instanceExit', { instanceId: id, code: 0 });
        return ok(true);
      },
      isRunning: (id) => ok(runningSet.has(id)),
      openFolder: () => ok(true),
      createShortcut: () => ok(true),
      export: () => ok({ fileCount: 12, name: 'demo' }),
      import: () => ok(null),
      listContent: (id, kind) => ok(state.mockContent[kind] ? state.mockContent[kind].map((x) => ({ ...x })) : []),
      toggleContent: (id, kind, name) => {
        const item = (state.mockContent[kind] || []).find((x) => x.name === name);
        if (item) item.enabled = !item.enabled;
        return ok(true);
      },
      deleteContent: (id, kind, name) => {
        state.mockContent[kind] = (state.mockContent[kind] || []).filter((x) => x.name !== name);
        return ok(true);
      },
    },
    groups: {
      list: () => ok(state.groups),
      create: (name) => {
        const id = uid();
        state.groups.push({ id, name, order: state.groups.length });
        return ok(id);
      },
      rename: (id, name) => {
        const g = state.groups.find((x) => x.id === id);
        if (g) g.name = name;
        return ok(true);
      },
      delete: (id) => {
        state.groups = state.groups.filter((g) => g.id !== id);
        state.instances.forEach((i) => {
          if (i.groupId === id) i.groupId = 'default';
        });
        return ok(true);
      },
      moveInstance: (instanceId, groupId) => {
        const inst = state.instances.find((i) => i.id === instanceId);
        if (inst) inst.groupId = groupId;
        return ok(true);
      },
      reorderInstances: () => ok(true),
    },
    mc: {
      versionManifest: () => ok({ latest: { release: '1.21.8', snapshot: '24w33a' }, versions: MOCK_VERSIONS }),
      fabricLoaders: () => ok([{ version: '0.15.11', stable: true }, { version: '0.15.10', stable: true }, { version: '0.16.0', stable: false }]),
      fabricSupported: () => ok(MOCK_VERSIONS.map((v) => v.id)),
      forgeVersions: () => ok(['47.2.20', '47.2.0', '47.1.3']),
      forgeRecommended: () => ok('47.2.0'),
      neoforgeVersions: (mc) => ok(mc && mc.startsWith('1.20') ? ['20.1.80', '20.1.72'] : mc && parseFloat(mc.slice(2)) >= 21 ? ['21.1.65', '21.1.57'] : []),
      neoforgeSupported: (mc) => ok(mc >= '1.20.1'),
    },
    java: {
      findAll: () => ok([{ javaHome: 'C:\\Program Files\\Eclipse Adoptium\\jdk-21', major: 21, raw: 'openjdk version "21.0.3"' }]),
      recommend: (mc) => ok(mc >= '1.20.5' ? 21 : mc >= '1.17' ? 17 : 8),
      pickManually: () => ok(null),
    },
    accounts: {
      createOffline: (username) => {
        const acc = { id: uid(), type: 'offline', username, uuid: uid(), accessToken: '0' };
        state.settings.accounts.push(acc);
        state.settings.activeAccountId = acc.id;
        return ok(acc);
      },
      remove: (id) => {
        state.settings.accounts = state.settings.accounts.filter((a) => a.id !== id);
        return ok(true);
      },
      setActive: (id) => {
        state.settings.activeAccountId = id;
        return ok(true);
      },
      startMicrosoftSignIn: () => Promise.reject(new Error('Microsoft sign-in is not available in the browser preview.')),
      pollMicrosoftSignIn: () => Promise.reject(new Error('n/a')),
    },
    events: {
      onInstallProgress: (cb) => {
        listeners.installProgress.push(cb);
        return () => {};
      },
      onInstanceLog: (cb) => {
        listeners.instanceLog.push(cb);
        return () => {};
      },
      onInstanceExit: (cb) => {
        listeners.instanceExit.push(cb);
        return () => {};
      },
      onLogLine: (cb) => {
        listeners.logLine.push(cb);
        return () => {};
      },
    },
  };
})();
