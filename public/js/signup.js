// ================================================================
// STEP NAVIGATION FUNCTIONS - 3-Step Signup Wizard
// ================================================================

/**
 * Navigate to Step 2 (Academic Info)
 * Validates Step 1 fields before proceeding
 */
function goToStep2() {
  // Get Step 1 field values
  const fullname = document.getElementById("fullname").value.trim();
  const email = document.getElementById("email").value.trim();
  const studentId = document.getElementById("student_id").value.trim();

  // Validate Step 1 fields are not empty
  if (!fullname || !email || !studentId) {
    alert("Please fill in all fields before proceeding.");
    return;
  }

  // Validate email format
  const emailPattern = /c22-\d{4}-\d{2}@spist\.edu\.ph/;
  if (!emailPattern.test(email)) {
    alert("Please enter a valid SPIST email address (c22-xxxx-xx@spist.edu.ph)");
    return;
  }

  // Validate student ID format
  const studentIdPattern = /c22-\d{4}-\d{2}/;
  if (!studentIdPattern.test(studentId)) {
    alert("Please enter a valid Student ID (c22-xxxx-xx)");
    return;
  }

  // Hide Step 1, Show Step 2
  document.querySelector(".signup-step-1").style.display = "none";
  document.querySelector(".signup-step-2").style.display = "block";

  // Update step indicators
  document.getElementById("step-indicator-1").classList.remove("active");
  document.getElementById("step-indicator-2").classList.add("active");

  // Scroll to top of form
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Navigate to Step 3 (Security)
 * Validates Step 2 fields before proceeding
 */
function goToStep3() {
  // Get Step 2 field values
  const department = document.getElementById("department").value;
  const yearLevel = document.getElementById("year_level").value;
  const studentType = document.getElementById("student_type").value;

  // Validate Step 2 fields are not empty
  if (!department || !yearLevel || !studentType) {
    alert("Please fill in all academic information before proceeding.");
    return;
  }

  // Hide Step 2, Show Step 3
  document.querySelector(".signup-step-2").style.display = "none";
  document.querySelector(".signup-step-3").style.display = "block";

  // Update step indicators
  document.getElementById("step-indicator-2").classList.remove("active");
  document.getElementById("step-indicator-3").classList.add("active");

  // Scroll to top of form
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Navigate back to Step 1 (Identity)
 * Preserves all input values
 */
function goBackToStep1() {
  // Hide Step 2, Show Step 1
  document.querySelector(".signup-step-2").style.display = "none";
  document.querySelector(".signup-step-1").style.display = "block";

  // Update step indicators
  document.getElementById("step-indicator-2").classList.remove("active");
  document.getElementById("step-indicator-1").classList.add("active");

  // Scroll to top of form
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Navigate back to Step 2 (Academic Info)
 * Preserves all input values
 */
function goBackToStep2() {
  // Hide Step 3, Show Step 2
  document.querySelector(".signup-step-3").style.display = "none";
  document.querySelector(".signup-step-2").style.display = "block";

  // Update step indicators
  document.getElementById("step-indicator-3").classList.remove("active");
  document.getElementById("step-indicator-2").classList.add("active");

  // Scroll to top of form
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ================================================================
// EXISTING SIGNUP LOGIC (Preserved - No Changes)
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const showPasswordCheckbox = document.getElementById("showPassword");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  // Show/hide password functionality
  if (showPasswordCheckbox && passwordInput) {
    showPasswordCheckbox.addEventListener("change", () => {
      passwordInput.type = showPasswordCheckbox.checked ? "text" : "password";
      if (confirmPasswordInput) {
        confirmPasswordInput.type = showPasswordCheckbox.checked
          ? "text"
          : "password";
      }
    });
  }

  // Handle form submission
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullname = document.getElementById("fullname").value;
    const email = document.getElementById("email").value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const studentId = document.getElementById("student_id").value;
    const department = document.getElementById("department").value;
    const yearLevel = document.getElementById("year_level").value;
    const studentType = document.getElementById("student_type").value;
    const contactNumber = document.getElementById("contact_number").value;

    // Validate all required fields
    if (
      !fullname ||
      !email ||
      !password ||
      !studentId ||
      !department ||
      !yearLevel ||
      !studentType ||
      !contactNumber
    ) {
      alert("Please fill in all required fields");
      return;
    }

    // Debug log to check form values
    console.log("Form Values:", {
      fullname,
      email,
      password,
      student_id: studentId,
      department,
      year_level: yearLevel,
      student_type: studentType,
      contact_number: contactNumber,
    });

    // Basic validation
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    // Validate contact number format
    if (!/^[0-9]{11}$/.test(contactNumber)) {
      alert("Please enter a valid 11-digit contact number!");
      return;
    }

    try {
      const formData = {
        student_id: studentId.trim(),
        fullname: fullname.trim(),
        email: email.trim(),
        password: password,
        department: department.trim(),
        year_level: yearLevel.trim(),
        student_type: studentType.trim(),
        contact_number: contactNumber.trim(),
        status: "active", // Setting a default status for new accounts
      };

      // Debug log to check request data
      console.log("Form data being sent:", formData);

      const response = await fetchWithCsrf("/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      });

      // Get response data regardless of status
      const data = await response.json();
      console.log("Server response:", data);

      if (!response.ok) {
        // Show the actual error message from the server
        alert(data.message || `Error: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status} - ${data.message || 'Unknown error'}`);
      }

      if (data.success) {
        alert("Account created successfully! Please login.");
        // Fade out and redirect to login page
        form.classList.add("fade-out");
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
      } else {
        alert(data.message || "Error creating account. Please try again.");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred during signup. Please try again.");
    }
  });
});

// ✅ Google OAuth Sign Up
function signUpWithGoogle() {
  window.location.href = '/auth/google';
}
