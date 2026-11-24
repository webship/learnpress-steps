@editor
Feature: The course editor of an instructor
  As an instructor
  I want to make a course with its sections, lessons and quiz
  So that students can learn it once the administrator has reviewed it

  Scenario: An instructor makes a course with a section, a lesson and a quiz, and sends it for review
    Given there is no course "Webship test course"
    And there is no lesson "Webship test lesson"
    And there is no quiz "Webship test quiz"
    And I am a logged in user with the "instructor" user
    When I start a new course "Webship test course"
    And I add the section "Webship test section" to the curriculum
    And I add the lesson "Webship test lesson" to the section "Webship test section"
    And I add the quiz "Webship test quiz" to the section "Webship test section"
    Then the curriculum should count "1 Section" and "2 Items"
    When I publish the course
    Then the course should be "Pending Review"
