# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Android 에뮬레이터에서 소셜 로그인 테스트

`jikchin-mobile`의 `.env.local`에 로컬 백엔드 주소와 테스트할 제공자의 Android 앱 등록값을 설정합니다.

```dotenv
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=
EXPO_PUBLIC_NAVER_CLIENT_ID=
EXPO_PUBLIC_NAVER_CLIENT_SECRET=
```

- **Google**은 백엔드 `GOOGLE_CLIENT_ID`와 동일한 웹 OAuth 클라이언트 ID를 사용합니다. Google Cloud에서 Android OAuth 클라이언트에 패키지 `com.jikchin.mobile`과 개발 빌드의 서명 SHA-1을 등록합니다.
- **카카오**는 네이티브 앱 키를 사용합니다. Kakao Developers에서 Android 플랫폼에 패키지 `com.jikchin.mobile`과 개발 빌드의 키 해시를 등록하고 카카오 로그인을 활성화합니다.
- **네이버**는 Android SDK용 Client ID와 Client Secret을 사용합니다. 네이버 개발자 센터의 Android 앱 등록에 패키지 `com.jikchin.mobile`을 추가합니다. `EXPO_PUBLIC_` 값은 앱 번들에 포함되므로 서버 전용 비밀키는 백엔드 환경변수에 보관합니다.

Android 에뮬레이터와 Docker Desktop을 켭니다. 백엔드 `jikchin` 폴더에서 `docker compose up --build -d`를 실행하고, 에뮬레이터에서 `http://10.0.2.2:8080/swagger-ui/index.html`이 열리는지 확인합니다.

Expo 앱 폴더에서 아래 명령으로 개발 빌드를 설치합니다. 카카오 앱 키를 추가하거나 바꾸면 첫 번째 명령으로 네이티브 설정을 다시 생성합니다.

```powershell
npx.cmd expo prebuild --platform android
npx.cmd expo run:android
```

로그인 버튼을 눌러 제공자 인증을 완료합니다. 신규 계정은 프로필 등록으로, 기존 계정은 홈으로 이동합니다. 연결 실패, 제공자 설정 오류, 서버 HTTP 오류는 로그인 화면에 표시되며 오류 문구를 길게 눌러 복사할 수 있습니다. 서버 오류의 상세 로그는 백엔드 폴더에서 `docker compose logs --tail=100 app`으로 확인합니다. 프로필 사진을 직접 올리려면 백엔드 S3 설정도 필요합니다.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **example** directory and create a blank **src/app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
