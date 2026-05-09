# Camping Planner

A mobile-friendly React app for organizing group camping trips, backed by Google Sheets via Google Apps Script.

## Features

- **Schedule** — shared itinerary for the trip
- **Shopping List** — collaborative gear and grocery tracking
- **Volunteers** — assign tasks to participants
- **Families** — manage who's coming
- **Expenses** — track costs and split spending
- **Signups** — activity or meal sign-up sheets

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for a full breakdown of how the frontend, Apps Script backend, and Google Sheets fit together.

## Setup

### 1. Google Sheet

Create a Google Sheet with these tabs: `Schedule`, `ShoppingList`, `Volunteers`, `Families`, `Expenses`, `Signups`.

### 2. Deploy Apps Script

1. Open the Google Sheet → **Extensions → Apps Script**
2. Paste the contents of `apps-script/Code.gs`
3. Update `SPREADSHEET_ID` at the top of `Code.gs` to your sheet's ID
4. Click **Deploy → New deployment** → Web App → Anyone → Deploy
5. Copy the Web App URL

### 3. Configure the App

Open `index.html` in a browser, enter your Web App URL in the settings panel, and you're ready.

## Hosting

The app is a single static `index.html` file — host it on GitHub Pages, Netlify, Vercel, or any static host.

## License

MIT — see [LICENSE](LICENSE).
