// Bundles extra app icons so App Store Connect Product Page Optimization can A/B test them.
// The app never switches icons itself, so no Info.plist entries or native module are needed.
// Usage in app.json: ["./plugins/withAlternateIcons", { "AppIcon-Ringing": "./assets/images/icon-ringing.png" }]
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = (config, icons) => {
  config = withDangerousMod(config, ['ios', (cfg) => {
    const { projectRoot, platformProjectRoot, projectName } = cfg.modRequest;
    const catalog = path.join(platformProjectRoot, projectName, 'Images.xcassets');
    for (const [name, file] of Object.entries(icons)) {
      const dir = path.join(catalog, `${name}.appiconset`);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(projectRoot, file), path.join(dir, 'icon.png'));
      fs.writeFileSync(path.join(dir, 'Contents.json'), JSON.stringify({
        images: [{ filename: 'icon.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
        info: { author: 'expo', version: 1 },
      }, null, 2));
    }
    return cfg;
  }]);

  return withXcodeProject(config, (cfg) => {
    const section = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(section)) {
      const settings = entry.buildSettings;
      if (!settings || !settings.ASSETCATALOG_COMPILER_APPICON_NAME) continue; // app target only
      settings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = `"${Object.keys(icons).join(' ')}"`;
      settings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = 'YES';
    }
    return cfg;
  });
};
