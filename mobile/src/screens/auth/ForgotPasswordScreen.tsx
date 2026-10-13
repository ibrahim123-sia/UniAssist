import React, { useState } from "react";
import { Text, Alert, ScrollView } from "react-native";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useTheme } from "../../hooks/useTheme";
import { useCountdown } from "../../hooks/useCountdown";
import { apiForgotPassword, apiResetPassword } from "../../api/auth";
import { errorMessage } from "../../api/client";
import { isEmail } from "../../utils/validation";

export default function ForgotPasswordScreen({ navigation, route }: any) {
  const { C } = useTheme();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState<string>(route.params?.email || "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useCountdown(0);

  const normalized = email.trim().toLowerCase();

  const requestOtp = async () => {
    if (!isEmail(normalized)) return Alert.alert("Enter a valid email");
    setLoading(true);
    try {
      await apiForgotPassword(normalized);
      setCooldown(60);
      setStep("reset");
      Alert.alert("Check your email", "If an account exists for this email, a reset code has been sent.");
    } catch (e: any) {
      const retryAfter = Number(e?.response?.data?.retryAfter);
      if (e?.response?.status === 429 && retryAfter > 0) {
        // A code was sent moments ago, so let them enter it.
        setCooldown(retryAfter);
        setStep("reset");
      }
      // 503 = the university email isn't configured yet; the server's
      // message says so.
      Alert.alert("Couldn't send code", errorMessage(e, "Retry shortly"));
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    if (!/^\d{6}$/.test(otp)) return Alert.alert("Enter the 6-digit code");
    if (password.length < 6) return Alert.alert("Password must be at least 6 characters");
    if (password !== confirm) return Alert.alert("Passwords don't match");
    setLoading(true);
    try {
      await apiResetPassword(normalized, otp, password);
      Alert.alert("Password reset", "Sign in with your new password.");
      navigation.navigate("Login");
    } catch (e: any) {
      const left = e?.response?.data?.attemptsRemaining;
      Alert.alert(
        "Reset failed",
        typeof left === "number"
          ? `Invalid code. ${left} attempt${left === 1 ? "" : "s"} remaining.`
          : errorMessage(e, "Try again")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 24, paddingTop: 80 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: C.text, fontSize: 22, fontWeight: "800", marginBottom: 6 }}>Reset password</Text>
      {step === "request" ? (
        <>
          <Text style={{ color: C.muted, marginBottom: 20 }}>
            Enter your MAJU student email and we will send a reset code.
          </Text>
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none"
            autoCorrect={false} keyboardType="email-address" placeholder="sp23bscs0178@maju.edu.pk" />
          <Button title="Send code" onPress={requestOtp} loading={loading} loadingTitle="Sending…" />
        </>
      ) : (
        <>
          <Text style={{ color: C.muted, marginBottom: 20 }}>Enter the code sent to {normalized}.</Text>
          <Input label="Reset code" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, ""))}
            keyboardType="number-pad" maxLength={6} />
          <Input label="New password (min 6)" value={password} onChangeText={setPassword} secureTextEntry />
          <Input label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry />
          <Button title="Reset password" onPress={reset} loading={loading} />
          <Button
            title={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            onPress={requestOtp} disabled={cooldown > 0 || loading}
            variant="ghost" style={{ marginTop: 12 }}
          />
        </>
      )}
      <Button title="Back to sign in" onPress={() => navigation.navigate("Login")}
        variant="ghost" style={{ marginTop: 12 }} />
    </ScrollView>
  );
}
