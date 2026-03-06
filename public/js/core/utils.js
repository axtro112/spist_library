/**
 * core/utils.js
 * Shared utilities available to all page modules (system-admin, student, super-admin).
 * Exposed as window.Core.utils
 */
(function (Core) {
  "use strict";

  /* ------------------------------------------------------------------
   * Interval registry — tracks all setInterval IDs so pages can clean
   * up when navigating away or reinitialising.
   * ------------------------------------------------------------------ */
  const _intervals = [];

  function addInterval(fn, ms) {
    const id = setInterval(fn, ms);
    _intervals.push(id);
    return id;
  }

  function clearAllIntervals() {
    _intervals.forEach(clearInterval);
    _intervals.length = 0;
  }

  /* ------------------------------------------------------------------
   * Date / time helpers
   * ------------------------------------------------------------------ */

  /**
   * Format a date string or Date object to a human-readable short form.
   * e.g. "Jan 5, 2025"
   */
  function formatDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  /**
   * Return a relative time string such as "3 minutes ago" or "just now".
   */
  function getTimeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - new Date(date)) / 1000);

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1,
    };

    if (seconds < 60) return "just now";

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? "s" : ""} ago`;
      }
    }
    return "just now";
  }

  /**
   * Walk every element with class "time" and update its text content
   * using its data-timestamp attribute.
   */
  function updateAllTimestamps() {
    document.querySelectorAll(".time").forEach(function (el) {
      const ts = el.getAttribute("data-timestamp");
      if (ts) el.textContent = getTimeAgo(new Date(ts));
    });
  }

  /* ------------------------------------------------------------------
   * Misc helpers
   * ------------------------------------------------------------------ */

  /**
   * Simple debounce — returns a function that delays invoking `fn` until
   * after `wait` ms have elapsed since the last call.
   */
  function debounce(fn, wait) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, arguments), wait);
    };
  }

  /**
   * Set the text content of an element by ID (no-op when element absent).
   */
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /**
   * Show a brief toast notification.
   * Falls back to console.log when DOM is not ready.
   */
  function showToast(message, type) {
    type = type || "info";
    const toast = document.createElement("div");
    toast.className = "core-toast core-toast--" + type;
    toast.textContent = message;
    toast.style.cssText = [
      "position:fixed",
      "bottom:1.5rem",
      "right:1.5rem",
      "background:" + (type === "error" ? "#e53935" : type === "success" ? "#43a047" : "#1565c0"),
      "color:#fff",
      "padding:0.6rem 1.2rem",
      "border-radius:6px",
      "font-size:0.875rem",
      "z-index:9999",
      "box-shadow:0 2px 8px rgba(0,0,0,.25)",
      "transition:opacity .3s",
    ].join(";");
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = "0";
      setTimeout(function () { toast.remove(); }, 350);
    }, 3000);
  }

  /* ------------------------------------------------------------------
   * Export
   * ------------------------------------------------------------------ */
  Core.utils = {
    addInterval: addInterval,
    clearAllIntervals: clearAllIntervals,
    formatDate: formatDate,
    getTimeAgo: getTimeAgo,
    updateAllTimestamps: updateAllTimestamps,
    debounce: debounce,
    setText: setText,
    showToast: showToast,
  };

}(window.Core = window.Core || {}));
