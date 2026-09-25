import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'Buzzed',
    appBundleId: 'com.personal.buzzed',
    appCategoryType: 'public.app-category.utilities',
    icon: './build/Buzzed.icns',
    extendInfo: {
      LSUIElement: true,
    },
    extraResource: ['assets'],
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG(
      {
        name: 'Buzzed',
        background: './build/dmg-background.png',
        icon: './build/Buzzed.icns',
        iconSize: 96,
        format: 'ULFO',
        overwrite: true,
        contents: (options) => [
          { x: 190, y: 270, type: 'file', path: options.appPath },
          { x: 468, y: 270, type: 'link', path: '/Applications' },
        ],
        additionalDMGOptions: {
          window: {
            size: { width: 658, height: 498 },
          },
        },
      },
      ['darwin'],
    ),
    new MakerZIP({}, ['darwin']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'timer_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
