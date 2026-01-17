let guests = [];

// Nickname dictionary
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

// Normalize text safely
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .trim();
}

// Load CSV safely
fetch("guests.csv")
  .then(res => res.text())
  .then(text => {
    text = text.replace(/\uFEFF/g, ""); // remove BOM
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");

    const headers = lines.shift().split(",");

    guests = lines.map(line => {
      const parts = line.split(",");
      return {
        first: normalize(parts[0]),
        last: normalize(parts[1]),
        table: parts[2]?.trim()
      };
    });
  });

document.getElementById("searchForm").addEventListener("submit", function (e) {
  e.preventDefault();

  document.getElementById("loading").classList.remove("hidden");
  document.getElementById("matches").classList.add("hidden");

  const rawFirst = normalize(document.getElementById("firstName").value);
  const rawLast = normalize(document.getElementById("lastName").value);

  const first =
    nicknames[rawFirst] ? nicknames[rawFirst] : rawFirst;

  // FIND MATCHES
  let results = guests.filter(g =>
    g.first.includes(first) &&
    g.last.includes(rawLast)
  );

  // LAST NAME ONLY FALLBACK
  if (results.length === 0 && rawLast) {
    results = guests.filter(g => g.last.includes(rawLast));
  }

  setTimeout(() => {
    document.getElementById("loading").classList.add("hidden");

    if (results.length === 1) {
      showResult(results[0]);
    } else if (results.length > 1) {
      showMatches(results);
    } else {
      alert("We couldn't find your name. Please see our coordinator 💙");
    }
  }, 600);
});

function showMatches(matches) {
  const container = document.getElementById("matches");
  container.innerHTML = "<p>Please tap your name 💙</p>";

  matches.forEach(g => {
    const btn = document.createElement("button");
    btn.textContent =
      capitalize(g.first) + " " + capitalize(g.last);
    btn.onclick = () => showResult(g);
    container.appendChild(btn);
  });

  container.classList.remove("hidden");
}

function showResult(guest) {
  document.getElementById("guestName").textContent =
    capitalize(guest.first) + " " + capitalize(guest.last);

  document.getElementById("tableNumber").textContent = guest.table;
  document.getElementById("result").classList.remove("hidden");
  document.getElementById("matches").classList.add("hidden");
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
