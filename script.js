let guests = [];

fetch("guests.csv")
  .then(res => res.text())
  .then(text => {
    const rows = text.trim().split("\n").slice(1);
    guests = rows.map(row => {
      const [first, last, table] = row.split(",");
      return {
        first: first.toLowerCase().trim(),
        last: last.toLowerCase().trim(),
        table: table.trim()
      };
    });
  });

document.getElementById("searchForm").addEventListener("submit", e => {
  e.preventDefault();

  const first = document.getElementById("firstName").value.toLowerCase().trim();
  const last = document.getElementById("lastName").value.toLowerCase().trim();

  const matches = guests.filter(g =>
    g.first.includes(first) &&
    (last === "" || g.last.includes(last))
  );

  if (matches.length === 1) {
    showResult(matches[0]);
  } else if (matches.length > 1) {
    showMatches(matches);
  } else {
    alert("Sorry, we couldn't find that name.");
  }
});

function showResult(guest) {
  document.getElementById("guestName").textContent =
    capitalize(guest.first) + " " + capitalize(guest.last);

  document.querySelector("#tableNumber .number").textContent = guest.table;

  document.getElementById("result").classList.remove("hidden");
  document.getElementById("matches").classList.add("hidden");

  addSparkles();
}

function showMatches(matches) {
  const container = document.getElementById("matches");
  container.innerHTML = "<p>Please select your name:</p>";

  matches.forEach(g => {
    const btn = document.createElement("button");
    btn.textContent = capitalize(g.first) + " " + capitalize(g.last);
    btn.onclick = () => showResult(g);
    container.appendChild(btn);
  });

  container.classList.remove("hidden");
}

function resetSearch() {
  document.getElementById("result").classList.add("hidden");
  document.getElementById("searchForm").reset();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function addSparkles() {
  const container = document.querySelector(".sparkles");
  container.innerHTML = "";

  for (let i = 0; i < 16; i++) {
    const sparkle = document.createElement("div");
    sparkle.className = "sparkle";
    sparkle.style.left = Math.random() * 100 + "%";
    sparkle.style.top = Math.random() * 100 + "%";
    sparkle.style.animationDelay = Math.random() * 2 + "s";
    container.appendChild(sparkle);
  }
}
