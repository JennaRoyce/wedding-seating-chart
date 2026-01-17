const form = document.getElementById("searchForm");
const result = document.getElementById("result");
const guestNameEl = document.getElementById("guestName");
const tableNumberEl = document.getElementById("tableNumber");
const resetBtn = document.getElementById("resetBtn");
const welcomeTitle = document.getElementById("welcomeTitle");

/* TEMP SAMPLE DATA */
const guests = [
  { first: "Jenna", last: "Royce", table: "7" },
  { first: "Michael", last: "Smith", table: "12" },
  { first: "Emily", last: "Johnson", table: "4" }
];

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const firstInput = document.getElementById("firstName").value.trim().toLowerCase();
  const lastInput = document.getElementById("lastName").value.trim().toLowerCase();

  const match = guests.find(g =>
    g.first.toLowerCase().includes(firstInput) &&
    (!lastInput || g.last.toLowerCase().includes(lastInput))
  );

  if (!match) {
    alert("Guest not found. Please check spelling.");
    return;
  }

  guestNameEl.textContent = `${match.first} ${match.last}`;
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
