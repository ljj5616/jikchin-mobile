import Constants, { ExecutionEnvironment } from 'expo-constants';

import type { SocialProvider } from './auth-api';

function requireSetting(value: string | undefined, name: string) {
  if (!value?.trim()) throw new Error(`로그인 설정이 필요해요. ${name} 값을 확인해 주세요.`);
  return value.trim();
}

function errorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error;
  if (typeof code === 'string' && /^[a-zA-Z0-9_-]{1,50}$/.test(code)) return code;
  if (typeof code === 'number' && Number.isInteger(code)) return String(code);
  return undefined;
}

async function googleToken() {
  const webClientId = requireSetting(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  const { GoogleSignin, statusCodes } = await import('@react-native-google-signin/google-signin').catch(() => {
    throw new Error('Google 로그인 모듈을 열 수 없어요. Android 개발 빌드를 다시 설치해 주세요.');
  });
  try {
    GoogleSignin.configure({ webClientId });
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return null;
    if (response.data.idToken) return response.data.idToken;
  } catch (error) {
    const code = errorCode(error);
    if (code === statusCodes.SIGN_IN_CANCELLED) return null;
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play 서비스가 필요해요. 에뮬레이터의 Google Play 이미지를 확인해 주세요.');
    }
    if (code === '10') {
      throw new Error('Google 로그인 설정을 확인해 주세요. Android 패키지 이름과 SHA-1이 일치해야 해요. (코드 10)');
    }
    throw new Error(`Google 인증에 실패했어요.${code ? ` (코드 ${code})` : ''}`);
  }
  throw new Error('Google ID 토큰을 받지 못했어요. Google 웹 클라이언트 ID를 확인해 주세요.');
}

async function kakaoToken() {
  const appKey = requireSetting(process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY, 'EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY');
  try {
    const { initializeKakaoSDK } = await import('@react-native-kakao/core');
    const { login } = await import('@react-native-kakao/user');
    await initializeKakaoSDK(appKey);
    const { accessToken } = await login();
    if (accessToken) return accessToken;
  } catch (error) {
    const code = errorCode(error);
    if (code?.toLowerCase() === 'cancelled') return null;
    throw new Error(`카카오 인증에 실패했어요. 앱 키와 Android 키 해시를 확인해 주세요.${code ? ` (코드 ${code})` : ''}`);
  }
  throw new Error('카카오에서 액세스 토큰을 받지 못했어요.');
}

async function naverToken() {
  const consumerKey = requireSetting(process.env.EXPO_PUBLIC_NAVER_CLIENT_ID, 'EXPO_PUBLIC_NAVER_CLIENT_ID');
  const consumerSecret = requireSetting(process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET, 'EXPO_PUBLIC_NAVER_CLIENT_SECRET');
  let code: string | undefined;
  try {
    const { default: NaverLogin } = await import('@react-native-seoul/naver-login');
    NaverLogin.initialize({ appName: '직관친구', consumerKey, consumerSecret });
    const { successResponse, failureResponse } = await NaverLogin.login();
    if (failureResponse?.isCancel) return null;
    if (successResponse?.accessToken) return successResponse.accessToken;
    code = failureResponse?.lastErrorCodeFromNaverSDK;
  } catch (error) {
    code = errorCode(error);
  }
  const suffix = code && /^[a-zA-Z0-9_-]{1,50}$/.test(code) ? ` (코드 ${code})` : '';
  throw new Error(`네이버 인증에 실패했어요. 네이버 앱 등록과 Client ID를 확인해 주세요.${suffix}`);
}

export async function getSocialToken(provider: SocialProvider): Promise<string | null> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    throw new Error('소셜 로그인은 Expo 개발 빌드가 필요해요. npx expo run:android로 실행해 주세요.');
  }

  switch (provider) {
    case 'google': return googleToken();
    case 'kakao': return kakaoToken();
    case 'naver': return naverToken();
  }
}
