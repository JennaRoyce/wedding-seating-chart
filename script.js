let guests = [];

fetch("guests.csv")
  .then(response => response.text())
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

document.getElementById("searchForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const firstName = document.getElementById("firstName").value.toLowerCase().trim();
  const lastName = document.getElementById("lastName").value.toLowerCase().trim();

  const guest = guests.find(g =>
    g.first === firstName && g.last === lastName
  );

  const result = document.getElementById("result");

  if (guest) {
    document.getElementById("guestName").textContent =
      firstName.charAt(0).toUpperCase() + firstName.slice(1) + " " +
      lastName.charAt(0).toUpperCase() + lastName.slice(1);

    document.getElementById("tableNumber").textContent = guest.table;
    result.classList.remove("hidden");
  } else {
    alert("We couldn't find your name. Please see our coordinator 💙");
  }
});
