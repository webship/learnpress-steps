'use strict';

// Learning a course, as the account logged in: enrolling in a free course ("Start Now"), opening a lesson or a quiz
// of its curriculum, completing a lesson (the plugin asks first: "Do you want to complete the lesson …?"), the
// progress the course header shows ("1 of 3 items"), the state of an item in the curriculum and the message the
// plugin shows ("Congrats! You have completed …"). What a step changes of the account's course (its enrolment, its
// progress, its order) is put back once the scenario ends.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./learnpress-helpers');

/** The course the step works on: the one named, or the one of the page. */
async function theCourse(world, title) {
  if (title) return h.courseByTitle(world, title);
  if (world.learningCourse) return world.learningCourse;
  throw friendly({ message: 'No course is open: the step does not know which course it is about.', hint: 'Go to the course first ("When I go to the course …"), or name it in the step.' });
}

/**
 * Enrol in a free course, as the account logged in: its page's "Start Now" (a course that starts by itself opens its
 * first item). The enrolment, and the order the plugin records for it, go when the scenario ends.
 *
 * Example #1: When I start the course "Webship Testing Basics"
 * Example #2: When I start the course "Webship Advanced Testing"
 * Example #3: And I start the course "Webship Testing Basics"
 * Example #4: And I start the course "Webship Advanced Testing"
 * Example #5: When I start the course "Webship Testing Basics"
 */
When(/^I start the course "([^"]*)"$/, async function (title) {
  const course = await h.openCourse(this, title);
  this.learningCourse = course;
  await h.touchCourse(this, await h.me(this), course);
  const button = this.page.locator('button.button-enroll-course, form.enroll-course button, .lp-button.button-enroll-course').filter({ visible: true }).first();
  if (!(await button.count())) {
    const offered = (await this.page.locator('button.lp-button, a.lp-button').filter({ visible: true }).allInnerTexts()).map(h.clean).filter(Boolean);
    throw friendly({ message: `The course "${title}" offers no "Start Now". It offers ${h.listed(offered)}.`, hint: 'An account enrolled already is offered "Continue"; a course that is not free asks for a payment.' });
  }
  await h.clickAndLoad(this, button, `start the course "${title}"`);
});

/**
 * Open an item of a course's curriculum (a lesson or a quiz), by its title, as the account logged in.
 *
 * Example #1: When I open "What a scenario is" in the course "Webship Testing Basics"
 * Example #2: When I open "Basics quiz" in the course "Webship Testing Basics"
 * Example #3: When I open "Steps and features" in the course "Webship Testing Basics"
 * Example #4: And I open "Tags and hooks" in the course "Webship Advanced Testing"
 * Example #5: And I open "What a scenario is" in the course "Webship Testing Basics"
 */
When(/^I open "([^"]*)" in the course "([^"]*)"$/, async function (item, title) {
  const course = await h.openCourse(this, title);
  this.learningCourse = course;
  const items = await h.curriculumItems(this);
  const found = items.find((i) => h.same(i.title, item));
  if (!found || !found.link) {
    throw friendly({ message: `The curriculum of "${title}" has no "${item}". It has ${h.listed(items.map((i) => i.title))}.`, hint: 'An item is a lesson or a quiz of one of the course\'s sections.' });
  }
  // Opening an item of a course one is enrolled in is progress the plugin records.
  await h.touchCourse(this, await h.me(this), course);
  await h.visit(this, found.link);
});

/**
 * Complete the lesson the page shows ("Complete"), answering the plugin's question yes. A course that moves on by
 * itself opens its next item.
 *
 * Example #1: When I complete the lesson
 * Example #2: And I complete the lesson
 * Example #3: When I complete the lesson
 * Example #4: And I complete the lesson
 * Example #5: When I complete the lesson
 */
When(/^I complete the lesson$/, async function () {
  const button = this.page.locator('button.button-complete-lesson, button.lp-btn-complete-item').filter({ visible: true }).first();
  if (!(await button.count())) {
    const title = h.clean(await this.page.locator('.course-item-title, #learn-press-content-item h1').first().innerText().catch(() => ''));
    throw friendly({ message: `The page${title ? ` of "${title}"` : ''} offers no "Complete".`, hint: 'A lesson is completed once, by an account enrolled in its course; a completed lesson says so instead.' });
  }
  const from = this.page.url();
  await button.click();
  const asked = await h.confirmBox(this, 'yes');
  if (asked === null) {
    // The question is off ("Confirmation popup" of the course settings): the click itself completes the lesson.
  }
  await this.page.waitForURL((url) => url.toString() !== from, { timeout: 15000 }).catch(() => {});
  await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  await this.page.waitForTimeout(300);
});

/**
 * The plugin's message on the page (the box it shows after an action) says a text.
 *
 * Example #1: Then the course should say "Congrats! You have completed “What a scenario is”."
 * Example #2: Then the course should say "You have completed"
 * Example #3: And the course should say "Congrats!"
 * Example #4: And the course should say "Congrats! You have completed “Steps and features”."
 * Example #5: Then the course should say "You have completed “Tags and hooks”."
 */
Then(/^the course should say "([^"]*)"$/, async function (text) {
  const read = () => this.page.locator('.learn-press-message, .lp-message, .message-success').filter({ visible: true }).allInnerTexts().then((t) => t.map(h.clean).filter(Boolean));
  await h.eventually(this, read, (all) => all.some((t) => h.holds(t, text)), async (all) => ({
    message: `The page says no "${text}". It says ${h.listed(all || [])}.`,
    hint: 'The plugin says what an action did in a box above the item, on the page it opens next.',
  }));
});

/**
 * The progress of the course the page shows: its header ("1 of 3 items").
 *
 * Example #1: Then the progress of the course should be "1 of 3 items"
 * Example #2: Then the progress of the course should be "0 of 3 items"
 * Example #3: And the progress of the course should be "2 of 3 items"
 * Example #4: And the progress of the course should be "3 of 3 items"
 * Example #5: Then the progress of the course should be "1 of 1 items"
 */
Then(/^the progress of the course should be "([^"]*)"$/, async function (text) {
  const read = async () => h.clean(await this.page.locator('.items-progress').first().innerText());
  await h.eventually(this, read, (value) => h.holds(value, text), async (value) => ({
    message: `The progress of the course is not "${text}". It is "${value || '(none)'}".`,
    hint: 'The header of a lesson or a quiz counts the items done of the course; the course page shows a percentage instead.',
  }));
});

/**
 * The state of an item in the curriculum on the page: "completed", "passed", "failed", "in progress", "locked".
 *
 * Example #1: Then the item "What a scenario is" should be completed
 * Example #2: Then the item "Basics quiz" should be passed
 * Example #3: And the item "Steps and features" should be in progress
 * Example #4: And the item "Basics quiz" should be failed
 * Example #5: Then the item "What a scenario is" should be locked
 */
Then(/^the item "([^"]*)" should be (completed|passed|failed|in progress|locked)$/, async function (item, state) {
  const wanted = state.replace(' ', '-');
  await h.eventually(this, () => h.curriculumItems(this), (all) => {
    const found = all.find((i) => h.same(i.title, item));
    return Boolean(found) && found.state.split(/\s+/).includes(wanted);
  }, async (all) => {
    const found = (all || []).find((i) => h.same(i.title, item));
    return {
      message: found ? `The item "${item}" is not ${state}. Its state is "${found.state || 'none'}".` : `The curriculum has no "${item}". It has ${h.listed((all || []).map((i) => i.title))}.`,
      hint: 'The curriculum marks each item by its state for the account logged in; a visitor sees them locked.',
    };
  });
});
