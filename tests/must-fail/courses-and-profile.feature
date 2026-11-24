@must-fail
Feature: Assertions of the courses, the course pages and the profile that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: A course the list does not show
    Fails with: The course list shows no "Webship test nothing".
    Given I am an anonymous user
    When I go to the course list
    Then the course list should show "Webship test nothing"

  Scenario: A course the list shows
    Fails with: The course list shows "Webship Testing Basics".
    Given I am an anonymous user
    When I go to the course list
    Then the course list should not show "Webship Testing Basics"

  Scenario: The courses in another order
    Fails with: The course list does not show "Webship Testing Basics", "Webship Advanced Testing" in this order.
    Given I am an anonymous user
    When I go to the course list
    Then the course list should show "Webship Testing Basics", "Webship Advanced Testing" in this order

  Scenario: A count the row of a course does not read
    Fails with: The course "Webship Testing Basics" of the list does not read "9 Lessons".
    Given I am an anonymous user
    When I go to the course list
    Then the course "Webship Testing Basics" of the list should read "9 Lessons"

  Scenario: An item the section does not hold
    Fails with: The section "Getting started" lists "What a scenario is", "Steps and features", not "Webship test nothing".
    Given I am an anonymous user
    When I go to the course "Webship Testing Basics"
    Then the curriculum should show the section "Getting started" with "Webship test nothing"

  Scenario: Another value of the course details
    Fails with: The course does not show "Lesson" as "9 Lessons".
    Given I am an anonymous user
    When I go to the course "Webship Testing Basics"
    Then the course should show "Lesson" as "9 Lessons"

  Scenario: Another instructor
    Fails with: The course's instructor is not "Student Test".
    Given I am an anonymous user
    When I go to the course "Webship Testing Basics"
    Then the instructor of the course should be "Student Test"

  Scenario: A button the course page does not offer a visitor
    Fails with: The course page offers no "Continue".
    Given I am an anonymous user
    When I go to the course "Webship Testing Basics"
    Then the course page should offer "Continue"

  Scenario: A count the profile does not have
    Fails with: The profile does not count "Enrolled Course" as "9".
    Given I am a logged in user with the "student" user
    When I go to my courses
    Then my profile should count "Enrolled Course" as "9"

  Scenario: A course the profile does not list
    Fails with: The profile lists no "Webship Advanced Testing".
    Given I am a logged in user with the "student" user
    When I go to my courses
    Then my profile should list "Webship Advanced Testing"

  Scenario: A course the profile lists
    Fails with: The profile lists "Webship Testing Basics".
    Given I am a logged in user with the "student" user
    When I go to my courses
    Then my profile should not list "Webship Testing Basics"
