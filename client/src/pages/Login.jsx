import React from "react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetStep, setResetStep] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post("/api/user/forgetpassword", {
        email: resetEmail,
      });
      if (data.success) {
        toast.success("OTP sent successfully");
        setResetStep(2);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post("/api/user/resetpassword", {
        email: resetEmail,
        otp: resetOtp,
        newPassword,
      });
      if (data.success) {
        toast.success("Password reset successfully");
        setResetStep(0);
        setResetEmail("");
        setResetOtp("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post("/api/user/login", { email, password });
      if (data.success) {
        setToken(data.token);
        localStorage.setItem("token", data.token);
        toast.success("Login successful!");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return <div></div>;
};

export default Login;
