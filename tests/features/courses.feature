@courses
Feature: The course list and a course page
  As a visitor of the academy
  I want to find a course and read what it holds
  So that I know what I will learn before I start

  Scenario: The course list shows the courses, newest first, and orders them by title
    Given I am an anonymous user
    When I go to the course list
    Then the course list should show "Webship Advanced Testing", "Webship Testing Basics" in this order
    And the course "Webship Testing Basics" of the list should read "2 Lessons"
    And the course "Webship Testing Basics" of the list should read "by Instructor Test"
    And the course "Webship Advanced Testing" of the list should read "Free"
    When I order the courses by "Title z-a"
    Then the course list should show "Webship Testing Basics", "Webship Advanced Testing" in this order

  Scenario: The search keeps the courses whose title holds the words
    Given I am an anonymous user
    When I go to the course list
    And I search the courses for "Advanced"
    Then the course list should show "Webship Advanced Testing"
    And the course list should not show "Webship Testing Basics"

  Scenario: A course page shows its curriculum, its details and its instructor
    Given I am an anonymous user
    When I go to the course "Webship Testing Basics"
    Then the curriculum should show the section "Getting started" with "What a scenario is", "Steps and features"
    And the curriculum should show the section "Check what you learned" with "Basics quiz"
    And the course should show "Lesson" as "2 Lessons"
    And the course should show "Quiz" as "1 Quiz"
    And the instructor of the course should be "Instructor Test"
    And the course page should offer "Start Now"

  Scenario: The enrolled student is offered to continue
    Given I am a logged in user with the "student" user
    When I go to the course "Webship Testing Basics"
    Then the course page should offer "Continue"
    And the course page should not offer "Start Now"
