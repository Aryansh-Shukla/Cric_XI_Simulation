# Cricket XI

**Draft Legends. Build Dynasties.**

Cricket XI is a historical cricket drafting and tournament simulation game. Build your dream XI from legendary players across cricketing eras, make strategic selections, and compete in simulated tournaments across multiple formats.

🌐 **Live Demo:** https://cric-xi-simulation.vercel.app/  
📦 **GitHub Repository:** https://github.com/Aryansh-Shukla/Cric_XI_Simulation

---

## About the Project

Cricket XI brings together cricket history, team-building strategy, and tournament simulation.

Choose from historical player editions, draft your squad, establish your leadership group, and take your team through competitive tournaments. Every decision—from player selection and team balance to captaincy—can influence your campaign.

## Features

- **Historical Player Drafting:** Build squads using legendary cricketers from different eras.
- **Strategic Team Building:** Select your playing XI, captain, vice-captain, and wicketkeeper.
- **Multiple Tournament Formats:** Compete in different international and franchise tournaments.
- **Match Simulation:** Dedicated simulation logic for T20, ODI, IPL, and Test cricket.
- **Match Centre:** Follow match progress through scorecards, ball-by-ball commentary, and playback controls for limited-overs matches.
- **Tournament Progression:** Experience league stages, qualification rounds, playoffs, semi-finals, and finals.
- **Player Performance:** Player attributes, traits, leadership, consistency, pressure, and team chemistry influence match outcomes.
- **Tournament Storylines:** Follow campaign narratives, qualification scenarios, records, and tournament recaps.
- **Top Runs:** Track completed campaign performances and compare your tournament results locally.

## Tournament Formats

Cricket XI currently supports the following formats:

| Format | Tournament Structure |
|---|---|
| ODI World Cup | League stage, semi-finals, and final |
| T20 World Cup | Group stage, Super 8, semi-finals, and final |
| Champions Trophy | Group stage, semi-finals, and final |
| IPL | League stage followed by the playoff system |
| Test Cricket | Test matches and series-based progression |

## Match Simulation

The game uses format-specific simulation systems to reflect the differences between T20, ODI, IPL, and Test cricket.

Match outcomes are influenced by factors such as:

- Batting and bowling abilities
- Performance against pace and spin
- Powerplay, middle-over, and death-over capabilities
- Fielding and fitness
- Leadership and consistency
- Pressure and match context
- Team balance and chemistry

The Match Centre provides scorecards, commentary, and match playback for limited-overs formats. Test matches use innings-level progression.

## Tech Stack

| Technology | Purpose |
|---|---|
| React 19 | Frontend |
| TypeScript | Type safety |
| TanStack Start | Application framework |
| TanStack Router | Routing |
| Vite | Build tooling |
| Tailwind CSS | Styling |
| shadcn/ui | UI components |
| Framer Motion | Animations |
| Vercel | Deployment |
| GitHub | Version control |
| Lovable | AI-assisted development |

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js
- npm

### Installation

Clone the repository:

```bash
git clone https://github.com/Aryansh-Shukla/Cric_XI_Simulation.git
```

Navigate to the project directory:

```bash
cd Cric_XI_Simulation
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The application should now be available at the local URL displayed in your terminal.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the production application |
| `npm run lint` | Run the linting checks |

## Project Structure

```text
Cric_XI_Simulation/
├── public/             # Static assets
├── src/                # Application source code
├── scripts/            # Project scripts
├── .lovable/           # Lovable project configuration
├── AGENTS.md           # Project instructions
├── package.json        # Dependencies and scripts
└── README.md           # Project documentation
```

## Development and Testing

The project has undergone iterative development and testing across its supported tournament formats.

Development verification has included:

- Tournament progression checks across all five formats.
- Algorithmic campaign simulations.
- Match Centre playback checks.
- Scorecard and match-result consistency checks.
- Tournament qualification and playoff progression.
- Responsive layout checks.

**Note:** Simulation test runs are development verification and should not be interpreted as actual users or production engagement.

## Future Improvements

Potential areas for further development include:

- Expanded historical player databases.
- More player editions and cricketing eras.
- Enhanced tournament customisation.
- Deeper player statistics and records.
- Additional match simulation scenarios.
- Improved campaign tracking and analytics.

## Disclaimer

Cricket XI is an independently developed cricket simulation project created for entertainment and educational purposes.

Player names, historical references, and cricket-related information are used to represent the sport and its history. Cricket XI is not affiliated with or endorsed by the ICC, BCCI, IPL, or any other cricket governing body or organisation.

---

**Cricket XI — Draft Legends. Build Dynasties.**
