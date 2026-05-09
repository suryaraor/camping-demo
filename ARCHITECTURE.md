# Camping Planning System — Architecture & Design

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│         React Frontend (Single HTML File)        │
│  Schedule | Shopping | Expenses | Signups        │
│  Volunteers                                      │
│  CDN: React 18.2 + Babel 7.23 (no build step)  │
└────────────────────┬────────────────────────────┘
                     │ fetch() — JSON over HTTPS
┌────────────────────▼────────────────────────────┐
│        Google Apps Script Web App               │
│     doGet(e) / doPost(e) — REST-style API       │
└────────────────────┬────────────────────────────┘
                     │ SpreadsheetApp SDK
┌────────────────────▼────────────────────────────┐
│           Google Sheets (6 tabs)                │
│  Schedule | ShoppingList | Volunteers | Families│
│  Expenses | Signups                             │
└─────────────────────────────────────────────────┘
```

**Why Apps Script as middleware?**
- Zero infrastructure to manage (runs on Google's servers)
- No OAuth friction for small teams — deploy as "Anyone" access
- Read + Write to Sheets via native SDK
- Free, instant deployment with one URL

**Why a single HTML file?**
- No build toolchain, no npm, no bundler
- Deployable to GitHub Pages with zero configuration
- React and Babel loaded from CDN at runtime
- Any text editor + a browser is enough to develop

---

## Google Sheet Schema

### Tab 1: `Schedule`
| Column | Type | Description |
|--------|------|-------------|
| Day | Number | 1, 2, 3... |
| Meal | String | Breakfast / Lunch / Dinner / Activity |
| Item | String | e.g. "Pancakes", "Hiking", "BBQ" |
| Details | String | Notes, ingredients, location |
| Assigned Volunteer | String | Who's responsible |
| Status | String | Planned / Done |

### Tab 2: `ShoppingList`
| Column | Type | Description |
|--------|------|-------------|
| ID | String | Unique row ID (auto) |
| Meal | String | Breakfast / Lunch / Dinner / Supplies |
| Category | String | Groceries / Produce / Dairy / Supplies |
| Item | String | e.g. "Eggs" |
| Quantity | String | e.g. "2 dozen" |
| Store | String | Costco / Trader Joe's / etc. |
| Volunteer | String | Who is buying it |
| Status | String | Pending / Purchased |
| Cost | Number | Actual cost entered by volunteer |

### Tab 3: `Volunteers`
| Column | Type | Description |
|--------|------|-------------|
| Name | String | Volunteer name |
| Family | String | Family they belong to |
| Assigned Store | String | Which store they're responsible for |
| Phone | String | Optional contact |

### Tab 4: `Families`
| Column | Type | Description |
|--------|------|-------------|
| Family Name | String | e.g. "The Smiths" |
| Members | Number | Total headcount |
| Contact | String | Primary contact name |
| Email | String | Optional |

### Tab 5: `Expenses`
| Column | Type | Description |
|--------|------|-------------|
| Volunteer | String | Who made the purchase |
| Store | String | Where it was purchased |
| Item | String | What was bought |
| Amount | Number | Cost in dollars |
| Receipt | String | Optional photo URL or note |
| Date | String | Date of purchase |

### Tab 6: `Signups`
| Column | Type | Description |
|--------|------|-------------|
| Name | String | Participant name |
| Family | String | Family group |
| Members | Number | Number in their party |
| Nights | Number | Number of nights attending |
| Email | String | Contact email |
| Dietary Notes | String | Restrictions/allergies |
| Signed Up At | String | Timestamp |

---

## API Endpoints (Apps Script)

All requests go to one URL: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`

### GET Requests
| Action | URL Params | Returns |
|--------|-----------|---------|
| Get schedule | `?action=getSchedule` | All schedule rows |
| Get shopping list | `?action=getShopping` | All shopping items |
| Get volunteers | `?action=getVolunteers` | All volunteers |
| Get families | `?action=getFamilies` | Families + headcounts |
| Get expenses | `?action=getExpenses` | All expenses |
| Get signups | `?action=getSignups` | All signups |
| Get summary | `?action=getSummary` | Totals: cost, headcount, split, shopping progress |

### POST Requests
| Action | Body | Effect |
|--------|------|--------|
| Add signup | `{action:"addSignup", data:{...}}` | Appends row to Signups |
| Update item status | `{action:"updateStatus", id, status}` | Updates ShoppingList status column |
| Update item cost | `{action:"updateCost", id, cost}` | Updates ShoppingList cost column |
| Add expense | `{action:"addExpense", data:{...}}` | Appends to Expenses |
| Update schedule item | `{action:"updateSchedule", row, data}` | Updates existing Schedule row |
| Add schedule item | `{action:"addScheduleItem", data:{...}}` | Appends new row to Schedule |
| Add shopping item | `{action:"addShoppingItem", data:{...}}` | Appends to ShoppingList |

### Response Format
All responses are JSON with CORS headers:
```json
{ "success": true, "data": [...] }
{ "success": false, "error": "message" }
```

### Apps Script Utilities (Code.gs)
- `sheetToObjects(sheetName)` — reads all rows, uses row 1 as keys, skips blanks
- `appendRow(sheetName, headers, data)` — appends a new row in header order
- `updateCell(sheetName, rowNum, colName, value)` — patches a single cell
- `setupSheetHeaders()` — one-time setup: creates all 6 tabs with headers and formatting
- `corsResponse(data)` — wraps any value in a JSON ContentService response with CORS headers

---

## Frontend Component Structure

```
App
├── Header (5-tab nav)
├── ScheduleView
│   ├── DayCard (repeats per day)
│   │   ├── MealRow (Breakfast/Lunch/Dinner)
│   │   └── ActivityRow
│   └── Modal → AddScheduleItemForm
├── ShoppingView
│   ├── FilterBar (by store, status)
│   ├── ShoppingItem (status toggle + cost entry)
│   └── Modal → AddItemForm
├── ExpensesView
│   ├── TotalSummaryCard (total cost, per-person, headcount)
│   ├── StoreBreakdownTable
│   ├── FamilySplitTable
│   └── Modal → AddExpenseForm
├── SignupsView
│   ├── HeadcountBanner (total campers)
│   ├── FamilyCard (members, nights, dietary notes)
│   └── Modal → SignupForm
└── VolunteersView
    ├── VolunteerCard (name, store, assigned items)
    └── Item completion status per volunteer
```

### Shared Primitives
- **`useData(action)`** — custom hook: fetches on mount, exposes `{data, loading, error, reload}`
- **`Modal`** — reusable overlay: accepts `title` + `children`, controlled by parent boolean state

### Mock / Demo Mode
`index.html` has a top-level config block:
```js
const APPS_SCRIPT_URL = 'https://script.google.com/...';
const USE_MOCK_DATA   = false;   // flip to true for local demo
```
When `USE_MOCK_DATA = true`, the `api` client returns bundled sample data (all 6 sheets populated) with a 280 ms artificial delay — no network calls are made. This is useful for UI development and demos without a live Sheet.

---

## Cost Splitting Logic

```
Total Cost        = SUM(Expenses.Amount)
Total Participants = SUM(Signups.Members)
Cost Per Person   = Total Cost / Total Participants

Per Family:
  Family Cost = Family.Members × Cost Per Person

Store Breakdown:
  Store Total = SUM(Expenses.Amount WHERE Store = storeName)

Shopping Progress:
  Purchased = COUNT(ShoppingList WHERE Status = "Purchased")
  Progress % = Purchased / Total × 100
```

---

## Deployment Steps

1. **Set up Google Sheet** — create the 6 tabs above with headers (or run `setupSheetHeaders()`)
2. **Add Apps Script** — in the Sheet: Extensions → Apps Script → paste `Code.gs`; set `SPREADSHEET_ID`
3. **Deploy as Web App** — Execute as "Me", access "Anyone"; copy the `/exec` URL
4. **Wire up the frontend** — paste the URL into `APPS_SCRIPT_URL` in `index.html`; set `USE_MOCK_DATA = false`
5. **Host the frontend** — push `index.html` to the `gh-pages` branch for GitHub Pages, or open it locally in a browser

---

## Security Notes

- Apps Script deployed with "Anyone can access" is suitable for small private groups
- Share the Sheet URL only with organizers; the Web App URL is effectively the API key
- For production use, switch to OAuth + service accounts
- No secrets are stored in the frontend — only the public Web App URL
