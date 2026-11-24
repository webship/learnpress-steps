<p align="center"><img src="https://raw.githubusercontent.com/webship/learnpress-steps/2.0.x/assets/logo.png" alt="LearnPress logo" width="96"></p>

# learnpress-steps

[![Test](https://github.com/webship/learnpress-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/learnpress-steps/actions/workflows/test.yml)

Cucumber step definitions for testing courses on WordPress with LearnPress, with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation harness built on Playwright and
Cucumber-js.

`@webship-js/learnpress-steps` is an extension of [`@webship-js/wordpress-steps`](https://github.com/webship/wordpress-steps).
It depends on that pack and loads it, so a courses project installs this one pack and has both. The WordPress pack gives
the login by a handle of the users registry, the administration screens, menus and notices, a setting by its label and
the rest of the site. This pack adds the courses:

- **the course list and a course page**: the courses it lists, in its order, a row's instructor, lessons, students and
  price, its search and its order; a course's curriculum (its sections and their lessons and quizzes), its details
  (students, duration, lessons, quizzes, level), its instructor and its button ("Start Now", "Continue");
- **enrolling in a free course** ("Start Now", which opens its first lesson);
- **lessons**: one opened from the curriculum, completed (the plugin asks first), the course's progress ("1 of 3
  items"), an item's state in the curriculum (completed, in progress, locked) and what the plugin says;
- **quizzes**: started, a question answered (one choice or several, on whichever page of the quiz), finished (asked
  first), the result (passed or failed, the points, the questions right, wrong and skipped), the review of the answers,
  a retake (asked first) and the buttons the quiz offers;
- **the student's profile**: its courses tab with its counts (enrolled, in progress, finished, passed, failed) and its
  courses, its quizzes tab with their results;
- **the instructor's course editor**: a new course, a section of its curriculum, a lesson and a quiz made in a section,
  the counts of the curriculum, the course published and waiting for review;
- **the administration, read only**: an option of the course settings (a switch, a choice), a row of the courses list.

No step phrase names the platform: a scenario reads `When I start the course "Webship Testing Basics"` and `Then the quiz
should be passed`.

CI builds a real site with [DDEV](https://ddev.com) on the runner: the latest WordPress with the latest LearnPress from
the plugin directory, its pages and roles, the accounts of the suite and the test content. It does this on a block
theme and on a classic theme, and on every push and pull request it runs the whole suite twice, comparing what the site
holds before and after each run, then the assertions that must fail. See [The test site](#the-test-site) and
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, and Node.js 24 or later with npm. PHP, WP-CLI,
the database and the mail catcher run in DDEV's containers.

**1. The site.** The pack's own build script (the one CI runs) makes the site in a DDEV project of type `wordpress`.
It installs the latest WordPress, LearnPress from the plugin directory with its pages and roles, the theme WordPress
installs with, the four accounts of [Test users](#test-users) and the test content (see [The test site](#the-test-site)).
It takes about a minute.

```bash
git clone https://github.com/webship/learnpress-steps.git
SITE_DIR="$PWD/learnpress-site" learnpress-steps/.github/scripts/build-ddev-site.sh
```

The courses answer at `https://learnpresssteps.ddev.site/courses/`. The accounts are `administrator`, `instructor`,
`student` and `student2`, each with the password `dD.123123ddd` (step 3 names them).

In the [Webship Workspace](https://github.com/webship/workspace), its LearnPress plugin builds the same site instead.
The plugin works on top of the WordPress plugin, in a sites folder of the workspace: `dev/` here, the one
`--with-needs` adds to a new workspace; `test/`, `sandboxes/` and `demos/` work the same.

```bash
bash core/scripts/plugins.sh --require learnpress --with-needs
bash core/scripts/plugins.sh --activate learnpress --with-needs
bash core/scripts/plugins.sh --install learnpress
bash dev/cmd-learnpress-project.sh lpsite --install --add-users --sample-course
```

Those courses answer at `https://lpsite.ddev.site/courses/`. `--sample-course` adds the courses, the lessons, the quiz and the
student's enrolment the features name. Its accounts are the plugin's: the same four, with the workspace's shared password
`dD.123123ddd`. The workspace's own account is the installer's, one more administrator of the site.

**2. A test project.**

```bash
mkdir learnpress-tests && cd learnpress-tests
npm init -y
npm install --save-dev webship-js @webship-js/learnpress-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the
`npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run changes
nothing. npm installs `@webship-js/wordpress-steps` along with the pack.

**3. `cucumber.js`.** Replace the file with the wiring of the pack:

- the step files of webship-js and of the pack (which loads the WordPress pack's itself);
- the tags that keep the assertions that must fail out of a normal run;
- the address of the site, and the account that puts back what a scenario changed;
- the accounts (the JSON of [Test users](#test-users)).

The first lines are the starter's own: a feature named on the command line runs alone.

```javascript
// A feature file or a scenario (file:line) named on the command line runs alone:
// cucumber-js 12 would add it to the paths below, so `paths` is left empty then.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

const launchUrl = (process.env.LAUNCH_URL || 'https://learnpresssteps.ddev.site').replace(/\/+$/, '');

module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/learnpress-steps/tests/step-definitions/**/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: commandLinePaths().length ? [] : ['tests/features/**/*.feature'],
    // Work in progress and the assertions that must fail stay out of a normal run.
    tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl,
      // The plugin's pages, and the account that puts back what a scenario changed (an administrator of the site).
      learning: { courses: '/courses/', profile: '/profile/', manager: 'admin' },
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      // "admin" is the handle the WordPress pack's features give the administrator; "name" is the one the site shows.
      users: {
        admin: { username: 'administrator', password: 'dD.123123ddd', email: 'administrator@example.com', name: 'Administrator Test' },
        instructor: { username: 'instructor', password: 'dD.123123ddd', email: 'instructor@example.com', name: 'Instructor Test' },
        student: { username: 'student', password: 'dD.123123ddd', email: 'student@example.com', name: 'Student Test' },
        student2: { username: 'student2', password: 'dD.123123ddd', email: 'student2@example.com', name: 'Student2 Test' },
      },
    },
  },
};
```

On a site from the Webship Workspace (step 1) the accounts are the same; its address goes in `LAUNCH_URL` (step 5).

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: A visitor finds a course and reads its curriculum
    Given I am an anonymous user
    When I go to the course list
    Then the course list should show "Webship Testing Basics"
    When I go to the course "Webship Testing Basics"
    Then the curriculum should show the section "Getting started" with "What a scenario is", "Steps and features"

  Scenario: The enrolled student is offered to continue
    Given I am a logged in user with the "student" user
    When I go to the course "Webship Testing Basics"
    Then the course page should offer "Continue"
```

**5. Run it.** Set `LAUNCH_URL` to the address of the site: `https://learnpresssteps.ddev.site` for the build script's
site, `https://lpsite.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://learnpresssteps.ddev.site npm test
```

A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two
scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
10 steps (10 passed)
```

From there, copy the features of [`tests/features/`](tests/features/). They also ship in the package, under
`node_modules/@webship-js/learnpress-steps/tests/features/`, and together they use every step of the pack. They read no
file of their own, so they run on the build script's site and on the Workspace's as they are.

### What the suite tests

The features of this repository run every step of the pack against the test site, twice in a row in CI on every
change, then the assertions that must fail:

- **`courses.feature`**: the course list of a visitor (its order, newest first, a row's lessons, instructor and price,
  the list ordered by title, a search), a course page (its curriculum, its details, its instructor, "Start Now"), and the
  enrolled student offered "Continue".
- **`lessons.feature`**: a student who is not enrolled starts the course and completes its first lesson (what the
  plugin says, the progress, the item's state); the enrolled student completes another.
- **`quiz.feature`**: a quiz answered right (passed, its points and right answers, "Retake (2)", the review of an
  answer), and one answered wrong (failed, the wrong and skipped questions), then retaken.
- **`profile.feature`**: the counts and the course of the student's profile, a quiz taken and listed in its quizzes
  tab with its result.
- **`course-editor.feature`**: an instructor makes a course with a section, a lesson and a quiz, counts its
  curriculum and publishes it, and it waits for review.
- **`administration.feature`**: the courses list of the administration, and the course settings.

Every scenario puts back what it changes when it ends:

- a learner's enrolment and progress (lessons opened and completed, quiz attempts) come back as they were with the
  plugin's own tools: "Assign" for an account that was enrolled (a fresh enrolment), "Unassign" for one that was not;
- the order a free enrolment records is deleted;
- a course an instructor made goes, with its lessons and quiz.

The suite leaves the site as it found it, and CI checks this with the site's counts.

Not tested:

- paid courses, the checkout and the payment gateways (the free plugin's offline payment needs an order a person
  handles);
- the "Become an Instructor" request and the instructor's approval;
- course categories and tags;
- the notes, the downloadable materials, the AI and MCP features of the plugin;
- the course builder of the front end, and the questions of types other than true or false, one choice and several
  choices;
- the plugin's e-mails (its mail of a free enrolment is sent by a background task, not at once);
- languages other than English (the steps read the site's words: "Start Now", "Complete", "Finish Quiz", "Passed").

## Requirements

- Node.js 24 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A site on WordPress with LearnPress 4, its pages set (Courses, Profile), and accounts on it for the suite

## Install

```bash
npm install --save-dev @webship-js/learnpress-steps
```

npm installs `@webship-js/wordpress-steps` with it. List only this pack's step files in `cucumber.js`, since it loads
the WordPress pack's itself. A project that also lists the WordPress pack's glob is fine while npm installed one copy of
it (Node loads a file once). A second, nested copy (the project pins another release line of it) registers every
WordPress step twice, so drop that glob then.

## What is included

| File | Covers |
| --- | --- |
| `learnpress-courses.steps.js` | The course list (its courses, their order, a row's text, its search, its order select), a course page (opening it, its curriculum, its details, its instructor, its button). |
| `learnpress-learning.steps.js` | A free course started, an item of its curriculum opened, a lesson completed, what the plugin says, the progress of the course, an item's state. |
| `learnpress-quiz.steps.js` | A quiz started, a question answered (one choice or several), finished, its result (passed or failed, its counts), its review and an answer read in it, a retake, the buttons it offers. |
| `learnpress-profile.steps.js` | The profile of the account logged in (its courses tab and its other tabs), its counts and the courses or quizzes it lists with their result. |
| `learnpress-editor.steps.js` | The course editor: a new course, a section and, in it, a new lesson or quiz, the counts of the curriculum, the course published and its status, the removal of a course, a lesson or a quiz of an earlier run. |
| `learnpress-site.steps.js` | An option of the settings screens (a switch or a choice), a row of the courses list of the administration. |
| `learnpress-defaults.js` | Loads the WordPress pack's steps, adds the courses' screens to its named administration screens ("Courses", "Lessons", "Quizzes", "Questions", "Orders", "Students", "Course Settings", "Learning Settings"), and keeps per scenario the removals and restores its steps asked for, run when it ends. It registers no step. |
| `learnpress-helpers.js` | Shared plumbing: the plugin's addresses, a course and its curriculum, the plugin's confirmations, the account logged in, the manager's session of the site and the restores. It registers no step. |

Text, links, fields, buttons, the status code and the headers of a page, and the accessibility audit, are webship-js's
own steps (`I should see "..."`, `I follow "..."`). The login by a handle, the administration screens and notices are
the WordPress pack's (`Given I am a logged in user with the "student" user`, `Given I am on the "Courses" admin screen`).

## How the steps find things and wait

- **By what a person reads.** A course, a lesson or a quiz is named by its title; a question by its words (its number
  aside); an answer by its words; an account by a handle of the users registry; a tab, a button or an option by its
  label.
- **No fixed sleeps.** The steps wait on the plugin's own signals:
  - the course list fills by script when "Loading ajax Courses" is on: a step waits for its rows, and a search or an
    order waits for the new list;
  - "Complete", "Finish Quiz" and "Retake" ask first: the plugin's own box ("Do you want to complete the lesson …?",
    No and Yes) or its SweetAlert2 box (Cancel and Yes) is answered yes, then the step waits for the page the plugin
    opens next, or for the quiz's state (`data-status` "started", "completed");
  - a question on another page of the quiz is reached by the quiz's own page links;
  - the profile fills its tabs by script: a step waits for the rows or the message that there are none;
  - the curriculum box of the editor saves a section, a lesson or a quiz at once: a step waits for it in its section.
- **What a scenario changes comes back.** Before a step changes what an account has of a course (it enrols, opens a
  lesson, completes one, takes the quiz), it notes whether the account was enrolled and which orders it had. When the
  scenario ends, whatever its outcome, the manager's session of the site puts the enrolment back with the plugin's own
  admin tools: `assign-user-course` (a fresh enrolment, its progress and attempts gone) for an account that was
  enrolled, `unassign-user-course` for one that was not. The orders the scenario made are deleted from the orders list,
  because a free enrolment records an order, and moving it to the bin does not end the enrolment. A course, a lesson or
  a quiz a step made is deleted for good.
- **Failures say what was found.** `The course list does not show "Webship Testing Basics", "Webship Advanced Testing"
  in this order. It shows "Webship Advanced Testing", "Webship Testing Basics".`, with a hint on where to look.

## Accounts

The suite never creates or deletes an account. Accounts are configuration: list the ones the site has in
`worldParameters.users`, by a handle the scenarios use, each with its `username` and `password`, and its `name` as the
site shows it (the toolbar's "Howdy, …" tells a step which account is logged in):

```javascript
users: {
  admin: { username: 'administrator', password: process.env.WP_ADMIN_PASSWORD, email: 'administrator@example.com', name: 'Administrator Test' },
  student: { username: 'student', password: process.env.WP_STUDENT_PASSWORD, email: 'student@example.com', name: 'Student Test' },
},
```

The restores need one more thing: `worldParameters.learning.manager`, the handle of an account that may use the
plugin's tools and delete courses and orders (the site's administrator; `admin` by default).

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js` lists them in `worldParameters.users` (the
default values; the `WP_<HANDLE>_USER`, `WP_<HANDLE>_PASSWORD`, `WP_<HANDLE>_EMAIL` and `WP_<HANDLE>_NAME` variables
replace them). The build script makes them; the Workspace's LearnPress plugin makes the same four.

```json
{
  "admin": { "username": "administrator", "password": "dD.123123ddd", "email": "administrator@example.com", "name": "Administrator Test" },
  "instructor": { "username": "instructor", "password": "dD.123123ddd", "email": "instructor@example.com", "name": "Instructor Test" },
  "student": { "username": "student", "password": "dD.123123ddd", "email": "student@example.com", "name": "Student Test" },
  "student2": { "username": "student2", "password": "dD.123123ddd", "email": "student2@example.com", "name": "Student2 Test" }
}
```

These are the four accounts and what each has on the site:

- `admin`: the site's administrator (the installer's account in the build script), with every course, the settings and
  the tools.
- `instructor`: has the plugin's instructor role, and the two courses of the test content are theirs. A course they
  publish waits for review.
- `student`: a subscriber enrolled in "Webship Testing Basics".
- `student2`: a subscriber enrolled in nothing.

They are accounts of a throwaway test site, with a placeholder password, not accounts of any real one.

## The test site

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh) builds the site the suite of this repository
runs against, in a DDEV project of type `wordpress` with PHP 8.4 and Node.js 24. `WORDPRESS_VERSION`,
`LEARNPRESS_VERSION`, `PHP_VERSION`, `THEME` and `SITE_TITLE` change it. The build makes:

- the latest WordPress, with pretty addresses, and the theme it installs with (a block theme), or the classic theme
  `THEME` names;
- LearnPress from the plugin directory, whose activation makes its tables, its pages (Courses, Profile, Checkout,
  Instructors, Become an Instructor, Terms and Conditions) and its roles;
- the four accounts of [Test users](#test-users);
- the test content, written by [`site/learning-site.php`](site/learning-site.php) with the plugin's own models, so the
  counts and the curriculum are the ones the plugin keeps:

| What | The test content |
| --- | --- |
| Courses | "Webship Testing Basics" (free, 2 weeks, all levels, by the instructor) and "Webship Advanced Testing" (free, by the instructor) |
| Curriculum | "Webship Testing Basics": "Getting started" (the lessons "What a scenario is", "Steps and features") and "Check what you learned" (the quiz "Basics quiz"); "Webship Advanced Testing": "Running a suite" (the lesson "Tags and hooks") |
| Quiz | "Basics quiz": passing grade 60 %, two retakes, its review with the right answers, one question a page: "A feature holds scenarios." (true or false: True), "Which keyword sets the scene of a scenario?" (one choice: Given), "Which words start a step?" (several choices: Given, When, Then) |
| Enrolment | The student in "Webship Testing Basics" |

CI builds it twice, see [`.github/workflows/test.yml`](.github/workflows/test.yml): on the block theme WordPress
installs with and PHP 8.4 (with the assertions that must fail), and on a classic theme (Twenty Twenty-One) and PHP 8.2.
Each lane runs the suite twice and compares what the site holds before the first run and after each run
(`COUNTS_ONLY=1`):

- the courses, lessons, quizzes, questions and orders by status;
- the sections, their items and the quiz questions;
- each account's enrolments, progress rows and quiz attempts by status, and its orders;
- each course's status and learners.

After a run that was stopped half way, `RESET_ONLY=1 SITE_DIR="$PWD/learnpress-site"
learnpress-steps/.github/scripts/build-ddev-site.sh` puts the courses back as the build left them:

- the learners' orders, enrolments and progress go, and the student's enrolment comes back;
- the courses, lessons, quizzes and questions named "Webship test …" go;
- the build's courses are published again.

## Steps

One example of each step; the JSDoc block above each definition holds five.

### `learnpress-courses.steps.js` (11)

- `When I go to the course list`
- `Then the course list should show "Webship Testing Basics"`
- `Then the course list should show "Webship Advanced Testing", "Webship Testing Basics" in this order`
- `Then the course "Webship Testing Basics" of the list should read "2 Lessons"`
- `When I search the courses for "Advanced"`
- `When I order the courses by "Title a-z"`
- `When I go to the course "Webship Testing Basics"`
- `Then the curriculum should show the section "Getting started" with "What a scenario is", "Steps and features"`
- `Then the course should show "Lesson" as "2 Lessons"`
- `Then the instructor of the course should be "Instructor Test"`
- `Then the course page should offer "Start Now"`

### `learnpress-learning.steps.js` (6)

- `When I start the course "Webship Testing Basics"`
- `When I open "What a scenario is" in the course "Webship Testing Basics"`
- `When I complete the lesson`
- `Then the course should say "Congrats! You have completed “What a scenario is”."`
- `Then the progress of the course should be "1 of 3 items"`
- `Then the item "What a scenario is" should be completed`

### `learnpress-quiz.steps.js` (9)

- `When I start the quiz "Basics quiz" of the course "Webship Testing Basics"`
- `When I answer "True" to "A feature holds scenarios."`
- `When I finish the quiz`
- `Then the quiz should be passed`
- `Then the quiz result should show "Points" as "3 / 3"`
- `When I review the quiz`
- `Then the question "A feature holds scenarios." should show "True" as the right answer`
- `When I retake the quiz`
- `Then the quiz should offer "Retake (2)"`

### `learnpress-profile.steps.js` (4)

- `When I go to my courses`
- `When I open the "Quizzes" tab of my profile`
- `Then my profile should count "Enrolled Course" as "1"`
- `Then my profile should list "Webship Testing Basics" with "0%"`

### `learnpress-editor.steps.js` (7)

- `When I start a new course "Webship test course"`
- `When I add the section "Webship test section" to the curriculum`
- `When I add the lesson "Webship test lesson" to the section "Webship test section"`
- `When I publish the course`
- `Then the course should be "Pending Review"`
- `Then the curriculum should count "1 Section" and "2 Items"`
- `Given there is no course "Webship test course"`

### `learnpress-site.steps.js` (2)

- `Then the "Review courses" option should be on`
- `Then the administration should list the course "Webship Testing Basics" with "2 Sections 2 Lessons 1 Quiz"`
## Phrases shared with other packs

The session phrases are the WordPress pack's, which this pack loads; none of this pack's phrases matches one of
the WordPress pack or of webship-js (`npm run test:examples` checks it). The platform packs are not meant to be
loaded together (one `cucumber.js` profile per system). Loaded beside each of the
43 packs published so far, these phrases of this pack also match one of theirs:

| Phrase of this pack | Also in |
| --- | --- |
| `I go to my courses` | moodle |
| `the "…" option should be "…"` | magento |

None matches a phrase of the community pack (BuddyPress), which a site with both plugins can load beside this one,
nor of the component pack (Bootstrap), the Diffy pack or the Shopify pack.

## LearnPress's own tests and this pack

LearnPress tests itself with PHPUnit (`tests/Unit/` of its repository) and with six tests of its front-end scripts
(`tests/Frontend/`). It has no browser suite, but the flows its tests hold to are the logic these steps check on a real
site, through the pages a person uses:

| LearnPress's own tests | In this pack |
| --- | --- |
| `Frontend/user-quiz.test.cjs`: start the quiz without a confirm, answers kept, submit the quiz after a confirm and the curriculum updated, a retake after a SweetAlert confirm, the review toggled with the result | `quiz.feature`: "Start", questions answered on their pages, "Finish Quiz" answered yes, the result (passed or failed, its points, the questions right, wrong and skipped), "Review" and the answers marked, "Retake (2)" answered yes and a new attempt |
| `Frontend/user-quiz.test.cjs`: the "Finish Course" button and its confirm | `lessons.feature`: "Complete" and the plugin's question "Do you want to complete the lesson …?", answered yes, then the next lesson and the progress |
| `Unit/Models/UserItems/UserQuizModelTest.php`, `Unit/Ajax/UserQuizAjaxTest.php`: an attempt's status and result | `profile.feature`: the quizzes tab lists the quiz with its result |
| `Unit/Models/CourseModelTest.php`, `Unit/LPProfileInstanceTest.php`: a course's items and counts, the profile's courses | `courses.feature`, `profile.feature`: the curriculum and the details of a course, the counts and the courses of the profile |
| `Unit/Security/CourseBuilderTrashCourseTest.php`: a course of the editor removed | `course-editor.feature`: a course made with a section, a lesson and a quiz, and deleted for good when the scenario ends |

## Testing this package

```bash
npm ci
npm run test:examples    # every step's JSDoc examples match it and nothing else; every feature step resolves
npm run test:paths       # a feature named on the command line runs alone
npx cucumber-js --dry-run
SITE_DIR="$PWD/../learnpress-site" .github/scripts/build-ddev-site.sh
npx cucumber-js          # the whole suite
npm run test:must-fail   # the assertions that must fail, each with its message and a hint
THEME=twentytwentyone PHP_VERSION=8.2 SITE_DIR="$PWD/../learnpress-site-classic" .github/scripts/build-ddev-site.sh
npx cucumber-js
```

The second build makes a project of the same name, so remove the first one before it (`ddev delete -Oy learnpresssteps`).

## How the steps were written

Every step was written from a round of manual testing of the real local site in the browser first. Each page it touches
was opened as the account the step works as, its lists, labels and messages were noted, and the signal it gives while
it works was found: the quiz's `data-status`, the plugin's two kinds of confirmation box, the page a completed lesson
opens next, the tabs of the profile filled by script.

The same round found what the restores must undo:

- a free enrolment records an order of $0.00, and moving that order to the bin does not end the enrolment;
- merely opening a lesson records progress for an enrolled account;
- an instructor's published course waits for review.

The plugin's own admin tools ("Assign" and "Unassign" a course) and the orders list are what put it all back.

## License

MIT, see [LICENSE](LICENSE).

## Logo

The logo in this README is the icon LearnPress ships in its plugin (`assets/images/icon-128x128.png` of LearnPress 4.5.0,
part of the plugin under GPL-3.0). It stays under that licence, and is not part of the npm package. Simple Icons, the
source of most packs' logos, has none for LearnPress. The LearnPress name and logo belong to their owner; this pack is
not affiliated with or endorsed by them.
