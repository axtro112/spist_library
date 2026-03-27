/**
 * system-admin/dashboard.js
 * System Admin Dashboard module.
 * Requires: /js/csrf-helper.js, /js/auth-helper.js, /js/api.js, /js/core/utils.js
 * Chart.js must be loaded before this file.
 * Exposed as window.SystemAdmin.Dashboard
 */
(function (SA) {
  "use strict";

  let _borrowingChart = null;
  let _categoryChart  = null;

  /* ------------------------------------------------------------------
   * Auth guard
   * ------------------------------------------------------------------ */
  function _guard() {
    const session = window.AuthHelper.getSession();

    if (!session.isLoggedIn || session.userRole !== "admin") {
      alert("Please log in with admin credentials to access this page.");
      window.location.href = "/login";
      return false;
    }

    if (session.adminRole === "super_admin") {
      window.location.href = "/super-admin-dashboard";
      return false;
    }

    if (session.adminRole !== "system_admin") {
      alert("Invalid admin role. Please log in again.");
      window.AuthHelper.clearSession();
      window.location.href = "/login";
      return false;
    }

    return true;
  }

  /* ------------------------------------------------------------------
   * Header
   * ------------------------------------------------------------------ */
  async function _loadHeader() {
    const adminData = await window.AuthHelper.fetchCurrentAdmin();
    window.AuthHelper.updateAdminHeader(adminData);
  }

  /* ------------------------------------------------------------------
   * Activity helpers
   * ------------------------------------------------------------------ */
  function _formatActivityType(type) {
    const map = {
      book_borrowed: "Borrowed",
      book_returned: "Returned",
      book_overdue:  "Overdue",
    };
    if (map[type]) return map[type];
    return type
      .split("_")
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
      .join(" ");
  }

  async function _fetchDashboardStats() {
    const doFetch = typeof fetchWithCsrf === "function" ? fetchWithCsrf : fetch;
    const res = await doFetch("/api/admin/dashboard/stats", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch dashboard statistics");
    const result = await res.json();
    return result.data || result;
  }

  async function _refreshActivities() {
    try {
      const statsData = await _fetchDashboardStats();
      const list      = document.getElementById("activityList");
      if (!list) return;

      list.innerHTML = "";

      if (statsData.recentActivities && statsData.recentActivities.length > 0) {
        statsData.recentActivities.forEach(function (activity) {
          const ts    = new Date(activity.timestamp);
          const timeAgo = Core.utils.getTimeAgo(ts);
          const li    = document.createElement("li");
          li.className = "activity-item";
          li.innerHTML =
            '<div class="activity-content">' +
              '<div class="activity-main">' +
                '<span class="activity-type">' + _formatActivityType(activity.type) + "</span>" +
                '<span class="activity-detail">' + activity.detail + "</span>" +
              "</div>" +
              '<div class="time" data-timestamp="' + ts.toISOString() + '" title="' + ts.toLocaleString() + '">' + timeAgo + "</div>" +
            "</div>";
          list.appendChild(li);
        });
      } else {
        list.innerHTML =
          '<li class="activity-item"><div class="activity-content">No recent activities</div></li>';
      }
    } catch (err) {
      console.error("[SystemAdmin.Dashboard] refreshActivities:", err);
    }
  }

  /* ------------------------------------------------------------------
   * Stats
   * ------------------------------------------------------------------ */
  async function _refreshStats() {
    try {
      const statsData = await _fetchDashboardStats();

      Core.utils.setText("totalBooks",          statsData.total_books        || 0);
      Core.utils.setText("activeBorrowings",    statsData.activeBorrowings   || 0);
      Core.utils.setText("registeredStudents",  statsData.registeredStudents || 0);
      Core.utils.setText("overdueBooks",        statsData.overdueBooks       || 0);

      _updateCharts(statsData);
    } catch (err) {
      console.error("[SystemAdmin.Dashboard] refreshStats:", err);
    }
  }

  /* ------------------------------------------------------------------
   * Charts
   * ------------------------------------------------------------------ */
  function _destroyCharts() {
    if (_borrowingChart) { _borrowingChart.destroy(); _borrowingChart = null; }
    if (_categoryChart)  { _categoryChart.destroy();  _categoryChart  = null; }
  }

  function _clearChartEmptyState(canvasEl) {
    if (!canvasEl || !canvasEl.parentElement) return;
    canvasEl.style.display = "";
    const emptyState = canvasEl.parentElement.querySelector(".dashboard-chart-empty");
    if (emptyState) emptyState.remove();
  }

  function _showChartEmptyState(canvasEl, title, message) {
    if (!canvasEl || !canvasEl.parentElement) return;
    _clearChartEmptyState(canvasEl);
    canvasEl.style.display = "none";

    const emptyState = document.createElement("div");
    emptyState.className = "dashboard-chart-empty";
    emptyState.innerHTML =
      '<div class="dashboard-chart-empty-card">' +
        '<div class="dashboard-chart-empty-icon">📊</div>' +
        '<div class="dashboard-chart-empty-title">' + title + '</div>' +
        '<div class="dashboard-chart-empty-message">' + message + '</div>' +
      '</div>';

    canvasEl.parentElement.appendChild(emptyState);
  }

  function _updateCharts(statsData) {
    _destroyCharts();

    const hasBorrowingTrendData = !!(statsData.borrowingTrends && statsData.borrowingTrends.length > 0) &&
      statsData.borrowingTrends.some(function (item) { return Number(item.count || 0) > 0; });

    const hasPopularCategoryData = !!(statsData.popularCategories && statsData.popularCategories.length > 0) &&
      statsData.popularCategories.some(function (item) { return Number(item.count || 0) > 0; });

    const borrowingEl = document.getElementById("borrowingTrends");
    if (borrowingEl && hasBorrowingTrendData) {
      _clearChartEmptyState(borrowingEl);
      const labels = statsData.borrowingTrends.map(function (item) {
        const parts = item.month.split("-");
        return new Date(parts[0], parts[1] - 1).toLocaleString("default", {
          month: "short",
          year:  "numeric",
        });
      });
      const data = statsData.borrowingTrends.map(function (item) { return item.count; });

      _borrowingChart = new Chart(borrowingEl.getContext("2d"), {
        type: "line",
        data: {
          labels:   labels,
          datasets: [{
            label:           "Books Borrowed",
            data:            data,
            borderColor:     "#2196F3",
            backgroundColor: "rgba(33,150,243,0.1)",
            tension:         0.4,
            fill:            true,
            pointRadius:     4,
            pointHoverRadius: 6,
          }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          plugins: {
            title:  { display: true, text: "Monthly Borrowing Trends", font: { size: 16, weight: "bold" } },
            legend: { display: true, position: "top" },
          },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } },
          },
        },
      });
    } else if (borrowingEl) {
      _showChartEmptyState(borrowingEl, "Monthly Borrowing Trends", "No borrowing data available");
    }

    const categoryEl = document.getElementById("popularCategories");
    if (categoryEl && hasPopularCategoryData) {
      _clearChartEmptyState(categoryEl);
      const catLabels = statsData.popularCategories.map(function (i) { return i.category; });
      const catData   = statsData.popularCategories.map(function (i) { return i.count; });

      _categoryChart = new Chart(categoryEl.getContext("2d"), {
        type: "doughnut",
        data: {
          labels:   catLabels,
          datasets: [{
            data:            catData,
            backgroundColor: ["#2196F3", "#4CAF50", "#FFC107", "#FF5722", "#9C27B0"],
          }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          plugins: {
            title:  { display: true, text: "Most Popular Book Categories", font: { size: 16, weight: "bold" } },
            legend: { position: "bottom", labels: { padding: 20 } },
          },
        },
      });
    } else if (categoryEl) {
      _showChartEmptyState(categoryEl, "Most Popular Book Categories", "No category data available");
    }
  }

  /* ------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------ */
  async function init() {
    if (!_guard()) return;

    try {
      await _loadHeader();
      await _refreshActivities();
      await _refreshStats();

      Core.utils.addInterval(Core.utils.updateAllTimestamps, 60000);
      Core.utils.addInterval(_refreshActivities, 300000);
      Core.utils.addInterval(_refreshStats,      60000);
    } catch (err) {
      console.error("[SystemAdmin.Dashboard] init:", err);
      const list = document.getElementById("activityList");
      if (list) {
        list.innerHTML =
          '<li class="activity-item"><div class="activity-content">Error loading dashboard: ' +
          err.message + "</div></li>";
      }
    }
  }

  /* ------------------------------------------------------------------
   * Export
   * ------------------------------------------------------------------ */
  SA.Dashboard = { init: init };

}(window.SystemAdmin = window.SystemAdmin || {}));
