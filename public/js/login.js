// Add console log to verify script is loaded
console.log("login.js loaded successfully");

const REMEMBER_EMAIL_KEY = "rememberedLoginEmail";

function hideAuthMessage() {
  const messageBox = document.getElementById("errorMessage");
  if (!messageBox) return;
  messageBox.style.display = "none";
  messageBox.textContent = "";
}

function showAuthMessage(message, type = "error") {
  const messageBox = document.getElementById("errorMessage");
  if (!messageBox) {
    alert(message);
    return;
  }

  messageBox.classList.remove("error-message", "success-message");
  messageBox.classList.add(type === "success" ? "success-message" : "error-message", "dismissible-alert");
  messageBox.innerHTML =
    '<span class="message-text"></span><button type="button" class="message-close-btn" aria-label="Dismiss message">&times;</button>';

  const textNode = messageBox.querySelector(".message-text");
  if (textNode) {
    textNode.textContent = message;
  }

  messageBox.style.display = "flex";
}

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Bind form submit
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleSubmit);
  }

  // Bind password toggle buttons
  document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      togglePasswordVisibility(targetId);
    });
  });

  // Bind forgot password link
  const forgotLink = document.getElementById('forgotPasswordLink');
  if (forgotLink) {
    forgotLink.addEventListener('click', function(e) {
      e.preventDefault();
      openForgotPasswordModal(e);
    });
  }

  // Bind Google sign in button
  const googleBtn = document.getElementById('googleSignInBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', signInWithGoogle);
  }

  // Bind modal overlay click
  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', closeForgotPasswordModal);
  }

  // Bind modal close button
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeForgotPasswordModal);
  }

  // Bind back to login link
  const backToLoginLink = document.getElementById('backToLoginLink');
  if (backToLoginLink) {
    backToLoginLink.addEventListener('click', function(e) {
      e.preventDefault();
      closeForgotPasswordModal();
      return false;
    });
  }

  const rememberMeInput = document.getElementById("rememberMe");
  const emailInput = document.getElementById("email");
  const rememberedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
  if (rememberMeInput && emailInput && rememberedEmail) {
    rememberMeInput.checked = true;
    emailInput.value = rememberedEmail;
  }

  const messageBox = document.getElementById("errorMessage");
  if (messageBox) {
    messageBox.addEventListener("click", (event) => {
      if (event.target && event.target.classList.contains("message-close-btn")) {
        hideAuthMessage();
      }
    });
  }
});

function togglePasswordVisibility(fieldId) {
  const passwordField = document.getElementById(fieldId);
  if (!passwordField) return;
  
  const button = passwordField.parentElement.querySelector('.toggle-password');
  const eyeIcon = button.querySelector('.eye-icon');
  
  if (passwordField.type === 'password') {
    passwordField.type = 'text';
    eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
  } else {
    passwordField.type = 'password';
    eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
  }
}

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
  hideAuthMessage();

  const emailInput = document.getElementById("email").value;
  const passwordInput = document.getElementById("password").value;
  const rememberMe = document.getElementById("rememberMe")?.checked || false;

  try {
    const response = await fetchWithCsrf("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: emailInput,
        password: passwordInput,
        rememberMe,
      }),
    });

    // Check if response is OK before parsing JSON
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      let errorMessage = "Login failed";
      
      if (contentType && contentType.includes("application/json")) {
        try {
          const errorData = await safeJsonParse(response);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error('[Login] Error parsing error response:', e);
          errorMessage = `Server error (${response.status}): ${e.message}`;
        }
      } else {
        // HTML error page returned
        errorMessage = `Server error (${response.status}): Server returned HTML instead of JSON. Please refresh and try again.`;
      }
      
      throw new Error(errorMessage);
    }

    // Safely parse success response
    const data = await safeJsonParse(response);

    if (data.success) {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, emailInput);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

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
        // Route based on user role and admin type
        if (data.userRole === "admin") {
          // Route admins based on their specific role
          if (data.role === "super_admin") {
            window.location.href = "/super-admin-dashboard";
          } else {
            // system_admin or other admin roles
            window.location.href = "/admin-dashboard";
          }
        } else {
          // Student login
          window.location.href = "/student-dashboard";
        }
      }, 500);
    } else {
      showAuthMessage("Invalid email or password. Please try again.");
    }
  } catch (error) {
    console.error("Error:", error);
    showAuthMessage(error.message || "An error occurred during login. Please try again.");
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
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  } else {
    console.error("Forgot password modal not found");
  }
}

function closeForgotPasswordModal() {
  console.log("Closing forgot password modal"); // Debug log
  const modal = document.getElementById("forgotPasswordModal");
  if (modal) {
    modal.style.display = "none";
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
    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("Forgot password form submitted"); // Debug log
      
      const emailInput = document.getElementById("resetEmail");
      const email = emailInput ? emailInput.value : "";
      const messageDiv = document.getElementById("forgotPasswordMessage");
      const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');

      if (!email) {
        console.error("Email input not found or empty");
        if (messageDiv) {
          messageDiv.style.display = "block";
          messageDiv.className = "forgot-message error";
          messageDiv.textContent = " Please enter your email address.";
        }
        return;
      }

      console.log("Sending reset link to:", email); // Debug log

      // Disable button and show loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
          Sending...
        `;
      }

      try {
        const doFetch = typeof fetchWithCsrf === "function" ? fetchWithCsrf : fetch;
        const response = await doFetch("/auth/forgot-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();
        console.log("Response from server:", data); // Debug log

        if (messageDiv) {
          messageDiv.style.display = "block";
        }

        if (response.ok) {
          if (messageDiv) {
            messageDiv.className = "forgot-message success";
            messageDiv.textContent = " Reset link sent! Check your email for instructions.";
          }
          forgotPasswordForm.reset();

          // Close modal after 3 seconds
          setTimeout(() => {
            closeForgotPasswordModal();
            if (messageDiv) {
              messageDiv.style.display = "none";
              messageDiv.textContent = "";
              messageDiv.className = "forgot-message";
            }
          }, 3000);
        } else {
          if (messageDiv) {
            messageDiv.className = "forgot-message error";
            messageDiv.textContent = ` ${data.error || "Failed to send reset link. Please try again."}`;
          }
        }
      } catch (error) {
        console.error("Forgot password error:", error);
        if (messageDiv) {
          messageDiv.style.display = "block";
          messageDiv.className = "forgot-message error";
          messageDiv.textContent = " An error occurred. Please check your connection and try again.";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Send Reset Link
          `;
        }
      }
    });
  }
});

//  Google OAuth Sign In
function signInWithGoogle() {
  window.location.href = '/auth/google';
}