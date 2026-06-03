const axios = require("axios");

async function triggerOTP() {
  const url = "https://storynest-qzwm.onrender.com/auth/otp/initiate";
  const payload = { email: "brianonyango229@gmail.com", dob: "2000-01-01" };
  console.log(`Sending POST to ${url}...`);
  try {
    const res = await axios.post(url, payload);
    console.log("Status:", res.status);
    console.log("Response:", res.data);
  } catch (err) {
    if (err.response) {
      console.error("Error status:", err.response.status);
      console.error("Error data:", err.response.data);
    } else {
      console.error("Request error:", err.message);
    }
  }
}

triggerOTP();
