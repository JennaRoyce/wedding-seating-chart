let guests = [];

fetch("guests.csv")
  .then(response => response.text())
  .then(text => {
    const rows = text.split("\n").slice(1);

    guests = rows
      .map(row => {
        const [first, last, table] = row.split(",");
        if (!first || !last || !table) return null;

        return {
          first: first.trim().toLowerCase(),
          last: last.trim().toLowerCase(),
          table: table.trim()
        };
      })
      .filter(Boolean);
  });

document.getElementById("searchForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const inputFirst = document
    .getElementById("firstName")
    .value.trim()
    .toLowerCase();

  const inputLast = document
    .getElementById("lastName")
    .value.trim()
    .toLowerCase();

  // PARTIAL MATCH LOGIC
  const matches = guests.filter(g =>
    g.first.includes(inputFirst) &&
    g.last.includes(inputLast)
  );

  if (matches.length === 1) {
    showResult(matches[0]);
  } else if (matches.length > 1) {
    alert(
      "Multiple guests found. Please type your full first and last name 💙"
    );
  } else {
    alert(
      "We couldn't find your name. Please see our coordinator 💙"
    );
  }
});

function showResult(guest) {
  const result = document.getElementById("result");

  const formattedName =
    guest.first.charAt(0).toUpperCase() +
    guest.first.slice(1) +
    " " +
    guest.last.charAt(0).toUpperCase() +
    guest.last.slice(1);

  document.getElementById("guestName").textContent = formattedName;
  document.getElementById("tableNumber").textContent = guest.table;

  result.classList.remove("hidden");
}
