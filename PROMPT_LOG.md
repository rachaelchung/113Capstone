# Prompt Log
This project was created with help from Claude and Cursor. Here are the prompts that shaped this product and an outline of the process that occurred.

--
After finally deciding on a project (thank you Mike Taylor!) ideation began with writing SPEC.md and doing research on the limitations of my project.

After writing my SPEC.md, I sent it to Claude to get me started.

--

## Claude Chat: Project Design Clarifications
me: 
hi. I'm ready to start iterating on and building this project. can you ask me any more clarifications you may still need though? especially about design?

*Claude asked a couples questions*

me:
Q: What's the primary vibe you want for the ecosystem/main screen?
A: user's can choose a background! for now start with a cozy forest

Q: For the creature designs (currently placeholder shapes with eyes) — how do you want to start?
A: simple colored blobs with cute eyes (fast to build)

Q: Which part do you want to build first?
A: Focus Timer + creature catching game

*I didn't like what it gave me so I took a step back*
--

## Claude Chat: Rewording Design brief from clarity:

me:
can you help me reword this to what I mean? - **Color palette:**
Playful, soft beige and bright red, blues, and yellows.
- **Typography:**
lowercase, fun stylistic lettering.
- **Style direction:**
playful and youthful. Like a childs tv show.

--
*I update my spec and come back to Claude*
## Claude Chat: Chrome extension pomodoro timer project

me:
hi this is my spec for my project. please ask me any questions. Let's begin with trying to just get the chrome extension/pomodoro timer/habitat portion of the app going.

*I now have the start to my project*

--
## Cursor Chat: Code review and specification alignment

me:
Hi. research the code I have so far so I can make sure we're on the same page. I'm only in the first step of the prcoess. read the spec and tell me what I have so far.

-- 
## Cursor Chat: Full screen UI adaptation

me:
currently, I am in phase one of the project. I want to adapt this code right now to be full screen. Also make it look a little nicer and make the UI more unique.

me:
ok great. Time to add more to the game feature! right now the collection just collects at the bottom. Remove this and instead add a new screen. On the new screen, everytime you enter the new screen, the new creatures you just collected are shown to you and you can name them, or just let them straight into your habitat. Give them some autonomy with pathfinding. You can watch them wander the habitat you have built for them. It will have customizable backgrounds and eventualy "slots" to add furniture to decorate. Leave room to add the customizable features in the code, but do not add them yet. Have a filler background just for now.

me:
right now the creatures move a little too fast. either slow them down, or make them easier to be caught
--

## Cursor Chat: UI changes for hamburger menu

me:
Hi! Let's change the UI some. I would really like there to be a hamburger menu in the top right, which will soon have calendar features/courses things (read SPEC.md for more info). Do not focus on  yet that however. On the right of the Hamburger menu will be a little house icon, to switch to your home with your captured pets. When on that screen, the icon will instead be a little timer, to indicate swithcing back t your focus screen.

instead of having the timer take up the bottom of the page, let it be a timer that floats on top of the page in the top right. I eventually want it to be visible on multiple screens.

timer will stop when you go to your home and it won't be visible there. However, eventually, it should be visible on top of the calendar pages etc.

me:
can you switch menu and other button to top left? also the floating timer is too short width wise.

me:
great! let's make the timer-dock like a true dock and make it draggable across the screen

--

## Cursor Chat: Creature design and personality

me:
read SPEC.md and understand what the creatures are. and then let me know to what extent you can create many creatures (about 50, for the demo) with custom art and individual "personalities" and inform me what "personalities" the creatures should have to make a user emotionally attached to having them.

me:
yes please. create this table. *this is in reference to a creatures.json data table*

me:
ok great! so now i need a way to actually interact with these creatures when I welcome them home. Create a module, to see their stats, like how close we are, based on me feeding them, and some abilty to interact with their personality.

me:
cool. now can you explain a little more to me about the creatures.json that needs to exist?

--

## Cursor Chat: Store feature and furniture slot arrangement

me:
let's work on a use for coins. add another button next to the home button that is the store icon. the store should have a couple filler furnitures/decorations created in a new data/decoration.json. 

move the slots on the home. They should be scattered across the "ground". please describe to me what is considered the top of the "ground" in my background image currently so I can create new backgrounds that use the same furniture slots regardless. 

each slot should be clickable and you can select a piece of decor from your inventory to place there. Each piece of decor is countable, meaning if you only bought one, you can only place down one. 

me:
great. with this knowledge of the background necessities, create two new tabs in the store. One to buy new background for home and another to buy new background for the focus creature catcher. Create five new backgrounds for each.

*from here I'm ready to move on to phase 2 of my project*
--

## Cursor Chat: Calendar and todo view implementation

me:
read my SPEC.md and begin writing the code for the calendar/todo/weekly view + courses reading wtih ollama. do not attempt to merge with my game code yet, but use similar design and style to what I have so far. and let me know how to test it.

*from here you can tell I made a mistake. I tried using ollama without thinking about what it really is*

me:
is ollama going to be to hard for others to use? should I just use my gpt API? I just thought that reading syllabi would eat up a lot of credits?

me:
ok. remove the ollama reccomendation, from the spec and from this, and instead use the gpt API. start writing the backend in python for this

*I know I can use this because I already have credits in my chatGPT API*

me:
can you actually switch to using flask?
*my fault for not specifying*

me:
remove anything that references running the ai locally. And completely change the courses page. It should show you all your courses at the top. You can click on your course and view the modal with all the information. You can manually add assignments and change other things. Otherwise, you can add a course with a plus button in the bottom right corner. From here it opens a different modal, you can add courses and all the assignments and other information manually. You also have the option to upload a syllabus.

--

## Cursor Chat: ASGI app loading error
*This chat was opened to debug syllabus reading. Not all the prompts are particularly insightful, just me asking questions. I didn't realize I couldn't just send a pdf and instead needed to install a python library (pypdf) to do so*

--

## Cursor Chat: Weekly view item management

me:
I want to work on the weekly view. right now when things are dragged into the weekly view they get stuck there. I want them to still be able to be moved, deleted (from the week view, not in it's entirety from the database) and checked off

--

## Cursor Chat: Project options discussion
*I do a temperature check to decide what to do next*

me:
at this point in my project, do you think it will be easier to create the chrome extension or merge the tracker with the game? or will both be ok?

--

## Cursor Chat: Class structures comparison with python
*I just needed to understand more of my code*

me:
can you just explain the class structures I'm seeing? I am used to syntax in python that looks like __init__(self) and variables called self.something


--

## Cursor Chat: Course modal grade calculations

me:
ok let's attempt to add grade calculations into each course. into each course modal now add tabs. course info, assignments, and grades. You can manually add weighting, or grab it from the scraped syllabus. Add in assignments. Leave me a mostly empty grade_calculation.py file so I can write the grade calculation things myself. But please leave instructions as to variable names and what to grab from the database

me:
can you explain to me the data structures I'm taking in and returning for this

*I run out of time to write this haha so I leave this plan*

--

## Cursor Chat: Grade calculation script

me:
please write the grade_calculation.py

me:
ok now the grades need a way to display. Please display the current grade percentage at the top. Assume blank fields aren't counted at all. Also, i currently cannot input any numbers into "max pts" any idea why?

--
*I want to move into integration, so I check that the tracker works*
## Cursor Chat: Tracker criteria assessment

me:
Look within TRACKERCRITERA.md and check each piece of criteria, and anything else from SPEC.md that might be relevant for checking if the tracker is working. mark things as [PASS] [WARN] or [FAIL] and add the bottom to TRACKERCRITERIA.md

me:
Great. most things work as expected. I would like to begin working on moving things to a database so I can have user logins and authentication. is SQLite the right scope for this project?

me:
I plan to host on render. WIll that be ok?

me:
ok. I don't think I plan to ship this anytime soon, so please go ahead with with moving my database to SQLite.

*I create me SQLite database*


--

## Cursor Chat: Integration of game and assignments
me:
take a look at my code. I'm ready to integrate the game functionalities (currerntly in index.html) and assignment tracker funcntionalities (currently in tracker.html) into one. Please read the spec for more instructions. UI is to change, but please make sure in the current menu in index.html that each page (course, weekly, todo, calendar) are new and separate items in the menu? while the game page remains the "home page"?" 

--
*I run back to Claude for a landing page*
## Claude Chat: Integration of game and assignments

me: *upload my SPEC.md*
I'm creating this app. Please create a landing page where users can login/sign up.

*I like the creatures and UI it imagines better so I ask it to change creatures*

me:
here is currently how creatures are being built and the json where they are pulled from. can you rewrite so they look like the one's you created?

*I end up not using any of this*

--

## Cursor Chat: Creatures design update for landing page

me:
take a look at landing.html. This is the new vibe and direction I want to go for. Please update creatures to look like the one's on the landing page, and make it all cohesive to the landing page

*although Cursor changed the creatures, it did almost nothing to the rest of the pages.*

--

## Cursor Chat: Google OAuth scope for user authentication

me:
I am ready to work on user authentication. as you can see that exists on landing.html. please first let me know about the scope of google oAuth. I do plan to create a google extension for this app, but if the googel authetnication is too hard I am willing to skip

me:
Ok. I am looking for something with good enough security (for the scope of this capstone project) but want to explore Google oAuth. let's do it. Can you begin writing the database that will store users and their info and connect it to landing.html. WHile you are at it, rename my current index.html to something else, and my current landing.html to index.html so it will be the first thing you land at instead. make sure you adjust all paths that may be affected by this renaming

--

## Cursor Chat: Game implementation

me:
Now that i've integrated three things (game + tracker + logins) I need to clean up the missing pieces. For example: in the bottom of the menu, I need a place to view profile and logout. I need completing full assignments ot award coins, and weekly todos to also assign coins (but less). I also a need a smart way to people to not just be able to mark as done and undone multiple times and award themselves more coins.

me:
great! can you know make it more interactive when you get coins? read like how to little click notifications are in index.html and implement it into getting coins and collecting creatures

me:
are things being stored in the databases right now?

me:
ok. can we try to move everything to be stored in the database? I want users to be able to log in across devices for this

*databases created once again*

--

## Cursor Chat: Chrome extension
*This part of the project was a lot of debugging, I will show you the main prompts*

me:
My next step is to create a chrome extension (as outlined in SPEC.md) do I need to deploy my app first or no?

me:
great. then let's start working on adapting to a chrome extension. describe the files you create and what they do and how I can test them. To be clear about the extension, I want it to be the same timer that is already floating on my app and creatures that run across the bottom of the screen (see index.html for what I am picturing). As for the forbidden site detector, it no longer needs to display on the app.html screen, it should just clearly display on the timer, pause it, and make sure no more creatures come across the screen.

*after this I fix some things with cursor + make manual changes to html and css, etc. I have lots of problems with the iframes*

me:
right now with the chrome extension, I can't seem to interact witht hings on the page. how do I fix this

*more things break, more conversation*

me:
can you undo everything you did in this conversation? none of this is working properly and it worked before this

--

## Cursor Chat: Chrome extension -- continued debugging

me:
I like exactly the way the chrome extension works right now... except for the fact that I cannot interact with anything on the page. can I fix this? by writing it so that I can click "through the frame" when I click anywhere except where the timer currently is and where the creature currentyl is

*after debugging that I think isn't going aynwhere, I decide the timer can no longer be a modal that moves freely but is instead fixed to the page*

me:
ok. remove the idea that it is a draggable modal. just leave it in one place where the timer can be minimized or unminimized in the top right corner.

--

## Cursor Chat: Chrome extension integration

me:
ok. what is the estimation on the difficulty of extending chrome extension to work with the rest of the app. In short, I want all creatures to be able to be stored in a user's info database, and updated. If i deploy my backend somewhere, how difficult is this to integrate?

me:
what do you suggest to get the user's JWT into the extension. I need the fasted option, even if it's not the cleanest. I'm tempted to just have the user log in again with the extension.

me:
ok. lets begin to implement this. I will continue to test with a local running backend. please give me all the instructions I need to run and test this properly.

me:
do you also see how everytime you reenter your habitat when you get a new creature you get the chance to name it? is this handled for this way or no? if not, can it be handled

me:
ok yes implement this

*I do a little more trivial debugging and move on*
--

## Cursor Chat: Backend Deployment

me:
I think i am ready to deplot my backend to render. I want running the app locally to take priority however. can you make the changes so that it checks if a local server is running first, and if not, looks for the backend? for reference I plan to deploy the front-end to github pages, and the backend to render... and then I want to remove having to use the "base API url" in my extension login. is this all feasible?
*this was in the plan function, so then I build*


*from here, I do some frontend final design skills. I really enjoyed Claude's style direction in index.html, so I match everything else to it.*