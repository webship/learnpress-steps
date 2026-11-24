@profile
Feature: The profile of a student
  As a student
  I want to see my courses and my quizzes with their results
  So that I know where I stand

  Scenario: The profile counts and lists the student's course
    Given I am a logged in user with the "student" user
    When I go to my courses
    Then my profile should count "Enrolled Course" as "1"
    And my profile should count "Inprogress Course" as "1"
    And my profile should count "Finished Course" as "0"
    And my profile should list "Webship Testing Basics"
    And my profile should not list "Webship Advanced Testing"

  Scenario: The quizzes tab lists a quiz taken, with its result
    Given I am a logged in user with the "student" user
    When I start the quiz "Basics quiz" of the course "Webship Testing Basics"
    And I answer "True" to "A feature holds scenarios."
    And I answer "Given" to "Which keyword sets the scene of a scenario?"
    And I answer "Given", "When" and "Then" to "Which words start a step?"
    And I finish the quiz
    When I go to my courses
    And I open the "Quizzes" tab of my profile
    Then my profile should list "Basics quiz" with "Passed"
