/**
 * 명리서재 E2E — 사용자 플로우
 *
 * 단위 테스트는 계산이 맞는지 본다. 여기서는 사람이 끝까지 갈 수 있는지 본다.
 *
 * 기준선: 설계 rev.2 성공 기준 7 —
 * "부모님께 링크를 보내드렸을 때, 도움 없이 결과 화면까지 도달하신다."
 * 그래서 대표 시나리오가 1957년생 · 음력 · 시간 미상이다.
 */

import { expect, openApp, test } from './fixtures';

/** 생년월일을 셀렉트로 채운다 */
async function fillBirth(
  page: import('@playwright/test').Page,
  year: string,
  month: string,
  day: string,
) {
  await page.getByLabel('년', { exact: true }).selectOption(year);
  await page.getByLabel('월', { exact: true }).selectOption(month);
  await page.getByLabel('일', { exact: true }).selectOption(day);
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  // 원안 와이어플로우대로 홈 → 사주 보기로 들어간다
  await page.getByRole('button', { name: /^사주 보기/ }).click();
});

test('첫 화면에서 시간 미상이 이미 골라져 있다', async ({ page }) => {
  // 모르는 게 예외가 아니라 기본값인 관객이다
  await expect(page.getByRole('button', { name: '모릅니다' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText(/태어난 시각을 몰라도 대운은 계산할 수 있습니다/)).toBeVisible();
});

test('양력 + 시간 미상으로 타임라인까지 간다', async ({ page }) => {
  await fillBirth(page, '1957', '6', '15');
  await page.getByRole('button', { name: '사주 풀어보기' }).click();

  const timeline = page.getByRole('region', { name: '대운 인생 타임라인' });
  await expect(timeline).toBeVisible();

  // 대운 10칸이 전부 나온다
  await expect(timeline.locator('ol > li')).toHaveCount(10);

  // 시각을 몰라도 정확하다는 안내
  await expect(page.getByText(/대운 시작 계산에는 태어난 시각을 사용하지 않습니다/)).toBeVisible();
});

test('음력 + 윤달로도 타임라인까지 간다', async ({ page }) => {
  await page.getByRole('button', { name: '음력' }).click();
  await expect(page.getByLabel('윤달로 태어났습니다')).toBeVisible();
  await page.getByLabel('윤달로 태어났습니다').check();

  await fillBirth(page, '2023', '2', '15');
  await page.getByRole('button', { name: '사주 풀어보기' }).click();

  await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();
});

test('없는 윤달을 고르면 조용히 틀리지 않고 안내한다', async ({ page }) => {
  await page.getByRole('button', { name: '음력' }).click();
  await page.getByLabel('윤달로 태어났습니다').check();
  // 2026년에는 윤달이 없다
  await fillBirth(page, '2026', '2', '15');
  await page.getByRole('button', { name: '사주 풀어보기' }).click();

  await expect(page.getByRole('alert')).toContainText('윤달이 없습니다');
  // 결과 화면으로 넘어가지 않는다
  await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toHaveCount(0);
});

test('현재 대운이 강조되고 기본으로 펼쳐진다', async ({ page }) => {
  await fillBirth(page, '1957', '6', '15');
  await page.getByRole('button', { name: '사주 풀어보기' }).click();

  const timeline = page.getByRole('region', { name: '대운 인생 타임라인' });
  await expect(timeline.getByText('지금', { exact: true })).toHaveCount(1);

  // 펼쳐진 칸이 정확히 하나
  await expect(timeline.locator('button[aria-expanded="true"]')).toHaveCount(1);
  await expect(timeline.getByText('지금 지나고 있는 10년입니다.')).toBeVisible();
});

test('지나온 대운을 펼치면 대조를 권한다', async ({ page }) => {
  await fillBirth(page, '1957', '6', '15');
  await page.getByRole('button', { name: '사주 풀어보기' }).click();

  const timeline = page.getByRole('region', { name: '대운 인생 타임라인' });
  // 첫 칸은 반드시 과거다 (1957년생 기준)
  await timeline.locator('ol > li').first().getByRole('button').first().click();

  await expect(timeline.getByText('이미 지나온 10년입니다. 당시의 경험과 비교해볼 수 있습니다.')).toBeVisible();
});

test('시간 미상이어도 사주팔자표가 나오고 시주만 비어 있다', async ({ page }) => {
  await fillBirth(page, '1957', '6', '15');
  await page.getByRole('button', { name: '사주 풀어보기' }).click();

  const table = page.getByRole('region', { name: '사주팔자' });
  await expect(table).toBeVisible();
  await expect(table.getByText('시각미상')).toBeVisible();
  await expect(page.getByText(/여섯 글자를 기준으로 계산했습니다/)).toBeVisible();
});

test('★1954~61 구간★ 표준시 이력이 결과에 반영된다', async ({ page }) => {
  // 1957 입춘 = UTC 01:55. 당시 표준시 UTC+8:30 이므로 시계로 10:25.
  // KST 10:20 출생 → 입춘 이전 → 丙申(전년)
  // KST 10:30 출생 → 입춘 이후 → 丁酉(당년)
  // KST=UTC+9 로 가정하는 구현은 둘 다 丙申 으로 낸다.
  const yearPillar = async (hour: string, minute: string) => {
    await openApp(page);
    await page.getByRole('button', { name: /^사주 보기/ }).click();
    await page.getByRole('button', { name: '압니다' }).click();
    await fillBirth(page, '1957', '2', '4');
    await page.getByLabel('시', { exact: true }).selectOption(hour);
    await page.getByLabel('분', { exact: true }).selectOption(minute);
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    const table = page.getByRole('region', { name: '사주팔자' });
    await expect(table).toBeVisible();
    return table.locator('div > div').last().innerText();
  };

  expect(await yearPillar('10', '20')).toContain('丙');
  expect(await yearPillar('10', '30')).toContain('丁');
});

test('큰 글씨 모드가 가로 스크롤을 만들지 않는다', async ({ page }) => {
  await fillBirth(page, '1957', '6', '15');
  await page.getByRole('button', { name: '사주 풀어보기' }).click();
  await page.getByRole('button', { name: '아주 크게' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-scale', 'xlarge');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('공유 버튼이 펼친 카드에 나온다', async ({ page }) => {
  await fillBirth(page, '1957', '6', '15');
  await page.getByRole('button', { name: '사주 풀어보기' }).click();

  const timeline = page.getByRole('region', { name: '대운 인생 타임라인' });
  await expect(timeline.getByRole('button', { name: '이 10년 공유하기' })).toHaveCount(1);
});

test('다른 사람 사주 보기로 입력 화면에 돌아온다', async ({ page }) => {
  await fillBirth(page, '1957', '6', '15');
  await page.getByRole('button', { name: '사주 풀어보기' }).click();
  await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();

  await page.getByRole('button', { name: /^처음부터 다시/ }).click();
  await expect(page.getByRole('button', { name: '사주 풀어보기' })).toBeVisible();
});

test('세부 설정은 접혀 있고 열면 기본값이 보인다', async ({ page }) => {
  const toggle = page.getByRole('button', { name: /세부 설정/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();

  await expect(page.getByLabel('태어난 지역')).toHaveValue('126.978');
  await expect(page.getByRole('button', { name: '일주 유지' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel(/균시차 보정/)).not.toBeChecked();
});

test('★프라이버시★ URL 에 생년월일이 남지 않는다', async ({ page }) => {
  await fillBirth(page, '1957', '6', '15');
  await page.getByRole('button', { name: '사주 풀어보기' }).click();
  await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();

  const url = page.url();
  expect(url).not.toContain('1957');
  expect(url).not.toContain('#');
});

test('콘솔 에러 없이 전체 플로우가 끝난다', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await openApp(page);
  await page.getByRole('button', { name: /^사주 보기/ }).click();
  await fillBirth(page, '1957', '6', '15');
  await page.getByRole('button', { name: '사주 풀어보기' }).click();
  await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();
  await page.getByRole('button', { name: '아주 크게' }).click();

  expect(errors).toEqual([]);
});

test.describe('원안 구조 — 홈 네비 + 별도 화면', () => {
  test('★사주를 보기 전에는 부가 기능이 비활성화된다★', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('button', { name: /^사주 보기/ })).toBeVisible();
    await expect(page.getByText('사주를 먼저 보면 아래 메뉴가 열립니다')).toBeVisible();

    for (const name of ['오늘', '궁합', '신년']) {
      await expect(page.getByRole('button', { name: new RegExp(name) })).toBeDisabled();
    }
  });

  test('사주 없이 궁합을 선택할 수 없다', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('button', { name: /궁합/ })).toBeDisabled();
  });

  test('사주를 보고 나면 홈에서 부가 화면이 열린다', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /홈으로/ }).click();

    await expect(page.getByText('최근에 계산한 명식을 기준으로 봅니다')).toBeVisible();
    await expect(page.getByText('생년월일부터')).toHaveCount(0);
  });

  test('홈에서 저장한 사주와 기록을 바로 지울 수 있다', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /홈으로/ }).click();

    await page.getByRole('button', { name: '저장한 사주 지우기' }).click();
    await expect(page.getByText('저장한 사주와 대운 기록을 지울까요? 되돌릴 수 없습니다.')).toBeVisible();
    await page.getByRole('button', { name: '저장한 정보 지우기' }).click();

    await expect(page.getByRole('button', { name: /^사주 보기/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /궁합/ })).toBeDisabled();
    const saved = await page.evaluate(() => ({
      reading: localStorage.getItem('myeongri.reading.v1'),
      notes: localStorage.getItem('myeongri.notes.v1'),
      intro: localStorage.getItem('myeongri.seen-intro.v1'),
    }));
    expect(saved).toEqual({ reading: null, notes: null, intro: '1' });
  });

  test('궁합이 독립 화면으로 열리고 시각 없이 동작한다', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /홈으로/ }).click();
    await page.getByRole('button', { name: /궁합/ }).click();

    const screen = page.getByRole('region', { name: '궁합' });
    await expect(screen).toBeVisible();
    // 타임라인은 이 화면에 없다 — 쌓지 않았다는 뜻
    await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toHaveCount(0);

    await screen.getByLabel('상대 년').selectOption('1960');
    await screen.getByLabel('상대 월').selectOption('3');
    await screen.getByLabel('상대 일').selectOption('12');
    await screen.getByRole('button', { name: '궁합 보기' }).click();
    // 결과가 여러 덩이로 나온다 — 일간 관계 덩이만 짚는다
    await expect(screen.getByText(/^일간 /).first()).toBeVisible();
  });

  test('오늘·신년도 독립 화면이다', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /홈으로/ }).click();

    await page.getByRole('button', { name: /^오늘/ }).click();
    await expect(page.getByRole('region', { name: '오늘의 운세' })).toBeVisible();
    await expect(page.getByRole('button', { name: '인쇄 · PDF로 저장' })).toBeVisible();
    await page.getByRole('button', { name: '‹ 홈' }).click();

    await page.getByRole('button', { name: /^신년/ }).click();
    const year = page.getByRole('region', { name: /년 운세/ });
    await expect(year).toBeVisible();
    await expect(year.locator('ol > li')).toHaveCount(12);
    await expect(page.getByRole('button', { name: '인쇄 · PDF로 저장' })).toBeVisible();
  });

  test('궁합 결과가 나온 뒤 PDF 저장 기능이 열린다', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /홈으로/ }).click();
    await page.getByRole('button', { name: /^궁합/ }).click();

    await expect(page.getByRole('button', { name: '인쇄 · PDF로 저장' })).toHaveCount(0);
    await page.getByRole('button', { name: '궁합 보기' }).click();
    await expect(page.getByRole('button', { name: '인쇄 · PDF로 저장' })).toBeVisible();
  });

  test('부가 운세를 인쇄할 때 화면 조작부를 숨긴다', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /홈으로/ }).click();
    await page.getByRole('button', { name: /^신년/ }).click();

    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: '인쇄 · PDF로 저장' })).toBeHidden();
    await expect(page.getByRole('button', { name: '‹ 홈' })).toBeHidden();
    await expect(page.getByRole('button', { name: `${new Date().getFullYear()}년` })).toBeHidden();
    await expect(page.getByRole('heading', { name: '신년 운세' })).toBeVisible();
  });

  // 화면마다 처음부터 다시 들어간다. 결과 화면 버튼이 늘어나도 안 흔들린다.
  for (const label of ['오늘', '신년']) {
    test(`★${label} 화면에 점수 배지가 없다★`, async ({ page }) => {
      await fillBirth(page, '1957', '6', '15');
      await page.getByRole('button', { name: '사주 풀어보기' }).click();
      await page.getByRole('button', { name: /^홈으로/ }).click();
      await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();

      const text = await page.locator('body').innerText();
      expect(text, `${label} 화면`).not.toMatch(/\d+\s*점/);
    });
  }

  test('결과 화면에 부가 기능이 쌓여 있지 않다', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();

    // 결과 화면에는 타임라인과 사주팔자만. 상세 풀이는 별도 화면이다.
    await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();
    await expect(page.getByRole('region', { name: '사주팔자' })).toBeVisible();
    await expect(page.getByRole('region', { name: '궁위' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: '오행 균형' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: '부가 운세' })).toHaveCount(0);
  });
});

test.describe('십이운성 — 그 10년의 힘', () => {
  test('대운 칸마다 십이운성과 힘 막대가 나온다', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();

    const timeline = page.getByRole('region', { name: '대운 인생 타임라인' });
    const cards = timeline.locator('ol > li');
    await expect(cards).toHaveCount(10);

    // 십이운성 열두 이름 중 하나가 각 칸에 있다
    const stages = ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'];
    for (let i = 0; i < 10; i += 1) {
      const text = await cards.nth(i).innerText();
      expect(stages.some((s) => text.includes(s)), `${i}번 칸: ${text}`).toBe(true);
    }
  });

  test('힘 막대 길이가 칸마다 다르다 (한 값으로 뭉개지 않는다)', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();

    // 계산 엔진이 동적 import 라서 렌더를 기다려야 한다.
    // 안 기다리면 번들이 커질수록 흔들린다 (실제로 그렇게 깨졌다).
    await expect(
      page.getByRole('region', { name: '대운 인생 타임라인' }).locator('ol > li'),
    ).toHaveCount(10);

    const widths = await page.evaluate(() =>
      [...document.querySelectorAll('ol li div[style*="width"]')].map(
        (el) => (el as HTMLElement).style.width,
      ),
    );
    expect(widths.length).toBe(10);
    expect(new Set(widths).size).toBeGreaterThanOrEqual(6);
  });

  test('펼치면 십이운성 설명이 나온다', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();

    const timeline = page.getByRole('region', { name: '대운 인생 타임라인' });
    const open = timeline.locator('button[aria-expanded="true"]');
    await expect(open).toHaveCount(1);
    // 펼친 칸 아래에 십이운성 한자 표기가 있다
    await expect(timeline.getByText(/[長沐冠建帝衰病死墓絕胎養]/).first()).toBeVisible();
  });

  test('신년 화면이 지금 대운과의 관계를 보여준다', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /홈으로/ }).click();
    await page.getByRole('button', { name: /^신년/ }).click();

    const year = page.getByRole('region', { name: /년 운세/ });
    await expect(year.getByText('지금 대운과의 관계')).toBeVisible();
    await expect(year.getByText(/대운 .{2} .+ · 세운 .{2}/)).toBeVisible();
  });
});

test.describe('원국 심화 — 궁위 · 오행 균형', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('button', { name: '압니다' }).click();
    await fillBirth(page, '1990', '5', '5');
    await page.getByLabel('시', { exact: true }).selectOption('9');
    await page.getByLabel('분', { exact: true }).selectOption('30');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: '상세 풀이 보기' }).click();
  });

  test('네 자리가 각각 다른 해석을 낸다', async ({ page }) => {
    const p = page.getByRole('region', { name: '궁위' });
    await expect(p).toBeVisible();
    const cards = p.locator('article');
    await expect(cards).toHaveCount(4);

    for (const label of ['년주', '월주', '일주', '시주']) {
      await expect(cards.filter({ hasText: label })).toHaveCount(1);
    }
    // 자리별 시기 안내가 있다
    await expect(p.getByText('초년 (0~20세 무렵)')).toBeVisible();
    await expect(p.getByText('말년 (60세 이후)')).toBeVisible();
  });

  test('★지장간이 표시된다 — 원본은 안 썼다★', async ({ page }) => {
    const p = page.getByRole('region', { name: '궁위' });
    await expect(p.getByText(/지장간 .+ · .+/).first()).toBeVisible();
  });

  test('오행 균형이 막대와 결손 안내를 낸다', async ({ page }) => {
    const b = page.getByRole('region', { name: '오행 균형' });
    await expect(b).toBeVisible();
    await expect(b.getByText(/여덟 자 중 8자를 셌습니다/)).toBeVisible();
    // 1990-05-05 09:30 은 목·수가 없다
    await expect(b.getByText(/목·수가 하나도 없습니다/)).toBeVisible();

    // 다섯 오행 막대가 다 있다
    const bars = b.locator('div[style*="width"]');
    await expect(bars).toHaveCount(5);
  });

  test('조사가 "이(가)" 같은 표기로 남지 않는다', async ({ page }) => {
    const text = await page.getByRole('region', { name: '오행 균형' }).innerText();
    expect(text).not.toMatch(/이\(가\)|은\(는\)|을\(를\)/);
  });

  test('오늘 화면이 지장간과 합충까지 보여준다', async ({ page }) => {
    /*
     * 예전에는 지지의 정기 십성 하나만 보여줬다. 이제 지지 안에 숨은
     * 천간을 전부 낸다 — 셋이 든 지지는 셋 다. 겉 글자 하나로만 읽으면
     * 그 날의 결이 한 줄로 납작해진다.
     */
    await page.getByRole('button', { name: /홈으로/ }).click();
    await page.getByRole('button', { name: /^오늘/ }).click();

    const s = page.getByRole('region', { name: '오늘의 운세' });
    await expect(s.getByText(/의 지장간/)).toBeVisible();
    await expect(
      s.getByText(/(비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인)/).first(),
    ).toBeVisible();
    await expect(s.getByText(/오늘 일진(이|과) 내 일지/)).toBeVisible();
  });
});

test.describe('용신 — 판정만 던지지 않는다', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('button', { name: '압니다' }).click();
    await fillBirth(page, '1990', '5', '5');
    await page.getByLabel('시', { exact: true }).selectOption('9');
    await page.getByLabel('분', { exact: true }).selectOption('30');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: '상세 풀이 보기' }).click();
  });

  test('★어떤 방법을 썼는지 밝힌다★', async ({ page }) => {
    const s = page.getByRole('region', { name: '신강 신약과 용신' });
    await expect(s).toBeVisible();
    await expect(s.getByText(/억부용신법\(抑扶用神法\) 기준입니다/)).toBeVisible();
    await expect(s.getByText(/다른 방법을 쓰면 답이 달라질 수 있습니다/)).toBeVisible();
  });

  test('판정과 함께 득령·득지·득세를 보여준다', async ({ page }) => {
    const s = page.getByRole('region', { name: '신강 신약과 용신' });
    await expect(s.getByText(/신강|중화|신약/).first()).toBeVisible();
    for (const f of ['득령 (得令)', '득지 (得地)', '득세 (得勢)']) {
      await expect(s.getByText(f)).toBeVisible();
    }
  });

  test('★자리별 계산을 펼쳐볼 수 있다★', async ({ page }) => {
    const s = page.getByRole('region', { name: '신강 신약과 용신' });
    const details = s.locator('details');
    await expect(details).toHaveCount(1);
    await details.locator('summary').click();

    // 일곱 자리가 전부 나온다 (일간 자신 제외)
    await expect(details.locator('li')).toHaveCount(7);
    // 부호가 붙은 숫자가 보인다
    await expect(details.getByText(/^[+−-]?\d/).first()).toBeVisible();
    // 무게 근거도 적혀 있다
    await expect(details.getByText(/월지가 가장 무겁습니다/)).toBeVisible();
  });

  test('용신과 도움·피할 기운이 나온다', async ({ page }) => {
    const s = page.getByRole('region', { name: '신강 신약과 용신' });
    await expect(s.getByText('용신 — 가장 필요한 기운')).toBeVisible();
    await expect(s.getByText(/도움 .+/)).toBeVisible();
    await expect(s.getByText(/색 .+ · 방위 .+/)).toBeVisible();
  });

  test('용신 섹션에도 점수가 없다', async ({ page }) => {
    const text = await page.getByRole('region', { name: '신강 신약과 용신' }).innerText();
    expect(text).not.toMatch(/\d+\s*점(?!수)/);
  });
});

test.describe('리포트 — 종이에 남는 물건', () => {
  test.beforeEach(async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /리포트/ }).click();
  });

  test('여섯 섹션이 한 문서에 담긴다', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /인생 리포트/ })).toBeVisible();
    for (const t of ['사주팔자', '인생 타임라인', '일간의 힘과 용신', '인생의 네 자리', '오행 균형', '풀이']) {
      await expect(page.getByRole('heading', { name: t, exact: true })).toBeVisible();
    }
  });

  test('★계산 근거가 문서에 실린다★', async ({ page }) => {
    await expect(page.getByText('계산 근거')).toBeVisible();
    // 1957-06-15 은 서머타임 구간이라 UTC+9:30
    await expect(page.getByText(/한국 표준시 UTC\+9:30/)).toBeVisible();
    await expect(page.getByText(/서머타임 적용 중/)).toBeVisible();
    await expect(page.getByText(/진태양시 보정 −62분 05초/)).toBeVisible();
  });

  test('시간 미상이면 그 사실과 영향을 적는다', async ({ page }) => {
    await expect(page.getByText(/태어난 시각을 입력하지 않았습니다/)).toBeVisible();
    await expect(page.getByText(/대운 시작 계산에는 시각을 사용하지 않으며/)).toBeVisible();
  });

  test('대운 10칸이 표로 들어간다', async ({ page }) => {
    const rows = page.locator('table').nth(1).locator('tbody tr');
    await expect(rows).toHaveCount(10);
    await expect(page.getByText('지금', { exact: true })).toHaveCount(1);
  });

  test('용신 자리별 계산이 접히지 않고 전부 실린다', async ({ page }) => {
    // 화면에서는 details 로 접었지만 문서에는 펼쳐서 넣는다.
    // "억부용신법" 은 본문과 푸터 두 곳에 있으므로 첫 번째로 좁힌다.
    await expect(page.getByText(/억부용신법/).first()).toBeVisible();
    const slotRows = page.locator('table').nth(2).locator('tbody tr');
    await expect(slotRows).toHaveCount(5); // 시간 미상이라 다섯 자리
  });

  test('면책 문구가 있다', async ({ page }) => {
    await expect(page.getByText(/단정적 예언이 아니라 흐름을 읽는 참고 자료/)).toBeVisible();
    await expect(page.getByText(/의료·법률·투자 판단에/)).toBeVisible();
  });

  test('인쇄 시 조작부가 숨는다', async ({ page }) => {
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: /인쇄 · PDF로 저장/ })).toBeHidden();
    await expect(page.getByRole('heading', { name: /인생 리포트/ })).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
  });
});

test.describe('신살 — 겁주지 않고 근거를 붙인다', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('button', { name: '압니다' }).click();
    await fillBirth(page, '2001', '9', '11');
    await page.getByLabel('시', { exact: true }).selectOption('21');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: '상세 풀이 보기' }).click();
  });

  test('신살이 목록으로 나온다', async ({ page }) => {
    const s = page.getByRole('region', { name: '신살' });
    await expect(s).toBeVisible();
    await expect(s.locator('button[aria-expanded]')).not.toHaveCount(0);
  });

  test('★펼치면 판정 근거가 나온다★', async ({ page }) => {
    const s = page.getByRole('region', { name: '신살' });
    await s.locator('button[aria-expanded]').first().click();
    await expect(s.getByText(/판정 근거 ·/)).toBeVisible();
    // 어느 자리를 기준으로 봤는지가 적혀 있다
    await expect(s.getByText(/년지|일지|일간|간지/).first()).toBeVisible();
  });

  test('겁주는 표현이 없다', async ({ page }) => {
    const s = page.getByRole('region', { name: '신살' });
    // 모두 펼친다
    const btns = s.locator('button[aria-expanded]');
    const n = await btns.count();
    for (let i = 0; i < n; i += 1) {
      await btns.nth(i).click();
      const text = await s.innerText();
      for (const w of ['죽음', '단명', '망한다', '재앙', '흉합니다']) {
        expect(text, `"${w}"`).not.toContain(w);
      }
    }
  });

  test('유파 주의를 밝힌다', async ({ page }) => {
    const s = page.getByRole('region', { name: '신살' });
    await expect(s.getByText(/신살의 종류와 판정 기준은 유파마다 다릅니다/)).toBeVisible();
    await expect(s.getByText(/판정 규칙을 명확히 구현할 수 있는 13종/)).toBeVisible();
  });

  test('리포트에도 신살이 들어간다', async ({ page }) => {
    await page.getByRole('button', { name: /^‹ 타임라인/ }).click();
    await page.getByRole('button', { name: /리포트/ }).click();
    await expect(page.getByRole('heading', { name: '신살', exact: true })).toBeVisible();
    await expect(page.getByText(/근거 ·/).first()).toBeVisible();
  });
});

test.describe('결과 링크 공유 — 프래그먼트에 불투명 토큰', () => {
  test('★링크를 복사해 새 탭에서 열면 같은 사주가 나온다★', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();

    // 결과를 하나 기억해둔다 — 링크로 열었을 때 같은지 보려고
    const before = await page.getByRole('region', { name: '대운 인생 타임라인' }).innerText();

    await page.getByRole('button', { name: '결과 링크 복사' }).click();
    await expect(page.getByRole('button', { name: '링크를 복사했습니다' })).toBeVisible();

    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toContain('#r=');
    // 생년월일이 글자로 들어가면 안 된다
    expect(url).not.toContain('1957');
    expect(url).not.toContain('06-15');

    const fresh = await context.newPage();
    await fresh.goto(url);
    // 입력 화면을 한 번 더 거치지 않고 바로 결과로 간다
    const timeline = fresh.getByRole('region', { name: '대운 인생 타임라인' });
    await expect(timeline).toBeVisible();
    await expect(timeline.locator('ol > li')).toHaveCount(10);
    expect(await timeline.innerText()).toBe(before);
    await fresh.close();
  });

  test('★잘린 링크는 조용히 다른 사주를 보여주지 않는다★', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: '결과 링크 복사' }).click();
    const url = await page.evaluate(() => navigator.clipboard.readText());

    // 메신저가 뒤를 자른 상황
    const cut = await context.newPage();
    await cut.goto(url.slice(0, -2));
    await expect(cut.getByText(/링크가 손상됐습니다/)).toBeVisible();
    await expect(cut.getByRole('region', { name: '대운 인생 타임라인' })).toHaveCount(0);
    await cut.close();
  });

  test('링크를 가진 사람이 볼 수 있다는 사실을 숨기지 않는다', async ({ page }) => {
    await fillBirth(page, '1990', '5', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await expect(page.getByText(/링크를 받으신 분은 이 사주를 그대로 보실 수 있습니다/)).toBeVisible();
  });
});

test.describe('인생 대조표 — 맞다고 말해주는 대신 직접 적게 한다', () => {
  async function openPastCard(page: import('@playwright/test').Page) {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    const timeline = page.getByRole('region', { name: '대운 인생 타임라인' });
    await expect(timeline).toBeVisible();
    // 첫 칸(가장 오래된 대운)을 연다
    await timeline.locator('ol > li').first().getByRole('button').first().click();
    return timeline;
  }

  test('지나온 칸에는 무슨 일이 있었는지 묻는다', async ({ page }) => {
    const timeline = await openPastCard(page);
    await expect(timeline.getByText(/실제로 무슨 일이 있었나요/)).toBeVisible();
    await expect(timeline.getByText('이 기기에만 남습니다')).toBeVisible();
  });

  test('★적은 내용이 새로고침 후에도 남는다★', async ({ page }) => {
    const timeline = await openPastCard(page);
    const box = timeline.locator('textarea').first();
    await box.fill('첫 직장에 들어갔다');

    await page.reload();
    await page.getByRole('button', { name: /^사주 보기/ }).click();
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    const again = page.getByRole('region', { name: '대운 인생 타임라인' });
    await again.locator('ol > li').first().getByRole('button').first().click();
    await expect(again.locator('textarea').first()).toHaveValue('첫 직장에 들어갔다');
  });

  test('★다른 사람 사주에는 남의 기록이 안 보인다★', async ({ page }) => {
    const timeline = await openPastCard(page);
    await timeline.locator('textarea').first().fill('첫 직장에 들어갔다');

    await page.getByRole('button', { name: /^처음부터 다시/ }).click();
    await fillBirth(page, '1990', '5', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    const other = page.getByRole('region', { name: '대운 인생 타임라인' });
    await other.locator('ol > li').first().getByRole('button').first().click();
    await expect(other.locator('textarea').first()).toHaveValue('');
  });

  test('적은 내용이 리포트에 실린다', async ({ page }) => {
    const timeline = await openPastCard(page);
    await timeline.locator('textarea').first().fill('첫 직장에 들어갔다');

    await page.getByRole('button', { name: '리포트 · 인쇄하기' }).click();
    await expect(page.getByText('인생 대조표 — 직접 적으신 기록')).toBeVisible();
    await expect(page.getByText('첫 직장에 들어갔다')).toBeVisible();
    await expect(page.getByText('본인이 적으신 내용입니다')).toBeVisible();
  });

  test('아무것도 안 적으면 리포트에 그 칸이 없다', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: '리포트 · 인쇄하기' }).click();
    await expect(page.getByText('인생 대조표 — 직접 적으신 기록')).toHaveCount(0);
  });

  test('지우기는 확인을 한 번 받는다', async ({ page }) => {
    const timeline = await openPastCard(page);
    await timeline.locator('textarea').first().fill('첫 직장에 들어갔다');

    await page.getByRole('button', { name: '적어둔 인생 기록 지우기' }).click();
    await expect(page.getByText('적어두신 내용을 지웁니다')).toBeVisible();
    await page.getByRole('button', { name: '지우기', exact: true }).click();
    await expect(timeline.locator('textarea').first()).toHaveValue('');
  });
});

test.describe('한국 음력 — 가족관계등록부에 적힌 그 음력', () => {
  test('★2017년 윤5월이 통한다 (중국 음력에는 없는 달)★', async ({ page }) => {
    // 중국 음력은 2017년을 윤6월로 본다. 예전 코드는 이 입력을 거절했다.
    // 한국 달력·가족관계등록부에는 윤5월로 적힌다.
    await page.getByRole('button', { name: '음력' }).click();
    await page.getByLabel('윤달로 태어났습니다').check();
    await fillBirth(page, '2017', '5', '10');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();

    await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();

    // 어느 양력 날짜로 옮겼는지 리포트에 밝힌다 — 2017 윤5/10 = 양력 7월 3일
    await page.getByRole('button', { name: '리포트 · 인쇄하기' }).click();
    await expect(page.getByText(/음력 2017년 5월 10일 윤달/)).toBeVisible();
    await expect(page.getByText(/양력 2017년 7월 3일로 계산했습니다/)).toBeVisible();
    await expect(page.getByText(/한국천문연구원 음양력 기준/)).toBeVisible();
  });

  test('2012년 윤3월도 통한다', async ({ page }) => {
    await page.getByRole('button', { name: '음력' }).click();
    await page.getByLabel('윤달로 태어났습니다').check();
    await fillBirth(page, '2012', '3', '10');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();
  });

  test('없는 윤달은 여전히 거절한다', async ({ page }) => {
    // 2016년에는 윤달이 없다. 있는 척 만들어내면 안 된다.
    await page.getByRole('button', { name: '음력' }).click();
    await page.getByLabel('윤달로 태어났습니다').check();
    await fillBirth(page, '2016', '5', '10');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toHaveCount(0);
  });
});

test.describe('궁합 — 여섯 자를 자리별로 본다', () => {
  async function toGunghap(page: import('@playwright/test').Page) {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();
    await page.getByRole('button', { name: /^홈으로/ }).click();
    await page.getByRole('button', { name: '궁합' }).click();
    await page.getByRole('button', { name: '궁합 보기' }).click();
    await expect(page.getByText('두 분의 명식')).toBeVisible();
  }

  test('★무엇을 보고 말하는지부터 보여준다★', async ({ page }) => {
    // 결론만 던지면 어디서 나온 말인지 알 수 없다.
    await toGunghap(page);
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    for (const head of ['년주', '월주', '일주']) {
      await expect(table.getByText(head, { exact: true })).toBeVisible();
    }
  });

  test('★없는 오행이 아니라 필요한 오행으로 본다★', async ({ page }) => {
    /*
     * 궁합에서 흔히 "없는 오행을 채워준다" 고 하는데, 없는 오행이 늘
     * 필요한 것은 아니다. 신강한 사람에게 자기 오행이 하나 더 오면
     * 도움이 아니라 부담이다. 용신은 그 차이를 아는 잣대다.
     */
    await toGunghap(page);
    await expect(page.getByText('서로에게 필요한 기운을 갖고 있는가')).toBeVisible();
    await expect(page.getByText(/에게 필요한 기운/).first()).toBeVisible();
    await expect(page.getByText(/억부용신법으로 판정한 기운입니다/)).toBeVisible();
  });

  test('자리마다 따로 본다 — 일지만 보지 않는다', async ({ page }) => {
    await toGunghap(page);
    const section = page.getByText('자리별로 본 관계').locator('..');
    for (const palace of ['년주', '월주', '일주']) {
      await expect(section.getByText(new RegExp(palace)).first()).toBeVisible();
    }
  });

  test('둘을 합친 오행이 다섯 칸으로 나온다', async ({ page }) => {
    await toGunghap(page);
    const section = page.getByText('둘을 합친 오행').locator('..');
    for (const el of ['목', '화', '토', '금', '수']) {
      await expect(section.getByText(el, { exact: false }).first()).toBeVisible();
    }
  });

  test('십이운성으로 곁에 있을 때의 상태를 본다', async ({ page }) => {
    await toGunghap(page);
    await expect(page.getByText('곁에 있을 때 나는 어떤 상태가 되나')).toBeVisible();
    await expect(page.getByText(/관계에서 나의 십이운성은/).first()).toBeVisible();
  });

  test('★점수를 내지 않는다★', async ({ page }) => {
    await toGunghap(page);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\d+\s*점/);
    expect(body).toContain('궁합을 하나의 점수로 환산하지 않습니다');
  });

  test('★겁주는 말로 끝내지 않는다★', async ({ page }) => {
    // 원진·충이 걸려도 "헤어진다" 로 끝내지 않는다.
    await toGunghap(page);
    const body = await page.locator('body').innerText();
    for (const scary of ['이별', '파탄', '흉합', '최악', '피하세요']) {
      expect(body, `"${scary}" 가 있다`).not.toContain(scary);
    }
  });
});

test.describe('오늘·신년 — 운이 내 원국 위를 지나간다', () => {
  async function toReading(page: import('@playwright/test').Page) {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();
    await page.getByRole('button', { name: /^홈으로/ }).click();
  }

  test('★오늘의 운세가 누구에게나 같은 말이 아니다★', async ({ page }) => {
    /*
     * "오늘은 정재의 날입니다" 는 그 날 태어난 사람 모두에게 같은 말이다.
     * 원국을 봐야 그 사람에게만 하는 말이 나온다 — 용신이 그 잣대다.
     */
    await toReading(page);
    await page.getByRole('button', { name: '오늘' }).click();
    await expect(page.getByText('오늘 들어오는 기운', { exact: true })).toBeVisible();
    await expect(page.getByText(/이 명식에 필요한 기운은/)).toBeVisible();
    await expect(page.getByText(/지장간을 포함해 계산했으며/)).toBeVisible();
  });

  test('★열두 시진을 낸다 — 하루를 한 덩어리로 말하지 않는다★', async ({ page }) => {
    await toReading(page);
    await page.getByRole('button', { name: '오늘' }).click();
    const section = page.getByText('오늘의 열두 시진').locator('..');
    await expect(section.locator('ol > li')).toHaveCount(12);
    // 지금 시각이 하나만 표시된다
    await expect(section.getByText('지금')).toHaveCount(1);
    // 좋고 나쁨으로 줄 세우지 않는다
    const body = await section.innerText();
    expect(body).not.toMatch(/길한|흉한|최고|최악/);
  });

  test('오늘이 원국의 어느 자리를 건드리는지 자리별로 본다', async ({ page }) => {
    await toReading(page);
    await page.getByRole('button', { name: '오늘' }).click();
    // 합충이 없는 날도 있으므로 있을 때만 확인한다
    const card = page.getByText('오늘이 건드리는 자리');
    if (await card.isVisible().catch(() => false)) {
      await expect(card.locator('..').getByText(/년주|월주|일주|시주/).first()).toBeVisible();
    }
  });

  test('★신년도 원국을 본다★', async ({ page }) => {
    await toReading(page);
    await page.getByRole('button', { name: '신년' }).click();
    await expect(page.getByText('올해 들어오는 기운')).toBeVisible();
    await expect(page.getByText(/이 명식에 필요한 기운은/)).toBeVisible();
  });

  test('공망일이면 나쁜 날이라 하지 않는다', async ({ page }) => {
    await toReading(page);
    await page.getByRole('button', { name: '오늘' }).click();
    const card = page.getByText('오늘은 공망일입니다');
    if (await card.isVisible().catch(() => false)) {
      const text = await card.locator('..').innerText();
      expect(text).toContain('나쁜 날이 아니라');
    }
  });

  test('★여기서도 점수를 내지 않는다★', async ({ page }) => {
    await toReading(page);
    for (const menu of ['오늘', '신년']) {
      await page.getByRole('button', { name: menu }).click();
      const body = await page.locator('body').innerText();
      expect(body, menu).not.toMatch(/\d+\s*점/);
      await page.getByRole('button', { name: /^‹ 홈|홈$/ }).first().click().catch(async () => {
        await page.goBack();
      });
      await expect(page.getByRole('button', { name: '신년' })).toBeVisible();
    }
  });
});

test.describe('궁합 입력 — 상대방도 나와 같은 것을 받는다', () => {
  async function toGunghapForm(page: import('@playwright/test').Page) {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();
    await page.getByRole('button', { name: /^홈으로/ }).click();
    await page.getByRole('button', { name: '궁합' }).click();
  }

  test('★시각·음력·출생지를 모두 받는다★', async ({ page }) => {
    /*
     * 예전에는 년·월·일·성별만 받고 양력 고정, 시각 없음, 출생지는 내
     * 것을 그대로 씌웠다. 궁합이 일지만 볼 때는 그래도 됐지만 지금은
     * 오행을 합산하고 년지·월지까지 본다.
     */
    await toGunghapForm(page);
    const s = page.getByRole('region', { name: '궁합' });
    await expect(s.getByRole('button', { name: '음력' })).toBeVisible();
    await expect(s.getByRole('button', { name: '태어난 시각을 압니다' })).toBeVisible();
    await expect(s.getByLabel('상대 출생지')).toBeVisible();
  });

  test('시각을 넣으면 여섯 자가 여덟 자가 된다', async ({ page }) => {
    await toGunghapForm(page);
    const s = page.getByRole('region', { name: '궁합' });

    await s.getByRole('button', { name: '궁합 보기' }).click();
    await expect(page.getByText('숫자로 견주기')).toBeVisible();
    const without = await page.getByText(/\d+·\d+자/).innerText();

    await s.getByRole('button', { name: '태어난 시각을 압니다' }).click();
    await s.getByLabel('상대 시').selectOption('9');
    await s.getByRole('button', { name: '궁합 보기' }).click();
    const withHour = await page.getByText(/\d+·\d+자/).innerText();

    expect(withHour).not.toBe(without);
    expect(withHour).toContain('8자');
  });

  test('상대방 음력도 받는다', async ({ page }) => {
    await toGunghapForm(page);
    const s = page.getByRole('region', { name: '궁합' });
    await s.getByRole('button', { name: '음력' }).click();
    await expect(s.getByText('상대방이 윤달로 태어났습니다')).toBeVisible();
    await s.getByRole('button', { name: '궁합 보기' }).click();
    await expect(page.getByText('두 분의 명식')).toBeVisible();
  });

  test('★출생지가 다르면 결과가 달라진다★', async ({ page }) => {
    // 예전에는 내 출생지를 상대에게 씌우고 있었다. 경도가 다르면
    // 진태양시가 달라져 일주가 갈리기도 한다.
    await toGunghapForm(page);
    const s = page.getByRole('region', { name: '궁합' });
    /*
     * 서울(126.978°)은 시계보다 32분, 신의주(124.398°)는 42분 늦다.
     * 그 사이인 00시 35분에 태어나면 서울 기준으로는 그 날이지만
     * 신의주 기준으로는 아직 전날이라 일주가 갈린다.
     */
    await s.getByRole('button', { name: '태어난 시각을 압니다' }).click();
    await s.getByLabel('상대 시').selectOption('0');
    await s.getByLabel('상대 분').selectOption('35');

    await s.getByLabel('상대 출생지').selectOption({ label: '서울에서 태어남' });
    await s.getByRole('button', { name: '궁합 보기' }).click();
    const seoul = await page.getByText('두 분의 명식').locator('..').innerText();

    await s.getByLabel('상대 출생지').selectOption({ label: '신의주에서 태어남' });
    await s.getByRole('button', { name: '궁합 보기' }).click();
    const sinuiju = await page.getByText('두 분의 명식').locator('..').innerText();

    // 자정 무렵이면 경도 차이가 일주를 가른다
    expect(sinuiju).not.toBe(seoul);
  });
});

test.describe('궁합 — 숫자로 견주기', () => {
  test('★오행 다섯 줄과 음양이 나란히 나온다★', async ({ page }) => {
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();
    await page.getByRole('button', { name: /^홈으로/ }).click();
    await page.getByRole('button', { name: '궁합' }).click();
    await page.getByRole('button', { name: '궁합 보기' }).click();

    const table = page.getByText('숫자로 견주기').locator('..').locator('table');
    await expect(table).toBeVisible();
    await expect(table.locator('tbody > tr')).toHaveCount(6); // 오행 5 + 음양 1
    for (const h of ['나', '상대', '둘 합']) {
      await expect(table.getByText(h, { exact: true })).toBeVisible();
    }
    await expect(table.getByText('양 · 음')).toBeVisible();
  });

  test('겉과 속을 나눠 센다', async ({ page }) => {
    await fillBirth(page, '1990', '5', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /^홈으로/ }).click();
    await page.getByRole('button', { name: '궁합' }).click();
    await page.getByRole('button', { name: '궁합 보기' }).click();
    await expect(page.getByText(/겉에 없는 오행이 지장간에 포함될 수 있으므로/)).toBeVisible();
    await expect(page.getByText(/속 \d+·\d+/).first()).toBeVisible();
  });
});

test.describe('신년 — 어느 해를 볼지 고른다', () => {
  test('★올해로 고정돼 있지 않다★', async ({ page }) => {
    /*
     * 신년에 궁금한 건 보통 다음 해다 — 12월에 "올해 어땠나" 를 보러
     * 오지 않는다. 그런데 올해로 고정돼 있었다.
     */
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await expect(page.getByRole('region', { name: '대운 인생 타임라인' })).toBeVisible();
    await page.getByRole('button', { name: /^홈으로/ }).click();
    await page.getByRole('button', { name: '신년' }).click();

    const thisYear = new Date().getFullYear();
    const s = page.getByRole('region', { name: '신년 운세' });
    const ganji = s.getByTestId('year-ganji');
    const before = await ganji.innerText();

    await s.getByRole('button', { name: `${thisYear + 1}년` }).click();
    await expect(s.getByRole('button', { name: `${thisYear + 1}년` })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // 세운 간지가 실제로 바뀐다 — 해마다 한 칸씩 나아간다
    await expect(ganji).not.toHaveText(before);
  });

  test('세 해를 고를 수 있다', async ({ page }) => {
    await fillBirth(page, '1990', '5', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /^홈으로/ }).click();
    await page.getByRole('button', { name: '신년' }).click();
    const thisYear = new Date().getFullYear();
    for (const y of [thisYear, thisYear + 1, thisYear + 2]) {
      await expect(page.getByRole('button', { name: `${y}년` })).toBeVisible();
    }
  });

  test('연도를 바꿔도 용신 관점이 따라온다', async ({ page }) => {
    await fillBirth(page, '1990', '5', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /^홈으로/ }).click();
    await page.getByRole('button', { name: '신년' }).click();
    await page.getByRole('button', { name: `${new Date().getFullYear() + 2}년` }).click();
    await expect(page.getByText('올해 들어오는 기운', { exact: true })).toBeVisible();
    await expect(page.getByText(/이 명식에 필요한 기운은/)).toBeVisible();
  });

  test('★오행을 한자와 함께 적고 조사를 맞춘다★', async ({ page }) => {
    /*
     * 한때 "수(수)이 있습니다" 가 나왔다. 괄호 안은 한자여야 뜻이 붙고,
     * 받침에 따라 이/가가 갈린다. 다섯 오행 중 목·금만 받침이 있다.
     */
    await fillBirth(page, '1990', '5', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();
    await page.getByRole('button', { name: /^홈으로/ }).click();
    await page.getByRole('button', { name: '오늘' }).click();
    const body = await page.locator('body').innerText();
    for (const bad of ['목(목)', '화(화)', '토(토)', '금(금)', '수(수)']) {
      expect(body, bad).not.toContain(bad);
    }
    for (const bad of ['화이 ', '토이 ', '수이 ', '목가 ', '금가 ']) {
      expect(body, bad).not.toContain(bad);
    }
  });
});

test.describe('SNS 공유 카드', () => {
  test('펼친 칸에 카드로 공유하기 버튼이 나온다', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: /^사주 보기/ }).click();
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();

    const timeline = page.getByRole('region', { name: '대운 인생 타임라인' });
    // 현재 대운이 기본으로 펼쳐져 있음
    const currentCard = timeline.locator('button[aria-expanded="true"]').first();
    const cardContent = currentCard.locator('..');

    // 카드로 공유하기 버튼이 보인다
    await expect(cardContent.getByRole('button', { name: /카드로 공유하기/ })).toBeVisible();
  });

  test('규격 선택 옵션이 보인다', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: /^사주 보기/ }).click();
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();

    const timeline = page.getByRole('region', { name: '대운 인생 타임라인' });
    const currentCard = timeline.locator('button[aria-expanded="true"]').first();
    const cardContent = currentCard.locator('..');

    // 규격 선택지가 보인다
    await expect(cardContent.getByLabel(/스토리/)).toBeVisible();
    await expect(cardContent.getByLabel(/정사각/)).toBeVisible();

    // 스토리가 기본으로 선택됨
    await expect(cardContent.getByLabel(/스토리/)).toBeChecked();
  });

  test('공유 카드에는 생년월일 옵션이 없다 — 식별 정보는 넣지 않는다', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: /^사주 보기/ }).click();
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();

    const timeline = page.getByRole('region', { name: '대운 인생 타임라인' });
    await expect(timeline.getByRole('button', { name: '카드로 공유하기' }).first()).toBeVisible();
    await expect(timeline.getByLabel(/생년월일/)).toHaveCount(0);
  });

  test('정사각 규격으로 전환할 수 있다', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: /^사주 보기/ }).click();
    await fillBirth(page, '1957', '6', '15');
    await page.getByRole('button', { name: '사주 풀어보기' }).click();

    const timeline = page.getByRole('region', { name: '대운 인생 타임라인' });
    const currentCard = timeline.locator('button[aria-expanded="true"]').first();
    const cardContent = currentCard.locator('..');

    const squareRadio = cardContent.getByLabel(/정사각/);
    await squareRadio.click();
    await expect(squareRadio).toBeChecked();
  });
});
