/**
 * Expo Config Plugin to fix AndroidX duplicate class conflicts
 * This resolves issues between androidx.* and com.android.support.* libraries
 * 
 * @type {import('expo/config-plugins').ConfigPlugin}
 */

import { withAppBuildGradle } from "expo/config-plugins";

function addAndroidXConfigurations(buildGradle) {
  // Add configurations block to exclude duplicate support library classes
  const configurationsBlock = `
configurations.all {
    resolutionStrategy {
        // Force AndroidX versions
        force 'androidx.core:core:1.12.0'
        force 'androidx.core:core-ktx:1.12.0'
        force 'androidx.appcompat:appcompat:1.6.1'
        force 'androidx.versionedparcelable:versionedparcelable:1.1.1'
    }
    // Exclude old support library modules that conflict with AndroidX
    exclude group: 'com.android.support', module: 'support-v4'
    exclude group: 'com.android.support', module: 'support-compat'
    exclude group: 'com.android.support', module: 'support-core-utils'
    exclude group: 'com.android.support', module: 'support-core-ui'
    exclude group: 'com.android.support', module: 'support-fragment'
    exclude group: 'com.android.support', module: 'support-media-compat'
    exclude group: 'com.android.support', module: 'versionedparcelable'
    exclude group: 'com.android.support', module: 'collections'
    exclude group: 'com.android.support', module: 'cursoradapter'
    exclude group: 'com.android.support', module: 'drawerlayout'
    exclude group: 'com.android.support', module: 'interpolator'
    exclude group: 'com.android.support', module: 'loader'
    exclude group: 'com.android.support', module: 'localbroadcastmanager'
    exclude group: 'com.android.support', module: 'print'
    exclude group: 'com.android.support', module: 'viewpager'
    exclude group: 'com.android.support', module: 'coordinatorlayout'
    exclude group: 'com.android.support', module: 'asynclayoutinflater'
    exclude group: 'com.android.support', module: 'swiperefreshlayout'
    exclude group: 'com.android.support', module: 'slidingpanelayout'
    exclude group: 'com.android.support', module: 'customview'
    exclude group: 'com.android.support', module: 'documentfile'
}
`;

  // Check if configurations block already exists
  if (buildGradle.includes("configurations.all")) {
    return buildGradle;
  }

  // Add after the last closing brace of android block or at the end
  const androidBlockEnd = buildGradle.lastIndexOf("}");
  if (androidBlockEnd !== -1) {
    return (
      buildGradle.slice(0, androidBlockEnd + 1) +
      "\n" +
      configurationsBlock +
      buildGradle.slice(androidBlockEnd + 1)
    );
  }

  return buildGradle + "\n" + configurationsBlock;
}

const withAndroidXFix = (config) => {
  // Modify app/build.gradle
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = addAndroidXConfigurations(
      config.modResults.contents
    );
    return config;
  });
};

export default withAndroidXFix;
