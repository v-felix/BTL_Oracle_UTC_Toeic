import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

// Run against a local, seeded Oracle-backed API: node --test tests/api.test.mjs
// The suite creates timestamped QA users/content and never edits seed accounts.
const baseUrl = process.env.TOEIC_TEST_URL ?? 'http://127.0.0.1:5080';
const runId = `${Date.now()}_${process.pid}`;
const startedAt = new Date().toISOString();
const results = [];
const resources = { users: [], exams: [], questions: [], lessons: [], vocabulary: [], attempts: [] };
let queryVerification;

class Client {
  cookies = new Map();
  token = null;
  async request(method, endpoint, body, { csrf = true } = {}) {
    const headers = { Accept: 'application/json' };
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const multipart = body instanceof FormData;
    if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
    if (csrf && this.token && !['GET', 'HEAD'].includes(method)) headers['X-CSRF-TOKEN'] = this.token;
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method, headers, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body), redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';')[0];
      const at = pair.indexOf('=');
      this.cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = raw; }
    if (response.status >= 500) throw new Error(`API ${response.status} ${method} ${endpoint}; traceId=${data?.traceId ?? '(none)'}; ${data?.message ?? 'server error'}`);
    return { status: response.status, data, headers: response.headers };
  }
  async csrf() {
    const response = await this.request('GET', '/api/auth/csrf');
    expectStatus(response, 200);
    assert.equal(typeof response.data.token, 'string');
    this.token = response.data.token;
  }
  async login(username, password) {
    await this.csrf();
    const response = await this.request('POST', '/api/auth/login', { username, password });
    expectStatus(response, 200);
    await this.csrf(); // Antiforgery token identity changes after authentication.
    return response.data;
  }
}

function expectStatus(response, expected) {
  assert.equal(response.status, expected, `Expected HTTP ${expected}, got ${response.status}: ${JSON.stringify(response.data)}`);
  return response.data;
}
function noAnswerKeys(data) {
  const serialized = JSON.stringify(data);
  assert.doesNotMatch(serialized, /"(?:correctChoice|correct_choice|passwordHash|password_hash|explanation|isCorrect)"\s*:/i);
}
async function caseTest(t, name, fn) {
  await t.test(name, async () => {
    const begin = performance.now();
    try {
      await fn();
      results.push({ name, passed: true, durationMs: Math.round(performance.now() - begin) });
    } catch (error) {
      results.push({ name, passed: false, durationMs: Math.round(performance.now() - begin), error: error.message });
      throw error;
    }
  });
}
function questionInput(label, partNo = 5, groupId = null) {
  return {
    groupId, partNo, groupTitle: `QA ${runId} ${partNo === 2 ? 'listening' : 'reading'}`,
    passage: partNo === 5 ? 'QA controlled reading passage.' : '', audioUrl: '', imageUrl: '',
    prompt: `QA ${runId} ${label}: select the first answer.`, explanation: 'QA original explanation.',
    correctChoice: 'A', difficulty: 'EASY',
    choices: (partNo === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']).map(key => ({ key, text: `QA option ${key}` })),
  };
}
function examInput(questionIds, status = 'DRAFT', title = `QA ${runId} exam`) {
  return { title, description: 'Integration test content, safe to archive.', durationMinutes: 15, kind: 'MINI_TEST', status, questionIds };
}
function integer(value) {
  assert.ok(Number.isSafeInteger(value) && value > 0, 'Oracle mutation needs a positive actual numeric QA ID');
  return value;
}
async function ownerSql(sql) {
  const secrets = JSON.parse(await readFile('.local/secrets.json', 'utf8'));
  assert.match(secrets.ownerPassword, /^[A-Za-z0-9!_#]+$/);
  // Password is supplied only on stdin; it is never a process argument or printed.
  const input = `SET ECHO OFF VERIFY OFF DEFINE OFF\nWHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK\nCONNECT TOEIC_OWNER/"${secrets.ownerPassword}"@localhost:1521/orcl\n${sql}\nEXIT\n`;
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.env.SQLPLUS_EXE ?? 'sqlplus', ['-S', '/nolog'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, NLS_LANG: 'AMERICAN_AMERICA.AL32UTF8' } });
    let stdout = '', stderr = '';
    child.stdout.on('data', x => { stdout += x; });
    child.stderr.on('data', x => { stderr += x; });
    child.on('error', reject);
    child.on('close', code => {
      const redacted = (stdout + stderr).split(secrets.ownerPassword).join('[redacted]');
      if (code !== 0 || /(?:ORA-|SP2-)/.test(redacted)) reject(new Error(`Owner SQL failed: ${redacted.slice(-2500)}`));
      else resolve(redacted);
    });
    child.stdin.end(input);
  });
  return output;
}

after(async () => {
  const report = {
    startedAt, finishedAt: new Date().toISOString(), timezone: 'Asia/Saigon', baseUrl, runId,
    testCount: results.length, passed: results.filter(x => x.passed).length,
    failed: results.filter(x => !x.passed).length, results, resources,
    oracleQueries: queryVerification ?? { executed: false },
    scope: 'Real HTTP requests against local ASP.NET Core API and Oracle 19c; only timestamped QA records are changed. No instance administration or physical restore is executed.',
  };
  await mkdir('docs', { recursive: true });
  await writeFile('docs/api-test-results.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
});

test('Oracle-backed API integration', { timeout: 120000 }, async t => {
  const anonymous = new Client(), admin = new Client(), qa = new Client(), other = new Client();
  const qaName = `qa_${runId}`, otherName = `qa2_${runId}`;
  const initialPassword = 'QaTest@2026', updatedPassword = 'QaChanged@2026';
  let qaUser, otherUser, mainQuestion, groupQuestion, listeningQuestion, foreignQuestion, disposableQuestion;
  let usedExam, spareExam, lesson, word, attempt, expiryAttempt;

  await caseTest(t, 'Oracle health check returns ok', async () => {
    const data = expectStatus(await anonymous.request('GET', '/api/health'), 200);
    assert.equal(data.status, 'ok'); assert.match(data.database, /Oracle/);
  });
  await caseTest(t, 'Public catalog and exam metadata omit answer keys', async () => {
    const exams = expectStatus(await anonymous.request('GET', '/api/exams'), 200);
    assert.ok(exams.length >= 5); noAnswerKeys(exams);
    const detail = expectStatus(await anonymous.request('GET', `/api/exams/${exams[0].examId}`), 200);
    noAnswerKeys(detail); assert.ok(detail.parts.length > 0);
    const stats = expectStatus(await anonymous.request('GET', '/api/catalog/stats'), 200);
    assert.ok(stats.questions >= 200);
  });
  await caseTest(t, 'Missing CSRF token is rejected with HTTP 400', async () => {
    expectStatus(await anonymous.request('POST', '/api/auth/register', { username: qaName, email: `${qaName}@example.test`, password: initialPassword, fullName: 'QA' }, { csrf: false }), 400);
  });
  await caseTest(t, 'Anonymous account and admin endpoints require authentication', async () => {
    expectStatus(await anonymous.request('GET', '/api/auth/me'), 401);
    expectStatus(await anonymous.request('GET', '/api/admin/users'), 401);
  });
  await caseTest(t, 'Registration ignores injected administrator roles', async () => {
    await qa.csrf();
    expectStatus(await qa.request('POST', '/api/auth/register', { username: qaName, email: `${qaName}@example.test`, password: initialPassword, fullName: 'QA API learner', roles: ['ADMIN'], role: 'ADMIN', roleId: 1 }), 201);
    qaUser = await qa.login(qaName, initialPassword); resources.users.push({ id: qaUser.id, username: qaName });
    assert.equal(qaUser.role, 'STUDENT'); noAnswerKeys(qaUser);
    expectStatus(await qa.request('GET', '/api/admin/users'), 403);
    expectStatus(await qa.request('GET', '/api/admin/exams'), 403);
  });
  await caseTest(t, 'Student, teacher and editor policies enforce least privilege', async () => {
    const student = new Client(), teacher = new Client(), editor = new Client();
    assert.equal((await student.login('student', 'Student@2026')).role, 'STUDENT');
    expectStatus(await student.request('GET', '/api/admin/stats'), 403);
    assert.equal((await teacher.login('teacher', 'Student@2026')).role, 'TEACHER');
    expectStatus(await teacher.request('GET', '/api/admin/stats'), 200);
    expectStatus(await teacher.request('GET', '/api/admin/questions'), 403);
    assert.equal((await editor.login('editor', 'Student@2026')).role, 'CONTENT_ADMIN');
    expectStatus(await editor.request('GET', '/api/admin/questions'), 200);
    expectStatus(await editor.request('GET', '/api/admin/database'), 403);
  });
  await caseTest(t, 'QA profile and password update affect only the authenticated account', async () => {
    const profile = expectStatus(await qa.request('PUT', '/api/profile', { fullName: 'QA updated learner', targetScore: 850, userId: 1 }), 200);
    assert.equal(profile.id, qaUser.id); assert.equal(profile.fullName, 'QA updated learner'); assert.equal(profile.targetScore, 850);
    expectStatus(await qa.request('PUT', '/api/profile/password', { currentPassword: 'WrongPass123', newPassword: updatedPassword }), 400);
    expectStatus(await qa.request('PUT', '/api/profile/password', { currentPassword: initialPassword, newPassword: updatedPassword }), 200);
    const fresh = new Client(); await fresh.csrf();
    expectStatus(await fresh.request('POST', '/api/auth/login', { username: qaName, password: initialPassword }), 401);
    assert.equal((await fresh.login(qaName, updatedPassword)).id, qaUser.id);
  });
  await caseTest(t, 'Administrator metadata and media upload validate permissions, size and signatures', async () => {
    assert.equal((await admin.login('admin', 'Admin@2026')).role, 'ADMIN');
    const database = expectStatus(await admin.request('GET', '/api/admin/database'), 200);
    assert.equal(database.tables.length, 14);
    for (const row of database.tables) assert.ok(row.rowCount >= 5, `${row.tableName} has fewer than five rows`);
    assert.ok(database.instance.length > 0); assert.ok(database.files.length > 0); assert.ok(database.grants.length > 0);
    expectStatus(await qa.request('POST', '/api/admin/media', {}), 403);
    expectStatus(await admin.request('POST', '/api/admin/media', {}), 400);
    for (const bytes of [Buffer.from('tiny'), Buffer.from([137, 80, 78, 0, 0, 0, 0, 0, 0, 0, 0, 0])]) {
      const form = new FormData(); form.set('file', new Blob([bytes], { type: 'image/png' }), 'invalid.png');
      expectStatus(await admin.request('POST', '/api/admin/media', form), 400);
    }
    const mediaFolder = 'server/Toeic.Api/wwwroot/media';
    const png = (await readdir(mediaFolder)).find(name => name.endsWith('.png'));
    const image = await readFile(`${mediaFolder}/${png}`);
    const validForm = new FormData(); validForm.set('file', new Blob([image], { type: 'image/png' }), 'qa.png');
    const uploaded = expectStatus(await admin.request('POST', '/api/admin/media', validForm), 200);
    assert.match(uploaded.url, /^\/uploads\/[a-f0-9]{32}\.png$/);
    try {
      const response = await fetch(baseUrl + uploaded.url);
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
    } finally {
      // Only remove the exact, randomly named QA file returned by this upload.
      await unlink('server/Toeic.Api/wwwroot' + uploaded.url);
    }
  });
  await caseTest(t, 'Administrator creates and edits QA questions with correct Part 2 choices', async () => {
    const create = async input => {
      const { id } = expectStatus(await admin.request('POST', '/api/admin/questions', input), 200);
      resources.questions.push(id); return expectStatus(await admin.request('GET', `/api/admin/questions/${id}`), 200);
    };
    mainQuestion = await create(questionInput('main'));
    groupQuestion = await create(questionInput('shared group', 5, mainQuestion.groupId));
    listeningQuestion = await create(questionInput('listening', 2));
    foreignQuestion = await create(questionInput('foreign'));
    disposableQuestion = await create(questionInput('disposable'));
    assert.equal(listeningQuestion.choices.length, 3);
    expectStatus(await admin.request('PUT', `/api/admin/questions/${disposableQuestion.id}`, { ...questionInput('disposable updated'), groupId: disposableQuestion.groupId }), 200);
    assert.match(expectStatus(await admin.request('GET', `/api/admin/questions/${disposableQuestion.id}`), 200).prompt, /updated/);
  });
  await caseTest(t, 'Draft exam CRUD, duplicate question rejection and full-test structure validation', async () => {
    usedExam = expectStatus(await admin.request('POST', '/api/admin/exams', examInput([])), 200).id; resources.exams.push(usedExam);
    const questionIds = [mainQuestion.id, groupQuestion.id, listeningQuestion.id];
    expectStatus(await admin.request('PUT', `/api/admin/exams/${usedExam}`, examInput([mainQuestion.id, mainQuestion.id])), 400);
    expectStatus(await admin.request('PUT', `/api/admin/exams/${usedExam}`, { ...examInput(questionIds, 'PUBLISHED'), kind: 'FULL_TEST' }), 400);
    expectStatus(await admin.request('PUT', `/api/admin/exams/${usedExam}`, examInput(questionIds)), 200);
    const data = expectStatus(await admin.request('GET', `/api/admin/exams/${usedExam}`), 200);
    assert.deepEqual(data.questionIds, questionIds);
    spareExam = expectStatus(await admin.request('POST', '/api/admin/exams', examInput([], 'DRAFT', `QA ${runId} unused draft`)), 200).id; resources.exams.push(spareExam);
  });
  await caseTest(t, 'Draft exams stay private and cannot start; publishing requires complete groups', async () => {
    expectStatus(await anonymous.request('GET', `/api/exams/${usedExam}`), 404);
    expectStatus(await qa.request('POST', '/api/attempts', { examId: usedExam }), 400);
    expectStatus(await admin.request('PUT', `/api/admin/exams/${usedExam}`, examInput([mainQuestion.id, listeningQuestion.id], 'PUBLISHED')), 400);
    expectStatus(await admin.request('PUT', `/api/admin/exams/${usedExam}`, examInput([mainQuestion.id, groupQuestion.id, listeningQuestion.id], 'PUBLISHED')), 200);
    expectStatus(await anonymous.request('GET', `/api/exams/${usedExam}`), 200);
  });
  await caseTest(t, 'Questions in a published exam reject modification and deletion', async () => {
    expectStatus(await admin.request('PUT', `/api/admin/questions/${mainQuestion.id}`, { ...questionInput('illegal edit'), groupId: mainQuestion.groupId }), 409);
    expectStatus(await admin.request('DELETE', `/api/admin/questions/${mainQuestion.id}`), 409);
  });
  await caseTest(t, 'One active attempt per user/exam is preserved across concurrent starts', async () => {
    const started = await Promise.all([qa.request('POST', '/api/attempts', { examId: usedExam }), qa.request('POST', '/api/attempts', { examId: usedExam })]);
    started.forEach(r => expectStatus(r, 201)); assert.equal(started[0].data.id, started[1].data.id);
    attempt = started[0].data.id; resources.attempts.push(attempt);
    const detail = expectStatus(await qa.request('GET', `/api/attempts/${attempt}`), 200);
    assert.equal(detail.questions.length, 3); assert.equal(detail.attempt.status, 'IN_PROGRESS'); noAnswerKeys(detail);
  });
  await caseTest(t, 'A different QA account cannot read, answer or submit another account attempt', async () => {
    await other.csrf();
    expectStatus(await other.request('POST', '/api/auth/register', { username: otherName, email: `${otherName}@example.test`, password: initialPassword, fullName: 'QA second learner' }), 201);
    otherUser = await other.login(otherName, initialPassword); resources.users.push({ id: otherUser.id, username: otherName });
    expectStatus(await other.request('GET', `/api/attempts/${attempt}`), 404);
    expectStatus(await other.request('PUT', `/api/attempts/${attempt}/answers`, { answers: [] }), 404);
    expectStatus(await other.request('POST', `/api/attempts/${attempt}/submit`), 404);
  });
  await caseTest(t, 'Duplicate, foreign-question and invalid-choice answer payloads are rejected', async () => {
    const save = answers => qa.request('PUT', `/api/attempts/${attempt}/answers`, { answers });
    expectStatus(await save([{ questionId: mainQuestion.id, choice: 'A' }, { questionId: mainQuestion.id, choice: 'A' }]), 400);
    expectStatus(await save([{ questionId: foreignQuestion.id, choice: 'A' }]), 400);
    expectStatus(await save([{ questionId: mainQuestion.id, choice: 'Z' }]), 400);
    expectStatus(await save([{ questionId: listeningQuestion.id, choice: 'D' }]), 400);
    const detail = expectStatus(await qa.request('GET', `/api/attempts/${attempt}`), 200);
    assert.ok(detail.questions.every(q => q.selectedChoice === null));
  });
  await caseTest(t, 'Answer updates replace previous choices instead of appending score entries', async () => {
    expectStatus(await qa.request('PUT', `/api/attempts/${attempt}/answers`, { answers: [{ questionId: mainQuestion.id, choice: 'B', marked: true }] }), 200);
    for (let i = 0; i < 3; i++) expectStatus(await qa.request('PUT', `/api/attempts/${attempt}/answers`, { answers: [{ questionId: mainQuestion.id, choice: 'A', marked: false }] }), 200);
    expectStatus(await qa.request('PUT', `/api/attempts/${attempt}/answers`, { answers: [groupQuestion, listeningQuestion].map(q => ({ questionId: q.id, choice: 'A', marked: false })) }), 200);
    const detail = expectStatus(await qa.request('GET', `/api/attempts/${attempt}`), 200);
    assert.equal(detail.questions.length, 3); assert.ok(detail.questions.every(q => q.selectedChoice === 'A'));
    assert.equal(detail.questions.find(q => q.id === mainQuestion.id).marked, 0);
  });
  await caseTest(t, 'Attempt snapshots survive draft conversion and later question answer changes', async () => {
    expectStatus(await admin.request('PUT', `/api/admin/exams/${usedExam}`, examInput([mainQuestion.id, groupQuestion.id, listeningQuestion.id])), 200);
    expectStatus(await admin.request('PUT', `/api/admin/questions/${mainQuestion.id}`, { ...questionInput('source changed'), groupId: mainQuestion.groupId, correctChoice: 'B', explanation: 'QA changed explanation.' }), 200);
    const source = expectStatus(await admin.request('GET', `/api/admin/questions/${mainQuestion.id}`), 200);
    assert.equal(source.correctChoice, 'B');
    const snapshot = expectStatus(await qa.request('GET', `/api/attempts/${attempt}`), 200).questions.find(q => q.id === mainQuestion.id);
    assert.match(snapshot.prompt, /main:/); assert.doesNotMatch(snapshot.prompt, /source changed/); noAnswerKeys(snapshot);
  });
  await caseTest(t, 'Submission uses snapshot keys, caps scores, and remains idempotent', async () => {
    expectStatus(await qa.request('POST', `/api/attempts/${attempt}/submit`), 200);
    const first = expectStatus(await qa.request('GET', `/api/attempts/${attempt}`), 200);
    assert.equal(first.attempt.status, 'COMPLETED'); assert.equal(first.attempt.totalCount, 3); assert.equal(first.attempt.correctCount, 3);
    assert.equal(first.attempt.listeningScore + first.attempt.readingScore, 990);
    assert.equal(first.questions.find(q => q.id === mainQuestion.id).correctChoice, 'A');
    expectStatus(await qa.request('POST', `/api/attempts/${attempt}/submit`), 200);
    const second = expectStatus(await qa.request('GET', `/api/attempts/${attempt}`), 200);
    const { serverTime: firstClock, ...firstStored } = first.attempt;
    const { serverTime: secondClock, ...secondStored } = second.attempt;
    assert.ok(firstClock && secondClock);
    assert.deepEqual(secondStored, firstStored, 'Repeated submit must leave stored result unchanged');
    expectStatus(await qa.request('PUT', `/api/attempts/${attempt}/answers`, { answers: [] }), 409);
    const history = expectStatus(await qa.request('GET', '/api/history'), 200);
    assert.equal(history.filter(x => x.id === attempt).length, 1);
  });
  await caseTest(t, 'QA lesson and vocabulary CRUD plus saved-word lifecycle work', async () => {
    const lessonInput = { partNo: 5, title: `QA ${runId} lesson`, summary: 'QA summary', content: 'QA lesson content.', durationMinutes: 10 };
    lesson = expectStatus(await admin.request('POST', '/api/admin/lessons', lessonInput), 200).id; resources.lessons.push(lesson);
    expectStatus(await admin.request('PUT', `/api/admin/lessons/${lesson}`, { ...lessonInput, title: lessonInput.title + ' updated' }), 200);
    assert.match(expectStatus(await qa.request('GET', `/api/lessons/${lesson}`), 200).title, /updated/);
    const wordInput = { word: `qa_${runId}`, pronunciation: '/qa/', meaning: 'QA original', example: 'QA example.', topic: 'QA' };
    word = expectStatus(await admin.request('POST', '/api/admin/vocabulary', wordInput), 200).id; resources.vocabulary.push(word);
    expectStatus(await admin.request('PUT', `/api/admin/vocabulary/${word}`, { ...wordInput, meaning: 'QA updated' }), 200);
    expectStatus(await qa.request('PUT', `/api/vocabulary/${word}/save`), 200);
    expectStatus(await qa.request('PUT', `/api/vocabulary/${word}/save`), 200);
    const saved = expectStatus(await qa.request('GET', '/api/vocabulary?saved=true'), 200);
    assert.equal(saved.filter(x => x.id === word).length, 1); assert.equal(saved.find(x => x.id === word).meaning, 'QA updated');
    expectStatus(await qa.request('DELETE', `/api/vocabulary/${word}/save`), 200);
    assert.ok(!expectStatus(await qa.request('GET', '/api/vocabulary?saved=true'), 200).some(x => x.id === word));
  });
  await caseTest(t, 'Oracle expiry finalizes the QA attempt and refuses late answer mutation', async () => {
    expectStatus(await admin.request('PUT', `/api/admin/exams/${usedExam}`, examInput([mainQuestion.id, groupQuestion.id, listeningQuestion.id], 'PUBLISHED')), 200);
    expiryAttempt = expectStatus(await qa.request('POST', '/api/attempts', { examId: usedExam }), 201).id; resources.attempts.push(expiryAttempt);
    const safeAttempt = integer(expiryAttempt), safeUser = integer(qaUser.id);
    await ownerSql(`BEGIN\n UPDATE toeic_attempts SET expires_at=SYS_EXTRACT_UTC(SYSTIMESTAMP)-INTERVAL '1' SECOND\n WHERE attempt_id=${safeAttempt} AND user_id=${safeUser} AND status='IN_PROGRESS'\n AND user_id IN (SELECT user_id FROM toeic_users WHERE username='${qaName}');\n IF SQL%ROWCOUNT<>1 THEN RAISE_APPLICATION_ERROR(-20999,'Expected exactly one QA attempt'); END IF;\n COMMIT;\nEND;\n/`);
    const response = expectStatus(await qa.request('PUT', `/api/attempts/${expiryAttempt}/answers`, { answers: [{ questionId: mainQuestion.id, choice: 'B' }] }), 200);
    assert.equal(response.status, 'EXPIRED');
    const detail = expectStatus(await qa.request('GET', `/api/attempts/${expiryAttempt}`), 200);
    assert.equal(detail.attempt.status, 'EXPIRED'); assert.equal(detail.attempt.correctCount, 0);
    assert.ok(detail.questions.every(q => q.selectedChoice === null));
    assert.ok(new Date(detail.attempt.submittedAt) <= new Date(detail.attempt.expiresAt));
  });
  await caseTest(t, 'Deleting used QA exams/questions archives them; unused QA content deletes', async () => {
    assert.equal(expectStatus(await admin.request('DELETE', `/api/admin/exams/${usedExam}`), 200).archived, true);
    assert.equal(expectStatus(await admin.request('GET', `/api/admin/exams/${usedExam}`), 200).status, 'ARCHIVED');
    for (const q of [mainQuestion, groupQuestion, listeningQuestion]) assert.equal(expectStatus(await admin.request('DELETE', `/api/admin/questions/${q.id}`), 200).archived, true);
    for (const q of [foreignQuestion, disposableQuestion]) {
      assert.equal(expectStatus(await admin.request('DELETE', `/api/admin/questions/${q.id}`), 200).archived, false);
      expectStatus(await admin.request('GET', `/api/admin/questions/${q.id}`), 404);
    }
    assert.equal(expectStatus(await admin.request('DELETE', `/api/admin/exams/${spareExam}`), 200).archived, false);
    expectStatus(await admin.request('GET', `/api/admin/exams/${spareExam}`), 404);
    expectStatus(await admin.request('DELETE', `/api/admin/lessons/${lesson}`), 200);
    expectStatus(await admin.request('GET', `/api/lessons/${lesson}`), 404);
    expectStatus(await admin.request('DELETE', `/api/admin/vocabulary/${word}`), 200);
  });
  await caseTest(t, 'Disabling a QA account invalidates its existing authentication cookie', async () => {
    expectStatus(await qa.request('GET', '/api/auth/me'), 200);
    for (const user of [qaUser, otherUser]) expectStatus(await admin.request('PUT', `/api/admin/users/${user.id}`, { fullName: 'QA completed account', role: 'STUDENT', active: false, targetScore: 650 }), 200);
    expectStatus(await qa.request('GET', '/api/auth/me'), 401);
    expectStatus(await other.request('GET', '/api/history'), 401);
  });
  await caseTest(t, 'All 20 Oracle example queries execute and every business table has five rows', async () => {
    const output = await ownerSql('@database/10_queries.sql');
    const queryMarkers = [...output.matchAll(/Q(\d{2}) - /g)].map(x => x[1]);
    assert.equal(new Set(queryMarkers).size, 20, 'All 20 SQL blocks must execute');
    const countSql = `SET HEADING OFF FEEDBACK OFF PAGESIZE 0\nSELECT table_name||'|'||row_count FROM vw_toeic_table_counts ORDER BY table_name;`;
    const countsOutput = await ownerSql(countSql);
    const tableCounts = [...countsOutput.matchAll(/(TOEIC_[A-Z_]+)\|(\d+)/g)].map(x => ({ tableName: x[1], rowCount: Number(x[2]) }));
    assert.equal(tableCounts.length, 14);
    assert.ok(tableCounts.every(x => x.rowCount >= 5));
    queryVerification = { executed: true, queryCount: new Set(queryMarkers).size, tableCounts, allTablesAtLeastFive: true };
  });
});
