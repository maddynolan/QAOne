/**
 * Electron Builder Configuration (CommonJS for electron-builder)
 * Creates distributable installers for Windows, macOS, and Linux
 */

module.exports = {
  // Application ID
  appId: "com.flowstral.desktop",
  productName: "Flowstral",
  copyright: "Copyright © 2025 Flowstral Inc.",

  // Build directories
  directories: {
    output: "dist-electron",
    buildResources: "electron/resources",
  },

  // Files to include
  files: [
    "dist/**/*",
    "electron/**/*",
    "!electron/resources/*",
  ],

  // Extra resources (copied to app root)
  extraResources: [
    {
      from: "electron/resources/",
      to: "resources/",
      filter: ["**/*"],
    },
  ],

  // Windows configuration
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    icon: "electron/resources/icon.ico",
    artifactName: "Flowstral-Setup.${ext}",
  },

  // NSIS installer configuration (Windows)
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Flowstral",
    installerIcon: "electron/resources/icon.ico",
    uninstallerIcon: "electron/resources/icon.ico",
    installerHeaderIcon: "electron/resources/icon.ico",
    license: "LICENSE",
    runAfterFinish: true,
  },

  // macOS configuration
  mac: {
    target: [
      {
        target: "dmg",
        arch: ["x64", "arm64"],
      },
    ],
    icon: "electron/resources/icon.icns",
    artifactName: "Flowstral-${version}-${arch}.${ext}",
    category: "public.app-category.developer-tools",
    darkModeSupport: true,
    hardenedRuntime: true,
    gatekeeperAssess: false,
  },

  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
    window: { width: 540, height: 380 },
  },

  linux: {
    target: [
      { target: "AppImage", arch: ["x64"] },
      { target: "deb", arch: ["x64"] },
    ],
    icon: "electron/resources/icons",
    artifactName: "Flowstral-${version}-${arch}.${ext}",
    category: "Development",
    synopsis: "No-Code QA Platform",
    description: "Flowstral - The complete no-code QA platform for modern teams",
  },

  publish: {
    provider: "generic",
    url: "https://releases.flowstral.com/",
  },

  afterSign: async (context) => {
    if (process.platform === "darwin" && process.env.NOTARIZE) {
      const { notarize } = await import("electron-notarize");
      await notarize({
        appBundleId: context.packager.appInfo.id,
        appPath: `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
      });
    }
  },
};
