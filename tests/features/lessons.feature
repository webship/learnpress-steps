@lessons
Feature: Enrolling and the lessons of a course
  As a student
  I want to enrol in a free course and work through its lessons
  So that I learn it one lesson at a time

  Scenario: A student enrols in a free course and completes its first lesson
    Given I am a logged in user with the "student2" user
    When I start the course "Webship Testing Basics"
    Then the progress of the course should be "0 of 3 items"
    When I open "What a scenario is" in the course "Webship Testing Basics"
    And I complete the lesson
    Then the course should say "Congrats! You have completed “What a scenario is”."
    And the progress of the course should be "1 of 3 items"
    And the item "What a scenario is" should be completed

  Scenario: The enrolled student completes a lesson
    Given I am a logged in user with the "student" user
    When I open "Steps and features" in the course "Webship Testing Basics"
    And I complete the lesson
    Then the item "Steps and features" should be completed
