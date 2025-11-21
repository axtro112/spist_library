// Extract token from URL
function getTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

// Show message helper
function showMessage(message, type) {
  const messageContainer = document.getElementById("messageContainer");
  const alertClass = `alert alert-${type}`;
  messageContainer.innerHTML = `<div class="${alertClass}" role="alert">${message}</div>`;
  window.scrollTo(0, 0);
}

// Show/Hide loading spinner
function setLoading(isLoading) {
  const spinner = document.getElementById("loadingSpinner");
  const submitBtn = document.getElementById("submitBtn");

  if (isLoading) {
    spinner.style.display = "block";
    submitBtn.disabled = true;
  } else {
    spinner.style.display = "none";
    submitBtn.disabled = false;
  }
}

// Toggle password visibility
function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  const button = event.target.closest('.toggle-password');
  const icon = button.querySelector('i');

  if (field.type === "password") {
    field.type = "text";
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    field.type = "password";
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// Validate on page load
document.addEventListener("DOMContentLoaded", () => {
  const token = getTokenFromURL();

  if (!token) {
    showMessage(
      "❌ Invalid reset link. Please request a new password reset.",
      "danger"
    );
    document.getElementById("resetForm").style.display = "none";
  }

  // Real-time password validation
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  newPasswordInput.addEventListener("input", validatePasswords);
  confirmPasswordInput.addEventListener("input", validatePasswords);
});

// Validate passwords in real-time
function validatePasswords() {
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const matchIndicator = document.getElementById("matchIndicator");
  const reqLength = document.getElementById("req-length");
  const reqMatch = document.getElementById("req-match");
  const submitBtn = document.getElementById("submitBtn");

  // Check length requirement
  if (newPassword.length >= 6) {
    reqLength.style.color = "#2e7d32";
    reqLength.innerHTML = '<i class="fas fa-check"></i> At least 6 characters';
  } else {
    reqLength.style.color = "#c62828";
    reqLength.innerHTML = '<i class="fas fa-times"></i> At least 6 characters';
  }

  // Check match requirement
  if (newPassword && confirmPassword) {
    if (newPassword === confirmPassword) {
      matchIndicator.className = "match-indicator match";
      matchIndicator.innerHTML =
        '<span class="match-icon"><i class="fas fa-check-circle"></i></span> Passwords match';
      reqMatch.style.color = "#2e7d32";
      reqMatch.innerHTML = '<i class="fas fa-check"></i> Passwords must match';
    } else {
      matchIndicator.className = "match-indicator no-match";
      matchIndicator.innerHTML =
        '<span class="match-icon"><i class="fas fa-times-circle"></i></span> Passwords do not match';
      reqMatch.style.color = "#c62828";
      reqMatch.innerHTML = '<i class="fas fa-times"></i> Passwords must match';
    }
  } else {
    matchIndicator.innerHTML = "";
    reqMatch.style.color = "#666";
    reqMatch.innerHTML = 'Passwords must match';
  }

  // Enable/disable submit button
  submitBtn.disabled = !(newPassword.length >= 6 && newPassword === confirmPassword);
}

// Handle form submission
document.getElementById("resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = getTokenFromURL();
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // Validate passwords match
  if (newPassword !== confirmPassword) {
    showMessage("❌ Passwords do not match. Please try again.", "danger");
    return;
  }

  // Validate password length
  if (newPassword.length < 6) {
    showMessage("❌ Password must be at least 6 characters long.", "danger");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch("/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: token,
        newPassword: newPassword,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(
        "✅ Password reset successfully! Redirecting to login...",
        "success"
      );
      document.getElementById("resetForm").style.display = "none";

      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } else {
      showMessage(
        `❌ ${data.error || "Failed to reset password. Please try again."}`,
        "danger"
      );
    }
  } catch (err) {
    console.error("Reset password error:", err);
    showMessage(
      "❌ An error occurred. Please check your connection and try again.",
      "danger"
    );
  } finally {
    setLoading(false);
  }
});
