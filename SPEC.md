# App Specification

This App is called "Head Empty. No Thoughts" subtitled, "for all those assignments you forget to do...and don't want to do."
It is an all in one gamified assignment tracker. At the begnning of the semester, add your courses and feed it your syallbi. All you info in one place, with double-checking to the Canvas API.

## Overview

This is a gamified all-in-one assignment tracker. Get all your assignments in one place with the help of AI, calculate your grades, and ask questions about your syllabus to a chatbot. 

Then use the pomodoro timer to actually get those things done! As the timer runs, new creatures might come to join your ecosystem (think like Pokemon Sleep, but creatures run across the scene every so often so that you are focused)! Complete assignments and to-do list items to earn points, buying new things to add to your habitat!

## Core Features

- Gamified: Build your world! Grab the creatures as they cross the screen while you focus. Gain coins as you complete assignments and level up. Customize the world for your creatures 
- Courses: Upload your syllabus and populate everything you need for the course! AI from here will populate your assignments, and help you calculate your grades!
- Grade calculation: have all your grades in one place. From the weighting outlines in the syllabus and info populated from Canvas and Gradescope
- Calendar views/ToDo lists: View all your assignments in one place! 
- Weekly View: View the week ahead, plan which assignments to do when and how much of them to do? The AI will see what you have due upcoming, and suggest things to do. For example, if you have a 20 page reading due friday, the AI might suggest you read 5 pages everyday for four days up until them. But you have the agency to plan your own week all by yourself.

## Game Mechanics

**The Catching Loop**: Creatures do not just appear; they cross the screen at random intervals during an active Focus Timer. The user must physically click/tap the creature to collect it.

**The Economy**:
    - Food: Earned via the Focus Timer. Used to maintain creature happiness and attract rare types.
    - Coins: Earned by completing assignments/To-Dos. Used to buy permanent habitat decorations and world upgrades.

**The Focus Guard**: If the user navigates to a "forbidden" site (that the user has chosen to mark as forbidden) (YouTube, Reddit, etc.), the timer pauses, and creatures stop appearing.

**Pomodoro-Timer**: a 25-min pomodoro focus timer with a way to indicate progress. It tracks 4 sessions, with short breaks in-between, plus a long break after the 4 sessions. Creatures appear oly during active focus time. During breaks, there is no penalty for navigating to a forbidden page. You are notified of the break almost ending, however.

## Chrome Extension

**Focus Overlay**: while you are in focus, you can navigate to other screens. The timer is still visible and can be moved around your screen, while creatures still have the chance to run along the bottom. Unless, of course, you are on a forbidden site during active work time.

## Main App

Navigate through many screens (as seen below). See your courses, assignments, and plans. There is also a main habitat that you can visit to play with your creatures and a shop to buy backgrounds, and other ways to decorate!

## Assignment Tracker

Add your courses for the semester, upload your syllabus, connect your Canvas, and forget the rest. You can still manually and and override information, but the whole semester's information should be laid out in front of you! Each course also has a grade book, where information is updated based on the weighting from the syllabus and grades that you add.

## Screens & Navigation

| Screen | Purpose |
|--------|---------|
| LogIn | Users are directed to create an account or log in. The website itself also displays features about the app. |
| Main Screen | Where the game action takes place. An ecosystem you can decorate where your creatures roam. Feed them, take care of them, and whatever else gets you to want to be emotionally attached to them. |
| Focus Timer | An aesthetic timer. As the timer runs, there's a chance a creature may come across the screen! Catch it before it's too late (by clicking on it) |
| Courses | Add a colored box for each new course. Add assignments manually, or upload you syllabus and AI can autofill your deadlines for the semester. Integrate Canvas API and Gradescope to calculate grades. |
| Calendar | See all your assignments, completed and uncompleted, in front of you. Each assignment tagged with their course and able to be marked as done from this view. |
| ToDo | See your |
| Weekly View/Daily Plan | This is the primary workspace for assignments. It allows users to drag Assignments (dated) and To-Do items (undated) into specific days. The AI suggests breakdowns (e.g., "Read 5 pages today") which live in this view as daily goals but do not permanently alter the master Assignment data. |

Each course modal will show you:
- assignments
- course professor
- days of the week and time of class
- a gradebook, populated from weighting breakdown of the course, and grades that can be manually entered or not.

## Data Model

User
    username, password_hash, email
    currency: { coins: int, food: int }
    inventory: [item_ids, creature_ids]

Assignments (Dated)
    name, dueDate, courseTag, completed (boolean)
    source: (Syllabus, Canvas, or Manual)
    pointsValue: (Weighting info for grade calculation)

To-Do List (Undated)
    taskName, completed (boolean)
    Note: These have no date and live in a side drawer/specific view until dragged into the Weekly View.

Weekly Plan (The Junction)
    date, taskReference (ID of Assignment or To-Do), subTaskDescription (e.g., "Do first half")


Semester >> Course >> Assignment


Additionally, there is a toDo list which is simply stored separately. As if "ToDo" is the course. These are not shown in the calendar view, but only in a todo list view.


All of this should be stored per user, as there will be user authentication and login.

AI manually fills in assignments when syllabus are updated to courses the user creates, or when a Canvas page is chosen to connect to it. 

**Sync Priority (The Source of Truth)**
- To prevent data conflicts between AI parsing and school systems:
- User Manual Override: If the user manually edits a date, it stays.
- Canvas/Gradescope API: Overwrites syllabus data if a discrepancy is found.
- GPT syllabus parse (via your backend): Initial "best guess" to populate the calendar at the start of the semester.


### Entities

**User**
- username: let's the user pick a username that does not exist in the database
- password: let's the user pick a password, which is hashed and stored
- email: user's create accounts with an email
- name: user's give the platform their first time for a more personalized experience
- semesters: stores all the users semeseter

**Semesters**
- courses: store all the courses for the semester

**Courses**
- assignments: store all the assignments per course

**Assignment**
- name: name of the assignment
- dueDate: date the assinment is due
- courseTag: the course name the assignment belongs to
- completed: a booelan for if the assignment is completed or not
- createdAt: when the assignment was created
- updatedAt: anytime the assignment is updated

## API & Backend

OpenAI (Chat Completions) for syllabus parsing and weekly planning suggestions, called only from a **Python backend** so the API key is never shipped to browsers.

Backend to store a database of users, and all the assignments (Render-hosted in the full product).

## Privacy Note

Transparency: Syllabus text is sent to your backend, which calls OpenAI for extraction. Users should know their syllabus content leaves the device for that step (subject to OpenAI’s data policies for your account tier).

Data Handling: Prefer not logging raw syllabi on the server; store only the structured assignments you persist for the user.

## Design & Branding

- **Color palette:**
Soft beige as a base, accented with punchy primary tones — bright red, blue, and yellow.
- **Typography:**
Lowercase throughout, using whimsical, illustrative letterforms with personality.
- **Style direction:**
Playful and child-like in the best way — think Saturday morning cartoons or a friendly preschool show.

For now, collectable creatures can be represented by shapes of various colors with cute eyes. They should still have a cute appeal to them, making you want to collect more.

## Platform Targets

- Platform: * Phase 1 (Chrome Extension): Required for the "Overlay" and "Site Blocking" features to work. This allows creatures to crawl over other websites.
    - Phase 2 (Web/Dashboard): A central hub for syllabus uploading and grade viewing.

- Backend: Render-hosted DB to sync data between the extension and the web dashboard.
- AI: OpenAI via the Python backend (same API key pattern as other server-side integrations).

Logins should work across platforms, based on a backend hosted on Render. Frontend hosted on GitHub Pages for web and used on ExpoGo for iOS.

## Notifications & Background Tasks

The app has an overlay over other apps. While you are in focus, you can see the timer, and the creatures have a chance to cross the screen. However, if you are in a forbidden app or website (ex: youtube, reddit), the timer will pause and no creatures will have the chance to cross the screen. 

## Offline Behavior

Core tracker UI (calendar, todos, weekly board) can work offline in the browser with cached/local data. Syllabus parsing and AI weekly suggestions require network access to your backend (which calls OpenAI).

## Analytics & Monitoring

N/A

## Constraints & Non-Goals

N/A

## Acceptance Criteria

This project should be made in two parts.

The first part is just the focus timer + game.

The second part is the assignment tracker.

Then they should attempt to be integrated together.


1. Focus Timer: Must detect "forbidden" tabs and pause creature spawning.

2. Active Catching: Creatures must move across the screen and be clickable for collection.

3. Data Sync: Canvas API must successfully update an assignment originally created by the AI syllabus parser.

4. Weekly Logic: User can drag an undated To-Do item into "Wednesday" without giving the To-Do item a permanent due date.

