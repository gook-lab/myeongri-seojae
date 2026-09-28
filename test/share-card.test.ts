/**
 * 공유 카드 테스트
 *
 * 캔버스 렌더링 자체는 브라우저 API 라 여기서 못 돈다 (E2E 가 본다).
 * 여기서는 카드에 실리는 **데이터**를 검사한다 — 그게 프라이버시가
 * 걸린 부분이다.
 *
 * 규칙: 공유 이미지와 파일명에 생년월일이 들어가면 안 된다.
 * 나이 구간과 연도 구간만으로는 생일을 역산할 수 없다.
 */

import { describe, expect, it } from 'vitest';
import { computeReading } from '../src/engine/index';
import type { RawFormValues } from '../src/core/types';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  lastSentenceEnd,
  shareFileName,
  SNS_CARD_VERTICAL_WIDTH,
  SNS_CARD_VERTICAL_HEIGHT,
  SNS_CARD_SQUARE_WIDTH,
  SNS_CARD_SQUARE_HEIGHT,
  snsCardSummary,
  snsCardKeywords,
  snsCardFileName,
} from '../src/ui/share-card';

const TODAY = new Date(Date.UTC(2026, 7, 21));

const reading = (over: Partial<RawFormValues> = {}) => {
  const r = computeReading(
    {
      calendar: 'solar', year: 1957, month: 6, day: 15, leapMonth: false,
      hourKnown: false, gender: '여', yajasi: 'preserve-day',
      applyEquationOfTime: false, ...over,
    } as RawFormValues,
    { today: TODAY },
  );
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};

describe('공유 카드 데이터 — 생년월일이 없다', () => {
  const cards = reading().cards;

  it('카드 필드에 생년월일이 하나도 없다', () => {
    const serialized = JSON.stringify(cards);
    // 출생 연도(1957)와 월일이 그대로 실리면 안 된다
    expect(serialized).not.toContain('1957-06-15');
    expect(serialized).not.toContain('19570615');
    // ★프라이버시 허용목록★
    // 카드에 필드가 하나라도 늘면 여기서 걸린다. 새 필드가 생년월일을
    // 실어 나를 수 있으므로, 늘릴 때는 안전한지 확인하고 목록에 넣는다.
    for (const c of cards) {
      expect(Object.keys(c).sort()).toEqual(
        [
          'branchColor', 'category', 'endAge', 'endYear', 'ganji', 'ganjiKo',
          'index', 'isCurrent', 'prefix', 'startAge', 'startYear', 'stemColor',
          'tenGod', 'text', 'theme',
          // 십이운성 — 일간과 지지로만 정해지므로 생년월일을 역산할 수 없다
          'stage', 'stageHanja', 'outwardness', 'stageText',
        ].sort(),
      );
    }
  });

  it('연도 구간은 10년 단위라 생일을 역산할 수 없다', () => {
    for (const c of cards) {
      expect(c.endYear - c.startYear).toBe(9);
    }
  });

  it('파일명에 생년월일이 없다', () => {
    for (const c of cards) {
      const name = shareFileName(c);
      expect(name).not.toMatch(/19\d{2}[-/.]?\d{2}[-/.]?\d{2}/);
      expect(name).toContain(`${c.startAge}-${c.endAge}세`);
      expect(name).toMatch(/\.png$/);
    }
  });

  it('파일명이 파일시스템에 안전하다', () => {
    for (const c of cards) {
      expect(shareFileName(c)).not.toMatch(/[/\\:*?"<>|]/);
    }
  });
});

describe('공유 카드 규격', () => {
  it('인스타·카톡에 무난한 4:5 비율이다', () => {
    expect(CARD_WIDTH).toBe(1080);
    expect(CARD_HEIGHT).toBe(1350);
    expect(CARD_HEIGHT / CARD_WIDTH).toBeCloseTo(1.25, 2);
  });
});

describe('카드 내용', () => {
  const { cards } = reading();

  it('열 장 전부 본문이 채워져 있다', () => {
    expect(cards).toHaveLength(10);
    for (const c of cards) {
      expect(c.text.length).toBeGreaterThan(100);
      expect(c.theme.length).toBeGreaterThan(70);
      expect(c.prefix).toBeTruthy();
    }
  });

  it('시점 안내가 과거·현재·미래로 나뉜다', () => {
    const prefixes = new Set(cards.map((c) => c.prefix));
    expect(prefixes.size).toBeGreaterThanOrEqual(2);
    const current = cards.find((c) => c.isCurrent);
    expect(current?.prefix).toContain('지금 지나고');
  });

  it('오행 색이 유효한 hex 다', () => {
    for (const c of cards) {
      expect(c.stemColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(c.branchColor).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('간지가 한자 두 글자다', () => {
    for (const c of cards) {
      expect(c.ganji).toHaveLength(2);
      expect(c.ganjiKo).toHaveLength(2);
    }
  });
});

describe('이름을 넣어도 생년월일은 안 들어간다', () => {
  it('name 은 입력에만 남고 카드에는 없다', () => {
    const r = reading({ name: '홍길동' });
    expect(r.chart.input.name).toBe('홍길동');
    expect(JSON.stringify(r.cards)).not.toContain('홍길동');
  });
});

describe('십이운성 필드도 생년월일을 담지 않는다', () => {
  it('stage 관련 필드에 연도·날짜가 없다', () => {
    for (const c of reading().cards) {
      const stageFields = `${c.stage} ${c.stageHanja} ${c.outwardness} ${c.stageText}`;
      expect(stageFields).not.toMatch(/19\d{2}|20\d{2}/);
    }
  });

  it('outwardness 는 0~1 비율이지 점수가 아니다', () => {
    for (const c of reading().cards) {
      expect(c.outwardness).toBeGreaterThan(0);
      expect(c.outwardness).toBeLessThanOrEqual(1);
    }
  });
});

describe('문장 중간에서 끊지 않는다', () => {
  it('마지막으로 문장이 끝난 자리를 찾는다', () => {
    expect(lastSentenceEnd('가나다. 라마바.')).toBe(9);
    expect(lastSentenceEnd('가나다. 라마바')).toBe(4);
    expect(lastSentenceEnd('문장 끝이 없다')).toBe(-1);
    expect(lastSentenceEnd('물음표는요? 네')).toBe(6);
  });

  it('★잘린 낱말이 카드에 남지 않는다★', () => {
    /*
     * 실제로 "…다음 10년을 버티게 할 바탕이 여기서 만들어집니다. 쉬어가…"
     * 로 끝나는 카드가 나왔다. 사람들이 퍼뜨리는 그림이라 잘린 말이
     * 그대로 남는다.
     */
    const text = '첫 문장입니다. 두 번째 문장입니다. 세 번째가 잘릴 자리입니다';
    const cut = lastSentenceEnd(text);
    expect(text.slice(0, cut)).toBe('첫 문장입니다. 두 번째 문장입니다.');
    expect(text.slice(0, cut).endsWith('.')).toBe(true);
  });
});

describe('SNS 공유 카드 — 규격', () => {
  it('세로 카드는 인스타 스토리 규격이다 (1080×1920)', () => {
    expect(SNS_CARD_VERTICAL_WIDTH).toBe(1080);
    expect(SNS_CARD_VERTICAL_HEIGHT).toBe(1920);
    expect(SNS_CARD_VERTICAL_HEIGHT / SNS_CARD_VERTICAL_WIDTH).toBeCloseTo(1.778, 2);
  });

  it('정사각 카드는 인스타·페북 규격이다 (1080×1080)', () => {
    expect(SNS_CARD_SQUARE_WIDTH).toBe(1080);
    expect(SNS_CARD_SQUARE_HEIGHT).toBe(1080);
    expect(SNS_CARD_SQUARE_HEIGHT / SNS_CARD_SQUARE_WIDTH).toBe(1);
  });
});

describe('SNS 카드 내용 생성', () => {
  const { cards } = reading();

  it('한 줄 요약을 생성한다', () => {
    const card = cards[0] as typeof cards[0];
    const summary = snsCardSummary(card);
    expect(summary).toBeTruthy();
    expect(summary.length).toBeGreaterThan(20);
    expect(summary.length).toBeLessThan(150);
  });

  it('요약에 생년월일이 없다', () => {
    const card = cards[0] as typeof cards[0];
    const summary = snsCardSummary(card);
    expect(summary).not.toMatch(/19\d{2}|20\d{2}/);
  });

  it('핵심 키워드 2~3개를 생성한다', () => {
    const card = cards[0] as typeof cards[0];
    const keywords = snsCardKeywords(card);
    expect(keywords.length).toBeGreaterThanOrEqual(2);
    expect(keywords.length).toBeLessThanOrEqual(3);
    // 키워드는 모두 문자열이다
    keywords.forEach((k) => expect(typeof k).toBe('string'));
  });

  it('키워드에 생년월일이 없다', () => {
    const card = cards[0] as typeof cards[0];
    const keywords = snsCardKeywords(card);
    const joined = keywords.join(' ');
    expect(joined).not.toMatch(/19\d{2}|20\d{2}/);
  });
});

describe('SNS 카드 파일명', () => {
  const { cards } = reading();

  it('세로 카드 파일명에 "스토리"가 들어간다', () => {
    for (const c of cards) {
      const name = snsCardFileName(c, 'vertical');
      expect(name).toContain('스토리');
      expect(name).toContain(`${c.startAge}-${c.endAge}세`);
      expect(name).toMatch(/\.png$/);
    }
  });

  it('정사각 카드 파일명에 "정사각"이 들어간다', () => {
    for (const c of cards) {
      const name = snsCardFileName(c, 'square');
      expect(name).toContain('정사각');
      expect(name).toContain(`${c.startAge}-${c.endAge}세`);
      expect(name).toMatch(/\.png$/);
    }
  });

  it('파일명에 생년월일이 없다', () => {
    for (const c of cards) {
      const verticalName = snsCardFileName(c, 'vertical');
      const squareName = snsCardFileName(c, 'square');
      expect(verticalName).not.toMatch(/19\d{2}[-/.]?\d{2}[-/.]?\d{2}/);
      expect(squareName).not.toMatch(/19\d{2}[-/.]?\d{2}[-/.]?\d{2}/);
    }
  });

  it('파일명이 파일시스템에 안전하다', () => {
    for (const c of cards) {
      const verticalName = snsCardFileName(c, 'vertical');
      const squareName = snsCardFileName(c, 'square');
      expect(verticalName).not.toMatch(/[/\\:*?"<>|]/);
      expect(squareName).not.toMatch(/[/\\:*?"<>|]/);
    }
  });
});
