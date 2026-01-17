const form = document.getElementById("searchForm");
const result = document.getElementById("result");
const guestNameEl = document.getElementById("guestName");
const tableNumberEl = document.getElementById("tableNumber");
const resetBtn = document.getElementById("resetBtn");

let guests = [];

// Load CSV
fetch("./assets/guests.csv")
  .then(res => res.text())
  .then(text => {
    const rows = text.split("\n").slice(1);
    guests = rows.map(row => {
      const [first, last, table] = row.split(",");
      return {
        first: first?.trim().toLowerCase(),
        last: last?.trim().toLowerCase(),
        table: table?.trim()
      };
    });
  });

form.addEventListener("submit", e => {
  e.preventDefault();

  const firstInput = document.getElementById("firstName").value.toLowerCase();
  const lastInput = document.getElementById("lastName").value.toLowerCase();

  const match = guests.find(g =>
    g.first.includes(firstInput) &&
    (lastInput === "" || g.last.includes(lastInput))
  );

  if (!match) {
    alert("Guest not found. Please try again.");
    return;
  }

  guestNameEl.textContent =
    `${capitalize(match.first)} ${capitalize(match.last)}`;
  tableNumberEl.textContent = match.table;

  result.classList.remove("hidden");
});

resetBtn.addEventListener("click", () => {
  result.classList.add("hidden");
  form.reset();
});

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
