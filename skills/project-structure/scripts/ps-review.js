export const meta = {
  name: 'ps-review',
  description: 'project-structure.json 백그라운드 검토 — 스캐너 sync → purpose 발굴(discovery) → stale 정리(GC), 각 1회 수렴(바깥 반복 없음). history.jsonl은 append-only 원장이라 절대 prune 안 함.',
  phases: [
    { title: 'Sync', detail: 'scan-structure.mjs --write 로 파일 목록을 디스크와 기계적 동기화' },
    { title: 'Discover', detail: '실제 파일을 Read해 빈/빈약한 purpose·entrypoint·related·directories 보강' },
    { title: 'GC', detail: '삭제된 파일·stale purpose·없어진 디렉토리·변동성 값 prune/correct (history는 불가침)' },
  ],
}

// ───────────────── 튜닝 상수 ─────────────────
const D_STREAK = 2   // discovery: 2연속 "새 보강 0" = 소진
const G_STREAK = 2   // GC: 2연속 "stale 0" = 정리 완료
const D_MAX = 10, G_MAX = 10

// ───────────────── 대상 파일 ─────────────────
const __ARGS = (typeof args === 'string' && args.trim()) ? JSON.parse(args) : (args || {})
const ROOT = __ARGS && __ARGS.projectRoot
if (!ROOT) throw new Error('args.projectRoot 필요 (예: {projectRoot:"/Users/me/projects/foo"})')
const FILE = `${ROOT}/meta/structures/project-structure.json`
const HISTORY = `${ROOT}/meta/structures/project-structure-history.jsonl`
const SCANNER = `${ROOT}/meta/scripts/scan-structure.mjs`

const ROUND = {
  type: 'object', additionalProperties: false,
  properties: {
    lens: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' } },
    newCount: { type: 'integer' },   // 이번 라운드에 실제 반영한 새 항목/수정 수
    clean: { type: 'boolean' },      // discovery: 새 보강 0 / GC: stale 0
  },
  required: ['newCount', 'clean'],
}

// ════════════════ Phase 0 — SYNC (스캐너로 파일 목록 기계적 동기화) ════════════════
// 새 파일은 purpose:"" 로 추가되고, 삭제된 파일은 files[]에서 빠진다. 의미는 안 채운다(다음 phase 책임).
phase('Sync')
const sync = await agent(
  `프로젝트 "${ROOT}"의 파일 구조 스냅샷을 디스크와 동기화하라. ` +
  `\`node "${SCANNER}" --diff\` 로 먼저 추가/삭제를 확인한 뒤, \`node "${SCANNER}" --write\` 를 실행하라 ` +
  `(기존 purpose/key_entrypoints_or_exports/related는 보존, 새 파일은 purpose:"", 삭제 파일은 제거 — 스크립트가 git-aware로 처리). ` +
  `스크립트가 없거나 실패하면 그 사실만 한 줄로 보고(절대 수동으로 files[]를 재작성하지 마라). ` +
  `추가/삭제 파일 수를 한 줄로 요약.`,
  { label: 'sync:scanner', phase: 'Sync', agentType: 'general-purpose' })
log(`[sync] ${typeof sync === 'string' ? sync.slice(0, 120) : ''}`)

// ════════════════ Phase 1 — DISCOVERY (의미 보강, loop-until-dry) ════════════════
// 스캐너는 *목록*만 준다. purpose 등 *의미*는 파일을 실제로 Read해 LLM이 채운다.
phase('Discover')
const D_LENS = [
  { key: 'purpose',   name: 'purpose공백',   ask: 'purpose가 빈("")이거나 파일명만 되풀이하는 모호한 항목 — 파일을 실제로 Read해 "무엇이고 무엇을 하는가"를 정확한 한 줄로' },
  { key: 'exports',   name: '진입점',        ask: 'export 함수/클래스·CLI 플래그·리슨 포트·주요 심볼이 있는데 key_entrypoints_or_exports가 빈 파일 — 채움' },
  { key: 'related',   name: '연관',          ask: 'import/호출로 강하게 연결됐는데 related에 안 걸린 파일 링크' },
  { key: 'dirs',      name: '디렉토리',      ask: 'directories 요약에 빠졌거나 부실한 실제 디렉토리(역할/파일수)' },
]
const D_MIN = D_LENS.length
let dStreak = 0; const dLog = []
for (let i = 0; i < D_MAX; i++) {
  const p = D_LENS[i % D_LENS.length]
  const r = await agent(
    `너는 독립 발견자다(이 파일 저자 아님·fork 아님). 목적 = 프로젝트 "${ROOT}"의 파일 지도 중 ` +
    `project-structure.json 에 *빠지거나 빈약한 의미 정보*를 채운다(QA 아님·틀린 걸 고치는 게 아니라 *없는 걸 보강*).\n` +
    `⚠ 검토 대상은 JSON이 *아니라 실제 파일*이다 — purpose는 반드시 그 파일을 Read해서 쓴다(추측·파일명 추론 금지).\n` +
    `이번 렌즈=[${p.name}]만: ${p.ask}.\n` +
    `먼저 "${FILE}" 를 Read해 *이미 채워진 건 건너뛰고*, **보강 필요한 항목만** 해당 파일을 Read한 뒤 Edit로 채워라.\n` +
    `이 렌즈로 다시 봐도 보강할 게 없으면 clean:true, newCount:0 (억지·날조 금지 — 진짜 공백만).`,
    { label: `disc:${p.key}#${i + 1}`, phase: 'Discover', schema: ROUND, agentType: 'general-purpose' })
  dLog.push({ round: i + 1, lens: p.name, newCount: r ? r.newCount : -1, clean: r ? !!r.clean : false })
  dStreak = (r && r.clean && r.newCount === 0) ? dStreak + 1 : 0
  log(`[discover ${i + 1}] ${p.name}: +${r ? r.newCount : '?'} (streak ${dStreak}/${D_STREAK})`)
  if (i + 1 >= D_MIN && dStreak >= D_STREAK) break
}

// ════════════════ Phase 2 — GC / QA (stale prune, 순차) ════════════════
// 보강은 직전 discovery가 했다. 여기선 *틀린·낡은·없어진* 것만 정리. history.jsonl은 불가침.
phase('GC')
const G_LENS = [
  { key: 'deleted',  name: '유령파일',     ask: 'files[]에 있지만 디스크에 없는 파일(`git -C "'+ROOT+'" ls-files`·ls 대조) 제거' },
  { key: 'stale',    name: 'stale purpose', ask: '역할이 실제로 바뀐 파일의 낡은 purpose — 의심 파일을 Read해 정정(추측 금지, 접지)' },
  { key: 'volatile', name: '변동성값',      ask: 'purpose·key_entrypoints_or_exports에 든 라인번호 등 곧 stale될 절대값을 *의미* 기술로 교체' },
  { key: 'dirs',     name: '없어진디렉토리', ask: 'directories에 있지만 실제로 없는 디렉토리 제거·요약 정정' },
]
const G_MIN = G_LENS.length
let gStreak = 0; const gLog = []
for (let i = 0; i < G_MAX; i++) {
  const p = G_LENS[i % G_LENS.length]
  const r = await agent(
    `너는 독립 적대 검토자다(저자 아님·fork 아님). 목적 = project-structure.json의 stale·유령·접지오류를 *정리(prune/correct)* (QA mode).\n` +
    `⚠ *보강을 새로 하지 마라* — 그건 직전 discovery가 했다. 오직 *틀린·낡은·없어진* 것만 고친다.\n` +
    `🚫 절대 금지: history 원장 "${HISTORY}" 는 append-only다 — 재작성·삭제·prune 금지(비대해도 이 워크플로는 안 건드림). 오직 "${FILE}"(스냅샷)만 정리.\n` +
    `"${FILE}" 를 현재 상태부터 Read하라. 모든 판정은 기억 아닌 접지: git -C "${ROOT}" ls-files/status · ls · 파일 Read.\n` +
    `이번 렌즈=[${p.name}]만: ${p.ask}.\n` +
    `발견은 "${FILE}"에 Edit로 직접 반영. 정말 없으면 clean:true, newCount:0 (억지 금지).`,
    { label: `gc:${p.key}#${i + 1}`, phase: 'GC', schema: ROUND, agentType: 'general-purpose' })
  gLog.push({ round: i + 1, lens: p.name, fixed: r ? r.newCount : -1, clean: r ? !!r.clean : false })
  gStreak = (r && r.clean) ? gStreak + 1 : 0
  log(`[gc ${i + 1}] ${p.name}: ~${r ? r.newCount : '?'} (streak ${gStreak}/${G_STREAK})`)
  if (i + 1 >= G_MIN && gStreak >= G_STREAK) break
}

// ════════════════ Finalize — JSON 유효성 + updated_at ════════════════
const fin = await agent(
  `"${FILE}" 가 유효한 JSON인지 \`node -e "JSON.parse(require('fs').readFileSync('${FILE}','utf8'));console.log('OK')"\` 로 확인하라. ` +
  `유효하면 updated_at 필드를 \`date -u +%Y-%m-%dT%H:%M:%SZ\` 결과로 Edit해 갱신. ` +
  `JSON이 깨졌으면 절대 덮어쓰지 말고 깨진 위치만 보고하라. ` +
  `history "${HISTORY}" 는 손대지 마라(원장). 결과를 한 줄로.`,
  { label: 'finalize', phase: 'GC', agentType: 'general-purpose' })

return {
  file: FILE,
  sync: typeof sync === 'string' ? sync.slice(0, 200) : sync,
  discovery: { rounds: dLog.length, converged: dStreak >= D_STREAK, log: dLog },
  gc: { rounds: gLog.length, converged: gStreak >= G_STREAK, log: gLog },
  finalize: fin,
}
