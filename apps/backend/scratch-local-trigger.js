const axios = require("axios");

async function triggerLocalOTP() {
  const url = "http://localhost:5000/auth/otp/initiate";
  const payload = {
    email: "brianonyango229@gmail.com",
    dob: "2000-01-01"
  };

  console.log(`Sending POST request to local server ${url}...`);
  try {
    const response = await axios.post(url, payload);
    console.log("Status Code:", response.status);
    console.log("Response Data:", response.data);
  } catch (error) {
    if (error.response) {
      console.error("Local Server Error Response Code:", error.response.status);
      console.error("Local Server Error Response Data:", error.response.data);
    } else {
      console.error("Local Request Error:", error.message);
    }
  }
}

triggerLocalOTP();
