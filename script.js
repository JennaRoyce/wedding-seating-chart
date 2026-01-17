const form = document.getElementById("searchForm");
const result = document.getElementById("result");
const guestNameEl = document.getElementById("guestName");
const tableNumberEl = document.getElementById("tableNumber");
const resetBtn = document.getElementById("resetBtn");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const first = document.getElementById("firstName").value.trim();
  const last = document.getElementById("lastName").value.trim();

  // Example match — replace with CSV logic
  guestNameEl.textContent = `${first} ${last}`.trim();
  tableNumberEl.textContent = "12";

  result.classList.remove("hidden");
  form.classList.add("hidden");
});

resetBtn.addEventListener("click", () => {
  result.classList.add("hidden");
  form.classList.remove("hidden");
  form.reset();
});
