const form = document.getElementById("searchForm");
const result = document.getElementById("result");
const guestNameEl = document.getElementById("guestName");
const tableNumberEl = document.getElementById("tableNumber");
const resetBtn = document.getElementById("resetBtn");
const welcomeTitle = document.getElementById("welcomeTitle");
const sheetStatus = document.getElementById("sheetStatus");

let guests = [];
let isLoading = false;

// Replace this with your published Google Sheet CSV link.
const GOOGLE_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1zkM2f22PYhlYKuCvnvlDSFm-nnk636G0HL4l_MrlApQ/export?format=csv&gid=0";

function parseCsvRow(row) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCase(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function loadGuests() {
  if (GOOGLE_SHEET_CSV_URL.includes("YOUR_SHEET_ID")) {
    sheetStatus.textContent =
      "Add your published Google Sheet CSV link in script.js to enable live guest updates.";
    return false;
  }

  isLoading = true;
  sheetStatus.textContent = "Refreshing guest list...";

  try {
    const response = await fetch(
      `${GOOGLE_SHEET_CSV_URL}${GOOGLE_SHEET_CSV_URL.includes("?") ? "&" : "?"}t=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const text = await response.text();
    const rows = text
      .split(/\r?\n/)
      .map(row => row.trim())
      .filter(Boolean);

    if (rows.length < 2) {
      throw new Error("The sheet is empty or missing guest rows.");
    }

    const headers = parseCsvRow(rows[0]).map(normalizeHeader);
    const firstNameIndex = headers.indexOf("first name");
    const lastNameIndex = headers.indexOf("last name");
    const tableNumberIndex = headers.indexOf("table number");

    if ([firstNameIndex, lastNameIndex, tableNumberIndex].some(index => index === -1)) {
      throw new Error(
        "The sheet must contain the columns: First Name, Last Name, Table Number."
      );
    }

    guests = rows.slice(1).map(row => {
      const columns = parseCsvRow(row);
      return {
        first: (columns[firstNameIndex] || "").trim(),
        last: (columns[lastNameIndex] || "").trim(),
        table: (columns[tableNumberIndex] || "").trim()
      };
    }).filter(guest => guest.first && guest.last && guest.table);

    sheetStatus.textContent = "Guest list is live and ready to search.";
    return true;
  } catch (error) {
    console.error("Unable to load guest list:", error);
    sheetStatus.textContent = "Could not load the guest list. Check the Google Sheet link and sharing settings.";
    return false;
  } finally {
    isLoading = false;
  }
}

loadGuests();

form.addEventListener("submit", async e => {
  e.preventDefault();

  if (isLoading) {
    return;
  }

  const loaded = await loadGuests();
  if (!loaded) {
    alert("The guest list is not available yet. Please try again after checking the Google Sheet setup.");
    return;
  }

  const firstInput = firstName.value.trim().toLowerCase();
  const lastInput = lastName.value.trim().toLowerCase();

  const match = guests.find(g =>
    g.first.toLowerCase().includes(firstInput) &&
    (!lastInput || g.last.toLowerCase().includes(lastInput))
  );

  if (!match) {
    alert("Guest not found. Please check spelling.");
    return;
  }

  guestNameEl.textContent =
    `${titleCase(match.first)} ${titleCase(match.last)}`;

  tableNumberEl.textContent = match.table;

  welcomeTitle.classList.add("hidden");
  form.classList.add("hidden");
  result.classList.remove("hidden");
});

resetBtn.addEventListener("click", () => {
  result.classList.add("hidden");
  form.classList.remove("hidden");
  welcomeTitle.classList.remove("hidden");
  form.reset();
});
