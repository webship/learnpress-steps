'use strict';

// The profile of the account logged in (the plugin's "Profile" page): its tabs (My Courses, Quizzes, Orders, Settings),
// the counts of its courses (enrolled, in progress, finished, passed, failed), the courses it learns with their
// result, and the quizzes it took with theirs. The page fills its lists by script once it loaded.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./learnpress-helpers');

/** Wait for the list of the tab to come: its rows, or the message that it has none. */
async function waitForTab(world) {
  await world.page.locator('.lp-list-table tbody tr, .lp_profile_course_progress__item:not(.lp_profile_course_progress__header), .learn-press-message, .lp-profile-content .no-courses, .learn-press-subtab-content')
    .first().waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
  await world.page.locator('.lp-skeleton-animation, .lp-loading-circle').first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await world.page.waitForTimeout(300);
}

/**
 * Open the profile of the account logged in, on its courses (the plugin's "Profile" page, its "My Courses" tab).
 *
 * Example #1: When I go to my courses
 * Example #2: Given I am on my courses
 * Example #3: When I go to my courses
 * Example #4: Given I am on my courses
 * Example #5: When I go to my courses
 */
When(/^(?:I go to|I am on) my courses$/, async function () {
  await h.visit(this, h.learningPath(this, 'profile'));
  await waitForTab(this);
});

/**
 * Open a tab of the profile on the page, by its name: "My Courses", "Quizzes", "Orders", "Settings".
 *
 * Example #1: When I open the "Quizzes" tab of my profile
 * Example #2: When I open the "My Courses" tab of my profile
 * Example #3: And I open the "Orders" tab of my profile
 * Example #4: And I open the "Quizzes" tab of my profile
 * Example #5: When I open the "Orders" tab of my profile
 */
When(/^I open the "([^"]*)" tab of my profile$/, async function (tab) {
  const links = this.page.locator('.lp-profile-nav-tabs a, .learn-press-tabs__nav a, aside a, #profile-nav a').filter({ visible: true });
  const texts = (await links.allInnerTexts()).map(h.clean);
  const at = texts.findIndex((t) => h.same(t, tab));
  if (at < 0) throw friendly({ message: `The profile has no tab "${tab}". It has ${h.listed(texts.filter(Boolean))}.`, hint: 'A profile shows its tabs to the account it belongs to.' });
  await h.clickAndLoad(this, links.nth(at), `open the "${tab}" tab`);
  await waitForTab(this);
});

/** The counts of the courses tab: label to number ("Enrolled Course" → "1"). */
async function counts(world) {
  return world.page.locator('.statistic-box').evaluateAll((boxes) => boxes.map((b) => ({
    label: ((b.querySelector('.statistic-box__text__label, .statistic-box__text span:not(.statistic-box__text__number)') || {}).innerText || b.innerText.replace(/\d+/g, '')),
    number: ((b.querySelector('.statistic-box__text__number') || {}).innerText || ''),
  }))).then((all) => all.map((c) => ({ label: h.clean(c.label), number: h.clean(c.number) })));
}

/**
 * The profile counts the account's courses: "Enrolled Course", "Inprogress Course", "Finished Course", "Passed
 * Course", "Failed Course".
 *
 * Example #1: Then my profile should count "Enrolled Course" as "1"
 * Example #2: Then my profile should count "Inprogress Course" as "1"
 * Example #3: And my profile should count "Finished Course" as "0"
 * Example #4: And my profile should count "Passed Course" as "0"
 * Example #5: And my profile should count "Failed Course" as "0"
 */
Then(/^my profile should count "([^"]*)" as "([^"]*)"$/, async function (label, number) {
  await h.eventually(this, () => counts(this), (all) => all.some((c) => h.same(c.label, label) && h.same(c.number, number)), async (all) => ({
    message: `The profile does not count "${label}" as "${number}". It counts ${h.listed((all || []).map((c) => `${c.label}: ${c.number}`))}.`,
    hint: 'The courses tab of a profile counts the courses enrolled, in progress, finished, passed and failed.',
  }));
});

/** The rows of the table of the tab on the page: the cells of each. */
async function tableRows(world) {
  return world.page.locator('.lp-list-table tbody tr, .lp_profile_course_progress__item:not(.lp_profile_course_progress__header)').evaluateAll((rows) => rows.map((r) => {
    const cells = [...r.querySelectorAll('td, .lp_profile_course_progress__item > *')].map((c) => c.innerText);
    return cells.length ? cells : [r.innerText];
  })).then((all) => all.map((cells) => cells.map(h.clean).filter(Boolean)).filter((cells) => cells.length));
}

/**
 * The table of the profile's tab lists a course or a quiz, with a text in its row: a result ("50%", "Failed"), a
 * total ("$0.00").
 *
 * Example #1: Then my profile should list "Webship Testing Basics" with "0%"
 * Example #2: Then my profile should list "Basics quiz" with "Passed"
 * Example #3: And my profile should list "Basics quiz" with "Failed"
 * Example #4: And my profile should list "Webship Testing Basics" with "In Progress"
 * Example #5: Then my profile should not list "Webship Advanced Testing"
 */
Then(/^my profile should( not)? list "([^"]*)"(?: with "([^"]*)")?$/, async function (notCase, name, text) {
  const matches = (cells) => cells.some((c) => h.same(c, name) || h.holds(c, name)) && (!text || cells.some((c) => h.holds(c, text)));
  await h.eventually(this, () => tableRows(this), (all) => all.some(matches) !== Boolean(notCase), async (all) => ({
    message: notCase ? `The profile lists "${name}".` : `The profile lists no "${name}"${text ? ` with "${text}"` : ''}. It lists ${h.listed((all || []).map((cells) => cells.join(' | ')))}.`,
    hint: 'The courses tab lists the courses the account learns, the quizzes tab its quizzes, each with its result.',
  }));
});
