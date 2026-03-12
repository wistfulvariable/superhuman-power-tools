// Triggers a Gmail search by changing the URL hash after Gmail loads.
// Gmail's SPA router picks up the hash change, executes the search,
// and populates the search box — so "Show search options" parses it into filter fields.

(function () {
  chrome.storage.local.get("gmailFilterData", (result) => {
    const data = result.gmailFilterData;
    if (!data) return;
    chrome.storage.local.remove("gmailFilterData");

    const query = buildQuery(data.from, data.subject);
    if (query) navigateToSearch(query);
  });

  function buildQuery(from, subject) {
    const parts = [];
    if (from) parts.push("from:" + from);
    if (subject) parts.push("subject:(" + subject + ")");
    return parts.join(" ");
  }

  function navigateToSearch(query) {
    // Wait for Gmail to finish loading (search input appears = Gmail is ready)
    let attempts = 0;
    const id = setInterval(() => {
      if (++attempts > 50) { clearInterval(id); return; }

      const input = document.querySelector('input[aria-label="Search mail"]');
      if (!input) return;
      clearInterval(id);

      // Encode the query so characters like / # ? & don't break the hash route.
      // Gmail's router decodes the hash before parsing search operators.
      const encoded = encodeURIComponent(query).replace(/%20/g, "+");
      window.location.hash = "#search/" + encoded;
    }, 200);
  }
})();
