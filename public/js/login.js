// Add console log to verify script is loaded
console.log("login.js loaded successfully");

function login() {
  const body = document.body;
  body.classList.add("fade-out");

  setTimeout(() => {
    window.location.href = "/login";
  }, 500);
}

function signup() {
  const body = document.body;
  body.classList.add("fade-out");

  setTimeout(() => {
    window.location.href = "/signup";
  }, 500);
}

document.querySelectorAll(".primaryNavigation a").forEach((link) => {
  link.addEventListener("click", function (event) {
    event.preventDefault();
    const body = document.body;
    body.classList.add("fade-out");

    setTimeout(() => {
      window.location.href = this.getAttribute("href");
    }, 500);
  });
});

async function handleSubmit(event) {
  event.preventDefault();

  const emailInput = document.getElementById("email").value;
  const passwordInput = document.getElementById("password").value;

  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: emailInput,
        password: passwordInput,
      }),
    });

    const data = await response.json();

    if (data.success) {
      sessionStorage.setItem("isLoggedIn", "true");
      sessionStorage.setItem("userRole", data.userRole);
      if (data.studentId) {
        sessionStorage.setItem("studentId", data.studentId);
      }
      if (data.adminId) {
        sessionStorage.setItem("adminId", data.adminId);
        sessionStorage.setItem("adminRole", data.role);
      }

      const form = event.target;
      form.classList.add("fade-out");

      setTimeout(() => {
        window.location.href =
          data.userRole === "admin" ? "/admin-dashboard" : "/student-dashboard";
      }, 500);
    } else {
      alert("Invalid email or password. Please try again.");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred during login. Please try again.");
  }
}

function redirectToSignup(event) {
  event.preventDefault();
  const signupLink = event.target;
  signupLink.classList.add("fade-out");

  setTimeout(() => {
    window.location.href = "/signup";
  }, 500);
}

function redirectToLogin(event) {
  if (event) event.preventDefault();
  window.location.href = "/login";
}

document.addEventListener("DOMContentLoaded", () => {
  const showPasswordCheckbox = document.getElementById("showPassword");
  const passwordInput = document.getElementById("password");

  if (showPasswordCheckbox && passwordInput) {
    showPasswordCheckbox.addEventListener("change", () => {
      passwordInput.type = showPasswordCheckbox.checked ? "text" : "password";
    });
  }
});

function logout() {
  sessionStorage.removeItem("isLoggedIn");
  sessionStorage.removeItem("userRole");
  sessionStorage.removeItem("userName");

  window.location.href = "/login";
}

// Forgot Password Modal Functions
// IMPORTANT: Use classList.remove('hidden') instead of style.display
// because the modal has .hidden class with !important in CSS

function openForgotPasswordModal(event) {
  event.preventDefault();
  console.log("Opening forgot password modal"); // Debug log
  const modal = document.getElementById("forgotPasswordModal");
  if (modal) {
    modal.classList.remove("hidden"); // Remove hidden class instead of setting display
    document.body.style.overflow = "hidden";
  } else {
    console.error("Forgot password modal not found");
  }
}

function closeForgotPasswordModal() {
  console.log("Closing forgot password modal"); // Debug log
  const modal = document.getElementById("forgotPasswordModal");
  if (modal) {
    modal.classList.add("hidden"); // Add hidden class instead of setting display
    document.body.style.overflow = "auto";
    const form = document.getElementById("forgotPasswordForm");
    const messageDiv = document.getElementById("forgotPasswordMessage");
    if (form) form.reset();
    if (messageDiv) messageDiv.innerHTML = "";
  }
}

// Close modal when clicking outside of it
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("forgotPasswordModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeForgotPasswordModal();
      }
    });
  }

  // Handle forgot password form submission
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  if (forgotPasswordForm) {
    console.log("Forgot password form found, attaching event listener"); // Debug log
    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("Forgot password form submitted"); // Debug log
      
      const emailInput = document.getElementById("resetEmail");
      const email = emailInput ? emailInput.value : "";
      const messageDiv = document.getElementById("forgotPasswordMessage");
      const submitBtn = forgotPasswordForm.querySelector(".btn-submit");

      if (!email) {
        console.error("Email input not found or empty");
        if (messageDiv) {
          messageDiv.innerHTML = `
            <div class="alert alert-danger">
              ❌ Please enter your email address.
            </div>
          `;
        }
        return;
      }

      console.log("Sending reset link to:", email); // Debug log

      // Disable button and show loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }

      try {
        const response = await fetch("/auth/forgot-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();
        console.log("Response from server:", data); // Debug log

        if (response.ok) {
          if (messageDiv) {
            messageDiv.innerHTML = `
              <div class="alert alert-success">
                ✅ Reset link sent! Check your email for instructions.
              </div>
            `;
          }
          forgotPasswordForm.reset();

          // Close modal after 2 seconds
          setTimeout(() => {
            closeForgotPasswordModal();
          }, 2000);
        } else {
          if (messageDiv) {
            messageDiv.innerHTML = `
              <div class="alert alert-danger">
                ❌ ${data.error || "Failed to send reset link. Please try again."}
              </div>
            `;
          }
        }
      } catch (error) {
        console.error("Forgot password error:", error);
        if (messageDiv) {
          messageDiv.innerHTML = `
            <div class="alert alert-danger">
              ❌ An error occurred. Please check your connection and try again.
            </div>
          `;
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send Reset Link";
        }
      }
    });
  } else {
    console.error("Forgot password form not found in DOM");
  }
});
