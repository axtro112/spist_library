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
        year_level: yearLevel,
        student_type: studentType,
        contact_number: contactNumber.trim(),
        status: "active", // Setting a default status for new accounts
      };

      // Debug log to check request data
      console.log("Form data being sent:", formData);

      const response = await fetch("/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Server response:", data);

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
