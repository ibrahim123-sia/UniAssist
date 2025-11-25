import React, { useContext, useState } from "react";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resendingOtp, setResendingOtp] = useState(false);
  const [verified, setVerified] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post("/api/v1/auth/register", {
        name,
        email,
        password,
      });
      if (data?.success) {
        toast.success("OTP sent to your email");
        setStep(1);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post("/api/register/verify-otp", {
        email,
        otp: otp.replace(/\s/g, ""),
      });
      if (data?.success) {
        localStorage.setItem("token", data.token);
        toast.success("Registration successful");
      }
    } catch (error) {
      toast.error(error.response.data.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    try {
      const { data } = await axios.post("/api/user/resendotp", { email });

      if (data.success) {
        toast.success("New OTP sent to your email!");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setResendingOtp(false);
    }
  };



  return (
    <div>
      <h1>register</h1>
    </div>
  );
};

export default Register;
