# Cricket Dynasty

Build a modern, responsive web application called "Cricket XI".

The game is inspired by the drafting and simulation mechanics of games like 7a0, but it should be a completely original cricket experience focused on building legendary cricket teams from different eras and tournaments.

The application should feel premium, immersive, fast, and addictive.

==================================================

CORE IDEA

==================================================

The user builds an all-time cricket XI by drafting one player at a time from randomly selected historical squads.

After completing the XI, the application simulates an entire tournament and determines whether the team wins.

Each game should last around 5–8 minutes.

The interface should encourage repeated play.

==================================================

DESIGN LANGUAGE

==================================================

Use a modern sports aesthetic.

Dark mode only.

Primary background:

#0D1117

Cards:

#161B22

Accent:

Gold (#D4AF37)

Secondary Accent:

Emerald (#2ECC71)

Text:

White and light gray

Use smooth animations.

Rounded cards.

Glassmorphism where appropriate.

Subtle glowing buttons.

Large typography.

Premium feeling similar to modern fantasy sports apps.

==================================================

LANDING PAGE

==================================================

Display

Logo

Cricket XI

Subtitle

"Draft Legends. Build Dynasties."

Buttons

Play Now

Daily Challenge

Leaderboard

How To Play

Recent Winners

==================================================

GAME FLOW

==================================================

STEP 1

Choose Game Mode

• ODI World Cup

• T20 World Cup

• Champions Trophy

• IPL

• Test Cricket

==================================================

STEP 2

Random Draft

Generate 11 draft rounds.

Each round randomly selects a historic squad.

Examples

India 2011

Australia 2003

England 2019

Pakistan 1992

CSK 2023

MI 2020

From that squad present 5 randomly selected players.

Example

India 2011

MS Dhoni

Virat Kohli

Yuvraj Singh

Zaheer Khan

Harbhajan Singh

User selects ONE.

That player is permanently added to the XI.

Player cannot appear again.

Repeat until 11 players are selected.

==================================================

PLAYER CARD

==================================================

Each player card contains

Player photo placeholder

Player Name

Country

Tournament

Role

Small badges

Captain

WK

Spinner

Fast Bowler

All-rounder

Hidden rating (not visible to user)

Hover animations

Selection glow

==================================================

TEAM BUILDING RULES

==================================================

Team must satisfy

Exactly 11 players

At least 1 wicketkeeper

Minimum 5 bowling options

At least 2 pace bowlers

At least 1 spinner

Maximum 7 specialist batsmen

Maximum 4 overseas players in IPL mode

If invalid

Display errors

Prevent simulation

==================================================

TEAM VIEW

==================================================

Display cricket field.

Players appear in field positions.

Show

Captain

Vice Captain

WK icon

Bowling options

Batting depth

Team balance indicator

==================================================

PLAYER ATTRIBUTES

==================================================

Every player has hidden stats

Batting

Bowling

Fielding

Leadership

Pressure

Consistency

Fitness

Form

Ratings range

40–99

Do NOT display numerical ratings.

==================================================

SPECIAL TRAITS

==================================================

Players may have hidden traits.

Examples

Ice Veins

Death Overs Specialist

Powerplay Destroyer

Spin Wizard

Run Machine

Clutch Performer

Big Match Player

Finisher

Captain Fantastic

Wall

Strike Bowler

These traits influence simulations.

==================================================

CHEMISTRY SYSTEM

==================================================

Certain legendary combinations receive bonuses.

Examples

Sachin + Sehwag

+ Opening Partnership

Dhoni + Raina

+ Finishing

Warne + McGrath

+ Bowling Pressure

Kohli + ABD

+ Chase Bonus

Gilchrist + Hayden

+ Explosive Starts

Display chemistry animations when activated.

==================================================

SIMULATION

==================================================

After drafting

Generate tournament bracket.

Quarter Final

Semi Final

Final

Each match should display

Win probability

Toss

Pitch type

Match summary

Top scorer

Best bowler

Player of Match

Simulation should feel cinematic.

Examples

"Ponting scored 94 from 79."

"Bumrah demolished the middle order."

"Dhoni finished the chase with a six."

Display scorecards.

Display wickets.

Display partnerships.

Display over summaries.

==================================================

PITCH TYPES

==================================================

Randomly generate

Green

Flat

Dusty

Turning

Slow

Each pitch affects batting and bowling.

==================================================

WEATHER

==================================================

Sunny

Cloudy

Humid

Night Match

These slightly influence simulations.

==================================================

DIFFICULTY

==================================================

Easy

Player roles visible.

Medium

Only player names.

Hard

No player information except name and year.

Legend

No squad preview.

==================================================

DAILY CHALLENGE

==================================================

Generate one global seed every day.

Every player receives identical draft choices.

Leaderboard ranks users based on

Tournament wins

Net Run Rate

Average margin

==================================================

LEADERBOARD

==================================================

Show

Username

Wins

Games Played

Win %

Longest Winning Streak

==================================================

ACHIEVEMENTS

==================================================

Win with

Only Left Handers

Only Asian Players

Only World Cup Winners

No Captains

Only Under-25 Players

Only Fast Bowlers

Only Spinners

Perfect Tournament

==================================================

PROFILE

==================================================

Statistics

Games Played

Wins

Favourite Player

Favourite Team

Favourite Tournament

Win Rate

Titles

Badges

==================================================

DATABASE STRUCTURE

==================================================

Design the app so player data can later come from Supabase.

Create models for

Players

Squads

Teams

Tournaments

Traits

Chemistry

Users

Matches

Daily Challenge

Leaderboard

==================================================

ANIMATIONS

==================================================

Use Framer Motion.

Animate

Card flips

Draft selections

Victory confetti

Score counters

Tournament progression

Hover effects

Loading screens

==================================================

SOUNDS

==================================================

Keep architecture ready for optional sounds

Crowd cheer

Bat hit

Appeal

Six

Stumps

Victory

==================================================

RESPONSIVENESS

==================================================

Desktop first.

Fully responsive.

Tablet support.

Mobile support.

==================================================

TECH STACK

==================================================

React

TypeScript

TailwindCSS

shadcn/ui

Framer Motion

Supabase-ready architecture

Component-based architecture.

==================================================

CODE QUALITY

==================================================

Use clean folder structure.

Reusable components.

Context API for global game state.

Well-organized hooks.

Reusable simulation engine.

==================================================

IMPORTANT

==================================================

Do not use copyrighted branding from ICC, BCCI, IPL, or any official cricket boards.

Keep the project generic and original.

Use placeholder player images and seed data.

Design the application so a real player database can easily be integrated later.

The UI should feel polished enough to be production-ready, with smooth transitions, accessible controls, and a clear separation between presentation, game logic, and data.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/72cc23e2-17b0-4fb8-9555-acc5bd85cc3d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
