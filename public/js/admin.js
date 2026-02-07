// Allow closing modals by clicking outside modal-content or pressing Escape
document.addEventListener("DOMContentLoaded", function () {
  // Click outside modal-content closes modal
  ["adminModal", "adminEdit", "modalDelete"].forEach((id) => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.addEventListener("mousedown", function (e) {
        if (e.target === modal) closeModal();
      });
    }
  });
  // Escape key closes modal
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });
});
document.addEventListener("DOMContentLoaded", initializePasswordToggles);

function initializePasswordToggles() {
  setupPasswordToggle("showPassword", ["password", "Cpassword"]);
  setupPasswordToggle("showPasswordEdit", ["passwordEdit", "CpasswordEdit"]);
}

function setupPasswordToggle(toggleId, fieldIds) {
  const toggle = document.getElementById(toggleId);
  if (!toggle) return;

  toggle.addEventListener("change", () => {
    const type = toggle.checked ? "text" : "password";
    fieldIds.forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.type = type;
    });
  });
}

/* ========================================
   MODAL FUNCTIONS
   ======================================== */

// IMPORTANT:
// These modal functions should ONLY be called when a user explicitly clicks
// a button or link. They must NEVER be called automatically on page load,
// from DOMContentLoaded, or from any automatic triggers.


function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("show");
    document.body.classList.add("modal-open");
  }
}

// Modal helper functions - only call these from user-triggered events (onclick, button clicks, etc.)
const showAdminModal = () => showModal("adminModal");
const showAdminEditModal = () => showModal("adminEdit");
const showDeleteModal = () => showModal("modalDelete");
const showLogoutModal = () => showModal("logoutModal");


function closeModal() {
  ["adminModal", "adminEdit", "modalDelete"].forEach((id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("show");
  });
  document.body.classList.remove("modal-open");
}


function closeLogoutModal() {
  const modal = document.getElementById("logoutModal");
  if (modal) modal.classList.remove("show");
  document.body.classList.remove("modal-open");
}

function logout() {
  console.log('[Logout] Clearing session and redirecting to login');
  // Use AuthHelper if available, otherwise fallback to manual clear
  if (window.AuthHelper) {
    window.AuthHelper.logout();
  } else {
    sessionStorage.clear();
    window.location.href = "/login";
  }
}
