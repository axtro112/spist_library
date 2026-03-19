/**
 * SuperAdmin.Dashboard
 * Handles all logic for the Super Admin Dashboard page.
 * Depends on: super-admin/utils.js, Chart.js
 */
(function (SA) {
  'use strict';

  var Dashboard = (function () {

    // ── Private state ───────────────────────────────────────────────────────
    var _borrowingChart = null;
    var _categoryChart  = null;

    // ── Private helpers ─────────────────────────────────────────────────────
    function _destroyCharts() {
      if (_borrowingChart) { _borrowingChart.destroy(); _borrowingChart = null; }
      if (_categoryChart)  { _categoryChart.destroy();  _categoryChart  = null; }
    }

    function _formatActivityType(type) {
      switch (type) {
        case 'book_borrowed': return 'Borrowed';
        case 'book_returned': return 'Returned';
        case 'book_overdue':  return 'Overdue';
        default:
          return type
            .split('_')
            .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
            .join(' ');
      }
    }

    function _getTimeAgo(date) {
      var seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 60) return 'just now';
      var intervals = [
        ['year', 31536000], ['month', 2592000], ['week', 604800],
        ['day', 86400], ['hour', 3600], ['minute', 60],
      ];
      for (var i = 0; i < intervals.length; i++) {
        var n = Math.floor(seconds / intervals[i][1]);
        if (n >= 1) return n + ' ' + intervals[i][0] + (n > 1 ? 's' : '') + ' ago';
      }
      return 'just now';
    }

    function _updateTimestamps() {
      document.querySelectorAll('.time').forEach(function (el) {
        var ts = new Date(el.getAttribute('data-timestamp'));
        el.textContent = _getTimeAgo(ts);
      });
    }

    // ── loadStats ───────────────────────────────────────────────────────────
    async function loadStats() {
      var result = await SA.utils.safeFetch('/api/admin/dashboard/stats');
      if (!result) return null;
      var data = result.data || result;

      // Keep pending pickup aligned with lifecycle tab logic by counting
      // records from the borrowed-books endpoint filtered as pending_pickup.
      var pendingPickupCount = data.pendingPickup || 0;
      var pendingResult = await SA.utils.safeFetch('/api/admin/borrowings?status=pending_pickup');
      if (pendingResult) {
        var pendingData = pendingResult.data || pendingResult;
        if (Array.isArray(pendingData)) {
          pendingPickupCount = pendingData.length;
        }
      }

      SA.utils.setText('totalBooks',         data.total_books         || 0);
      SA.utils.setText('activeBorrowings',   data.activeBorrowings    || 0);
      SA.utils.setText('registeredStudents', data.registeredStudents  || 0);
      SA.utils.setText('overdueBooks',       data.overdueBooks        || 0);
      SA.utils.setText('totalAdmins',        data.totalAdmins         || 0);
      SA.utils.setText('pendingPickup',      pendingPickupCount);
      return data;
    }

    // ── loadCharts ──────────────────────────────────────────────────────────
    function loadCharts(data) {
      _destroyCharts();

      // Borrowing trends (line chart)
      var trendEl = document.getElementById('borrowingTrends');
      if (trendEl && data.borrowingTrends && data.borrowingTrends.length > 0) {
        var trendLabels = data.borrowingTrends.map(function (item) {
          var parts = item.month.split('-');
          return new Date(parts[0], parts[1] - 1)
            .toLocaleString('default', { month: 'short', year: 'numeric' });
        });
        _borrowingChart = new Chart(trendEl.getContext('2d'), {
          type: 'line',
          data: {
            labels: trendLabels,
            datasets: [{
              label: 'Books Borrowed',
              data: data.borrowingTrends.map(function (i) { return i.count; }),
              borderColor: '#2196F3',
              backgroundColor: 'rgba(33,150,243,0.1)',
              tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title:  { display: true, text: 'Monthly Borrowing Trends', font: { size: 16, weight: 'bold' } },
              legend: { display: true, position: 'top' },
            },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } },
          },
        });
      } else if (trendEl) {
        trendEl.parentElement.innerHTML =
          '<div class="empty-state-message">No borrowing data available</div>';
      }

      // Popular categories (doughnut chart)
      var catEl = document.getElementById('popularCategories');
      if (catEl && data.popularCategories && data.popularCategories.length > 0) {
        _categoryChart = new Chart(catEl.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: data.popularCategories.map(function (i) { return i.category; }),
            datasets: [{
              data: data.popularCategories.map(function (i) { return i.count; }),
              backgroundColor: ['#2196F3', '#4CAF50', '#FFC107', '#FF5722', '#9C27B0'],
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title:  { display: true, text: 'Most Popular Book Categories', font: { size: 16, weight: 'bold' } },
              legend: { position: 'bottom', labels: { padding: 20 } },
            },
          },
        });
      } else if (catEl) {
        catEl.parentElement.innerHTML =
          '<div class="empty-state-message">No category data available</div>';
      }
    }

    // ── loadActivities ──────────────────────────────────────────────────────
    async function loadActivities() {
      var result = await SA.utils.safeFetch('/api/admin/dashboard/stats');
      if (!result) return;
      var data = result.data || result;
      var list = document.getElementById('activityList');
      if (!list) return;

      list.innerHTML = '';
      var activities = data.recentActivities;
      if (!activities || activities.length === 0) {
        list.innerHTML =
          '<li class="activity-item"><div class="activity-content">No recent activities</div></li>';
        return;
      }

      activities.forEach(function (activity) {
        var ts  = new Date(activity.timestamp);
        var li  = document.createElement('li');
        li.className = 'activity-item';
        li.innerHTML =
          '<div class="activity-content">' +
            '<div class="activity-main">' +
              '<span class="activity-type">' + _formatActivityType(activity.type) + '</span>' +
              '<span class="activity-detail"> ' + activity.detail + '</span>' +
            '</div>' +
            '<div class="time" data-timestamp="' + ts.toISOString() + '" title="' + ts.toLocaleString() + '">' +
              _getTimeAgo(ts) +
            '</div>' +
          '</div>';
        list.appendChild(li);
      });
    }

    // ── startAutoRefresh ────────────────────────────────────────────────────
    function startAutoRefresh() {
      // Update relative timestamps every minute
      SA.utils.addInterval(_updateTimestamps, 60000);

      // Refresh stats + charts every minute
      SA.utils.addInterval(async function () {
        var data = await loadStats();
        if (data) loadCharts(data);
      }, 60000);

      // Refresh activity feed every 5 minutes
      SA.utils.addInterval(loadActivities, 300000);
    }

    // ── init ────────────────────────────────────────────────────────────────
    async function init() {
      if (!SA.utils.guardSuperAdmin()) return;
      // Extended delay to ensure backend session is fully loaded from store
      // on hard refresh (100ms gives enough time for MySQL session store)
      await new Promise(resolve => setTimeout(resolve, 100));
      var session = SA.utils.getSession();
      await SA.utils.loadAdminHeader(session.adminId);

      var data = await loadStats();
      if (data) loadCharts(data);

      await loadActivities();
      startAutoRefresh();
    }

    // Public API
    return { init: init, loadStats: loadStats, loadCharts: loadCharts, loadActivities: loadActivities };
  }());

  SA.Dashboard = Dashboard;

}(window.SuperAdmin = window.SuperAdmin || {}));
