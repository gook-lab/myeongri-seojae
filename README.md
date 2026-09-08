# 명리서재

**한국어** | [English](README.en.md)

**인생을 10년 단위로 펼쳐보는 사주 사이트.**
겁주지 않고, 점수 매기지 않고, 생년월일을 가져가지 않습니다.

<sub>React 19 · TypeScript · Vite · Tailwind v4 · Zustand · Vitest · Playwright · MCP</sub>

[Demo](https://saju-blond-six.vercel.app) · [정확도 검증](docs/accuracy.md) · [화면과 움직임](docs/ux.md)

---

하루의 운세를 점수로 보여주는 대신, 사용자가 지나온 시기와 앞으로의 흐름을 10년 단위 타임라인에서 비교할 수 있도록 만들었습니다. 결과를 맞다고 단정하기보다 계산 기준을 함께 보여주고 사용자가 자신의 경험과 대조하도록 구성했습니다.

대운이 시작되는 시점과 일주는 작은 계산 차이도 전체 타임라인에 영향을 줍니다. 서로 다른 구현과 천체력 데이터를 대조하고, 날짜·시간대·절기 경계 조건을 테스트해 계산 결과를 검증했습니다.

## 화면

| 첫 화면 | 계산 근거 | 인생 타임라인 |
|:--:|:--:|:--:|
| <img src="docs/screenshots/01-intro.png" width="240"> | <img src="docs/screenshots/04-calculating.png" width="240"> | <img src="docs/screenshots/05-result.png" width="240"> |
| 서비스의 해석 기준과 개인정보 처리 방식을 먼저 안내 | 계산 과정에서 확인한 값을 단계별로 표시 | 사주팔자표보다 대운 타임라인을 먼저 제시 |

| 궁합 | 상세 풀이 | 인생 리포트 |
|:--:|:--:|:--:|
| <img src="docs/screenshots/10-gunghap.png" width="240"> | <img src="docs/screenshots/07-detail.png" width="240"> | <img src="docs/screenshots/08-report.png" width="240"> |
| 단일 점수 대신 두 사람의 오행 관계를 항목별로 설명 | 궁위·오행 균형·용신을 별도 화면으로 구분 | 계산 근거를 함께 담은 A4 인쇄 문서 |

| 대운 펼침 | 생년월일은 어디로 갑니다 | 없는 주소 |
|:--:|:--:|:--:|
| <img src="docs/screenshots/06-card-open.png" width="240"> | <img src="docs/screenshots/13-privacy.png" width="240"> | <img src="docs/screenshots/12-404.png" width="240"> |
| 지나온 시기의 기록을 직접 남기며 결과와 비교 | 생년월일의 저장·전송 범위를 쉬운 문장으로 안내 | 잘못된 주소에서 이동할 경로를 안내 |

## 기술 스택

| | |
|---|---|
| **언어 · 빌드** | TypeScript 5.9 (`strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`) · Vite 6 |
| **UI** | React 19 · Tailwind CSS v4 (`@theme` 토큰) · 애니메이션은 **CSS 만** (라이브러리 0바이트) |
| **상태** | Zustand 5 — 라우팅도 상태로 (URL 에 생년월일을 안 남기려고) |
| **도메인 엔진** | 직접 구현 (`core/pillars.ts`) + 직접 생성한 절기표 (23.6KB) |
| **음력** | `korean-lunar-calendar` — 한국천문연구원 자료 |
| **관측** | `@sentry/react` — 생년월일 세탁 게이트를 통과해야만 나간다 |
| **테스트** | Vitest 3 (**558**) · Playwright 1.62 (**252**, 모바일·데스크톱·움직임 3프로젝트) |
| **검증 도구** | astronomy-engine (천체력) · lunar-javascript · manseryeok · **Python + skyfield/JPL DE421** |
| **통합** | Model Context Protocol SDK — 엔진을 MCP 도구 6개로 노출 |
| **CI** | GitHub Actions — tzdata 자가진단 → 타입 → 빌드 → 테스트 → E2E → 골든 재생성 diff |

### 실제 구현 범위

- **시간대·역법** — IANA tzdata, 진태양시, 두 타임라인 분리
- **천체 계산** — 태양 겉보기 황경, 삭(朔), 中氣로 윤달 판정
- **데이터 인코딩** — 절기 4,824개를 델타 + 36진수로 23.6KB
- **번들 예산 관리** — 진입 청크 250KB 를 CI 가 지킨다
- **프라이버시 엔지니어링** — 개인정보가 샐 수 있는 네 경로를 막고, 막혔는지를 테스트가 확인
- **접근성** — 용어를 설명하는 화면(관객이 사주 용어를 모른다), WCAG AA 색 대비를 **토큰에서 직접 계산해 테스트**, `prefers-reduced-motion`, 큰 글씨 모드, 44px 터치 타깃
- **검증 설계** — 정답지가 없는 대상(용신·신살)을 어떻게 검증하는가

## 핵심 요약

| | |
|---|---|
| 절기를 천체력과 대조 | 3,624 표본 · 최대 편차 **55.8초** |
| 일주를 율리우스일로 검증 | **73,414일** 전수 대조 |
| 구조 규칙 전수 (오호둔·오자시두법) | 11,172건 · 불일치 **0** |
| 파이썬 독립 구현과 대조 | 독립 계산 결과와 네 기둥 불일치 0 |
| 진입 청크 / 엔진 청크 | 250KB 예산 / **100KB** (계산 라이브러리 제거 후) |
| 음력 데이터 오류 수정 | 중국 음력과 한국 음력의 차이로 일부 날짜가 하루 어긋나는 문제 수정 |
| 개인정보 전송 경로 수정 | 외부 Google Fonts 요청을 제거하고 폰트를 자체 호스팅으로 전환 |

## 더 읽기

| 문서 | 내용 |
|---|---|
| [만세력 정확도](docs/accuracy.md) | 한국 표준시 이력 · 절기 · 일주 · 한국 음력 · 파이썬 검증 |
| [구조와 게이트](docs/architecture.md) | 설계 결정 · 번들 분할 · **배포 게이트 전 단계** · 손으로 돌리는 검증 |
| [해석](docs/interpretation.md) | 용신 · 신살 · **궁합** · **오늘/신년** · 리포트 · 대조표 · **용어** |
| [화면과 움직임](docs/ux.md) | 첫 화면 · 화면 구조 · 애니메이션 · 공유 링크 · **색 대비** · **폰트 자체 호스팅** |
| [MCP 서버](docs/mcp.md) | 엔진을 다른 AI 에게 도구로 여는 법 |

## 실행

```bash
pnpm install
pnpm dev                # 개발 서버
pnpm gate               # 타입 + MCP 빌드 + 단위 테스트
pnpm test:e2e           # Playwright
pnpm build:mcp          # MCP 서버 → dist-mcp/server.js
pnpm verify:python 150  # 파이썬 독립 구현과 대조 (환경 필요)
pnpm shots              # 문서용 스크린샷 갱신
pnpm docs:sync          # README 의 테스트 수를 실제와 맞춤
pnpm fonts              # 웹폰트를 우리 쪽으로 다시 받기
pnpm gen:terms          # 절기표 다시 생성
```

## 미구현 범위

- **KASI 공식 대조** — 절기는 천체력으로 직접 검증했습니다(위 "절기" 절). 그 위에
  공식 기관 값까지 맞춰보는 건 `pnpm verify:kasi` 로 남겨뒀는데,
  공공데이터포털 키 발급이 사람 손을 타는 절차라 아직 실키로 못 돌려봤습니다.
  응답 형태를 문서로만 보고 맞췄으므로 처음 돌릴 때 `--raw` 로 확인이 필요합니다
- **파이썬 검증의 자동화** — `pnpm verify:python` 은 손으로 돌립니다. 천체력
  17MB 를 CI 에 매달 만하지는 않아서, 큰 변경 뒤에 사람이 한 번 돌리는
  절차로 남겨뒀습니다
- **1911년 이전 음력** — 한국 음력 자료가 그 구간에서 KST 규칙과 여덟 번
  어긋납니다. 대한제국이 표준시를 정하기 전이라 어느 기준이 맞는지부터
  정해야 합니다. 1900~1911년생은 지금도 계산되지만 음력 입력의 정밀도가
  그 뒤 구간보다 낮습니다

---

## 라이선스

**Source-available — 오픈소스가 아닙니다.** 코드를 읽을 수 있게 공개했을 뿐,
사용 권한을 드린 것은 아닙니다. 다른 프로젝트에 가져다 쓰거나 재배포·상업적 이용을
하려면 사전 서면 허락이 필요합니다. 전문은 [LICENSE](LICENSE), 한국어 안내는 [LICENSE.ko.md](LICENSE.ko.md) 참조.
