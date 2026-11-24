@must-fail
Feature: Assertions of the lessons, the quiz and the administration that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. What a scenario changes of the student's course is put back when it ends;
  tests/check-must-fail.js runs them.

  Scenario: Another progress of the course
    Fails with: The progress of the course is not "3 of 3 items".
    Given I am a logged in user with the "student" user
    When I open "What a scenario is" in the course "Webship Testing Basics"
    Then the progress of the course should be "3 of 3 items"

  Scenario: An item that is not completed
    Fails with: The item "Steps and features" is not completed.
    Given I am a logged in user with the "student" user
    When I open "What a scenario is" in the course "Webship Testing Basics"
    Then the item "Steps and features" should be completed

  Scenario: A message the course does not give
    Fails with: The page says no "Webship test nothing".
    Given I am a logged in user with the "student" user
    When I open "What a scenario is" in the course "Webship Testing Basics"
    And I complete the lesson
    Then the course should say "Webship test nothing"

  Scenario: A quiz answered right is not failed
    Fails with: The quiz is not failed: its result is "passed" ("Passed").
    Given I am a logged in user with the "student" user
    When I start the quiz "Basics quiz" of the course "Webship Testing Basics"
    And I answer "True" to "A feature holds scenarios."
    And I answer "Given" to "Which keyword sets the scene of a scenario?"
    And I answer "Given", "When" and "Then" to "Which words start a step?"
    And I finish the quiz
    Then the quiz should be failed

  Scenario: Another count of the quiz result
    Fails with: The quiz result does not show "Points" as "9 / 3".
    Given I am a logged in user with the "student" user
    When I start the quiz "Basics quiz" of the course "Webship Testing Basics"
    And I answer "True" to "A feature holds scenarios."
    And I finish the quiz
    Then the quiz result should show "Points" as "9 / 3"

  Scenario: A wrong answer shown as the right one
    Fails with: The question "A feature holds scenarios." does not show "False" as the right answer.
    Given I am a logged in user with the "student" user
    When I start the quiz "Basics quiz" of the course "Webship Testing Basics"
    And I answer "False" to "A feature holds scenarios."
    And I finish the quiz
    And I review the quiz
    Then the question "A feature holds scenarios." should show "False" as the right answer

  Scenario: A button the quiz does not offer before it starts
    Fails with: The quiz offers no "Finish Quiz".
    Given I am a logged in user with the "student" user
    When I open "Basics quiz" in the course "Webship Testing Basics"
    Then the quiz should offer "Finish Quiz"

  Scenario: Another status of a published course
    Fails with: The course is not "Pending Review".
    Given I am a logged in user with the "admin" user
    When I go to the "Courses" admin screen
    And I follow "Webship Testing Basics"
    Then the course should be "Pending Review"

  Scenario: Another count of a curriculum
    Fails with: The curriculum does not count "9 Sections" and "2 Items".
    Given I am a logged in user with the "admin" user
    When I go to the "Courses" admin screen
    And I follow "Webship Testing Basics"
    Then the curriculum should count "9 Sections" and "2 Items"

  Scenario: A switch that is on
    Fails with: The option "Review courses" is not off.
    Given I am a logged in user with the "admin" user
    When I go to the "Course settings" admin screen
    Then the "Review courses" option should be off

  Scenario: A course the administration does not list
    Fails with: The courses list has no "Webship test nothing".
    Given I am a logged in user with the "admin" user
    When I go to the "Courses" admin screen
    Then the administration should list the course "Webship test nothing"
