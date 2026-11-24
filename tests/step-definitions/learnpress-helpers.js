'use strict';

// Shared helpers for the step files of courses, lessons, quizzes and the student's profile.
//
// Not a step file: it registers no step definitions and no hooks. It holds the plumbing the step files share, on top
// of the WordPress pack's helpers (the page budget, navigation, the users registry, the login): the addresses of the
// course list and of a course and its items, the confirmations the plugin asks for (its own box "Do you want to
// complete the lesson …?" with No and Yes, and the SweetAlert2 box of a quiz with Cancel and Yes), the account a step
// works as, and the restore of what a scenario changed: the learners' enrolments and progress, their orders, the
// courses an instructor made.
//
// The plugin draws a course item (a lesson or a quiz) in a page of its own: the course's header ("2 Sections 2 Lessons
// 1 Quiz 2 Weeks", "0 of 3 items"), the curriculum beside it, the item, its button ("Complete", "Start", "Finish
// Quiz"). A quiz lives in `#learn-press-user-quiz`, whose `data-status` says where it is: "" before it starts,
// "started", "completed".

const path = require('path');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  siteRoot,
  joinUrl,
  navigate,
  resolveUser,
} = require('@webship-js/wordpress-steps/tests/step-definitions/wordpress-helpers');

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** White space collapsed, typographic dashes and quotes made plain, trimmed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/[‒-―−]/g, '-')
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[  ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A list for a failure message: "a", "b" and "c", or (none). */
function listed(items) {
  const all = (items || []).map((i) => `"${clean(i)}"`);
  if (!all.length) return '(none)';
  return all.length > 12 ? `${all.slice(0, 12).join(', ')} and ${all.length - 12} more` : all.join(', ');
}

/** The same text for a person: letter case, white space, dashes and quotes aside. */
function same(a, b) {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

/** Whether a text holds another, letter case, white space, dashes and quotes aside. */
function holds(text, part) {
  return clean(text).toLowerCase().includes(clean(part).toLowerCase());
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The whole of a text, white space aside, for a locator's `hasText` or `name`. */
function exactly(text) {
  return new RegExp(`^\\s*${escapeRegExp(clean(text)).replace(/ /g, '\\s+')}\\s*$`, 'i');
}

// ---------------------------------------------------------------------------
// Waiting
// ---------------------------------------------------------------------------

/**
 * Read something of the page again and again until `ok` holds for it, or the wait budget (twice the page budget) is
 * spent; then fail with the message `fail` builds from the last reading.
 */
async function eventually(world, read, ok, fail, timeout) {
  const deadline = Date.now() + (timeout || budget(world) * 2);
  let value;
  for (;;) {
    try {
      value = await read();
    } catch (err) {
      value = undefined;
      if (Date.now() > deadline) throw err;
    }
    if (value !== undefined && ok(value)) return value;
    if (Date.now() > deadline) break;
    await world.page.waitForTimeout(200);
  }
  throw friendly(await fail(value));
}

/** Click a link or a button that loads a page, and wait for that page. */
async function clickAndLoad(world, locator, what) {
  try {
    await Promise.all([
      world.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      locator.click(),
    ]);
  } catch (err) {
    throw friendly({ message: `Could not ${what}: the site did not answer with a page.`, cause: err, hint: `The browser is at ${world.page.url()}.` });
  }
  await settle(world);
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** The plugin's pages and the manager of the users registry, from `worldParameters.learning`. */
function learning(world) {
  return (world.parameters && world.parameters.learning) || {};
}

function learningPath(world, what) {
  const defaults = { courses: '/courses/', profile: '/profile/' };
  const own = learning(world)[what] || defaults[what];
  return '/' + String(own).replace(/^\/+|\/+$/g, '') + '/';
}

/** The handle of the account that removes test content in the administration (the site's administrator). */
function manager(world) {
  return learning(world).manager || 'admin';
}

/**
 * Open an address of the site and say what the site answered: the status of the page the browser ended on (after
 * its redirects), 0 when none was read.
 */
async function visit(world, url) {
  const response = await navigate(world, joinUrl(world.launchUrl, url));
  await settle(world);
  return response ? response.status() : 0;
}

/** A course of the site by its title, through the site's API (published courses answer anybody): { id, link, title }. */
async function courseByTitle(world, title) {
  const url = joinUrl(world.launchUrl, `/wp-json/wp/v2/lp_course?per_page=100&search=${encodeURIComponent(clean(title))}`);
  const response = await world.context.request.get(url, { failOnStatusCode: false });
  let found = [];
  try { found = JSON.parse(await response.text()); } catch { found = []; }
  const course = (Array.isArray(found) ? found : []).find((c) => same(c.title && c.title.rendered, title));
  if (!course) {
    const titles = (Array.isArray(found) ? found : []).map((c) => c.title && c.title.rendered);
    throw friendly({
      message: `There is no published course "${title}" on the site.${titles.length ? ` A search for it finds ${listed(titles)}.` : ''}`,
      hint: 'A course is found by its title as the course list shows it; a draft or a course waiting for review is not public.',
    });
  }
  return { id: course.id, link: course.link, title: clean(course.title.rendered) };
}

/** Open the page of a course by its title. */
async function openCourse(world, title) {
  const course = await courseByTitle(world, title);
  await visit(world, course.link);
  await world.page.locator('.lp-single-course, .wp-block-learnpress-course-curriculum, .course-curriculum, #learn-press-course-curriculum').first()
    .waitFor({ state: 'attached', timeout: budget(world) * 2 }).catch(() => {});
  return course;
}

/**
 * The items of the curriculum on the page (a course page or an item page): { title, link, type ("lp_lesson",
 * "lp_quiz"), state (the icon of its status: "locked", "in-progress", "completed", "passed", "failed"…), section }.
 */
async function curriculumItems(world) {
  return world.page.locator('li.course-item').evaluateAll((lis) => lis.map((li) => {
    const link = li.querySelector('a.course-item__link, a');
    const status = li.querySelector('.course-item__status .course-item-ico');
    const section = li.closest('li.course-section');
    return {
      title: (li.querySelector('.course-item-title') || {}).innerText || '',
      link: link ? link.href : '',
      type: li.getAttribute('data-item-type') || '',
      state: status ? status.className.replace(/course-item-ico/g, '').trim() : '',
      section: section ? ((section.querySelector('.course-section__title') || {}).innerText || '') : '',
    };
  })).then((items) => items.map((i) => ({ ...i, title: clean(i.title), section: clean(i.section) })));
}

// ---------------------------------------------------------------------------
// The confirmations the plugin asks for
// ---------------------------------------------------------------------------

/**
 * Answer the box the plugin opens to confirm (its own: "Complete lesson" with No and Yes; SweetAlert2: "Finish Quiz",
 * "Retake" with Cancel and Yes), and return what it asked.
 */
async function confirmBox(world, answer = 'yes') {
  const page = world.page;
  const own = page.locator('.lp-modal-dialog').filter({ visible: true }).first();
  const sweet = page.locator('.swal2-popup').filter({ visible: true }).first();
  const which = await Promise.race([
    own.waitFor({ state: 'visible', timeout: budget(world) * 2 }).then(() => 'own'),
    sweet.waitFor({ state: 'visible', timeout: budget(world) * 2 }).then(() => 'sweet'),
  ]).catch(() => null);
  if (!which) return null;
  const box = which === 'own' ? own : sweet;
  const asked = clean(await box.innerText().catch(() => ''));
  const button = which === 'own'
    ? box.locator(answer === 'yes' ? 'button.btn-yes' : 'button.btn-no')
    : box.locator(answer === 'yes' ? 'button.swal2-confirm' : 'button.swal2-cancel');
  await button.first().click();
  await box.waitFor({ state: 'hidden', timeout: budget(world) * 2 }).catch(() => {});
  return asked;
}

// ---------------------------------------------------------------------------
// The account a step works as
// ---------------------------------------------------------------------------

/** The handle of the users registry the browser is logged in as (by the toolbar's "Howdy, <name>"), or null. */
async function me(world) {
  const howdy = await world.page.locator('#wp-admin-bar-my-account .display-name').first().innerText({ timeout: 2000 }).catch(() => '');
  const users = (world.parameters && world.parameters.users) || {};
  for (const [handle, entry] of Object.entries(users)) {
    if (entry && typeof entry === 'object' && entry.name && same(entry.name, howdy)) return handle;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Removals, run once the scenario ends (the After hook of learnpress-defaults.js)
// ---------------------------------------------------------------------------

function afterScenario(world, job, late) {
  const list = late ? 'learningLateCleanup' : 'learningCleanup';
  if (!world[list]) world[list] = [];
  world[list].push(job);
}

/** Playwright, as webship-js has it. */
function playwrightModule() {
  const from = [path.dirname(require.resolve('webship-js/package.json')), process.cwd()];
  return require(require.resolve('playwright', { paths: from }));
}

/** The transport settings of the suite's browser contexts (playwright.config's HTTPS setting, proxy, certificates). */
function transportOptions() {
  let from = {};
  try {
    const config = require(path.join(process.cwd(), 'playwright.config'));
    from = (config && (config.contextOptions || (config.default && config.default.contextOptions))) || {};
  } catch { /* no configuration: the defaults */ }
  const options = {};
  for (const key of ['ignoreHTTPSErrors', 'proxy', 'clientCertificates']) {
    if (from[key] !== undefined) options[key] = from[key];
  }
  return options;
}

// Per site, for the run: the manager's session of the site (a request context of its own, kept for the run) and the
// user ids of the accounts of the users registry.
const MANAGER_RUNS = new Map();

/** The manager's session of the site for the run: `api(route, options)` for /wp-json, `admin(path)` for wp-admin pages. */
async function managerSession(world) {
  const root = siteRoot(world.launchUrl);
  if (MANAGER_RUNS.has(root)) return MANAGER_RUNS.get(root);
  const run = (async () => {
    const { username, password } = resolveUser(world, manager(world));
    const request = await playwrightModule().request.newContext(transportOptions());
    await request.get(`${root}/wp-login.php`, { failOnStatusCode: false });
    await request.post(`${root}/wp-login.php`, { form: { log: username, pwd: password, testcookie: '1' }, failOnStatusCode: false, maxRedirects: 0 });
    const nonce = (await (await request.get(`${root}/wp-admin/admin-ajax.php?action=rest-nonce`, { failOnStatusCode: false })).text()).trim();
    if (!/^[a-f0-9]{6,}$/i.test(nonce)) {
      await request.dispose().catch(() => {});
      throw new Error(`The manager account ("${manager(world)}") could not sign in to the site, so what a scenario changed is not put back.`);
    }
    const headers = { Accept: 'application/json', 'X-WP-Nonce': nonce };
    const api = async (route, { method = 'GET', data } = {}) => {
      const response = await request.fetch(`${root}/wp-json${route}`, { method, data, headers, failOnStatusCode: false });
      let json = null;
      try { json = JSON.parse(await response.text()); } catch { /* not JSON */ }
      return { status: response.status(), json };
    };
    const admin = async (adminPath) => {
      const response = await request.get(`${root}${adminPath.startsWith('/') ? '' : '/wp-admin/'}${adminPath}`, { failOnStatusCode: false });
      return { status: response.status(), html: await response.text() };
    };
    const users = await api('/wp/v2/users?context=edit&per_page=100');
    const ids = new Map();
    const logins = new Map();
    for (const u of Array.isArray(users.json) ? users.json : []) {
      ids.set(String(u.username || '').toLowerCase(), u.id);
      if (u.email) logins.set(String(u.email).toLowerCase(), String(u.username || '').toLowerCase());
    }
    return { request, api, admin, ids, logins, root };
  })();
  MANAGER_RUNS.set(root, run);
  run.catch(() => MANAGER_RUNS.delete(root));
  return run;
}

/** The user id of a handle of the users registry, through the manager's session. */
async function userIdOf(world, handle) {
  const session = await managerSession(world);
  const { username } = resolveUser(world, handle);
  const id = session.ids.get(String(username).toLowerCase());
  if (!id) throw new Error(`The account "${username}" (the handle "${handle}") is not on the site.`);
  return id;
}

/** The ids of the orders the orders list of the administration shows for a login. */
async function ordersOf(world, login) {
  const session = await managerSession(world);
  const ids = new Set();
  for (const status of ['all', 'trash']) {
    const page = await session.admin(`edit.php?post_type=lp_order&post_status=${status}&posts_per_page=200`);
    for (const row of page.html.split(/<tr[\s>]/).slice(1)) {
      const id = (row.match(/id="post-(\d+)"/) || [])[1];
      if (id && new RegExp(`>\\s*${escapeRegExp(login)}\\s*\\(`, 'i').test(row)) ids.add(Number(id));
    }
  }
  return ids;
}

/** An order moved to the bin, then deleted for good, as the orders list's own links do. */
async function deleteOrder(world, id) {
  const session = await managerSession(world);
  const list = await session.admin('edit.php?post_type=lp_order&post_status=all&posts_per_page=200');
  const trash = (list.html.match(new RegExp(`post\\.php\\?post=${id}&(?:amp;)?action=trash&(?:amp;)?_wpnonce=([a-f0-9]+)`)) || [])[1];
  if (trash) await session.admin(`post.php?post=${id}&action=trash&_wpnonce=${trash}`);
  const bin = await session.admin('edit.php?post_type=lp_order&post_status=trash&posts_per_page=200');
  const remove = (bin.html.match(new RegExp(`post\\.php\\?post=${id}&(?:amp;)?action=delete&(?:amp;)?_wpnonce=([a-f0-9]+)`)) || [])[1];
  if (!remove) throw new Error(`The order #${id} could not be deleted: the orders list offers no link for it.`);
  await session.admin(`post.php?post=${id}&action=delete&_wpnonce=${remove}`);
}

/**
 * Before a step changes what an account has of a course (enrols, opens a lesson, completes it, takes the quiz): note
 * whether the account was enrolled and which orders it had, once a scenario, so that the scenario's end puts the
 * enrolment back (fresh, through the plugin's own "Assign" tool) or takes it away ("Unassign"), and deletes the orders
 * the scenario made. The course is put back once, whichever accounts touched it.
 */
async function touchCourse(world, handle, course) {
  if (!handle) return;
  if (!world.learningTouched) world.learningTouched = new Map();
  if (!world.learningTouched.has(course.id)) {
    world.learningTouched.set(course.id, { course, entries: new Map() });
    afterScenario(world, () => restoreCourse(world, world.learningTouched.get(course.id)), true);
  }
  const record = world.learningTouched.get(course.id);
  if (record.entries.has(handle)) return;
  const entry = { handle, enrolled: false, orders: new Set() };
  record.entries.set(handle, entry);
  const page = await world.context.request.get(course.link, { failOnStatusCode: false });
  const html = await page.text();
  entry.enrolled = !/button-enroll-course|button-purchase-course/.test(html) && /course-btn-continue|lp-course-progress|course-progress|btn-finish-course|button-retake-course/.test(html);
  const { username } = resolveUser(world, handle);
  entry.orders = await ordersOf(world, username).catch(() => new Set());
}

/** The logins of the users registry, lower case: the accounts of the suite. */
function registryLogins(world) {
  const users = (world.parameters && world.parameters.users) || {};
  return new Set(Object.entries(users).map(([handle, entry]) => String((entry && typeof entry === 'object' && entry.username) || handle).toLowerCase()));
}

/**
 * The learners of a course (enrolled or finished), by their address, as the plugin's own "Students" screen lists
 * them; null when it lists more than a hundred.
 */
async function learnersOf(world, courseId) {
  const session = await managerSession(world);
  const emails = [];
  for (let paged = 1; paged <= 10; paged += 1) {
    const answer = await session.api('/lp/v1/load_content_via_ajax', {
      method: 'POST',
      data: { callback: { class: 'LearnPress\\TemplateHooks\\Admin\\AdminListStudentsEnrolled', method: 'render_enrolled_students' }, args: { course_id: courseId, paged } },
    });
    const html = String((answer.json && answer.json.data && answer.json.data.content) || '');
    if (answer.status !== 200 || !/lp-enrolled-students-table/.test(html)) {
      throw new Error(`The plugin's list of the learners of the course #${courseId} did not answer (${answer.status}).`);
    }
    const page = [...html.matchAll(/class="lp-email">([^<]*)</g)].map((m) => clean(m[1]).toLowerCase());
    emails.push(...page);
    const shown = html.match(/Displaying \d+ to (\d+) of (\d+) student/);
    if (!page.length || !shown || Number(shown[1]) >= Number(shown[2])) return emails;
  }
  return null;
}

/**
 * What a scenario changed in a course, put back. The plugin keeps a history row of every enrolment and every attempt
 * (its results table), and its own "Assign" and "Unassign" keep that history, as does the deletion of an order (which
 * removes the enrolment it made); its "Reset course progress" removes it, for every learner of the course, so it runs
 * first, while the scenario's enrolments are still there, and only when every learner is an account of the users
 * registry. Then the orders the scenario's free enrolments made are deleted for good (moving one to the bin does not
 * end the enrolment), each account that touched the course gets its enrolment back fresh ("Assign") or taken away
 * ("Unassign"), and every other learner the reset took in gets a fresh enrolment too, as the reset left it without its
 * history row.
 */
async function restoreCourse(world, record) {
  const session = await managerSession(world);
  const { course } = record;
  const problems = [];
  const touched = new Map();
  for (const entry of record.entries.values()) touched.set(resolveUser(world, entry.handle).username.toLowerCase(), entry);
  const fresh = new Set([...touched].filter(([, entry]) => entry.enrolled).map(([login]) => login));
  const away = new Set([...touched].filter(([, entry]) => !entry.enrolled).map(([login]) => login));
  let learners = null;
  try { learners = await learnersOf(world, course.id); } catch (err) { problems.push(err.message); }
  if (learners) {
    const suite = registryLogins(world);
    const outside = learners.filter((email) => !suite.has(session.logins.get(email) || ''));
    if (outside.length) {
      problems.push(`the plugin's history of the scenario's enrolments and attempts stays: "${course.title}" has learners that are not accounts of the suite (${outside.join(', ')}), and the plugin's only tool that removes that history resets every learner of a course`);
    } else {
      const reset = await session.api(`/lp/v1/admin/tools/reset-data/reset-courses?courseId=${course.id}`);
      if (reset.status !== 200 || !reset.json || reset.json.status !== 'success') {
        problems.push(`"Reset course progress" answered ${reset.status} for "${course.title}"`);
      } else {
        for (const email of learners) {
          const login = session.logins.get(email);
          if (login && !away.has(login)) fresh.add(login);
        }
      }
    }
  } else if (learners === null && !problems.length) {
    problems.push(`the plugin's history of the scenario's enrolments and attempts stays: "${course.title}" has more than a hundred learners`);
  }
  for (const [login, entry] of touched) {
    for (const id of await ordersOf(world, login)) {
      if (entry.orders.has(id)) continue;
      await deleteOrder(world, id).catch((err) => problems.push(err.message));
    }
  }
  for (const [logins, tool] of [[fresh, 'assign-user-course'], [away, 'unassign-user-course']]) {
    for (const login of logins) {
      const userId = session.ids.get(login);
      if (!userId) { problems.push(`the account "${login}" is not on the site`); continue; }
      const answer = await session.api(`/lp/v1/admin/tools/${tool}`, { method: 'POST', data: { data: [{ user_id: userId, course_id: course.id }], page: 1, totalPage: 1 } });
      if (answer.status !== 200) problems.push(`${tool} answered ${answer.status} for ${login} in "${course.title}"`);
    }
  }
  if (problems.length) throw new Error(`The course "${course.title}" was not all put back: ${problems.join('; ')}.`);
}

/**
 * A lesson, a quiz or a question of the site, by its title, moved to the bin then deleted for good, as the lists of
 * the administration do it (the links of its row, then of the bin); every post of that title goes.
 */
async function deleteItemsTitled(world, type, title) {
  const session = await managerSession(world);
  const ids = new Set();
  for (const status of ['all', 'trash', 'draft', 'pending']) {
    const list = await session.admin(`edit.php?post_type=${type}&post_status=${status}&s=${encodeURIComponent(clean(title))}&posts_per_page=100`);
    for (const row of list.html.split(/<tr[\s>]/).slice(1)) {
      const id = (row.match(/id="post-(\d+)"/) || [])[1];
      const name = (row.match(/class="row-title"[^>]*>([^<]*)</) || [])[1];
      if (id && name !== undefined && same(name.replace(/&#8211;|&#8217;/g, (e) => (e === '&#8211;' ? '-' : "'")).replace(/&amp;/g, '&'), title)) ids.add(Number(id));
    }
  }
  for (const id of ids) {
    const edit = await session.admin(`edit.php?post_type=${type}&post_status=all&posts_per_page=100&s=${encodeURIComponent(clean(title))}`);
    const trash = (edit.html.match(new RegExp(`post\\.php\\?post=${id}&(?:amp;)?action=trash&(?:amp;)?_wpnonce=([a-f0-9]+)`)) || [])[1];
    if (trash) await session.admin(`post.php?post=${id}&action=trash&_wpnonce=${trash}`);
    const bin = await session.admin(`edit.php?post_type=${type}&post_status=trash&posts_per_page=100`);
    const remove = (bin.html.match(new RegExp(`post\\.php\\?post=${id}&(?:amp;)?action=delete&(?:amp;)?_wpnonce=([a-f0-9]+)`)) || [])[1];
    if (!remove) throw new Error(`The ${type.replace('lp_', '')} #${id} "${title}" could not be deleted: the bin offers no link for it.`);
    await session.admin(`post.php?post=${id}&action=delete&_wpnonce=${remove}`);
  }
  return ids.size;
}

/** The courses of the site with this title, whatever their status, deleted for good (with their sections). */
async function deleteCoursesTitled(world, title) {
  const session = await managerSession(world);
  const found = await session.api(`/wp/v2/lp_course?context=edit&status=any&per_page=100&search=${encodeURIComponent(clean(title))}`);
  const courses = (Array.isArray(found.json) ? found.json : []).filter((c) => same(c.title && (c.title.raw || c.title.rendered), title));
  for (const course of courses) {
    const answer = await session.api(`/wp/v2/lp_course/${course.id}?force=true`, { method: 'DELETE' });
    if (answer.status !== 200) throw new Error(`The course #${course.id} "${title}" could not be deleted (${answer.status}).`);
  }
  return courses.length;
}

/** The run's sessions, closed once the run ends. */
async function managerEnd() {
  const runs = [...MANAGER_RUNS.values()];
  MANAGER_RUNS.clear();
  for (const run of runs) {
    try { await (await run).request.dispose(); } catch { /* gone */ }
  }
}

module.exports = {
  clean,
  listed,
  same,
  holds,
  escapeRegExp,
  exactly,
  eventually,
  clickAndLoad,
  learning,
  learningPath,
  manager,
  visit,
  courseByTitle,
  openCourse,
  curriculumItems,
  confirmBox,
  me,
  afterScenario,
  managerSession,
  userIdOf,
  ordersOf,
  deleteOrder,
  touchCourse,
  deleteItemsTitled,
  deleteCoursesTitled,
  managerEnd,
};
