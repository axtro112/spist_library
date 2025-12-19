// System Admin Role Guard
// This script ensures only system_admin role can access system admin pages

(function() {
  'use strict';

  function checkSystemAdminAccess() {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    const userRole = sessionStorage.getItem("userRole");
    const adminRole = sessionStorage.getItem("adminRole");

    if (isLoggedIn !== "true" || userRole !== "admin") {
      console.warn("Not logged in or not an admin");
      return false;
    }

    if (adminRole !== "system_admin") {
      console.warn("Access denied: System Admin role required");
      return false;
    }

    return true;
  }

  // Auto-check on pages that include this script
  window.checkSystemAdminAccess = checkSystemAdminAccess;
  
  console.log("System Admin guard loaded");
})();
