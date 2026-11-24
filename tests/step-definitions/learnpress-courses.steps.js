'use strict';

// The course list and a course page: the courses the list shows, in its order, their rows (instructor, lessons,
// students, price), its search and its order; a course's curriculum (its sections and their items), its details
// (the box beside it: price, students, duration, lessons, quizzes, level), its instructor and its button.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./learnpress-helpers');

/** The rows of the course list on the page: { title, text }. */
async function rows(world) {
  return world.page.locator('ul.learn-press-courses > li.course, .learn-press-courses li.course').evaluateAll((lis) => lis.map((li) => ({
    title: (li.querySelector('.course-title, .course-permalink, h3') || {}).innerText || '',
    text: li.innerText || '',
  }))).then((all) => all.map((r) => ({ title: h.clean(r.title), text: h.clean(r.text) })));
}

/** Wait for the course list the page fills (by script, when "Loading ajax Courses" is on) to show its rows or say it has none. */
async function waitForCourses(world) {
  await world.page.locator('ul.learn-press-courses > li.course, .learn-press-courses li.course, .learn-press-message, .lp-no-course')
    .first().waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
  await world.page.waitForTimeout(200);
}

/**
 * Open the course list (the plugin's "Courses" page) and wait for its rows.
 *
 * Example #1: When I go to the course list
 * Example #2: Given I am on the course list
 * Example #3: When I go to the course list
 * Example #4: Given I am on the course list
 * Example #5: When I go to the course list
 */
When(/^(?:I go to|I am on) the course list$/, async function () {
  await h.visit(this, h.learningPath(this, 'courses'));
  await waitForCourses(this);
});

/**
 * The course list shows a course, by its title, or does not.
 *
 * Example #1: Then the course list should show "Webship Testing Basics"
 * Example #2: Then the course list should not show "Webship test course"
 * Example #3: Then the course list should show "Webship Advanced Testing"
 * Example #4: And the course list should not show "Webship Testing Basics"
 * Example #5: And the course list should show "Webship Testing Basics"
 */
Then(/^the course list should( not)? show "([^"]*)"$/, async function (notCase, title) {
  await h.eventually(this, () => rows(this), (all) => all.some((r) => h.same(r.title, title)) !== Boolean(notCase), async (all) => ({
    message: notCase ? `The course list shows "${title}".` : `The course list shows no "${title}". It shows ${h.listed((all || []).map((r) => r.title))}.`,
    hint: notCase ? 'A course of the list is published; its search and filters keep some of them only.' : 'The list shows published courses only, a page at a time, newest first unless an order is chosen.',
  }));
});

/**
 * The course list shows these courses, in this order (others may come between them).
 *
 * Example #1: Then the course list should show "Webship Advanced Testing", "Webship Testing Basics" in this order
 * Example #2: Then the course list should show "Webship Testing Basics", "Webship Advanced Testing" in this order
 * Example #3: And the course list should show "Webship Advanced Testing", "Webship Testing Basics" in this order
 * Example #4: And the course list should show "Webship Testing Basics", "Webship Advanced Testing" in this order
 * Example #5: Then the course list should show "Webship Testing Basics", "Webship Advanced Testing" in this order
 */
Then(/^the course list should show ((?:"[^"]*",? ?)+) in this order$/, async function (titles) {
  const wanted = titles.match(/"([^"]*)"/g).map((t) => t.slice(1, -1));
  const inOrder = (all) => {
    let at = -1;
    for (const title of wanted) {
      const next = all.findIndex((r, i) => i > at && h.same(r.title, title));
      if (next < 0) return false;
      at = next;
    }
    return true;
  };
  await h.eventually(this, () => rows(this), (all) => inOrder(all), async (all) => ({
    message: `The course list does not show ${h.listed(wanted)} in this order. It shows ${h.listed((all || []).map((r) => r.title))}.`,
    hint: 'The order is the list\'s order select: "Newly published" first by default.',
  }));
});

/**
 * The row of a course in the course list reads a text: its instructor ("by Instructor Test"), its counts ("2 Lessons",
 * "1 Student"), its price ("Free").
 *
 * Example #1: Then the course "Webship Testing Basics" of the list should read "2 Lessons"
 * Example #2: Then the course "Webship Testing Basics" of the list should read "1 Student"
 * Example #3: Then the course "Webship Advanced Testing" of the list should read "Free"
 * Example #4: And the course "Webship Advanced Testing" of the list should read "by Instructor Test"
 * Example #5: And the course "Webship Testing Basics" of the list should not read "0 Students"
 */
Then(/^the course "([^"]*)" of the list should( not)? read "([^"]*)"$/, async function (title, notCase, text) {
  await h.eventually(this, () => rows(this), (all) => {
    const row = all.find((r) => h.same(r.title, title));
    return Boolean(row) && h.holds(row.text, text) !== Boolean(notCase);
  }, async (all) => {
    const row = (all || []).find((r) => h.same(r.title, title));
    return {
      message: row ? `The course "${title}" of the list ${notCase ? 'reads' : 'does not read'} "${text}". It reads "${row.text}".` : `The course list shows no "${title}". It shows ${h.listed((all || []).map((r) => r.title))}.`,
      hint: 'A row reads its title, "by" and its instructor, its lessons and students, and its price.',
    };
  });
});

/**
 * Search the course list ("Search courses..."): the list shows the courses whose title holds the words.
 *
 * Example #1: When I search the courses for "Advanced"
 * Example #2: When I search the courses for "Basics"
 * Example #3: When I search the courses for "Webship"
 * Example #4: And I search the courses for "Testing"
 * Example #5: And I search the courses for "nothing like this"
 */
When(/^I search the courses for "([^"]*)"$/, async function (words) {
  const box = this.page.locator('input[name="c_search"], .search-courses input[type="search"]').first();
  if (!(await box.count())) throw friendly({ message: 'The page has no search box of courses.', hint: 'Go to the course list first.' });
  await box.fill(words);
  await box.press('Enter');
  await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  await this.page.waitForTimeout(800);
  await waitForCourses(this);
});

/**
 * Order the course list by a choice of its select ("Newly published", "Title a-z", "Title z-a", "Price high to
 * low", "Price low to high", "Popular").
 *
 * Example #1: When I order the courses by "Title a-z"
 * Example #2: When I order the courses by "Title z-a"
 * Example #3: When I order the courses by "Newly published"
 * Example #4: And I order the courses by "Popular"
 * Example #5: And I order the courses by "Price low to high"
 */
When(/^I order the courses by "([^"]*)"$/, async function (choice) {
  const select = this.page.locator('select.courses-order-by, select[name="order_by"]').first();
  if (!(await select.count())) throw friendly({ message: 'The page has no order select of courses.', hint: 'Go to the course list first.' });
  const options = await select.locator('option').allInnerTexts();
  const label = options.find((o) => h.same(o, choice));
  if (!label) throw friendly({ message: `The course list cannot be ordered by "${choice}". It offers ${h.listed(options)}.` });
  await select.selectOption({ label });
  await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  await this.page.waitForTimeout(800);
  await waitForCourses(this);
});

/**
 * Open the page of a course, by its title.
 *
 * Example #1: When I go to the course "Webship Testing Basics"
 * Example #2: Given I am on the course "Webship Advanced Testing"
 * Example #3: When I go to the course "Webship Advanced Testing"
 * Example #4: Given I am on the course "Webship Testing Basics"
 * Example #5: When I go to the course "Webship Testing Basics"
 */
When(/^(?:I go to|I am on) the course "([^"]*)"$/, async function (title) {
  this.learningCourse = await h.openCourse(this, title);
});

/** The sections of the curriculum on the page and their items, read from the page: [{ title, items: [titles] }]. */
async function sections(world) {
  return world.page.locator('li.course-section').evaluateAll((all) => all.map((s) => ({
    title: (s.querySelector('.course-section__title') || {}).innerText || '',
    count: (s.querySelector('.section-count-items') || {}).innerText || '',
    items: [...s.querySelectorAll('li.course-item .course-item-title')].map((t) => t.innerText),
  }))).then((all) => all.map((s) => ({ title: h.clean(s.title), count: h.clean(s.count), items: s.items.map(h.clean) })).filter((s) => s.title));
}

/**
 * The curriculum of the course page shows a section, with these items in it (a section the page shows closed lists
 * its items once opened: the step opens it).
 *
 * Example #1: Then the curriculum should show the section "Getting started" with "What a scenario is", "Steps and features"
 * Example #2: Then the curriculum should show the section "Check what you learned" with "Basics quiz"
 * Example #3: Then the curriculum should show the section "Running a suite" with "Tags and hooks"
 * Example #4: And the curriculum should show the section "Getting started" with "What a scenario is"
 * Example #5: And the curriculum should show the section "Check what you learned" with "Basics quiz"
 */
Then(/^the curriculum should show the section "([^"]*)" with ((?:"[^"]*",? ?)+)$/, async function (section, titles) {
  const wanted = titles.match(/"([^"]*)"/g).map((t) => t.slice(1, -1));
  // A closed section keeps its items out of the page until it is opened: open the ones that list none.
  const closed = this.page.locator('li.course-section').filter({ has: this.page.locator('.course-section__title').filter({ hasText: h.exactly(section) }) });
  if (await closed.count()) {
    const items = await closed.first().locator('li.course-item').count();
    if (!items) await closed.first().locator('.course-section-header').first().click().catch(() => {});
  }
  await h.eventually(this, () => sections(this), (all) => {
    const found = all.find((s) => h.same(s.title, section));
    return Boolean(found) && wanted.every((w) => found.items.some((i) => h.same(i, w)));
  }, async (all) => {
    const found = (all || []).find((s) => h.same(s.title, section));
    return {
      message: found ? `The section "${section}" lists ${h.listed(found.items)}, not ${h.listed(wanted)}.` : `The curriculum shows no section "${section}". It shows ${h.listed((all || []).map((s) => s.title))}.`,
      hint: 'The curriculum lists the sections of the course and, in each, its lessons and quizzes.',
    };
  });
});

/** The details of the course page (the box beside it), label to value: "Lesson" → "2 Lessons". */
async function details(world) {
  return world.page.locator('.lp-block-course-sidebar .info-meta-item, .course-sidebar-preview .info-meta-item, .info-meta-item').evaluateAll((all) => all.map((m) => ({
    label: (m.querySelector('.info-meta-left, .info-meta-label') || {}).innerText || '',
    value: (m.querySelector('.info-meta-right, .info-meta-value') || {}).innerText || '',
    text: m.innerText,
  }))).then((all) => all.map((d) => ({ label: h.clean(d.label).replace(/:$/, ''), value: h.clean(d.value), text: h.clean(d.text) })));
}

/**
 * The details of the course (the box beside its curriculum) show a value for a label: "Student", "Duration",
 * "Lesson", "Quiz", "Level".
 *
 * Example #1: Then the course should show "Lesson" as "2 Lessons"
 * Example #2: Then the course should show "Quiz" as "1 Quiz"
 * Example #3: Then the course should show "Level" as "All levels"
 * Example #4: And the course should show "Duration" as "2 Weeks"
 * Example #5: And the course should show "Student" as "1 Student"
 */
Then(/^the course should show "([^"]*)" as "([^"]*)"$/, async function (label, value) {
  await h.eventually(this, () => details(this), (all) => all.some((d) => h.same(d.label, label) && h.same(d.value, value)), async (all) => ({
    message: `The course does not show "${label}" as "${value}". It shows ${h.listed((all || []).map((d) => `${d.label}: ${d.value}`))}.`,
    hint: 'The details are the box beside the curriculum: its price, students, duration, lessons, quizzes and level.',
  }));
});

/**
 * The course page shows its instructor by name.
 *
 * Example #1: Then the instructor of the course should be "Instructor Test"
 * Example #2: And the instructor of the course should be "Instructor Test"
 * Example #3: Then the instructor of the course should be "Instructor Test"
 * Example #4: And the instructor of the course should be "Instructor Test"
 * Example #5: Then the instructor of the course should be "Instructor Test"
 */
Then(/^the instructor of the course should be "([^"]*)"$/, async function (name) {
  const read = () => this.page.locator('.course-instructor a, .lp-section-instructor .instructor-display-name, .wp-block-learnpress-course-instructor a').allInnerTexts().then((t) => t.map(h.clean).filter(Boolean));
  await h.eventually(this, read, (all) => all.some((t) => h.same(t, name)), async (all) => ({
    message: `The course's instructor is not "${name}". The page names ${h.listed([...new Set(all || [])])}.`,
    hint: 'The instructor is the author of the course (or a co-instructor).',
  }));
});

/**
 * The course page offers a button: "Start Now" (a free course, not enrolled), "Continue" (enrolled), "Buy Now".
 *
 * Example #1: Then the course page should offer "Start Now"
 * Example #2: Then the course page should offer "Continue"
 * Example #3: And the course page should not offer "Start Now"
 * Example #4: And the course page should not offer "Continue"
 * Example #5: Then the course page should offer "Start Now"
 */
Then(/^the course page should( not)? offer "([^"]*)"$/, async function (notCase, text) {
  const read = () => this.page.locator('.lp-block-course-sidebar button, .course-buttons button, .lp-course-buttons button, form button.lp-button, a.lp-button, button.lp-button').filter({ visible: true }).allInnerTexts().then((t) => t.map(h.clean).filter(Boolean));
  await h.eventually(this, read, (all) => all.some((t) => h.same(t, text)) !== Boolean(notCase), async (all) => ({
    message: notCase ? `The course page offers "${text}".` : `The course page offers no "${text}". It offers ${h.listed([...new Set(all || [])])}.`,
    hint: 'A free course offers "Start Now" to somebody not enrolled, and "Continue" once enrolled.',
  }));
});
