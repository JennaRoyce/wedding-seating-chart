const form = document.getElementById("searchForm");
const result = document.getElementById("result");
const guestNameEl = document.getElementById("guestName");
const tableNumberEl = document.getElementById("tableNumber");
const resetBtn = document.getElementById("resetBtn");
const welcomeTitle = document.getElementById("welcomeTitle");

let guests = [];

/* Load CSV */
fetch("guests.csv")
  .then(res => res.text())
  .then(text => {
    const rows = text.trim().split("\n").slice(1);
    guests = rows.map(row => {
      const [first, last, table] = row.split(",");
      return {
        first: first.trim().toLowerCase(),
        last: last.trim().toLowerCase(),
        table: table.trim()
      };
    });
  });

form.addEventListener("submit", e => {
  e.preventDefault();

  const firstInput = firstName.value.trim().toLowerCase();
  const lastInput = lastName.value.trim().toLowerCase();

  const match = guests.find(g =>
    g.first.includes(firstInput) &&
    (!lastInput || g.last.includes(lastInput))
  );

  if (!match) {
    alert("Guest not found. Please check spelling.");
    return;
  }

  guestNameEl.textContent =
    `${match.first.charAt(0).toUpperCase()}${match.first.slice(1)} ` +
    `${match.last.charAt(0).toUpperCase()}${match.last.slice(1)}`;

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

