(function () {
  "use strict";

  function setText(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(value);
  }

  function getStudentId() {
    var fromSession = sessionStorage.getItem("studentId");
    if (fromSession) return fromSession;

    var fromBody = document.body ? document.body.getAttribute("data-student-id") : "";
    return fromBody || "";
  }

  async function loadOverviewStats() {
    var studentId = getStudentId();
    if (!studentId) return;

    try {
      var doFetch = typeof fetchWithCsrf === "function" ? fetchWithCsrf : fetch;
      var res = await doFetch("/api/students/" + studentId + "/dashboard-stats?ts=" + Date.now());
      if (!res.ok) throw new Error("Failed to load overview stats: " + res.status);

      var payload = await res.json();
      var stats = payload.data || payload;

      setText("availableBooksCount", stats.availableBooks ?? 0);
      setText("borrowedBooksCount", stats.borrowedBooks ?? 0);
      setText("dueSoonCount", stats.dueSoon ?? 0);
      setText("pendingBooksCount", stats.pendingBooks ?? 0);
    } catch (err) {
      console.error("[Student.Overview] loadOverviewStats:", err);
      setText("availableBooksCount", "Error");
      setText("borrowedBooksCount", "Error");
      setText("dueSoonCount", "Error");
      setText("pendingBooksCount", "Error");
    }
  }

  document.addEventListener("DOMContentLoaded", loadOverviewStats);
})();
