# BAKEWEB 견적서 웹 저장 설정

## 1. Supabase 프로젝트 만들기

Supabase에서 새 프로젝트를 만든 뒤 프로젝트가 준비될 때까지 기다립니다.

## 2. 데이터베이스 테이블과 보안 정책 적용

Supabase의 SQL Editor에서 [supabase-schema.sql](./supabase-schema.sql) 내용을 실행합니다. 이 SQL은 견적서 테이블을 만들고 로그인 사용자별 행 수준 보안(RLS)을 적용합니다.

## 3. BAKEWEB 관리자 계정 만들기

Supabase 대시보드의 Authentication → Users에서 관리자 이메일 계정을 생성합니다. 비밀번호는 소스 코드에 입력하지 않습니다.

## 4. 공개 연결 정보 입력

[config.js](./config.js)의 아래 두 값만 입력합니다.

```js
// 브라우저에서 사용하도록 발급된 공개 프로젝트 정보입니다.
window.BAKEWEB_CONFIG = Object.freeze({
  // Supabase Project URL을 입력합니다.
  supabaseUrl: 'https://xxxxxxxxxxxx.supabase.co',
  // Publishable key 또는 legacy anon key를 입력합니다.
  supabasePublishableKey: 'sb_publishable_xxxxxxxxxxxx'
});
```

`service_role`, `secret key` 등 관리자 비밀 키는 브라우저 파일이나 GitHub에 절대 입력하지 않습니다.

## 5. 로그인 및 저장 확인

웹앱을 새로 열어 생성한 관리자 이메일과 비밀번호로 로그인합니다. 견적서를 작성하고 `웹에 저장`을 누른 다음 `저장 목록`에서 다시 열리는지 확인합니다.
