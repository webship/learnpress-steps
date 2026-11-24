#!/usr/bin/env bash
# Builds the site the suite runs against: the latest WordPress with the free LearnPress plugin in a DDEV project of
# type wordpress, the way a site gets its courses:
#   - LearnPress from the plugin directory: its tables, its pages (Courses, Profile, Checkout, Become an Instructor…)
#     and its roles, made by its own activation, with pretty addresses;
#   - the default block theme (Twenty Twenty-Five), or the theme THEME names;
#   - the accounts of the suite, each with its place: an instructor, a student enrolled in the course, a student who
#     is not;
#   - the test content (site/learning-site.php): a free course with its sections, lessons and a quiz with its
#     questions, by the instructor, and the student's enrolment.
#
# Settings (environment variables, all optional):
#   PROJECT_NAME          the DDEV project name                           (default learnpresssteps)
#   SITE_DIR              the project folder                              (default a new temporary folder)
#   WORDPRESS_VERSION     the WordPress release                           (default latest)
#   LEARNPRESS_VERSION    the LearnPress release, from the plugin directory (default the latest stable)
#   PHP_VERSION           the PHP of the web container                    (default 8.4)
#   THEME                 a theme of the theme directory to activate      (default: the theme WordPress installs with)
#   SITE_TITLE            the name of the site                            (default Webship Academy)
#   RESET_ONLY            1: build nothing; put the courses in SITE_DIR back as the build left them, after a run
#                         that was stopped half way
#   COUNTS_ONLY           1: build nothing; print the counts a test run must leave as it found them
#
# The accounts are configuration: this script creates them and cucumber.js names them; the features never create or
# delete an account. Each is named after its place, with one password:
#   administrator  dD.123123ddd  administrator of the site (the installer's account): every course, the settings
#   instructor     dD.123123ddd  LearnPress's instructor role: the course of the test content is theirs
#   student        dD.123123ddd  a subscriber enrolled in the course
#   student2       dD.123123ddd  a subscriber enrolled in nothing
#
# Nothing is installed that is paid or needs an account.
set -euo pipefail
# No command of the build reads a terminal: a container command waits forever on an open stdin pipe.
exec < /dev/null

PROJECT_NAME="${PROJECT_NAME:-learnpresssteps}"
WORDPRESS_VERSION="${WORDPRESS_VERSION:-latest}"
LEARNPRESS_VERSION="${LEARNPRESS_VERSION:-}"
PHP_VERSION="${PHP_VERSION:-8.4}"
THEME="${THEME:-}"
SITE_TITLE="${SITE_TITLE:-Webship Academy}"
PASSWORD='dD.123123ddd'
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"

# The courses, the accounts' places and the test content, written with the plugin's own models (site/learning-site.php).
learning_site() {
  cp "$REPO_DIR/site/learning-site.php" .webship-learning-site.php
  ddev wp eval-file .webship-learning-site.php "$@"
  rm -f .webship-learning-site.php
}

mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

if [ "${RESET_ONLY:-}" = "1" ]; then
  learning_site reset
  echo "The courses are back as the build left them."
  exit 0
fi

if [ "${COUNTS_ONLY:-}" = "1" ]; then
  learning_site counts
  exit 0
fi

# Node.js 24, the line the workspace builds run.
ddev config --project-type=wordpress --docroot="" --project-name="$PROJECT_NAME" --php-version="$PHP_VERSION" --nodejs-version=24
ddev start -y
SITE_URL="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['primary_url'])")"

ddev wp core download --version="$WORDPRESS_VERSION"
ddev wp core install --url="$SITE_URL" --title="$SITE_TITLE" \
  --admin_user=administrator --admin_password="$PASSWORD" --admin_email=administrator@example.com --skip-email
ddev wp rewrite structure '/%postname%/'

if [ -n "$THEME" ]; then
  ddev wp theme install "$THEME" --activate
fi

# LearnPress's activation makes its tables, its pages and its roles.
ddev wp plugin install learnpress ${LEARNPRESS_VERSION:+--version="$LEARNPRESS_VERSION"} --activate

# The accounts of the suite (the installer's account is the administrator).
ddev wp user create instructor instructor@example.com --role=lp_teacher --display_name="Instructor Test" --user_pass="$PASSWORD" --porcelain > /dev/null
for account in student student2; do
  ddev wp user create "$account" "$account@example.com" --role=subscriber --display_name="${account^} Test" --user_pass="$PASSWORD" --porcelain > /dev/null
done

learning_site content

# The addresses of the courses, lessons and quizzes answer once the rules are written again.
ddev wp rewrite flush

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
echo "Built the courses at $SITE_URL: WordPress $(ddev wp core version), LearnPress $(ddev wp plugin get learnpress --field=version), theme $(ddev wp option get stylesheet), PHP $(ddev exec php -r 'echo PHP_VERSION;')"
