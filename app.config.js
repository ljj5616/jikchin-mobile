const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

const reanimatedStaging = `
// Use a shorter CMake staging directory for Reanimated on Windows.
def reanimatedProject = findProject(':react-native-reanimated')
reanimatedProject?.plugins?.withId('com.android.library') {
    reanimatedProject.androidComponents.finalizeDsl { library ->
        library.externalNativeBuild.cmake.buildStagingDirectory = rootProject.file('.cxx/reanimated')
    }
}
`;

const appObjectPaths = `
// Shorten object paths generated for autolinked libraries on Windows.
android {
    externalNativeBuild {
        cmake {
            buildStagingDirectory rootProject.file('../.expo/cxx')
        }
    }
    defaultConfig {
        externalNativeBuild {
            cmake {
                arguments '-DCMAKE_OBJECT_PATH_MAX=259'
            }
        }
    }
}
`;

module.exports = ({ config }) => {
  if (process.platform === 'win32') {
    config = withProjectBuildGradle(config, (gradleConfig) => {
      if (!gradleConfig.modResults.contents.includes(reanimatedStaging)) {
        gradleConfig.modResults.contents += reanimatedStaging;
      }
      return gradleConfig;
    });
    config = withAppBuildGradle(config, (gradleConfig) => {
      if (!gradleConfig.modResults.contents.includes(appObjectPaths)) {
        gradleConfig.modResults.contents += appObjectPaths;
      }
      return gradleConfig;
    });
  }

  const kakaoAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim();
  if (!kakaoAppKey) return config;

  return {
    ...config,
    plugins: [
      ...config.plugins,
      ['@react-native-kakao/core', {
        nativeAppKey: kakaoAppKey,
        android: { authCodeHandlerActivity: true },
      }],
    ],
  };
};
