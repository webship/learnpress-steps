'use strict';

// The course editor of the administration, as an instructor or the administrator: a new course with its title, the
// sections of its curriculum and, in a section, a new lesson or a new quiz (the curriculum box of the editor makes
// them at once); publishing it (an instructor's course then waits for review); the counts of its curriculum; and the
// removal of a course, a lesson or a quiz by its title. What a step makes goes once the scenario ends.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./learnpress-helpers');

const EDITOR = '#course-editor';

/** Remove, once the scenario ends, what a step made: a course, a lesson or a quiz, by its title. */
function removeLater(world, kind, title) {
  if (!world.learningMade) world.learningMade = new Set();
  const key = `${kind}|${title}`;
  if (world.learningMade.has(key)) return;
  world.learningMade.add(key);
  h.afterScenario(world, () => (kind === 'course' ? h.deleteCoursesTitled(world, title) : h.deleteItemsTitled(world, kind === 'lesson' ? 'lp_lesson' : 'lp_quiz', title)));
}

/**
 * Open the course editor for a new course and give it a title (nothing is saved yet). The course goes once the
 * scenario ends.
 *
 * Example #1: When I start a new course "Webship test course"
 * Example #2: And I start a new course "Webship test course"
 * Example #3: When I start a new course "Webship test course two"
 * Example #4: And I start a new course "Webship test course two"
 * Example #5: When I start a new course "Webship test course"
 */
When(/^I start a new course "([^"]*)"$/, async function (title) {
  removeLater(this, 'course', title);
  await h.visit(this, '/wp-admin/post-new.php?post_type=lp_course');
  const field = this.page.locator('#title');
  if (!(await field.count())) throw friendly({ message: 'The editor of a new course did not open.', hint: `The browser is at ${this.page.url()}: the account may not make courses.` });
  await field.fill(title);
  await this.page.locator(EDITOR).waitFor({ state: 'visible', timeout: 15000 });
});

/** A section of the curriculum box, by its title (its title box holds it). */
async function sectionBox(world, section) {
  const boxes = world.page.locator(`${EDITOR} .curriculum-sections > .section`);
  const titles = await boxes.locator('input.lp-section-title-input').evaluateAll((all) => all.map((i) => i.value));
  const at = titles.findIndex((t) => h.same(t, section));
  if (at < 0) throw friendly({ message: `The curriculum has no section "${section}". It has ${h.listed(titles.map(h.clean).filter(Boolean))}.`, hint: 'Add the section first ("When I add the section …").' });
  return boxes.nth(at);
}

/**
 * Add a section to the curriculum of the course in the editor ("Create a new section", "Add Section").
 *
 * Example #1: When I add the section "Webship test section" to the curriculum
 * Example #2: And I add the section "Webship test section" to the curriculum
 * Example #3: When I add the section "Webship test part two" to the curriculum
 * Example #4: And I add the section "Webship test part two" to the curriculum
 * Example #5: When I add the section "Webship test section" to the curriculum
 */
When(/^I add the section "([^"]*)" to the curriculum$/, async function (section) {
  const box = this.page.getByRole('textbox', { name: 'Create a new section' });
  if (!(await box.count())) throw friendly({ message: 'The editor has no box to create a section.', hint: 'Open the editor of a course first.' });
  await box.fill(section);
  await this.page.getByRole('button', { name: 'Add Section' }).click();
  await h.eventually(this, () => sectionBox(this, section).then(() => true).catch(() => false), (ok) => ok, async () => ({
    message: `The section "${section}" did not show in the curriculum.`,
    hint: 'The curriculum saves a new section at once and shows it with its title box.',
  }), 20000);
});

/**
 * Add a new lesson or a new quiz to a section of the curriculum ("New Lesson" / "New Quiz", its title, "Add
 * Lesson" / "Add Quiz"). It goes once the scenario ends.
 *
 * Example #1: When I add the lesson "Webship test lesson" to the section "Webship test section"
 * Example #2: When I add the quiz "Webship test quiz" to the section "Webship test section"
 * Example #3: And I add the lesson "Webship test lesson two" to the section "Webship test section"
 * Example #4: And I add the quiz "Webship test quiz" to the section "Webship test part two"
 * Example #5: When I add the lesson "Webship test lesson" to the section "Webship test part two"
 */
When(/^I add the (lesson|quiz) "([^"]*)" to the section "([^"]*)"$/, async function (kind, title, section) {
  removeLater(this, kind, title);
  const box = await sectionBox(this, section);
  const word = kind === 'lesson' ? 'Lesson' : 'Quiz';
  await box.getByRole('button', { name: new RegExp(`New ${word}$`) }).click();
  const input = box.getByRole('textbox', { name: `Create a new ${word}` });
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(title);
  await box.getByRole('button', { name: `Add ${word}`, exact: true }).click();
  const read = () => box.locator('li.section-item input.lp-item-title-input').evaluateAll((all) => all.map((e) => e.value)).then((t) => t.map(h.clean));
  await h.eventually(this, read, (all) => all.some((t) => h.same(t, title)), async (all) => ({
    message: `The ${kind} "${title}" did not show in the section "${section}". The section holds ${h.listed((all || []).filter(Boolean))}.`,
    hint: 'The curriculum makes the item at once and lists it in its section.',
  }), 20000);
});

/**
 * Publish the course in the editor ("Publish"). An instructor's course then waits for the administrator's review
 * ("Pending Review"), as the course settings ask by default.
 *
 * Example #1: When I publish the course
 * Example #2: And I publish the course
 * Example #3: When I publish the course
 * Example #4: And I publish the course
 * Example #5: When I publish the course
 */
When(/^I publish the course$/, async function () {
  const button = this.page.locator('#publish');
  if (!(await button.count())) throw friendly({ message: 'The editor offers no "Publish".', hint: 'Open the editor of a course first.' });
  await h.clickAndLoad(this, button, 'publish the course');
});

/**
 * The status of the course in the editor: "Published", "Pending Review", "Draft".
 *
 * Example #1: Then the course should be "Pending Review"
 * Example #2: Then the course should be "Published"
 * Example #3: And the course should be "Draft"
 * Example #4: And the course should be "Pending Review"
 * Example #5: Then the course should be "Published"
 */
Then(/^the course should be "(Published|Pending Review|Draft|Private|Scheduled)"$/, async function (status) {
  const read = () => this.page.locator('#post-status-display').innerText().then(h.clean);
  await h.eventually(this, read, (value) => h.same(value, status), async (value) => ({
    message: `The course is not "${status}". The editor says "${value || '(no status)'}".`,
    hint: 'An instructor\'s course waits for review once published, while "Review courses" is on in the course settings.',
  }));
});

/**
 * The curriculum box of the editor counts the course's sections and items ("1 Section", "2 Items").
 *
 * Example #1: Then the curriculum should count "1 Section" and "2 Items"
 * Example #2: Then the curriculum should count "2 Sections" and "3 Items"
 * Example #3: And the curriculum should count "1 Section" and "1 Item"
 * Example #4: And the curriculum should count "0 Sections" and "0 Items"
 * Example #5: Then the curriculum should count "1 Section" and "2 Items"
 */
Then(/^the curriculum should count "([^"]*)" and "([^"]*)"$/, async function (sections, items) {
  const read = () => this.page.locator(`${EDITOR} #lp-course-edit-curriculum .heading`).first().evaluate((head) => [
    (head.querySelector('.count-sections') || {}).innerText || '',
    (head.querySelector('.total-items') || {}).innerText || '',
  ]).then((c) => c.map(h.clean));
  await h.eventually(this, read, (c) => h.same(c[0], sections) && h.same(c[1], items), async (c) => ({
    message: `The curriculum does not count "${sections}" and "${items}". It counts ${c ? `"${c[0]}" and "${c[1]}"` : '(nothing)'}.`,
    hint: 'The details of the curriculum box count the sections and the items of the course.',
  }));
});

/**
 * No course, lesson or quiz of this title is on the site (whatever its status): one left by an earlier run goes now.
 *
 * Example #1: Given there is no course "Webship test course"
 * Example #2: Given there is no lesson "Webship test lesson"
 * Example #3: Given there is no quiz "Webship test quiz"
 * Example #4: And there is no course "Webship test course two"
 * Example #5: And there is no lesson "Webship test lesson two"
 */
Given(/^there is no (course|lesson|quiz) "([^"]*)"$/, async function (kind, title) {
  if (kind === 'course') await h.deleteCoursesTitled(this, title);
  else await h.deleteItemsTitled(this, kind === 'lesson' ? 'lp_lesson' : 'lp_quiz', title);
});
