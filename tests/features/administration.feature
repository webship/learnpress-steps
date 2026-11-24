@administration
Feature: The courses in the administration
  As the administrator of the academy
  I want to read the courses and their settings
  So that I know how the courses are run

  Scenario: The courses list shows each course with its curriculum and its price
    Given I am a logged in user with the "admin" user
    When I go to the "Courses" admin screen
    Then the administration should list the course "Webship Testing Basics" with "2 Sections 2 Lessons 1 Quiz"
    And the administration should list the course "Webship Advanced Testing" with "Free"

  Scenario: The course settings say how a course is run
    Given I am a logged in user with the "admin" user
    When I go to the "Course settings" admin screen
    Then the "Review courses" option should be on
    And the "Auto start" option should be on
    And the "Confirmation popup" option should be on
    And the "Courses per page" option should be "8"
