/**
 * 명리서재 — 궁합 심화
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 왜 다시 쓰나
 *
 * 궁합만 유독 얕았다. 결과가 네 덩이뿐이었는데, 이유는 계산이 어려워서가
 * 아니라 **이미 계산해둔 것을 안 넘겨주고 있어서**였다. 기존 gunghap() 은
 * 일간과 오행 개수만 받았다. 용신도, 신살도, 년지·월지도 다 계산해놓고
 * 궁합에는 일간·일지 넉 자만 쓰고 있었던 것이다.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 여기서 더 보는 것
 *
 *   천간합      두 일간이 합을 이루는가 (갑기합토 …)
 *   용신 교차   상대가 내게 필요한 오행을 갖고 있는가  ★
 *   지지 세 쌍  년지·월지·일지를 각각 본다 (기존은 일지만)
 *   십이운성    내 일간이 상대 일지에서 어떤 자리인가
 *   합산 오행   둘을 합치면 오행이 고루 차는가
 *   신살 교차   두 사람 사이에 원진·귀문관·도화가 걸리는가
 *
 * 용신 교차가 이 중 제일 무겁다. "내게 없는 오행을 상대가 갖고 있다" 보다
 * "내게 **필요한** 오행을 상대가 갖고 있다" 가 훨씬 강한 말이기 때문이다.
 * 없는 오행이 늘 필요한 것은 아니다 — 신강한 사람에게 자기 오행이 하나 더
 * 오는 건 도움이 아니라 부담이다. 용신은 그 차이를 아는 유일한 잣대이고,
 * 우리는 이미 그걸 계산해두고 있었다.
 *
 * 점수는 여전히 내지 않는다.
 */

import { BRANCH_KO, STEM_KO } from './constants';
import { branchRelationOf, type BranchRelation } from './fortune';
import { HIDDEN_STEMS } from './pillars';
import { STAGE_OUTWARDNESS, twelveStage } from './twelve-stages';
import type {
  Element,
  FourPillars,
  Palace,
  TwelveStage,
} from './types';

const ELEMENTS: readonly Element[] = ['목', '화', '토', '금', '수'];
const stemIdx = (ko: string) => STEM_KO.indexOf(ko as never);
const branchIdx = (ko: string) => BRANCH_KO.indexOf(ko as never);

/* ── 천간합 ─────────────────────────────────────────────────────────── */

/**
 * 천간합 — 두 천간이 짝을 이뤄 다른 오행으로 화(化)한다.
 *
 *   갑기합토 · 을경합금 · 병신합수 · 정임합목 · 무계합화
 *
 * 표를 적지 않아도 규칙으로 나온다. 두 천간의 index 차가 5 면 합이고,
 * 화하는 오행은 (작은 쪽 + 2) mod 5 다.
 *
 * 일간끼리 합이 있으면 서로 끌리는 자리로 본다. 좋다 나쁘다가 아니라
 * **묶인다**는 뜻이다 — 붙어 있게 되는 관계다.
 */
export interface StemHarmony {
  present: boolean;
  /** 합해서 되는 오행. 합이 없으면 null */
  becomes: Element | null;
  /** "갑기합토" 같은 표기 */
  label: string | null;
}

export function stemHarmonyOf(aStem: string, bStem: string): StemHarmony {
  const a = stemIdx(aStem);
  const b = stemIdx(bStem);
  if (a < 0 || b < 0 || Math.abs(a - b) !== 5) {
    return { present: false, becomes: null, label: null };
  }
  const lo = Math.min(a, b);
  const becomes = ELEMENTS[(lo + 2) % 5] as Element;
  return {
    present: true,
    becomes,
    label: `${STEM_KO[lo]}${STEM_KO[lo + 5]}합${becomes}`,
  };
}

/* ── 용신 교차 ──────────────────────────────────────────────────────── */

/**
 * 상대가 내게 **필요한** 오행을 갖고 있는가.
 *
 * 궁합에서 흔히 "없는 오행을 채워준다" 고 하는데, 없는 오행이 늘 필요한
 * 것은 아니다. 신강한 사람에게 자기 오행이 하나 더 오면 도움이 아니라
 * 부담이다. 용신은 그 차이를 아는 잣대다.
 */
export interface YongsinCross {
  /** 내 용신 오행 */
  need: Element;
  /** 상대 명식에 그 오행이 몇 글자 */
  partnerHas: number;
  /** 내가 피할 오행을 상대가 몇 글자 */
  partnerAvoid: number;
  verdict: '채워준다' | '보통' | '부딪힌다';
}

export function yongsinCross(
  need: Element,
  avoid: readonly Element[],
  partnerCounts: Record<Element, number>,
): YongsinCross {
  const partnerHas = partnerCounts[need] ?? 0;
  const partnerAvoid = avoid.reduce((n, e) => n + (partnerCounts[e] ?? 0), 0);
  // 필요한 것을 둘 이상 갖고 오면서 피할 것이 적으면 채워준다고 본다
  const verdict: YongsinCross['verdict'] =
    partnerHas >= 2 && partnerHas > partnerAvoid ? '채워준다'
    : partnerAvoid >= partnerHas + 2 ? '부딪힌다'
    : '보통';
  return { need, partnerHas, partnerAvoid, verdict };
}

/* ── 지지 세 쌍 ─────────────────────────────────────────────────────── */

export interface BranchPair {
  palace: Palace;
  aGlyph: string;
  bGlyph: string;
  relation: BranchRelation;
}

/**
 * 년지·월지·일지를 각각 본다.
 *
 * 자리마다 뜻이 다르다. 년지는 집안과 뿌리, 월지는 자라온 환경과 성향,
 * 일지는 배우자 자리다. 일지만 보면 "왜 잘 맞는데 집에서 반대하나" 같은
 * 것이 안 보인다.
 *
 * 시지는 뺀다 — 태어난 시각을 모르는 분이 많고, 이 앱은 그걸 예외가
 * 아니라 정상 경로로 다룬다.
 */
export function branchPairs(a: FourPillars, b: FourPillars): BranchPair[] {
  const rows: Array<[Palace, string, string]> = [
    ['년주', a.year.branch, b.year.branch],
    ['월주', a.month.branch, b.month.branch],
    ['일주', a.day.branch, b.day.branch],
  ];
  return rows.map(([palace, ag, bg]) => ({
    palace,
    aGlyph: ag,
    bGlyph: bg,
    relation: branchRelationOf(branchIdx(ag), branchIdx(bg)),
  }));
}

/* ── 십이운성 교차 ──────────────────────────────────────────────────── */

/**
 * 내 일간이 상대의 일지에서 어떤 자리인가.
 *
 * 십이운성은 원래 원국 안에서 보는 것이지만, 배우자궁(일지)에 내 일간을
 * 놓아보면 "그 사람 곁에서 내가 어떤 상태가 되는가" 가 읽힌다.
 * 힘이 세다 약하다가 아니라 밖으로 뻗느냐 안으로 여무느냐다.
 */
export interface StageCross {
  stage: TwelveStage;
  outwardness: number;
}

export const stageCross = (myDayStem: string, partnerDayBranch: string): StageCross => {
  const stage = twelveStage(myDayStem as never, partnerDayBranch as never);
  return { stage, outwardness: STAGE_OUTWARDNESS[stage] };
};

/* ── 합산 오행 ──────────────────────────────────────────────────────── */

export interface CombinedBalance {
  counts: Record<Element, number>;
  /** 둘을 합쳐도 여전히 빈 오행 */
  stillMissing: Element[];
  /** 혼자일 땐 없었는데 둘이면 채워지는 오행 */
  filledTogether: Element[];
}

export function combinedBalance(
  a: Record<Element, number>,
  b: Record<Element, number>,
): CombinedBalance {
  const counts = Object.fromEntries(
    ELEMENTS.map((e) => [e, (a[e] ?? 0) + (b[e] ?? 0)]),
  ) as Record<Element, number>;
  const eitherMissing = ELEMENTS.filter((e) => (a[e] ?? 0) === 0 || (b[e] ?? 0) === 0);
  return {
    counts,
    stillMissing: ELEMENTS.filter((e) => counts[e] === 0),
    filledTogether: eitherMissing.filter((e) => counts[e] > 0),
  };
}

/* ── 신살 교차 ──────────────────────────────────────────────────────── */

/** 두 사람 지지 사이에 걸리는 쌍 신살 */
const WONJIN: ReadonlyArray<readonly [string, string]> = [
  ['자', '미'], ['축', '오'], ['인', '유'], ['묘', '신'], ['진', '해'], ['사', '술'],
];
const GWIMUN: ReadonlyArray<readonly [string, string]> = [
  ['자', '유'], ['축', '오'], ['인', '미'], ['묘', '신'], ['진', '해'], ['사', '술'],
];

export interface SinsalCross {
  name: '원진' | '귀문관';
  palace: Palace;
  aGlyph: string;
  bGlyph: string;
}

/**
 * 두 사람 사이에 걸리는 원진·귀문관.
 *
 * 같은 자리끼리만 본다 — 년지와 년지, 일지와 일지. 서로 다른 자리를
 * 교차해 보면 여섯 자 안에서 뭐라도 하나는 걸려서, 아무 말도 안 하는
 * 것과 같아진다.
 *
 * 원진은 까닭 없이 껄끄러운 자리이지 인연이 아니라는 뜻이 아니다.
 * 오래 붙어 있는 사이에서 오히려 자주 보인다.
 */
export function sinsalCross(a: FourPillars, b: FourPillars): SinsalCross[] {
  const rows: Array<[Palace, string, string]> = [
    ['년주', a.year.branch, b.year.branch],
    ['월주', a.month.branch, b.month.branch],
    ['일주', a.day.branch, b.day.branch],
  ];
  const hit = (list: ReadonlyArray<readonly [string, string]>, x: string, y: string) =>
    list.some(([p, q]) => (x === p && y === q) || (x === q && y === p));

  const out: SinsalCross[] = [];
  for (const [palace, ag, bg] of rows) {
    if (hit(WONJIN, ag, bg)) out.push({ name: '원진', palace, aGlyph: ag, bGlyph: bg });
    if (hit(GWIMUN, ag, bg)) out.push({ name: '귀문관', palace, aGlyph: ag, bGlyph: bg });
  }
  return out;
}

/* ── 지장간까지 센 오행 ─────────────────────────────────────────────── */

/**
 * 겉 여덟 자만이 아니라 지장간까지 세어본 오행 분포.
 *
 * 겉으로 없는 오행이 지지 안에 숨어 있는 경우가 흔하다. "수가 아예 없다"
 * 고 말하기 전에 한 번 더 확인하는 용도다.
 */
export function hiddenElementCounts(pillars: FourPillars): Record<Element, number> {
  const counts = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  const list = [pillars.year, pillars.month, pillars.day, pillars.hour].filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );
  for (const p of list) {
    counts[p.stemElement] += 1;
    for (const hidden of HIDDEN_STEMS[branchIdx(p.branch)] ?? []) {
      counts[ELEMENTS[Math.floor(hidden / 2)] as Element] += 1;
    }
  }
  return counts;
}

/* ── 음양 ───────────────────────────────────────────────────────────── */

export interface Polarity {
  yang: number;
  yin: number;
  /** 여덟(또는 여섯) 글자 중 양의 비율 */
  yangRatio: number;
}

/**
 * 음양의 치우침.
 *
 * 천간은 갑·병·무·경·임이 양, 을·정·기·신·계가 음이다. 지지는 자·인·진·
 * 오·신·술이 양, 축·묘·사·미·유·해가 음이다. 둘 다 순서에서 짝수 자리가
 * 양이라 표를 적을 필요가 없다.
 *
 * 한쪽으로 크게 쏠리면 그 결이 강하게 드러난다 — 양이 많으면 밖으로
 * 뻗고 빠르며, 음이 많으면 안으로 여물고 신중하다. 좋고 나쁨이 아니라
 * 어느 쪽으로 기울었는지를 본다. 궁합에서는 서로 반대로 기울면 채워지고
 * 같은 쪽으로 기울면 닮은 만큼 같은 데서 막힌다.
 */
export function polarityOf(pillars: FourPillars): Polarity {
  const list = [pillars.year, pillars.month, pillars.day, pillars.hour].filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );
  let yang = 0;
  let yin = 0;
  for (const p of list) {
    if (stemIdx(p.stem) % 2 === 0) yang++;
    else yin++;
    if (branchIdx(p.branch) % 2 === 0) yang++;
    else yin++;
  }
  const total = yang + yin;
  return { yang, yin, yangRatio: total === 0 ? 0.5 : yang / total };
}

/* ── 정량 비교 ──────────────────────────────────────────────────────── */

export interface SideFigures {
  /** 여덟(시각 없으면 여섯) 글자 */
  glyphCount: number;
  polarity: Polarity;
  /** 겉으로 드러난 오행 */
  surface: Record<Element, number>;
  /** 지장간까지 센 오행 */
  withHidden: Record<Element, number>;
}

/**
 * 두 사람을 나란히 놓고 세는 값들.
 *
 * 문장으로만 말하면 "많다 적다" 가 사람마다 다르게 읽힌다. 숫자를 그대로
 * 보여주면 읽는 분이 직접 견줄 수 있다 — 이 앱이 점수를 안 내는 대신
 * 하는 일이 그것이다.
 *
 * 겉과 속을 나눠 센다. 겉으로 없는 오행이 지지 안에 숨어 있는 경우가
 * 흔해서, 겉만 보고 "수가 아예 없다" 고 말하면 틀린 말이 된다.
 */
export const figuresOf = (pillars: FourPillars): SideFigures => {
  const list = [pillars.year, pillars.month, pillars.day, pillars.hour].filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );
  const surface = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  for (const p of list) {
    surface[p.stemElement] += 1;
    surface[p.branchElement] += 1;
  }
  return {
    glyphCount: list.length * 2,
    polarity: polarityOf(pillars),
    surface,
    withHidden: hiddenElementCounts(pillars),
  };
};
