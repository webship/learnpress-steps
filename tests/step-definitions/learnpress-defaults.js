'use strict';

// What this pack brings along for every scenario. Not a step file.
//
//   1. The WordPress pack's steps. A courses project installs this pack alone: the login by a handle of the users
//      registry, the administration screens, menus and notices, the settings by their labels, the REST API and the
//      feeds come from @webship-js/wordpress-steps, which this package depends on and loads here, so one `require`
//      glob in cucumber.js is enough. A project that lists the WordPress pack's glob as well is fine while npm
//      installed one copy of it (Node loads a file once); a second, nested copy registers every WordPress step twice,
//      so drop that glob then (see README).
//
//   2. The screens of the courses' administration, added to the WordPress pack's list of named screens: `Given I am on
//      the "Courses" admin screen` opens the courses, as `the "Plugins" admin screen` opens the plugins. A name the
//      WordPress pack already has is never changed.
//
//   3. Per scenario: the removals its steps asked for (a course an instructor made, with its lessons and quiz), and
//      the restore of what the learners' accounts have of a course (their enrolment, progress and quiz attempts, put
//      back fresh with the plugin's own "Assign" tool or taken away with "Unassign", and the orders the scenario
//      made), run once it ends, whatever its outcome.

const fs = require('fs');
const path = require('path');
const { Before, After, AfterAll } = require('@cucumber/cucumber');

const WORDPRESS_STEPS_DIR = path.join(path.dirname(require.resolve('@webship-js/wordpress-steps/package.json')), 'tests', 'step-definitions');
for (const file of fs.readdirSync(WORDPRESS_STEPS_DIR).filter((f) => f.endsWith('.js')).sort()) {
  require(path.join(WORDPRESS_STEPS_DIR, file));
}

const { ADMIN_SCREENS } = require('@webship-js/wordpress-steps/tests/step-definitions/wordpress-helpers');
const h = require('./learnpress-helpers');

// The screens of the courses' administration, by the name a person reads in the menu or on the screen, lower case.
const LEARNING_ADMIN_SCREENS = {
  'courses': '/wp-admin/edit.php?post_type=lp_course',
  'lessons': '/wp-admin/edit.php?post_type=lp_lesson',
  'quizzes': '/wp-admin/edit.php?post_type=lp_quiz',
  'questions': '/wp-admin/edit.php?post_type=lp_question',
  'orders': '/wp-admin/edit.php?post_type=lp_order',
  'students': '/wp-admin/admin.php?page=learn-press-students-enrolled',
  'course settings': '/wp-admin/admin.php?page=learn-press-settings&tab=courses',
  'learning settings': '/wp-admin/admin.php?page=learn-press-settings',
};
for (const [name, screen] of Object.entries(LEARNING_ADMIN_SCREENS)) {
  if (!(name in ADMIN_SCREENS)) ADMIN_SCREENS[name] = screen;
}

Before(function () {
  this.learningScenarioStartedAt = Date.now();
  this.learningCleanup = [];
  this.learningLateCleanup = [];
  this.learningTouched = new Map();
});

// The removals the scenario's steps asked for, newest first, then the late ones (the restores of the learners'
// courses); one that fails is reported and the others still run.
After({ timeout: 240000 }, async function () {
  const jobs = [...(this.learningCleanup || []).slice().reverse(), ...(this.learningLateCleanup || [])];
  this.learningCleanup = [];
  this.learningLateCleanup = [];
  const failures = [];
  for (const job of jobs) {
    try {
      await job();
    } catch (err) {
      failures.push(err && err.message ? err.message : String(err));
    }
  }
  if (failures.length) {
    // eslint-disable-next-line no-console
    console.warn(`What the scenario changed was not all put back: ${failures.join(' | ')}`);
  }
});

// The manager's sessions of the site, closed once the run ends.
AfterAll(async function () {
  await h.managerEnd();
});

module.exports = { WORDPRESS_STEPS_DIR, LEARNING_ADMIN_SCREENS };
