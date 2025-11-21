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
function openForgotPasswordModal(event) {
  event.preventDefault();
  const modal = document.getElementById("forgotPasswordModal");
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeForgotPasswordModal() {
  const modal = document.getElementById("forgotPasswordModal");
  modal.style.display = "none";
  document.body.style.overflow = "auto";
  document.getElementById("forgotPasswordForm").reset();
  document.getElementById("forgotPasswordMessage").innerHTML = "";
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
    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("resetEmail").value;
      const messageDiv = document.getElementById("forgotPasswordMessage");
      const submitBtn = forgotPasswordForm.querySelector(".btn-submit");

      // Disable button and show loading state
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";

      try {
        const response = await fetch("/auth/forgot-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (response.ok) {
          messageDiv.innerHTML = `
            <div class="alert alert-success">
              ✅ Reset link sent! Check your email for instructions.
            </div>
          `;
          forgotPasswordForm.reset();

          // Close modal after 2 seconds
          setTimeout(() => {
            closeForgotPasswordModal();
          }, 2000);
        } else {
          messageDiv.innerHTML = `
            <div class="alert alert-danger">
              ❌ ${data.error || "Failed to send reset link. Please try again."}
            </div>
          `;
        }
      } catch (error) {
        console.error("Forgot password error:", error);
        messageDiv.innerHTML = `
          <div class="alert alert-danger">
            ❌ An error occurred. Please check your connection and try again.
          </div>
        `;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Reset Link";
      }
    });
  }
});
