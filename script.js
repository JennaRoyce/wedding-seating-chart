const form = document.getElementById("searchForm");
const result = document.getElementById("result");
const guestNameEl = document.getElementById("guestName");
const tableNumberEl = document.getElementById("tableNumber");
const resetBtn = document.getElementById("resetBtn");
const welcomeTitle = document.getElementById("welcomeTitle");
const sheetStatus = document.getElementById("sheetStatus");

const firstNameInput = document.getElementById("firstName");
const lastNameInput = document.getElementById("lastName");

const matchArea = document.getElementById("matchArea");
const matchHelp = document.getElementById("matchHelp");
const matchOptions = document.getElementById("matchOptions");

let guests = [];
let isLoading = false;

// Your published Google Sheet CSV link.
const GOOGLE_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1zkM2f22PYhlYKuCvnvlDSFm-nnk636G0HL4l_MrlApQ/export?format=csv&gid=0";


/* =========================================================
   CSV PARSING
   ========================================================= */

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


/* =========================================================
   TEXT NORMALIZATION
   =========================================================
   This makes matching tolerant of:
   - uppercase/lowercase
   - extra spaces
   - apostrophes
   - periods
   - hyphens
   - accented characters
   ========================================================= */

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]/g, "");
}


function normalizeHeader(header) {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


/* =========================================================
   SUFFIX HANDLING
   ========================================================= */

const SUFFIX_ALIASES = {
  jr: "jr",
  junior: "jr",

  sr: "sr",
  senior: "sr",

  ii: "ii",
  iii: "iii",
  iv: "iv",
  v: "v"
};


function normalizeSuffix(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .trim();

  return SUFFIX_ALIASES[normalized] || normalized;
}


/*
  Allows a guest to type:

  Smith Jr.
  Smith, Jr.
  Smith junior

  into the Last Name field.

  The suffix is optional. If the guest doesn't provide one,
  we don't eliminate Jr./Sr. candidates automatically.
*/

function splitLastNameAndSuffix(value) {
  const cleaned = String(value || "").trim();

  const match = cleaned.match(
    /^(.*?)(?:[\s,]+)(jr\.?|junior|sr\.?|senior|ii|iii|iv|v)$/i
  );

  if (!match) {
    return {
      last: cleaned,
      suffix: ""
    };
  }

  return {
    last: match[1].trim(),
    suffix: normalizeSuffix(match[2])
  };
}


/* =========================================================
   NICKNAME HANDLING
   ========================================================= */

function parseNicknames(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(/[;,]/)
    .map(name => name.trim())
    .filter(Boolean);
}


/* =========================================================
   DISPLAY NAME
   ========================================================= */

function getDisplayName(guest) {
  const parts = [
    guest.first,
    guest.last
  ].filter(Boolean);

  if (guest.suffix) {
    parts.push(guest.suffix.toUpperCase() === "JR"
      ? "Jr."
      : guest.suffix.toUpperCase() === "SR"
        ? "Sr."
        : guest.suffix.toUpperCase());
  }

  return parts.join(" ");
}


/* =========================================================
   LEVENSHTEIN DISTANCE
   =========================================================
   Used only as a very conservative final fallback for
   tiny spelling differences.

   Example:
     Jon -> John
     Sara -> Sarah

   It will NOT be used to make a risky guess when there
   are multiple possible guests.
   ========================================================= */

function levenshteinDistance(a, b) {
  if (a === b) {
    return 0;
  }

  if (!a.length) {
    return b.length;
  }

  if (!b.length) {
    return a.length;
  }

  const previous = Array.from(
    { length: b.length + 1 },
    (_, index) => index
  );

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= b.length; j += 1) {
      const insertion = current[j - 1] + 1;
      const deletion = previous[j] + 1;
      const substitution =
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);

      current.push(
        Math.min(insertion, deletion, substitution)
      );
    }

    for (let j = 0; j < current.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}


/*
  A tiny spelling difference is allowed only when the name
  is otherwise clearly identifiable.

  This is intentionally conservative.
*/

function isSmallSpellingDifference(input, candidate) {
  if (!input || !candidate) {
    return false;
  }

  if (input === candidate) {
    return true;
  }

  const distance = levenshteinDistance(input, candidate);

  if (distance > 1) {
    return false;
  }

  return Math.min(input.length, candidate.length) >= 4;
}


/* =========================================================
   LOAD GUEST LIST
   ========================================================= */

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
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Request failed with status ${response.status}`
      );
    }

    const text = await response.text();

    const rows = text
      .split(/\r?\n/)
      .map(row => row.trim())
      .filter(Boolean);

    if (rows.length < 2) {
      throw new Error(
        "The sheet is empty or missing guest rows."
      );
    }

    const headers = parseCsvRow(rows[0]).map(normalizeHeader);

    const firstNameIndex = headers.indexOf("first name");
    const lastNameIndex = headers.indexOf("last name");
    const nicknamesIndex =
      headers.indexOf("nicknames") !== -1
        ? headers.indexOf("nicknames")
        : headers.indexOf("nickname");

    const suffixIndex = headers.indexOf("suffix");
    const tableNumberIndex = headers.indexOf("table number");

    if (
      firstNameIndex === -1 ||
      lastNameIndex === -1 ||
      tableNumberIndex === -1
    ) {
      throw new Error(
        "The sheet must contain the columns: First Name, Last Name, Table Number."
      );
    }

    guests = rows
      .slice(1)
      .map(row => {
        const columns = parseCsvRow(row);

        const first =
          (columns[firstNameIndex] || "").trim();

        const last =
          (columns[lastNameIndex] || "").trim();

        const nicknames =
          nicknamesIndex === -1
            ? []
            : parseNicknames(columns[nicknamesIndex]);

        const suffix =
          suffixIndex === -1
            ? ""
            : normalizeSuffix(columns[suffixIndex]);

        const table =
          (columns[tableNumberIndex] || "").trim();

        return {
          first,
          last,
          nicknames,
          suffix,
          table
        };
      })
      .filter(
        guest =>
          guest.first &&
          guest.last &&
          guest.table
      );

    sheetStatus.textContent = "";

    return true;

  } catch (error) {
    console.error(
      "Unable to load guest list:",
      error
    );

    sheetStatus.textContent =
      "Could not load the guest list. Check the Google Sheet link and sharing settings.";

    return false;

  } finally {
    isLoading = false;
  }
}


/* =========================================================
   FIND MATCHES
   ========================================================= */

function findMatches(firstInput, lastInput) {
  const first = normalizeText(firstInput);

  const parsedLast = splitLastNameAndSuffix(lastInput);
  const last = normalizeText(parsedLast.last);
  const requestedSuffix = parsedLast.suffix;

  /*
    A guest's searchable first names include:
      - their real first name
      - every nickname listed in the sheet
  */

  const preparedGuests = guests.map(guest => {
    const firstVariants = [
      guest.first,
      ...guest.nicknames
    ]
      .map(normalizeText)
      .filter(Boolean);

    return {
      ...guest,
      normalizedFirst: normalizeText(guest.first),
      normalizedLast: normalizeText(guest.last),
      normalizedSuffix: normalizeSuffix(guest.suffix),
      firstVariants: [...new Set(firstVariants)]
    };
  });


  /* -------------------------------------------------------
     1. EXACT NAME / NICKNAME MATCH
     ------------------------------------------------------- */

  let exactMatches = preparedGuests.filter(guest => {
    const firstMatches =
      guest.firstVariants.includes(first);

    const lastMatches =
      guest.normalizedLast === last;

    const suffixMatches =
      !requestedSuffix ||
      guest.normalizedSuffix === requestedSuffix;

    return (
      firstMatches &&
      lastMatches &&
      suffixMatches
    );
  });

  if (exactMatches.length > 0) {
    return exactMatches;
  }


  /* -------------------------------------------------------
     2. VERY SMALL SPELLING DIFFERENCE
     -------------------------------------------------------
     Only used if there is no exact/nickname match.
     We require BOTH first and last names to be very close.
     ------------------------------------------------------- */

  const fuzzyMatches = preparedGuests.filter(guest => {
    const firstClose = guest.firstVariants.some(
      variant =>
        isSmallSpellingDifference(
          first,
          variant
        )
    );

    const lastClose =
      isSmallSpellingDifference(
        last,
        guest.normalizedLast
      );

    const suffixMatches =
      !requestedSuffix ||
      guest.normalizedSuffix === requestedSuffix;

    return (
      firstClose &&
      lastClose &&
      suffixMatches
    );
  });

  return fuzzyMatches;
}


/* =========================================================
   SHOW A SINGLE GUEST
   ========================================================= */

function showGuest(guest) {
  guestNameEl.textContent =
    getDisplayName(guest);

  tableNumberEl.textContent =
    guest.table;

  matchArea.classList.add("hidden");
  result.classList.remove("hidden");

  welcomeTitle.classList.add("hidden");
  form.classList.add("hidden");
}


/* =========================================================
   SHOW MULTIPLE POSSIBLE GUESTS
   ========================================================= */

function showMultipleMatches(matches) {
  matchOptions.innerHTML = "";

  matchHelp.textContent =
    "We found more than one guest with that name. Please select your name:";

  matches.forEach((guest, index) => {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "match-option";

    button.textContent =
      getDisplayName(guest);

    button.addEventListener(
      "click",
      () => {
        showGuest(guest);
      }
    );

    matchOptions.appendChild(button);
  });

  matchArea.classList.remove("hidden");
  result.classList.add("hidden");
}


/* =========================================================
   ERROR MESSAGE
   ========================================================= */

function showSearchError(message) {
  matchOptions.innerHTML = "";

  matchHelp.textContent = message;

  matchArea.classList.remove("hidden");
  result.classList.add("hidden");
}


/* =========================================================
   SEARCH FORM
   ========================================================= */

form.addEventListener(
  "submit",
  async e => {
    e.preventDefault();

    if (isLoading) {
      return;
    }

    const firstInput =
      firstNameInput.value.trim();

    const lastInput =
      lastNameInput.value.trim();

    /*
      Explicit validation.
      Last name is now REQUIRED.
    */

    if (!firstInput || !lastInput) {
      showSearchError(
        "Please enter both your first name and last name."
      );

      return;
    }

    const loaded =
      await loadGuests();

    if (!loaded) {
      alert(
        "The guest list is not available yet. Please try again after checking the Google Sheet setup."
      );

      return;
    }

    const matches =
      findMatches(
        firstInput,
        lastInput
      );


    /* -------------------------------------------------------
       NO MATCH
       ------------------------------------------------------- */

    if (matches.length === 0) {
      showSearchError(
        "We couldn't find a guest matching that name. Please check the spelling and try again."
      );

      return;
    }


    /* -------------------------------------------------------
       ONE MATCH
       ------------------------------------------------------- */

    if (matches.length === 1) {
      showGuest(matches[0]);
      return;
    }


    /* -------------------------------------------------------
       MULTIPLE MATCHES
       ------------------------------------------------------- */

    showMultipleMatches(matches);
  }
);


/* =========================================================
   RESET
   ========================================================= */

resetBtn.addEventListener(
  "click",
  () => {
    result.classList.add("hidden");
    matchArea.classList.add("hidden");
    form.classList.remove("hidden");
    welcomeTitle.classList.remove("hidden");

    matchOptions.innerHTML = "";
    matchHelp.textContent = "";

    form.reset();

    firstNameInput.focus();
  }
);


/* =========================================================
   INITIAL LOAD
   ========================================================= */

loadGuests();
