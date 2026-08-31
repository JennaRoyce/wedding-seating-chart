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


/* =========================================================
   GOOGLE SHEET
   ========================================================= */

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
   NORMALIZATION
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
   SUFFIXES
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
   NICKNAMES
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

function formatSuffix(suffix) {
  const normalized = normalizeSuffix(suffix);

  if (normalized === "jr") {
    return "Jr.";
  }

  if (normalized === "sr") {
    return "Sr.";
  }

  if (["ii", "iii", "iv", "v"].includes(normalized)) {
    return normalized.toUpperCase();
  }

  return suffix || "";
}


function getDisplayName(guest) {
  const parts = [
    guest.first,
    guest.last
  ].filter(Boolean);

  const suffix = formatSuffix(guest.suffix);

  if (suffix) {
    parts.push(suffix);
  }

  return parts.join(" ");
}


/* =========================================================
   LEVENSHTEIN DISTANCE
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
        previous[j - 1] +
        (a[i - 1] === b[j - 1] ? 0 : 1);

      current.push(
        Math.min(
          insertion,
          deletion,
          substitution
        )
      );
    }

    for (let j = 0; j < current.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}


/* =========================================================
   NAME SIMILARITY
   ========================================================= */

function similarityScore(input, candidate) {
  if (!input || !candidate) {
    return 0;
  }

  if (input === candidate) {
    return 1;
  }

  /*
    Exact beginning match.
    Example:
      "kath" -> "katherine"
  */

  if (
    candidate.startsWith(input) &&
    input.length >= 3
  ) {
    return 0.88;
  }

  if (
    input.startsWith(candidate) &&
    candidate.length >= 3
  ) {
    return 0.86;
  }

  /*
    Very small spelling difference.
  */

  const distance =
    levenshteinDistance(
      input,
      candidate
    );

  const longestLength =
    Math.max(
      input.length,
      candidate.length
    );

  if (distance === 1 && longestLength >= 4) {
    return 0.82;
  }

  /*
    Slightly more forgiving for longer names.
    Two-character differences are only allowed
    when the names are reasonably long.
  */

  if (
    distance === 2 &&
    longestLength >= 7
  ) {
    return 0.72;
  }

  return 0;
}


/* =========================================================
   PREPARE GUEST DATA
   ========================================================= */

function prepareGuest(guest) {
  const firstVariants = [
    guest.first,
    ...guest.nicknames
  ]
    .map(normalizeText)
    .filter(Boolean);

  return {
    ...guest,

    normalizedFirst:
      normalizeText(guest.first),

    normalizedLast:
      normalizeText(guest.last),

    normalizedSuffix:
      normalizeSuffix(guest.suffix),

    firstVariants:
      [...new Set(firstVariants)]
  };
}


/* =========================================================
   SCORE A POTENTIAL MATCH
   ========================================================= */

function scoreGuestMatch(
  guest,
  firstInput,
  lastInput,
  requestedSuffix
) {
  const first =
    normalizeText(firstInput);

  const last =
    normalizeText(lastInput);

  /*
    Suffix handling.

    If the guest specifically enters Jr./Sr.,
    it must match that suffix.

    If they leave the suffix out, Jr./Sr. candidates
    remain possible and may cause an ambiguity prompt.
  */

  if (
    requestedSuffix &&
    guest.normalizedSuffix !== requestedSuffix
  ) {
    return 0;
  }


  /* -------------------------------------------------------
     LAST NAME SCORE
     ------------------------------------------------------- */

  let lastScore =
    similarityScore(
      last,
      guest.normalizedLast
    );

  /*
    Last names need to be stronger than first names.
    We don't want a vague last-name match.
  */

  if (lastScore < 0.72) {
    return 0;
  }


  /* -------------------------------------------------------
     FIRST NAME / NICKNAME SCORE
     ------------------------------------------------------- */

  let bestFirstScore = 0;

  for (const variant of guest.firstVariants) {
    const score =
      similarityScore(
        first,
        variant
      );

    bestFirstScore =
      Math.max(
        bestFirstScore,
        score
      );
  }

  if (bestFirstScore < 0.72) {
    return 0;
  }


  /* -------------------------------------------------------
     COMBINED SCORE
     ------------------------------------------------------- */

  let score =
    (bestFirstScore * 0.55) +
    (lastScore * 0.45);


  /*
    Exact last name gets a meaningful boost.
  */

  if (
    last === guest.normalizedLast
  ) {
    score += 0.08;
  }


  /*
    Exact first name or nickname gets a meaningful boost.
  */

  if (
    guest.firstVariants.includes(first)
  ) {
    score += 0.08;
  }


  /*
    Explicit suffix match gets a boost.
  */

  if (
    requestedSuffix &&
    guest.normalizedSuffix === requestedSuffix
  ) {
    score += 0.12;
  }


  return Math.min(score, 1);
}


/* =========================================================
   FIND AND RANK MATCHES
   ========================================================= */

function findMatches(
  firstInput,
  lastInput
) {
  const parsedLast =
    splitLastNameAndSuffix(
      lastInput
    );

  const requestedSuffix =
    parsedLast.suffix;

  const preparedGuests =
    guests.map(prepareGuest);

  const scoredMatches =
    preparedGuests
      .map(guest => ({
        guest,
        score: scoreGuestMatch(
          guest,
          firstInput,
          parsedLast.last,
          requestedSuffix
        )
      }))
      .filter(match => match.score >= 0.72)
      .sort(
        (a, b) =>
          b.score - a.score
      );

  return scoredMatches;
}


/* =========================================================
   DETERMINE WHETHER A MATCH IS CLEAR
   ========================================================= */

function chooseMatches(scoredMatches) {
  if (!scoredMatches.length) {
    return {
      type: "none",
      matches: []
    };
  }


  /*
    One strong match.

    If the best match is significantly stronger than
    the next possible match, it is safe to use it.
  */

  if (scoredMatches.length === 1) {
    return {
      type: "single",
      matches: [
        scoredMatches[0].guest
      ]
    };
  }


  const best =
    scoredMatches[0];

  const second =
    scoredMatches[1];


  /*
    If the top result is substantially stronger,
    use it.

    Otherwise ask the guest to choose.
  */

  const scoreDifference =
    best.score - second.score;

  if (
    best.score >= 0.91 &&
    scoreDifference >= 0.10
  ) {
    return {
      type: "single",
      matches: [
        best.guest
      ]
    };
  }


  /*
    Multiple reasonable matches.
  */

  return {
    type: "multiple",
    matches:
      scoredMatches
        .slice(0, 8)
        .map(match => match.guest)
  };
}


/* =========================================================
   LOAD GUEST LIST
   ========================================================= */

async function loadGuests() {
  isLoading = true;

  sheetStatus.textContent =
    "Refreshing guest list...";

  try {
    const response =
      await fetch(
        `${GOOGLE_SHEET_CSV_URL}&t=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `Request failed with status ${response.status}`
      );
    }

    const text =
      await response.text();

    const rows =
      text
        .split(/\r?\n/)
        .map(row => row.trim())
        .filter(Boolean);

    if (rows.length < 2) {
      throw new Error(
        "The sheet is empty or missing guest rows."
      );
    }

    const headers =
      parseCsvRow(rows[0])
        .map(normalizeHeader);

    const firstNameIndex =
      headers.indexOf(
        "first name"
      );

    const lastNameIndex =
      headers.indexOf(
        "last name"
      );

    const nicknamesIndex =
      headers.indexOf(
        "nicknames"
      ) !== -1
        ? headers.indexOf("nicknames")
        : headers.indexOf("nickname");

    const suffixIndex =
      headers.indexOf(
        "suffix"
      );

    const tableNumberIndex =
      headers.indexOf(
        "table number"
      );


    if (
      firstNameIndex === -1 ||
      lastNameIndex === -1 ||
      tableNumberIndex === -1
    ) {
      throw new Error(
        "The sheet must contain First Name, Last Name, and Table Number columns."
      );
    }


    guests =
      rows
        .slice(1)
        .map(row => {
          const columns =
            parseCsvRow(row);

          const first =
            (
              columns[firstNameIndex] ||
              ""
            ).trim();

          const last =
            (
              columns[lastNameIndex] ||
              ""
            ).trim();

          const nicknames =
            nicknamesIndex === -1
              ? []
              : parseNicknames(
                  columns[nicknamesIndex]
                );

          const suffix =
            suffixIndex === -1
              ? ""
              : normalizeSuffix(
                  columns[suffixIndex]
                );

          const table =
            (
              columns[tableNumberIndex] ||
              ""
            ).trim();

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
      "Could not load the guest list. Please try again.";

    return false;

  } finally {
    isLoading = false;
  }
}


/* =========================================================
   SHOW ONE GUEST
   ========================================================= */

function showGuest(guest) {
  guestNameEl.textContent =
    getDisplayName(guest);

  tableNumberEl.textContent =
    guest.table;

  matchArea.classList.add(
    "hidden"
  );

  result.classList.remove(
    "hidden"
  );

  welcomeTitle.classList.add(
    "hidden"
  );

  form.classList.add(
    "hidden"
  );
}


/* =========================================================
   SHOW MULTIPLE MATCHES
   ========================================================= */

function showMultipleMatches(
  matches
) {
  matchOptions.innerHTML = "";

  matchHelp.textContent =
    "We found more than one guest with a similar name. Please select your name below:";

  matches.forEach(guest => {

    const button =
      document.createElement(
        "button"
      );

    button.type = "button";

    button.className =
      "match-option";

    button.textContent =
      getDisplayName(guest);

    button.addEventListener(
      "click",
      () => {
        showGuest(guest);
      }
    );

    matchOptions.appendChild(
      button
    );
  });

  matchArea.classList.remove(
    "hidden"
  );

  result.classList.add(
    "hidden"
  );
}


/* =========================================================
   ERROR
   ========================================================= */

function showSearchError(
  message
) {
  matchOptions.innerHTML = "";

  matchHelp.textContent =
    message;

  matchArea.classList.remove(
    "hidden"
  );

  result.classList.add(
    "hidden"
  );
}


/* =========================================================
   SEARCH
   ========================================================= */

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    if (isLoading) {
      return;
    }


    const firstInput =
      firstNameInput.value.trim();

    const lastInput =
      lastNameInput.value.trim();


    /*
      Both names are required.
    */

    if (
      !firstInput ||
      !lastInput
    ) {

      showSearchError(
        "Please enter both your first name and last name."
      );

      return;
    }


    const loaded =
      await loadGuests();

    if (!loaded) {
      return;
    }


    const scoredMatches =
      findMatches(
        firstInput,
        lastInput
      );


    const decision =
      chooseMatches(
        scoredMatches
      );


    /* -------------------------------------------------------
       NO MATCH
       ------------------------------------------------------- */

    if (
      decision.type === "none"
    ) {

      showSearchError(
        "We couldn't find a guest matching that name. Please check the spelling and try again."
      );

      return;
    }


    /* -------------------------------------------------------
       ONE CLEAR MATCH
       ------------------------------------------------------- */

    if (
      decision.type === "single"
    ) {

      showGuest(
        decision.matches[0]
      );

      return;
    }


    /* -------------------------------------------------------
       MULTIPLE POSSIBLE MATCHES
       ------------------------------------------------------- */

    if (
      decision.type === "multiple"
    ) {

      showMultipleMatches(
        decision.matches
      );

      return;
    }

  }
);


/* =========================================================
   RESET
   ========================================================= */

resetBtn.addEventListener(
  "click",
  () => {

    result.classList.add(
      "hidden"
    );

    matchArea.classList.add(
      "hidden"
    );

    form.classList.remove(
      "hidden"
    );

    welcomeTitle.classList.remove(
      "hidden"
    );

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
