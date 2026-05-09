/**
 * 🏕️ Camping Planning System — Google Apps Script Backend
 *
 * Deploy as Web App:
 *   - Execute as: Me
 *   - Who has access: Anyone (or Anyone with Google Account for more security)
 *
 * After deploying, copy the Web App URL into your frontend config.
 */

const SPREADSHEET_ID = '1e8USg_XyJsiG4awul4S9kE6L8x5jdUU7xNXH_UEGtYA';

// ─── Sheet name constants ───────────────────────────────────────────────────
const SHEETS = {
  SCHEDULE:  'Schedule',
  SHOPPING:  'ShoppingList',
  VOLUNTEERS:'Volunteers',
  FAMILIES:  'Families',
  EXPENSES:  'Expenses',
  SIGNUPS:   'Signups',
};

// ─── CORS helper ────────────────────────────────────────────────────────────
function corsResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── doGet — handles all read actions ───────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action || '';
    let result;

    switch (action) {
      case 'getSchedule':    result = getSchedule();    break;
      case 'getShopping':    result = getShopping();    break;
      case 'getVolunteers':  result = getVolunteers();  break;
      case 'getFamilies':    result = getFamilies();    break;
      case 'getExpenses':    result = getExpenses();    break;
      case 'getSignups':     result = getSignups();     break;
      case 'getSummary':     result = getSummary();     break;
      default:               result = { error: 'Unknown action: ' + action };
    }

    return corsResponse({ success: true, data: result });
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }
}

// ─── doPost — handles all write actions ─────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || '';
    let result;

    switch (action) {
      case 'addSignup':          result = addSignup(body.data);                         break;
      case 'addExpense':         result = addExpense(body.data);                        break;
      case 'addShoppingItem':    result = addShoppingItem(body.data);                  break;
      case 'updateStatus':       result = updateShoppingStatus(body.id, body.status);        break;
      case 'updateVolunteer':    result = updateShoppingVolunteer(body.id, body.volunteer); break;
      case 'updateCost':         result = updateShoppingCost(body.id, body.cost);           break;
      case 'updateShoppingItem': result = updateShoppingItem(body.id, body.row, body.data); break;
      case 'updateSchedule':     result = updateScheduleItem(body.row, body.data);     break;
      case 'addScheduleItem':    result = addScheduleItem(body.data);                  break;
      default:                   result = { error: 'Unknown action: ' + action };
    }

    return corsResponse({ success: true, data: result });
  } catch (err) {
    return corsResponse({ success: false, error: err.message });
  }
}

// ─── Utility: sheet rows → array of objects ─────────────────────────────────
function sheetToObjects(sheetName) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const rows    = data.slice(1);

  return rows
    .filter(row => row.some(cell => cell !== ''))   // skip blank rows
    .map((row, i) => {
      const obj = { _row: i + 2 };                 // 1-indexed, header is row 1
      headers.forEach((h, j) => { obj[h] = row[j]; });
      return obj;
    });
}

// ─── Utility: append a row ──────────────────────────────────────────────────
function appendRow(sheetName, headers, data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  const row = headers.map(h => data[h] !== undefined ? data[h] : '');
  sheet.appendRow(row);
  return { appended: true };
}

// ─── Utility: update a specific cell ────────────────────────────────────────
function updateCell(sheetName, rowNum, colName, value) {
  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet   = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colIdx  = headers.findIndex(h => String(h).trim() === colName);
  if (colIdx === -1) throw new Error('Column not found: ' + colName);
  sheet.getRange(rowNum, colIdx + 1).setValue(value);
  return { updated: true, row: rowNum, col: colName };
}

// ═══════════════════════════════════════════════════════════════════════════
// READ ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getSchedule() {
  return sheetToObjects(SHEETS.SCHEDULE);
}

function getShopping() {
  return sheetToObjects(SHEETS.SHOPPING);
}

function getVolunteers() {
  return sheetToObjects(SHEETS.VOLUNTEERS);
}

function getFamilies() {
  return sheetToObjects(SHEETS.FAMILIES);
}

function getExpenses() {
  return sheetToObjects(SHEETS.EXPENSES);
}

function getSignups() {
  return sheetToObjects(SHEETS.SIGNUPS);
}

function getSummary() {
  const expenses  = sheetToObjects(SHEETS.EXPENSES);
  const signups   = sheetToObjects(SHEETS.SIGNUPS);
  const families  = sheetToObjects(SHEETS.FAMILIES);
  const shopping  = sheetToObjects(SHEETS.SHOPPING);

  // Total cost
  const totalCost = expenses.reduce((sum, e) => sum + (parseFloat(e['Amount']) || 0), 0);

  // Total participants
  const totalPeople = signups.reduce((sum, s) => sum + (parseInt(s['Members']) || 0), 0);

  // Cost per person
  const costPerPerson = totalPeople > 0 ? totalCost / totalPeople : 0;

  // Per-store spending
  const byStore = {};
  expenses.forEach(e => {
    const store = e['Store'] || 'Unknown';
    byStore[store] = (byStore[store] || 0) + (parseFloat(e['Amount']) || 0);
  });

  // Per-family cost
  const familyCosts = families.map(f => {
    const members = parseInt(f['Members']) || 0;
    return {
      family:  f['Family Name'],
      members: members,
      cost:    Math.round(members * costPerPerson * 100) / 100,
    };
  });

  // Shopping stats
  const totalItems     = shopping.length;
  const purchasedItems = shopping.filter(i => i['Status'] === 'Purchased' || i['Status'] === 'Done').length;

  return {
    totalCost:       Math.round(totalCost * 100) / 100,
    totalPeople,
    costPerPerson:   Math.round(costPerPerson * 100) / 100,
    byStore,
    familyCosts,
    shoppingProgress: { total: totalItems, purchased: purchasedItems },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// WRITE ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function addSignup(data) {
  const headers = ['Name', 'Family', 'Members', 'Nights', 'Email', 'Dietary Notes', 'Signed Up At'];
  data['Signed Up At'] = new Date().toISOString();
  return appendRow(SHEETS.SIGNUPS, headers, data);
}

function addExpense(data) {
  const headers = ['Volunteer', 'Store', 'Item', 'Amount', 'Receipt', 'Date'];
  data['Date'] = data['Date'] || new Date().toISOString().split('T')[0];
  return appendRow(SHEETS.EXPENSES, headers, data);
}

function addShoppingItem(data) {
  const headers = ['ID', 'Meal', 'Category', 'Item', 'Quantity', 'Store', 'Volunteer', 'Status', 'Cost'];
  data['ID']     = data['ID']     || Utilities.getUuid();
  data['Status'] = data['Status'] || 'Pending';
  data['Cost']   = data['Cost']   || 0;
  return appendRow(SHEETS.SHOPPING, headers, data);
}

function addScheduleItem(data) {
  const headers = ['Day', 'Meal', 'Item', 'Details', 'Assigned Volunteer', 'Status'];
  data['Status'] = data['Status'] || 'Planned';
  return appendRow(SHEETS.SCHEDULE, headers, data);
}

function updateShoppingStatus(id, status) {
  // Find the row with matching ID
  const rows = sheetToObjects(SHEETS.SHOPPING);
  const match = rows.find(r => String(r['ID']) === String(id));
  if (!match) throw new Error('Item not found with ID: ' + id);
  return updateCell(SHEETS.SHOPPING, match._row, 'Status', status);
}

function updateShoppingVolunteer(id, volunteer) {
  const rows  = sheetToObjects(SHEETS.SHOPPING);
  const match = rows.find(r => String(r['ID']) === String(id));
  if (!match) throw new Error('Item not found with ID: ' + id);
  return updateCell(SHEETS.SHOPPING, match._row, 'Volunteer', volunteer);
}

function updateShoppingCost(id, cost) {
  const rows  = sheetToObjects(SHEETS.SHOPPING);
  const match = rows.find(r => String(r['ID']) === String(id));
  if (!match) throw new Error('Item not found with ID: ' + id);
  return updateCell(SHEETS.SHOPPING, match._row, 'Cost', cost);
}

function updateShoppingItem(id, rowNum, data) {
  const fields = ['Meal', 'Category', 'Item', 'Quantity', 'Store', 'Volunteer'];
  fields.forEach(field => {
    if (data[field] !== undefined) updateCell(SHEETS.SHOPPING, rowNum, field, data[field]);
  });
  return { updated: true, row: rowNum };
}

function updateScheduleItem(rowNum, data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.SCHEDULE);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = headers.map(h => data[String(h).trim()] !== undefined ? data[String(h).trim()] : '');
  sheet.getRange(rowNum, 1, 1, rowData.length).setValues([rowData]);
  return { updated: true, row: rowNum };
}

// ─── One-time setup: create headers on all sheets ───────────────────────────
function setupSheetHeaders() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const schema = {
    'Schedule':     ['Day', 'Meal', 'Item', 'Details', 'Assigned Volunteer', 'Status'],
    'ShoppingList': ['ID', 'Meal', 'Category', 'Item', 'Quantity', 'Store', 'Volunteer', 'Status', 'Cost'],
    'Volunteers':   ['Name', 'Family', 'Assigned Store', 'Phone'],
    'Families':     ['Family Name', 'Members', 'Contact', 'Email'],
    'Expenses':     ['Volunteer', 'Store', 'Item', 'Amount', 'Receipt', 'Date'],
    'Signups':      ['Name', 'Family', 'Members', 'Nights', 'Email', 'Dietary Notes', 'Signed Up At'],
  };

  Object.entries(schema).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    // Bold the header row
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });

  return 'Setup complete!';
}
