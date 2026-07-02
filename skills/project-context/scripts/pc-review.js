export const meta = {
  name: 'pc-review',
  description: 'project-context.json 백그라운드 검토 — 누락 발견(discovery) → stale 정리(GC), 각 1회 수렴(바깥 반복 없음)',
  phases: [
    { title: 'Discover', detail: '실제 프로젝트(git·코드·리포트) 대조로 빠진 컨텍스트 발굴·append' },
    { title: 'GC', detail: 'stale·중복·접지오류 prune/correct' },
  ],
}

// ───────────────── 튜닝 상수 (작은 JSON이라 작게) ─────────────────
// floor = 렌즈 1바퀴(모든 관점 최소 1회), streak = 연속 무발견이면 소진으로 판정.
const D_STREAK = 2   // discovery: 2연속 "새 누락 0" = 소진
const G_STREAK = 2   // GC: 2연속 "stale 0" = 정리 완료
const D_MAX = 12, G_MAX = 10   // 폭주 방지 cap (작은 JSON은 보통 floor 근처에서 수렴)

// ───────────────── 대상 파일 ─────────────────
// args는 Workflow 인터페이스에서 *문자열*(JSON 텍스트)로 도착할 수 있다 → 둘 다 수용.
const __ARGS = (typeof args === 'string' && args.trim()) ? JSON.parse(args) : (args || {})
const ROOT = __ARGS && __ARGS.projectRoot
if (!ROOT) throw new Error('args.projectRoot 필요 (예: {projectRoot:"/Users/me/projects/foo"})')
const FILE = `${ROOT}/meta/structures/project-context.json`

const ROUND = {
  type: 'object', additionalProperties: false,
  properties: {
    lens: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' } },
    newCount: { type: 'integer' },   // 이번 라운드에 실제 반영한 새 항목/수정 수
    clean: { type: 'boolean' },      // discovery: 새 누락 0 / GC: stale 0
  },
  required: ['newCount', 'clean'],
}

// ════════════════ Phase 1 — DISCOVERY (누락 소진, loop-until-dry) ════════════════
// 검토 대상 = JSON 문서가 *아니라* 실제 프로젝트. 없는 건 JSON만 봐선 못 찾는다.
phase('Discover')
const D_LENS = [
  { key: 'fields',  name: '필드별',          ask: '스키마 각 필드(key_decisions·anti_patterns·open_limitations·recurring_risks·non_goals·glossary·deferred_work·setup_first_time)가 프로젝트 현실 대비 비었거나 부실한 곳' },
  { key: 'commits', name: '커밋별',          ask: '최근 git 커밋/diff가 도입한 결정·한계·anti-pattern·새 코드영역이 JSON에 캡처됐는지' },
  { key: 'reports', name: '리포트별',        ask: 'meta/reports/ 각 문서의 핵심 lesson·결정이 JSON(key_decisions·anti_patterns)에 반영됐는지' },
  { key: 'codemap', name: 'code_map커버리지', ask: 'git ls-files 대비 code_map에 빠진 핵심 코드 영역(엔트리포인트·핵심 모듈)' },
  { key: 'summary', name: 'summary완전성',   ask: 'summary·next_steps가 현재 상태·다음 로드맵을 실제로 담는지(빈약하면 보강)' },
]
const D_MIN = D_LENS.length
let dStreak = 0; const dLog = []
for (let i = 0; i < D_MAX; i++) {
  const p = D_LENS[i % D_LENS.length]
  const r = await agent(
    `너는 독립 발견자다(이 파일 저자 아님·fork 아님). 목적 = 프로젝트 "${ROOT}"의 회복용 컨텍스트 중 ` +
    `project-context.json 에 *빠진* 것을 찾아 채운다(QA 아님·고치지 말고 *없는 걸 추가*만).\n` +
    `⚠ 검토 대상은 JSON 문서가 *아니라 실제 프로젝트*다 — 없는 건 JSON만 봐선 못 찾는다. 반드시 프로젝트를 보고 JSON과 대조:\n` +
    `   git -C "${ROOT}" log --oneline -30 · git -C "${ROOT}" diff 최근 · ls -R 핵심 디렉토리 · ls "${ROOT}/meta/reports/" · grep 코드.\n` +
    `이번 렌즈=[${p.name}]만으로 훑어라(다른 렌즈는 다음 라운드): ${p.ask}.\n` +
    `먼저 "${FILE}" 를 Read해 *이미 적힌 건 건너뛰고*(중복금지), **새로 필요한 항목만** 해당 필드에 Edit로 append. ` +
    `각 항목은 프로젝트 증거(커밋 해시·파일 경로·리포트 경로)에 접지하라. yardstick = 스키마 필드 의도 × 실제 프로젝트 상태.\n` +
    `이 렌즈로 프로젝트를 다시 봐도 새로 넣을 게 없으면 clean:true, newCount:0 (억지·날조·취향 금지 — 진짜 누락만).`,
    { label: `disc:${p.key}#${i + 1}`, phase: 'Discover', schema: ROUND, agentType: 'general-purpose' })
  dLog.push({ round: i + 1, lens: p.name, newCount: r ? r.newCount : -1, clean: r ? !!r.clean : false })
  dStreak = (r && r.clean && r.newCount === 0) ? dStreak + 1 : 0
  log(`[discover ${i + 1}] ${p.name}: +${r ? r.newCount : '?'} (streak ${dStreak}/${D_STREAK})`)
  if (i + 1 >= D_MIN && dStreak >= D_STREAK) break
}

// ════════════════ Phase 2 — GC / QA (stale prune, 순차) ════════════════
// 누락은 직전 discovery가 채웠다. 여기선 *틀린·낡은·중복된* 것만 정리. 누락 새로 찾지 마라(모드 분리).
phase('GC')
const G_LENS = [
  { key: 'summary',  name: 'summary정합', ask: 'summary가 현재 상태와 불일치(옛 "다음 한 걸음")·recent_tasks[0]/active_tasks와 모순. next_steps에 이미 끝난 항목(recent_tasks 대조) 잔존' },
  { key: 'codemap',  name: 'code_map접지', ask: '경로 없는 code_map 키(ls/git ls-files로 확인)·옮겨진 라인번호·삭제된 파일 설명 제거/정정' },
  { key: 'resolved', name: '해결항목',     ask: '이미 해결된 open_limitations·완료/취소된 deferred_work·번복된 key_decisions([SUPERSEDED] 표기 또는 삭제)' },
  { key: 'dup',      name: '중복churn',    ask: '같은 사실 여러 섹션 반복·active와 recent 중복 서술(한쪽 포인터화)·검토로그/카운트 산식 churn 압축' },
  { key: 'absolute', name: '절대값stale',  ask: 'navigation_hints의 옛 HEAD/커밋수/diff수치 등 곧 stale될 절대값을 상대표현으로' },
  { key: 'budget',   name: '크기예산',     ask: '`wc -lc`로 200줄/25KB 초과 시 장황한 recent_tasks·검토로그·중복서술을 압축/포인터화. ⚠ 단 code_map/glossary/data_locations 같은 *구조 메타*는 항목당 한 줄로 유지하되 *항목 수는 줄이지 마라*(프로젝트가 크면 그만큼 큰 게 정상)' },
]
const G_MIN = G_LENS.length
let gStreak = 0; const gLog = []
for (let i = 0; i < G_MAX; i++) {
  const p = G_LENS[i % G_LENS.length]
  const r = await agent(
    `너는 독립 적대 검토자다(저자 아님·fork 아님). 목적 = project-context.json의 stale·중복·접지오류를 *정리(prune/correct)* (QA mode).\n` +
    `⚠ *누락을 새로 찾지 마라* — 그건 직전 discovery phase가 했다. 오직 *틀린·낡은·중복된* 것만 고친다(모드 혼동 금지).\n` +
    `"${FILE}" 를 현재 상태부터 Read하라(직전 라운드/discovery가 이미 고쳤을 수 있음). 모든 판정은 기억 아닌 접지: ` +
    `git -C "${ROOT}" log/status/diff · ls · grep.\n` +
    `이번 렌즈=[${p.name}]만: ${p.ask}.\n` +
    `발견은 "${FILE}"에 Edit로 직접 반영(삭제/정정/포인터화). 정말 없으면 clean:true, newCount:0 (억지 금지).`,
    { label: `gc:${p.key}#${i + 1}`, phase: 'GC', schema: ROUND, agentType: 'general-purpose' })
  gLog.push({ round: i + 1, lens: p.name, fixed: r ? r.newCount : -1, clean: r ? !!r.clean : false })
  gStreak = (r && r.clean) ? gStreak + 1 : 0
  log(`[gc ${i + 1}] ${p.name}: ~${r ? r.newCount : '?'} (streak ${gStreak}/${G_STREAK})`)
  if (i + 1 >= G_MIN && gStreak >= G_STREAK) break
}

// ════════════════ Finalize — JSON 유효성 + updated_at ════════════════
const fin = await agent(
  `"${FILE}" 가 유효한 JSON인지 \`python3 -c "import json;json.load(open('${FILE}'));print('OK')"\` 로 확인하라. ` +
  `유효하면 updated_at 필드를 \`date -u +%Y-%m-%dT%H:%M:%SZ\` 결과로 Edit해 갱신. ` +
  `JSON이 깨졌으면 절대 덮어쓰지 말고 깨진 위치만 보고하라(history 보존). 결과를 한 줄로.`,
  { label: 'finalize', phase: 'GC', agentType: 'general-purpose' })

return {
  file: FILE,
  discovery: { rounds: dLog.length, converged: dStreak >= D_STREAK, log: dLog },
  gc: { rounds: gLog.length, converged: gStreak >= G_STREAK, log: gLog },
  finalize: fin,
}
