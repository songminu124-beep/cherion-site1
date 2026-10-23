# 채리온 Cloudflare Workers 프로젝트

이 프로젝트는 Pages Functions가 아닌 **Cloudflare Workers + Static Assets** 방식입니다. 기존 채리온 디자인과 `workers.dev` 주소를 유지할 수 있습니다.

## GitHub 저장소에 올릴 파일
ZIP 압축을 풀고 폴더 안의 `public`, `src`, `wrangler.jsonc`, `package.json`, `schema.sql`, `README_KO.md`를 저장소 루트에 올립니다. 기존의 `functions` 폴더는 이 Worker 버전에서 사용하지 않습니다.

## 배포
1. Cloudflare에서 기존 `cherion-site` Worker의 Git 연동/빌드 설정을 열어 저장소를 연결합니다.
2. Build command는 `npm install && npx wrangler deploy`로 설정합니다. Build output directory는 사용하지 않습니다. `wrangler.jsonc`가 `public` 정적 자산과 `src/index.js` Worker를 설정합니다.
3. 배포 후 Worker → Settings → Bindings에서 D1 database binding을 추가합니다. Variable name은 `DB`, Database는 기존 `cherion-db`입니다.
4. Worker → Settings → Variables and Secrets에서 다음 두 값을 **Secret**으로 추가합니다.
   - `ADMIN_PASSWORD`: 관리자 로그인 비밀번호
   - `SESSION_SECRET`: 최소 40자 이상의 무작위 비밀 문자열
5. 저장 후 재배포합니다.
6. D1 데이터베이스에서 `schema.sql` 전체를 실행합니다. 기존 테이블을 만들었다면 `CREATE TABLE IF NOT EXISTS` 및 `INSERT OR IGNORE`는 다시 실행해도 됩니다.
7. 사이트 아래의 관리자 버튼에서 로그인합니다.

## 중요한 점
- Worker는 API 요청(`/api/*`)을 서버 코드로 처리하고, 나머지 파일은 `public`에서 제공합니다.
- `DB` 바인딩 또는 Secret이 없으면 API가 오류를 반환합니다.
- 채팅에 이미 입력한 비밀번호는 사용하지 말고, 새롭고 고유한 비밀번호를 `ADMIN_PASSWORD`로 설정하세요.
- 관리자 소개 영역은 아직 포함하지 않았습니다.
