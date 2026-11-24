'use strict';

// The administration of the courses, read only: an option of the settings screens (a switch on or off, or the choice
// a select shows) and a row of the courses list (its curriculum, its students, its price, its status).

const { Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./learnpress-helpers');

/** The options of the settings screen on the page: label, kind, on, value. */
async function options(world) {
  return world.page.locator('.form-table tr').evaluateAll((rows) => rows.map((tr) => {
    const th = tr.querySelector('th');
    const input = tr.querySelector('td input:not([type=hidden]), td select, td textarea');
    if (!th || !input) return null;
    const select = input.tagName === 'SELECT' ? input : null;
    return {
      label: th.innerText,
      kind: input.type === 'checkbox' ? 'switch' : (select ? 'select' : 'text'),
      on: input.type === 'checkbox' ? input.checked : null,
      value: select ? ((select.options[select.selectedIndex] || {}).text || '') : input.value,
    };
  }).filter(Boolean)).then((all) => all.map((o) => ({ ...o, label: h.clean(o.label), value: h.clean(o.value) })));
}

/**
 * An option of the settings screen on the page is on or off (a switch), or shows a choice (a select) or a value.
 *
 * Example #1: Then the "Review courses" option should be on
 * Example #2: Then the "Auto start" option should be on
 * Example #3: And the "Instructor registration" option should be off
 * Example #4: And the "Single course layout" option should be "Modern"
 * Example #5: Then the "Courses per page" option should be "8"
 */
Then(/^the "([^"]*)" option should be (?:(on|off)|"([^"]*)")$/, async function (label, state, value) {
  await h.eventually(this, () => options(this), (all) => {
    const option = all.find((o) => h.same(o.label, label));
    if (!option) return false;
    if (state) return option.kind === 'switch' && option.on === (state === 'on');
    return h.same(option.value, value);
  }, async (all) => {
    const option = (all || []).find((o) => h.same(o.label, label));
    if (!option) return { message: `The screen has no option "${label}". It has ${h.listed((all || []).map((o) => o.label))}.`, hint: 'Open the settings screen (and its tab) that holds the option first.' };
    return {
      message: `The option "${label}" is not ${state || `"${value}"`}. It is ${option.kind === 'switch' ? (option.on ? 'on' : 'off') : `"${option.value}"`}.`,
      hint: 'A switch is on or off; a select shows the choice it holds.',
    };
  });
});

/**
 * The courses list of the administration lists a course, with a text in its row: its curriculum ("2 Sections 2
 * Lessons 1 Quiz"), its students, its price ("Free"), its status ("Pending").
 *
 * Example #1: Then the administration should list the course "Webship Testing Basics" with "2 Sections 2 Lessons 1 Quiz"
 * Example #2: Then the administration should list the course "Webship Advanced Testing" with "Free"
 * Example #3: And the administration should list the course "Webship test course" with "Pending"
 * Example #4: And the administration should list the course "Webship Testing Basics" with "Instructor Test"
 * Example #5: Then the administration should not list the course "Webship test course"
 */
Then(/^the administration should( not)? list the course "([^"]*)"(?: with "([^"]*)")?$/, async function (notCase, title, text) {
  const read = () => this.page.locator('#the-list tr').evaluateAll((rows) => rows.map((r) => ({
    title: (r.querySelector('.row-title') || {}).innerText || '',
    text: r.innerText,
  }))).then((all) => all.map((r) => ({ title: h.clean(r.title), text: h.clean(r.text) })));
  if (!(await this.page.locator('#the-list').count())) throw friendly({ message: 'The page is no list of the administration.', hint: 'Open the "Courses" admin screen first.' });
  await h.eventually(this, read, (all) => all.some((r) => h.same(r.title, title) && (!text || h.holds(r.text, text))) !== Boolean(notCase), async (all) => {
    const row = (all || []).find((r) => h.same(r.title, title));
    return {
      message: notCase ? `The courses list lists "${title}".` : (row ? `The row of "${title}" does not read "${text}". It reads "${row.text}".` : `The courses list has no "${title}". It lists ${h.listed((all || []).map((r) => r.title))}.`),
      hint: 'The courses list shows every course with its author, its curriculum, its students, its price and its status.',
    };
  });
});
