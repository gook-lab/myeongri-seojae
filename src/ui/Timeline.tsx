/**
 * 명리서재 — 대운 인생 타임라인  ★주인공 화면★
 *
 * 결과 화면의 첫 번째가 사주팔자표가 아니라 이 화면이다. 정보구조를
 * 뒤집은 것이고, 그게 이 프로젝트가 다른 사주 앱과 갈리는 지점이다.
 *
 * 세로 스크롤로 인생이 흐른다. 왼쪽에 세로선을 긋고 각 10년을 칸으로
 * 얹는다. 지나온 시기는 흐리게, 지금은 주묵으로, 앞으로는 점선으로.
 * 사람들은 지나온 칸부터 열어 자기 기억과 맞춰본다 — 그게 이 화면의
 * 사용법이고, "이미 지나온 10년입니다. 그때가 어땠는지 맞춰보세요"
 * 라는 문구가 그걸 대놓고 권한다.
 */

import { useState, type CSSProperties } from 'react';
import type { DaeunCard } from '../engine';
import { useSajuStore } from '../store/saju-store';

/**
 * 공유 버튼. 대운 칸 하나가 공유 단위다.
 * 카드에는 생년월일이 들어가지 않는다 — 나이·연도 구간만 담는다.
 */
function ShareButton({ card, title }: { card: DaeunCard; title?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');

  const label =
    state === 'busy' ? '만드는 중…'
    : state === 'done' ? '이미지를 저장했어요'
    : state === 'failed' ? '다시 시도'
    : '이 10년 공유하기';

  return (
    <button
      type="button"
      disabled={state === 'busy'}
      onClick={async (e) => {
        // 카드 펼침 토글이 같이 눌리지 않게 막는다
        e.stopPropagation();
        setState('busy');
        // 카드 렌더러는 캔버스 그리기 코드가 통째로 들어 있다. 공유를
        // 누르는 사람만 받으면 되므로 이 시점에 가져온다.
        const { shareCard } = await import('./share-card');
        const r = await shareCard({ card, ...(title ? { title } : {}) });
        if (r.method === 'failed' && r.reason !== 'cancelled') setState('failed');
        else if (r.method === 'download') setState('done');
        else setState('idle');
      }}
      className="mt-3.5 w-full rounded-md border border-line bg-hanji px-3 py-2.5 text-sm text-ink-soft disabled:opacity-60"
    >
      {label}
    </button>
  );
}

/**
 * SNS 카드로 공유. 인스타·페북 스토리·정사각 두 규격을 제공한다.
 * 기본값으로 생년월일을 넣지 않고, 옵션으로 포함할 수 있다.
 */
function SNSShareButton({ card }: { card: DaeunCard }) {
  const [format, setFormat] = useState<'vertical' | 'square'>('vertical');
  const [includePersonalInfo, setIncludePersonalInfo] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');

  const label =
    state === 'busy' ? '만드는 중…'
    : state === 'done' ? '이미지를 저장했어요'
    : state === 'failed' ? '다시 시도'
    : '카드로 공유하기';

  return (
    <div className="mt-3.5">
      <button
        type="button"
        disabled={state === 'busy'}
        onClick={async (e) => {
          e.stopPropagation();
          setState('busy');
          const { shareSNSCard } = await import('./share-card');
          const r = await shareSNSCard({ card, format, includePersonalInfo });
          if (r.method === 'failed' && r.reason !== 'cancelled') setState('failed');
          else if (r.method === 'download') setState('done');
          else setState('idle');
        }}
        className="w-full rounded-md border border-line bg-hanji px-3 py-2.5 text-sm text-ink-soft disabled:opacity-60"
      >
        {label}
      </button>

      {/* 규격 선택 */}
      <div className="mt-2 flex gap-2">
        <label className="flex items-center gap-2 text-xs text-ink-soft">
          <input
            type="radio"
            name="sns-format"
            value="vertical"
            checked={format === 'vertical'}
            onChange={(e) => setFormat(e.target.value as 'vertical' | 'square')}
            className="cursor-pointer"
          />
          스토리 (1080×1920)
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-soft">
          <input
            type="radio"
            name="sns-format"
            value="square"
            checked={format === 'square'}
            onChange={(e) => setFormat(e.target.value as 'vertical' | 'square')}
            className="cursor-pointer"
          />
          정사각 (1080×1080)
        </label>
      </div>

      {/* 개인정보 옵션 */}
      <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
        <input
          type="checkbox"
          checked={includePersonalInfo}
          onChange={(e) => setIncludePersonalInfo(e.target.checked)}
          className="cursor-pointer"
        />
        생년월일도 넣을게요
      </label>
    </div>
  );
}

/**
 * 인생 대조표 — 이 프로젝트의 태도가 제일 잘 드러나는 칸
 *
 * 사주가 맞다고 말해주는 대신, 그 10년에 실제로 무슨 일이 있었는지 직접
 * 적게 한다. 적어놓고 위의 풀이와 나란히 놓으면 맞는지 아닌지는 본인이
 * 판단한다. 우리가 판정하지 않는다.
 *
 * 지나온 칸에만 권한다. 앞으로 올 10년에 "무슨 일이 있었나요" 를 물으면
 * 그건 예언을 받아적으라는 뜻이 되어버린다.
 *
 * 저장은 이 기기의 localStorage 뿐이다. 서버가 없으므로 나갈 곳도 없다.
 */
function LifeNote({ card }: { card: DaeunCard }) {
  const noteFor = useSajuStore((s) => s.noteFor);
  const setNote = useSajuStore((s) => s.setNote);
  // notes 를 구독해야 다른 칸에서 지웠을 때 같이 갱신된다
  useSajuStore((s) => s.notes);
  const value = noteFor(card.startYear);
  const past = !card.isCurrent && card.endYear < new Date().getFullYear();

  return (
    <div className="mt-3.5 border-t border-dashed border-line-dash pt-3">
      <label
        htmlFor={`note-${card.index}`}
        className="mb-1.5 block text-xs font-bold text-ink-soft"
      >
        {past
          ? `${card.startYear}~${card.endYear}년, 실제로 무슨 일이 있었나요`
          : '적어두고 싶은 것'}
      </label>
      <textarea
        id={`note-${card.index}`}
        value={value}
        onChange={(e) => setNote(card.startYear, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        rows={2}
        placeholder={past ? '이직, 이사, 만남, 아팠던 일…' : ''}
        className="w-full resize-y rounded-md border border-line bg-hanji px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-faint"
      />
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
        여기 적으신 내용은 이 기기에만 남습니다.
      </p>
    </div>
  );
}

/** 적어둔 것을 지운다. 적은 게 있을 때만 나타난다. */
function ClearNotes() {
  const notes = useSajuStore((s) => s.notes);
  const clear = useSajuStore((s) => s.clearNotes);
  const [asked, setAsked] = useState(false);
  const has = Object.keys(notes).length > 0;
  if (!has) return null;

  return (
    <div className="mt-4 text-center">
      {asked ? (
        <span className="text-xs text-ink-faint">
          적어두신 내용을 지웁니다.{' '}
          <button
            type="button"
            onClick={() => { clear(); setAsked(false); }}
            className="font-bold text-jumuk underline"
          >
            지우기
          </button>{' '}
          ·{' '}
          <button type="button" onClick={() => setAsked(false)} className="underline">
            취소
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAsked(true)}
          className="text-xs text-ink-faint underline"
        >
          적어둔 인생 기록 지우기
        </button>
      )}
    </div>
  );
}

interface Props {
  cards: DaeunCard[];
  /** 공유 카드에 넣을 표시 이름 (선택) */
  name?: string;
  startAge: number;
  direction: 'forward' | 'backward';
  monthsToNextTransition: number | null;
  hourUnknown: boolean;
}

export function Timeline({
  cards,
  name,
  startAge,
  direction,
  monthsToNextTransition,
  hourUnknown,
}: Props) {
  const openCard = useSajuStore((s) => s.openCard);
  const toggleCard = useSajuStore((s) => s.toggleCard);
  const currentYear = new Date().getFullYear();

  return (
    <section aria-label="대운 인생 타임라인" className="mx-auto w-full max-w-md px-5">
      <header className="mb-6">
        <h2 className="text-xl font-bold text-ink">인생 타임라인</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          {startAge}세부터 10년 단위로 {direction === 'forward' ? '순행' : '역행'}합니다.
          {monthsToNextTransition !== null && monthsToNextTransition <= 24 && (
            <>
              {' '}
              <strong className="text-jumuk">
                {monthsToNextTransition}개월 뒤 다음 대운이 시작됩니다.
              </strong>
            </>
          )}
        </p>
        {hourUnknown && (
          <p className="mt-2.5 rounded-md border border-dashed border-line-dash px-3 py-2 text-xs leading-relaxed text-ink-faint">
            대운 시작 계산에는 태어난 시각을 사용하지 않습니다. 시주를 제외한 입력값으로
            타임라인을 계산했습니다.
          </p>
        )}
      </header>

      <ol className="brush-line relative pl-0">
        {cards.map((card) => {
          const isOpen = openCard === card.index;
          const isPast = card.endYear < currentYear;
          return (
            <li
              key={card.index}
              className="card-enter relative pb-3 pl-6"
              style={{ '--i': card.index } as CSSProperties}
            >
              {/* 세로선 위의 점 */}
              <span
                aria-hidden
                className={
                  'absolute -left-[5px] top-5 size-2.5 rounded-full border-2 ' +
                  (card.isCurrent
                    ? 'border-jumuk bg-jumuk'
                    : isPast
                      ? 'border-line-dash bg-line-dash'
                      : 'border-line bg-hanji')
                }
              />

              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleCard(card.index)}
                className={
                  'w-full border px-4 py-3.5 text-left transition-colors ' +
                  (isOpen ? 'rounded-t-lg border-b-0 ' : 'rounded-lg ') +
                  (card.isCurrent
                    ? 'border-jumuk bg-card-warm'
                    : 'border-line bg-card ' +
                      (isPast ? 'opacity-80' : ''))
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-baseline gap-2">
                    <span className="text-lg font-bold tabular-nums text-ink">
                      {card.startAge}
                      <span className="text-sm font-normal text-ink-faint">
                        ~{card.endAge}세
                      </span>
                    </span>
                    {card.isCurrent && (
                      <span className="rounded-sm bg-jumuk px-1.5 py-0.5 text-[10px] font-bold text-card">
                        지금
                      </span>
                    )}
                  </span>

                  {/* 간지 — 오행 색으로 */}
                  <span className="flex items-center gap-0.5 text-xl leading-none">
                    <span style={{ color: card.stemColor }}>{card.ganji[0]}</span>
                    <span style={{ color: card.branchColor }}>{card.ganji[1]}</span>
                  </span>
                </div>

                <div className="mt-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm text-ink-soft">
                    {card.tenGod}
                    <span className="text-ink-faint"> · {card.stage}</span>
                  </span>
                  <span className="text-xs tabular-nums text-ink-faint">
                    {card.startYear}~{card.endYear}
                  </span>
                </div>

                {/*
                  밖으로 뻗는 힘. 점수가 아니라 십이운성 열두 자리를
                  막대 길이로 옮긴 것이다. 절·묘가 짧은 건 나쁘다는 뜻이
                  아니라 안으로 여무는 시기라는 뜻이다.
                */}
                <div
                  aria-hidden
                  className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line-soft"
                >
                  <div
                    className="bar-fill h-full rounded-full"
                    style={{
                      width: `${Math.round(card.outwardness * 100)}%`,
                      backgroundColor: card.isCurrent ? '#A63A2B' : '#C9B98F',
                      '--i': card.index,
                    } as CSSProperties}
                  />
                </div>

              </button>

              {isOpen && (
                <div className="fold-open">
                  <div
                    className={
                      'mt-[-1px] overflow-hidden rounded-b-lg border border-t-0 px-4 pb-4 pt-3.5 ' +
                      (card.isCurrent ? 'border-jumuk bg-card-warm' : 'border-line bg-card')
                    }
                  >
                    <p className="mb-2 text-xs text-jumuk">{card.prefix}</p>
                    <p className="text-sm leading-[1.85] text-ink">{card.text}</p>
                    <p className="mt-3 border-t border-dashed border-line-dash pt-3 text-xs leading-relaxed text-ink-soft">
                      <b className="text-jumuk">
                        {card.stage}({card.stageHanja})
                      </b>{' '}
                      {card.stageText}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-ink-faint">{card.theme}</p>
                    <LifeNote card={card} />
                    <ShareButton card={card} {...(name ? { title: name } : {})} />
                    <SNSShareButton card={card} />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-center text-xs leading-relaxed text-ink-faint">
        각 칸을 눌러 펼쳐보세요.
        <br />
        지나온 10년이 맞는지부터 확인하시면 나머지가 읽힙니다.
      </p>
      <ClearNotes />
    </section>
  );
}
