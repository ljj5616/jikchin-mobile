import type { SocialProvider } from './auth-api';

export async function getSocialToken(_provider: SocialProvider): Promise<string | null> {
  throw new Error('소셜 로그인은 Android 개발 빌드에서 테스트해 주세요.');
}
