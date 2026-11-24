'use strict';

// A quiz of a course, as the account logged in: started ("Start"), its questions answered (a choice, several choices,
// on whichever page of the quiz the question is), finished ("Finish Quiz", with the plugin's question answered yes),
// its result (passed or failed, the points, the questions right, wrong and skipped), the review of the answers, and a
// retake ("Retake (2)", asked first too). What the attempts change of the account's course is put back once the
// scenario ends.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./learnpress-helpers');

const QUIZ = '#learn-press-user-quiz';

async function quizStatus(world) {
  return world.page.locator(QUIZ).first().getAttribute('data-status').catch(() => null);
}

async function waitForStatus(world, wanted, what) {
  await h.eventually(world, () => quizStatus(world), (status) => status === wanted, async (status) => ({
    message: `The quiz did not ${what}: its state is "${status === null ? 'no quiz on the page' : status || 'not started'}".`,
    hint: 'A quiz is started, then finished, by an account enrolled in its course.',
  }), 30000);
}

/** The question of the quiz on the page with this title (its number aside), visible or on another page of the quiz. */
async function question(world, title) {
  const questions = world.page.locator(`${QUIZ} .lp-quiz-doing .question[data-id], ${QUIZ} .lp-quiz-review .question[data-id]`);
  const all = await questions.evaluateAll((qs) => qs.map((q) => ({
    id: q.getAttribute('data-id'),
    page: q.getAttribute('data-page'),
    review: Boolean(q.closest('.lp-quiz-review')),
    title: ((q.querySelector('h4, .question-title') || {}).innerText || '').replace(/^\s*\d+\.\s*/, ''),
  })));
  const inReview = await world.page.locator(`${QUIZ} .lp-quiz-review`).filter({ visible: true }).count();
  const found = all.find((q) => h.same(q.title, title) && q.review === Boolean(inReview));
  if (!found) {
    throw friendly({ message: `The quiz has no question "${title}". It has ${h.listed([...new Set(all.map((q) => h.clean(q.title)))])}.`, hint: 'A question is found by its title, its number aside.' });
  }
  const scope = inReview ? `${QUIZ} .lp-quiz-review` : `${QUIZ} .lp-quiz-doing`;
  const locator = world.page.locator(`${scope} .question[data-id="${found.id}"]`).first();
  if (!(await locator.isVisible())) {
    // On another page of the quiz: its page number in the pages under the questions.
    await world.page.locator(`${scope} a[href$="#page-${found.page}"]`).filter({ visible: true }).first().click();
    await locator.waitFor({ state: 'visible', timeout: 15000 });
  }
  return locator;
}

/**
 * Start a quiz of a course ("Start"), as the account logged in.
 *
 * Example #1: When I start the quiz "Basics quiz" of the course "Webship Testing Basics"
 * Example #2: And I start the quiz "Basics quiz" of the course "Webship Testing Basics"
 * Example #3: When I start the quiz "Basics quiz" of the course "Webship Testing Basics"
 * Example #4: And I start the quiz "Basics quiz" of the course "Webship Testing Basics"
 * Example #5: When I start the quiz "Basics quiz" of the course "Webship Testing Basics"
 */
When(/^I start the quiz "([^"]*)" of the course "([^"]*)"$/, async function (quiz, title) {
  const course = await h.openCourse(this, title);
  this.learningCourse = course;
  const items = await h.curriculumItems(this);
  const found = items.find((i) => h.same(i.title, quiz) && i.type === 'lp_quiz');
  if (!found) throw friendly({ message: `The course "${title}" has no quiz "${quiz}". Its curriculum has ${h.listed(items.map((i) => i.title))}.` });
  await h.touchCourse(this, await h.me(this), course);
  await h.visit(this, found.link);
  const start = this.page.locator(`${QUIZ} button.start`).filter({ visible: true }).first();
  if (!(await start.count())) {
    const offered = (await this.page.locator(`${QUIZ} button`).filter({ visible: true }).allInnerTexts()).map(h.clean).filter(Boolean);
    throw friendly({ message: `The quiz "${quiz}" offers no "Start". It offers ${h.listed(offered)}.`, hint: 'A quiz is started by an account enrolled in its course; one finished offers "Retake" and "Review".' });
  }
  await start.click();
  await waitForStatus(this, 'started', 'start');
});

/**
 * Answer a question of the quiz on the page: one choice, or several ("Given", "When" and "Then"), by their words. A
 * question on another page of the quiz is opened first.
 *
 * Example #1: When I answer "True" to "A feature holds scenarios."
 * Example #2: When I answer "Given" to "Which keyword sets the scene of a scenario?"
 * Example #3: When I answer "Given", "When" and "Then" to "Which words start a step?"
 * Example #4: And I answer "False" to "A feature holds scenarios."
 * Example #5: And I answer "When" to "Which keyword sets the scene of a scenario?"
 */
When(/^I answer ((?:"[^"]*"(?:, | and )?)+) to "([^"]*)"$/, async function (answers, title) {
  const wanted = answers.match(/"([^"]*)"/g).map((a) => a.slice(1, -1));
  const q = await question(this, title);
  const options = q.locator('li');
  const texts = (await options.allInnerTexts()).map(h.clean);
  for (const answer of wanted) {
    const at = texts.findIndex((t) => h.same(t, answer));
    if (at < 0) throw friendly({ message: `The question "${title}" has no answer "${answer}". It offers ${h.listed(texts)}.` });
    const input = options.nth(at).locator('input').first();
    if (!(await input.isChecked())) await input.click();
  }
});

/**
 * Finish the quiz on the page ("Finish Quiz"), answering the plugin's question ("Are you sure to submit the quiz?")
 * yes, and wait for its result.
 *
 * Example #1: When I finish the quiz
 * Example #2: And I finish the quiz
 * Example #3: When I finish the quiz
 * Example #4: And I finish the quiz
 * Example #5: When I finish the quiz
 */
When(/^I finish the quiz$/, async function () {
  const button = this.page.locator(`${QUIZ} button.submit-quiz`).filter({ visible: true }).first();
  if (!(await button.count())) throw friendly({ message: 'The page offers no "Finish Quiz".', hint: 'A quiz is finished once it is started.' });
  await button.click();
  await h.confirmBox(this, 'yes');
  await waitForStatus(this, 'completed', 'finish');
  await this.page.locator(`${QUIZ} .quiz-result`).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
});

/** The result of the quiz on the page: { outcome: "passed"/"failed", fields: { label: value } }. */
async function result(world) {
  return world.page.locator(`${QUIZ} .quiz-result`).first().evaluate((r) => ({
    outcome: r.classList.contains('passed') ? 'passed' : (r.classList.contains('failed') ? 'failed' : ''),
    message: ((r.querySelector('.result-message') || {}).innerText || ''),
    fields: [...r.querySelectorAll('.result-statistic-field')].map((f) => f.innerText.split('\n').map((x) => x.trim()).filter(Boolean)),
  }));
}

/**
 * The result of the quiz on the page is passed or failed.
 *
 * Example #1: Then the quiz should be passed
 * Example #2: Then the quiz should be failed
 * Example #3: And the quiz should be passed
 * Example #4: And the quiz should be failed
 * Example #5: Then the quiz should be passed
 */
Then(/^the quiz should be (passed|failed)$/, async function (outcome) {
  await h.eventually(this, () => result(this), (r) => r.outcome === outcome, async (r) => ({
    message: `The quiz is not ${outcome}: ${r ? `its result is "${r.outcome || 'none'}"${r.message ? ` ("${h.clean(r.message)}")` : ''}` : 'the page shows no result'}.`,
    hint: 'A finished quiz is passed when its grade reaches the passing grade.',
  }));
});

/**
 * The result of the quiz shows a value for a label: "Points", "Questions", "Correct", "Wrong", "Skipped".
 *
 * Example #1: Then the quiz result should show "Points" as "3 / 3"
 * Example #2: Then the quiz result should show "Correct" as "3"
 * Example #3: And the quiz result should show "Wrong" as "1"
 * Example #4: And the quiz result should show "Skipped" as "2"
 * Example #5: And the quiz result should show "Questions" as "3"
 */
Then(/^the quiz result should show "([^"]*)" as "([^"]*)"$/, async function (label, value) {
  await h.eventually(this, () => result(this), (r) => r.fields.some((f) => h.same(f[0], label) && h.same(f[f.length - 1], value)), async (r) => ({
    message: `The quiz result does not show "${label}" as "${value}". It shows ${h.listed(((r && r.fields) || []).map((f) => `${f[0]}: ${f[f.length - 1]}`))}.`,
    hint: 'The result counts the time spent, the points, the questions, and those right, wrong and skipped.',
  }));
});

/**
 * Review the answers of the finished quiz ("Review"), or go back to its result ("Result").
 *
 * Example #1: When I review the quiz
 * Example #2: When I go back to the result of the quiz
 * Example #3: And I review the quiz
 * Example #4: And I go back to the result of the quiz
 * Example #5: When I review the quiz
 */
When(/^I (review the quiz|go back to the result of the quiz)$/, async function (what) {
  const review = what === 'review the quiz';
  const button = this.page.locator(`${QUIZ} ${review ? 'button.review-quiz' : 'button.back-quiz'}`).filter({ visible: true }).first();
  if (!(await button.count())) throw friendly({ message: `The quiz offers no "${review ? 'Review' : 'Result'}".`, hint: 'A finished quiz offers "Review" when its settings allow it; the review offers "Result".' });
  await button.click();
  await this.page.locator(`${QUIZ} ${review ? '.lp-quiz-review' : '.quiz-result'}`).first().waitFor({ state: 'visible', timeout: 15000 });
});

/**
 * In the review of the quiz, a question shows an answer as the right one, or as the one given (right or wrong).
 *
 * Example #1: Then the question "A feature holds scenarios." should show "True" as the right answer
 * Example #2: Then the question "A feature holds scenarios." should show "False" as my answer
 * Example #3: And the question "Which keyword sets the scene of a scenario?" should show "Given" as the right answer
 * Example #4: And the question "Which keyword sets the scene of a scenario?" should show "Given" as my answer
 * Example #5: Then the question "Which words start a step?" should show "Then" as the right answer
 */
Then(/^the question "([^"]*)" should show "([^"]*)" as (the right answer|my answer)$/, async function (title, answer, which) {
  const q = await question(this, title);
  const read = () => q.locator('li').evaluateAll((lis) => lis.map((li) => ({ text: li.innerText, cls: li.className })));
  const ok = (all) => all.some((a) => h.same(a.text, answer) && (which === 'the right answer' ? /\banswer-correct\b/.test(a.cls) : /\banswered-(correct|wrong)\b/.test(a.cls)));
  await h.eventually(this, read, ok, async (all) => ({
    message: `The question "${title}" does not show "${answer}" as ${which}. It shows ${h.listed((all || []).map((a) => `${h.clean(a.text)} (${a.cls.replace(/answer-option/, '').trim() || 'plain'})`))}.`,
    hint: 'The review marks the right answers, and the account\'s answers right or wrong, when the quiz shows the right answers in its review.',
  }));
});

/**
 * Retake the finished quiz ("Retake (2)"), answering the plugin's question ("Are you sure you want to retake the
 * quiz?") yes: a new attempt starts, with no answer.
 *
 * Example #1: When I retake the quiz
 * Example #2: And I retake the quiz
 * Example #3: When I retake the quiz
 * Example #4: And I retake the quiz
 * Example #5: When I retake the quiz
 */
When(/^I retake the quiz$/, async function () {
  const button = this.page.locator(`${QUIZ} button.retake-quiz`).filter({ visible: true }).first();
  if (!(await button.count())) throw friendly({ message: 'The quiz offers no "Retake".', hint: 'A finished quiz is offered again as many times as its settings allow; then the button is gone.' });
  await button.click();
  await h.confirmBox(this, 'yes');
  await waitForStatus(this, 'started', 'start again');
});

/**
 * The quiz offers a button, by its words: "Start", "Finish Quiz", "Retake (2)", "Review".
 *
 * Example #1: Then the quiz should offer "Retake (2)"
 * Example #2: Then the quiz should offer "Review"
 * Example #3: And the quiz should offer "Retake (1)"
 * Example #4: And the quiz should not offer "Retake (2)"
 * Example #5: Then the quiz should offer "Start"
 */
Then(/^the quiz should( not)? offer "([^"]*)"$/, async function (notCase, text) {
  const read = () => this.page.locator(`${QUIZ} button`).filter({ visible: true }).allInnerTexts().then((t) => t.map(h.clean).filter(Boolean));
  await h.eventually(this, read, (all) => all.some((t) => h.same(t, text)) !== Boolean(notCase), async (all) => ({
    message: notCase ? `The quiz offers "${text}".` : `The quiz offers no "${text}". It offers ${h.listed(all || [])}.`,
    hint: 'A quiz offers "Start" first, "Finish Quiz" while it runs, then "Retake (N)" and "Review".',
  }));
});
