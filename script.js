let guests = [];

// Nickname mapping
const nicknames = {
  jen: "jennifer",
  jenny: "jennifer",
  alex: "alexander",
  mike: "michael",
  liz: "elizabeth",
  beth: "elizabeth",
  kate: "katherine",
  katie: "katherine"
};

// Normalize input safely
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .trim();
}

// Load CSV
fetch("guests.csv")
  .then(res => res.text())
  .then(text => {
    text = text.replace(/\uFEFF/g, ""); // remove BOM
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");

    lines.shift(); // remove header row

    guests = lines.map(line => {
      const [first, last, table] = line.split(",");
      return {
        first: normalize(first),
        last: normalize(last),
        table: table.trim()
      };
    });
  });

// Form submit
document.getElementById("searchForm").addEventListener("submit", function (e) {
  e.preventDefault();

  document.getElementById("loading").classList.remove("hidden");
  document.getElementById("matches").classList.add("hidden");

  const inputFirst = normalize(document.getElementById("firstName").value);
  const inputLast = normalize(document.getElementById("lastName").value);

  const first =
    nicknames[inputFirst] ? nicknames[inputFirst] : inputFirst;

  let results = guests.filter(g =>
    g.first.includes(first) &&
    g.last.includes(inputLast)
  );

  if (results.length === 0 && inputLast) {
    results = guests.filter(g =>
      g.last.includes(inputLast)
    );
  }

  setTimeout(() => {
    document.getElementById("loading").classList.add("hidden");

    if (results.length === 1) {
      showResult(results[0]);
    } else if (results.length > 1) {
      showMatches(results);
    } else {
      alert("We couldn't find your name. Please see our coordinator.");
    }
  }, 600);
});

// Show multiple matches
function showMatches(matches) {
  const container = document.getElementById("matches");
  container.innerHTML = "<p>Please select your name</p>";

  matches.forEach(g => {
    const btn = document.createElement("button");
    btn.textContent = capitalize(g.first) + " " + capitalize(g.last);
    btn.onclick = () => showResult(g);
    container.appendChild(btn);
  });

  container.classList.remove("hidden");
}

// Show result
function showResult(guest) {
  document.getElementById("guestName").textContent =
    capitalize(guest.first) + " " + capitalize(guest.last);

  document.getElementById("tableNumber").textContent = guest.table;

  document.getElementById("result").classList.remove("hidden");
  document.getElementById("matches").classList.add("hidden");
}

// Reset search
function resetSearch() {
  document.getElementById("searchForm").reset();
  document.getElementById("result").classList.add("hidden");
  document.getElementById("matches").classList.add("hidden");
}

// Capitalize helper
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
