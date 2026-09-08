/**
 * 문서의 숫자를 실제와 맞춘다
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 왜
 *
 * README 가 "Vitest (514) · Playwright (161)" 이라고 적고 있었는데 실제는
 * 556 과 206 이었다. 손으로 적은 숫자는 반드시 낡는다 — 스크린샷을 손으로
 * 찍으면 안 되는 것과 같은 이유다.
 *
 * 세어서 다시 적는다. CI 는 이걸 돌린 뒤 파일이 바뀌었는지 본다
 * (골든 정답지와 같은 방식). 바뀌었다면 문서가 낡았다는 뜻이다.
 *
 * 실행:  pnpm docs:sync
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

function countVitest(): number {
  const r = spawnSync('pnpm', ['exec', 'vitest', 'list', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const start = r.stdout.indexOf('[');
  if (start < 0) throw new Error(`vitest 목록을 못 읽었습니다: ${r.stderr.slice(0, 200)}`);
  return (JSON.parse(r.stdout.slice(start)) as unknown[]).length;
}

function countPlaywright(): number {
  const r = spawnSync('pnpm', ['exec', 'playwright', 'test', '--list'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const m = /Total:\s*(\d+)\s*test/.exec(r.stdout);
  if (!m) throw new Error(`playwright 목록을 못 읽었습니다: ${r.stdout.slice(-300)}`);
  return Number(m[1]);
}

const unit = countVitest();
const e2e = countPlaywright();

const paths = ['README.md', 'README.en.md'];
let changed = false;

for (const path of paths) {
  const before = readFileSync(path, 'utf8');
  const after = before
    .replace(/Vitest 3 \(\*\*\d+\*\*\)/, `Vitest 3 (**${unit}**)`)
    .replace(/Playwright 1\.62 \(\*\*\d+\*\*/, `Playwright 1.62 (**${e2e}**`);

  if (after !== before) {
    writeFileSync(path, after);
    changed = true;
    console.log(`${path} 갱신: 단위 ${unit} · E2E ${e2e}`);
  }
}

if (!changed) {
  console.log(`이미 최신입니다: 단위 ${unit} · E2E ${e2e}`);
}
