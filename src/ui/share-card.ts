/**
 * 명리서재 — 대운 칸 공유 이미지 (설계 성공 기준 5)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 왜 대운 칸 하나가 공유 단위인가
 *
 * 사주 전체를 통째로 공유하면 아무도 안 읽는다. "25~34세, 편관 대운"
 * 한 칸은 읽힌다. 그리고 그 칸이 자기 과거와 맞았을 때 사람들은
 * 캡처해서 친구한테 보낸다 — 그게 이 제품의 확산 경로다.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 프라이버시
 *
 * 카드에 생년월일을 넣지 않는다. 나이 구간과 연도 구간만 들어간다.
 * "64~73세 / 2020~2029" 로는 생일을 역산할 수 없다.
 * 전제 5 를 이미지에서도 지킨다.
 *
 * 렌더링은 canvas 로 한다. 외부 라이브러리를 쓰지 않고 폰트도
 * 이미 로드된 Gowun Batang 을 그대로 쓴다.
 */

import type { DaeunCard } from '../engine';

/** Hanji 시안 팔레트 */
const PALETTE = {
  hanji: '#FAF6EA',
  card: '#FFFDF6',
  cardWarm: '#FBF1DE',
  ink: '#4A4036',
  inkSoft: '#6F614F',
  inkFaint: '#8A7A63',
  jumuk: '#A63A2B',
  line: '#DACCAE',
} as const;

/** 인스타 스토리·카톡에 모두 무난한 비율 */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const FONT = "'Gowun Batang', 'Nanum Myeongjo', serif";

export interface ShareCardOptions {
  card: DaeunCard;
  /** 표시 이름. 없으면 넣지 않는다 */
  title?: string;
  scale?: number;
}

/**
 * 대운 카드 한 장을 캔버스에 그린다.
 * 폰트가 아직 로드되지 않았으면 기다린다 — 안 그러면 fallback 으로 그려진다.
 */
export async function renderShareCard(
  options: ShareCardOptions,
): Promise<HTMLCanvasElement> {
  const { card, title } = options;
  const scale = options.scale ?? 1;

  // 폰트 로드를 기다리지 않으면 첫 렌더가 산세리프로 나온다
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.load(`700 100px ${FONT}`);
      await document.fonts.ready;
    } catch {
      // 폰트 로드 실패는 치명적이지 않다. fallback 으로 그린다.
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * scale;
  canvas.height = CARD_HEIGHT * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context 를 만들지 못했습니다');
  ctx.scale(scale, scale);

  drawCard(ctx, card, title);
  return canvas;
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  card: DaeunCard,
  title?: string,
): void {
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;

  // 바탕
  ctx.fillStyle = PALETTE.hanji;
  ctx.fillRect(0, 0, W, H);

  // 안쪽 카드
  const pad = 64;
  const cardX = pad;
  const cardY = pad;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;
  ctx.fillStyle = card.isCurrent ? PALETTE.cardWarm : PALETTE.card;
  ctx.strokeStyle = card.isCurrent ? PALETTE.jumuk : PALETTE.line;
  ctx.lineWidth = card.isCurrent ? 4 : 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fill();
  ctx.stroke();

  const left = cardX + 72;
  const right = cardX + cardW - 72;
  const contentW = right - left;

  // ── 머리말 ──
  // 아래 나이 글자가 104px 라 위로 ~80px 올라온다. 겹치지 않게 충분히 띄운다.
  let y = cardY + 92;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.inkFaint;
  ctx.font = `400 26px ${FONT}`;
  ctx.fillText('명 리 서 재', left, y);
  if (title) {
    ctx.textAlign = 'right';
    ctx.fillText(title, right, y);
    ctx.textAlign = 'left';
  }

  // ── 나이 구간 + 간지 ── 카드의 주인공
  y = cardY + 232;
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `700 104px ${FONT}`;
  ctx.fillText(`${card.startAge}~${card.endAge}세`, left, y);

  ctx.textAlign = 'right';
  const stem = card.ganji[0] ?? '';
  const branch = card.ganji[1] ?? '';
  const branchW = ctx.measureText(branch).width;
  ctx.fillStyle = card.branchColor;
  ctx.fillText(branch, right, y);
  ctx.fillStyle = card.stemColor;
  ctx.fillText(stem, right - branchW - 10, y);
  ctx.textAlign = 'left';

  // ── 연도 + 십성 ──
  y += 62;
  ctx.fillStyle = PALETTE.inkSoft;
  ctx.font = `400 34px ${FONT}`;
  ctx.fillText(`${card.startYear} ~ ${card.endYear}`, left, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.jumuk;
  ctx.fillText(`${card.tenGod} · ${card.category}`, right, y);
  ctx.textAlign = 'left';

  // ── 구분선 ──
  y += 46;
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── 시점 안내 ──
  y += 66;
  ctx.fillStyle = PALETTE.jumuk;
  ctx.font = `400 30px ${FONT}`;
  ctx.fillText(card.prefix, left, y);

  // 꼬리말이 앉을 자리. 본문·주제는 이 선을 넘지 않는다.
  const footerY = cardY + cardH - 52;
  const contentMaxY = footerY - 64;

  // ── 본문 (십성 수준) ──
  y += 72;
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `400 37px ${FONT}`;
  const bodyLines = wrapLines(ctx, card.text, contentW);
  const themeLineH = 50;
  const themeHeaderH = 24 + 54; // 구분선 + 여백

  ctx.font = `400 29px ${FONT}`;
  const themeLines = wrapLines(ctx, card.theme, contentW);

  // 우선순위: 십성별 본문이 알맹이고 카테고리 주제는 덤이다.
  // 본문에 먼저 자리를 주고, 주제에는 최소 두 줄만 예약한다.
  // 남는 공간이 있으면 주제가 더 많이 들어간다.
  const themeMinReserve = themeHeaderH + themeLineH * 2;
  const bodyMaxY = contentMaxY - themeMinReserve;

  ctx.font = `400 37px ${FONT}`;
  y = drawLines(ctx, bodyLines, left, y, 64, bodyMaxY, contentW);

  // ── 카테고리 주제 (넓은 결) ──
  // 한 줄만 남으면 어중간하니 통째로 생략한다. 두 줄부터 의미가 있다.
  const themeStartY = y + themeHeaderH;
  const themeRoom = Math.floor((contentMaxY - themeStartY) / themeLineH) + 1;
  if (themeLines.length > 0 && themeRoom >= 2) {
    y += 24;
    ctx.strokeStyle = PALETTE.line;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.setLineDash([]);

    y += 54;
    ctx.fillStyle = PALETTE.inkFaint;
    ctx.font = `400 29px ${FONT}`;
    drawLines(ctx, themeLines, left, y, themeLineH, contentMaxY, contentW);
  }

  // ── 꼬리말 ── 생년월일은 넣지 않는다
  ctx.fillStyle = PALETTE.inkFaint;
  ctx.font = `400 25px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('정확한 만세력으로 계산한 대운입니다', W / 2, footerY);
  ctx.textAlign = 'left';
}

/**
 * 한국어는 단어 경계가 약해 글자 단위로 접는다.
 * 폭 기준으로만 접는다 (measureText 는 현재 ctx.font 를 따른다).
 */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line);
      line = ch === ' ' ? '' : ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * 줄을 그린다. maxY 를 넘으면 거기서 멈춘다.
 *
 * 본문 길이가 십성마다 달라서 고정 좌표로는 반드시 넘친다.
 * 남은 공간을 재서 자르는 쪽이 어떤 텍스트가 와도 안전하다.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 문장 중간에서 끊지 않는다
 *
 * 처음에는 넘치는 자리에서 그냥 자르고 말줄임을 붙였다. 그랬더니
 * "…쉬어가…" 처럼 낱말 중간에서 끊긴 카드가 나왔다. 이건 사람들이
 * 퍼뜨리는 그림이라 잘린 말이 그대로 남는다.
 *
 * 그래서 **마지막으로 온전히 끝난 문장까지만** 그린다. 문장 하나도
 * 안 들어가는 극단적인 경우에만 예전처럼 말줄임으로 자른다.
 */
function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number,
  maxY: number,
  maxWidth: number,
): number {
  // 먼저 몇 줄이 들어가는지 센다. 그린 다음 지우면 카드 배경에 구멍이 난다.
  const fits = Math.max(0, Math.floor((maxY - startY) / lineHeight) + 1);
  let visible = lines.slice(0, Math.min(fits, lines.length));
  const overflowed = visible.length < lines.length;
  let ellipsis = false;

  if (overflowed) {
    // 들어가는 만큼 이어붙인 뒤, 마지막으로 끝난 문장까지 되돌린다
    const joined = visible.join('');
    const end = lastSentenceEnd(joined);
    if (end > joined.length * 0.4) {
      visible = wrapLines(ctx, joined.slice(0, end), maxWidth);
    } else {
      // 문장 하나도 못 담을 만큼 좁다. 이때만 말줄임으로 자른다.
      ellipsis = true;
    }
  }

  let y = startY;
  visible.forEach((line, i) => {
    const isLast = i === visible.length - 1;
    let text = line;
    if (isLast && ellipsis) {
      while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) {
        text = text.slice(0, -1);
      }
      text = `${text}…`;
    }
    ctx.fillText(text, x, y);
    y += lineHeight;
  });
  return y;
}

/**
 * 마지막으로 문장이 끝난 자리(끝 문자 다음 index). 없으면 -1.
 *
 * 한국어 본문이라 마침표만 보면 대체로 맞는다. 물음표·느낌표도 함께 본다.
 */
export function lastSentenceEnd(text: string): number {
  for (let i = text.length - 1; i >= 0; i -= 1) {
    const ch = text[i] as string;
    if (ch === '.' || ch === '!' || ch === '?') return i + 1;
  }
  return -1;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 파일명. 생년월일이 들어가지 않도록 나이 구간만 쓴다. */
export function shareFileName(card: DaeunCard): string {
  return `명리서재_${card.startAge}-${card.endAge}세_${card.ganji}.png`;
}

export interface ShareResult {
  method: 'share' | 'download' | 'failed';
  reason?: string;
}

/**
 * 카드를 내보낸다.
 * 모바일에서는 Web Share API 로 바로 카톡·메시지에 보낼 수 있고,
 * 지원하지 않으면 다운로드로 떨어진다.
 */
export async function shareCard(options: ShareCardOptions): Promise<ShareResult> {
  try {
    const canvas = await renderShareCard(options);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    if (!blob) return { method: 'failed', reason: '이미지를 만들지 못했습니다' };

    const fileName = shareFileName(options.card);
    const file = new File([blob], fileName, { type: 'image/png' });

    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file] });
      return { method: 'share' };
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    // revoke 를 즉시 하면 사파리에서 다운로드가 취소된다
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { method: 'download' };
  } catch (e) {
    // 사용자가 공유 시트를 닫은 것은 실패가 아니다
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { method: 'failed', reason: 'cancelled' };
    }
    return {
      method: 'failed',
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SNS 공유 카드 — 인스타·페북 형식 (T9 추가)
 *
 * 대운 칸 하나를 짧은 텍스트로 요약한 이미지.
 * 두 가지 규격: 세로(1080×1920) · 정사각(1080×1080)
 *
 * 프라이버시: 생년월일을 **기본값으로 넣지 않는다.**
 * 사용자가 옵션을 켤 때만 포함된다.
 * 나이 구간만으로는 생일을 역산할 수 없다.
 *
 * 폰트: 이미 로드된 Gowun Batang 을 쓴다.
 * 외부 요청이 없어야 한다.
 */

/** SNS 카드 규격 */
export const SNS_CARD_VERTICAL_WIDTH = 1080;
export const SNS_CARD_VERTICAL_HEIGHT = 1920;
export const SNS_CARD_SQUARE_WIDTH = 1080;
export const SNS_CARD_SQUARE_HEIGHT = 1080;

export interface SNSCardOptions {
  card: DaeunCard;
  /** 생년월일도 넣을지 여부 */
  includePersonalInfo?: boolean;
  format: 'vertical' | 'square';
  scale?: number;
}

/**
 * 대운 카드의 한 줄 요약. 십성과 무엇을 하던 시기인지를 담는다.
 * 테스트 가능하게 순수 함수로 분리했다.
 */
export function snsCardSummary(card: DaeunCard): string {
  // 십성과 카테고리로 한 줄 요약. 텍스트는 이미 계산되어 있다.
  const firstSentence = card.text.split('।')[0] || card.text;
  return firstSentence.trim();
}

/**
 * SNS 카드용 핵심 키워드 2~3개를 추출한다.
 * 카테고리와 십성에서 가져온다.
 */
export function snsCardKeywords(card: DaeunCard): string[] {
  const keywords: string[] = [];

  // 카테고리와 십성을 키워드로 사용
  keywords.push(card.category);
  keywords.push(card.tenGod);

  // 십이운성도 추가 (3개 키워드)
  if (card.stage) {
    keywords.push(card.stage);
  }

  return keywords.slice(0, 3);
}

/**
 * SNS 카드를 캔버스에 그린다 (세로 또는 정사각).
 * 폰트가 아직 로드되지 않았으면 기다린다.
 */
export async function renderSNSCard(
  options: SNSCardOptions,
): Promise<HTMLCanvasElement> {
  const { card, format, includePersonalInfo = false } = options;
  const scale = options.scale ?? 1;

  // 폰트 로드를 기다리지 않으면 첫 렌더가 산세리프로 나온다
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.load(`700 100px ${FONT}`);
      await document.fonts.ready;
    } catch {
      // 폰트 로드 실패는 치명적이지 않다. fallback 으로 그린다.
    }
  }

  const [width, height] = format === 'vertical'
    ? [SNS_CARD_VERTICAL_WIDTH, SNS_CARD_VERTICAL_HEIGHT]
    : [SNS_CARD_SQUARE_WIDTH, SNS_CARD_SQUARE_HEIGHT];

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context 를 만들지 못했습니다');
  ctx.scale(scale, scale);

  drawSNSCard(ctx, card, format, includePersonalInfo);
  return canvas;
}

function drawSNSCard(
  ctx: CanvasRenderingContext2D,
  card: DaeunCard,
  format: 'vertical' | 'square',
  includePersonalInfo?: boolean,
): void {
  const W = format === 'vertical' ? SNS_CARD_VERTICAL_WIDTH : SNS_CARD_SQUARE_WIDTH;
  const H = format === 'vertical' ? SNS_CARD_VERTICAL_HEIGHT : SNS_CARD_SQUARE_HEIGHT;

  // 바탕 — 한지
  ctx.fillStyle = PALETTE.hanji;
  ctx.fillRect(0, 0, W, H);

  const pad = format === 'vertical' ? 60 : 50;
  const left = pad;
  const right = W - pad;
  const top = pad;
  const contentMaxY = H - pad;

  let y = top;

  // 제목: 사이트 이름
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.inkFaint;
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText('명 리 서 재', W / 2, y);

  // 스페이서
  y += format === 'vertical' ? 80 : 60;

  // 나이 구간 + 간지
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `700 72px ${FONT}`;
  const ageDisplay = `${card.startAge}~${card.endAge}세`;
  ctx.fillText(ageDisplay, W / 2, y);

  y += 90;

  // 십성 · 카테고리
  ctx.font = `400 36px ${FONT}`;
  ctx.fillStyle = PALETTE.jumuk;
  ctx.fillText(`${card.tenGod} · ${card.category}`, W / 2, y);

  y += format === 'vertical' ? 80 : 60;

  // 핵심 한 줄 요약
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `400 32px ${FONT}`;
  ctx.textAlign = 'left';
  const summary = snsCardSummary(card);
  const summaryLines = wrapLines(ctx, summary, right - left);
  const maxSummaryLines = format === 'vertical' ? 4 : 2;
  const displaySummary = summaryLines.slice(0, maxSummaryLines);

  y = drawLines(ctx, displaySummary, left, y, 50, contentMaxY - 180, right - left);

  // 스페이서
  y += format === 'vertical' ? 60 : 40;

  // 키워드 3개
  const keywords = snsCardKeywords(card);
  ctx.font = `400 28px ${FONT}`;
  ctx.fillStyle = PALETTE.inkSoft;
  ctx.textAlign = 'center';
  const keywordStr = `# ${keywords.join(' # ')}`;
  ctx.fillText(keywordStr, W / 2, y);

  // 하단 — 개인정보 안내
  ctx.fillStyle = PALETTE.inkFaint;
  ctx.font = `400 20px ${FONT}`;
  ctx.textAlign = 'center';
  const footerText = includePersonalInfo
    ? '정확한 만세력으로 계산했습니다 (생년월일 포함)'
    : '정확한 만세력으로 계산했습니다';
  ctx.fillText(footerText, W / 2, H - 35);
}

/**
 * SNS 카드용 파일명.
 * 정사각은 insta/square, 세로는 insta/story 로 구분한다.
 */
export function snsCardFileName(card: DaeunCard, format: 'vertical' | 'square'): string {
  const type = format === 'vertical' ? '스토리' : '정사각';
  return `명리서재_${type}_${card.startAge}-${card.endAge}세.png`;
}

/**
 * SNS 카드를 내보낸다.
 * 모바일에서는 Web Share API 로 바로 카톡·메시지에 보낼 수 있고,
 * 지원하지 않으면 다운로드로 떨어진다.
 */
export async function shareSNSCard(options: SNSCardOptions): Promise<ShareResult> {
  try {
    const canvas = await renderSNSCard(options);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    if (!blob) return { method: 'failed', reason: '이미지를 만들지 못했습니다' };

    const fileName = snsCardFileName(options.card, options.format);
    const file = new File([blob], fileName, { type: 'image/png' });

    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file] });
      return { method: 'share' };
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    // revoke 를 즉시 하면 사파리에서 다운로드가 취소된다
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { method: 'download' };
  } catch (e) {
    // 사용자가 공유 시트를 닫은 것은 실패가 아니다
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { method: 'failed', reason: 'cancelled' };
    }
    return {
      method: 'failed',
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
