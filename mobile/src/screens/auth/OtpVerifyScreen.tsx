import React, { useState } from "react";
import { View, Text, TextInput, Alert } from "react-native";
import { useDispatch } from "react-redux";
import { Button } from "../../components/Button";
import { useTheme } from "../../hooks/useTheme";
import { useCountdown } from "../../hooks/useCountdown";
import { apiVerifyOtp, apiResendOtp } from "../../api/auth";
import { errorMessage } from "../../api/client";
import { startSession } from "../../redux/slices/authSlice";
import type { AppDispatch } from "../../redux/store";

export default function OtpVerifyScreen({ navigation, route }: any) {
  const { C } = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const email: string = route.params?.email || "";
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useCountdown(Number(route.params?.cooldown) || 0);

  const onVerify = async () => {
    if (!/^\d{6}$/.test(otp)) return Alert.alert("Enter the 6-digit code");
    setLoading(true);
    try {
      const { data } = await apiVerifyOtp(email, otp);
      if (data?.success && data.token) {
        // Verification returns a session; the navigator switches to the app.
        const r = await dispatch(startSession({ token: data.token, user: data.user }));
        if (startSession.rejected.match(r)) {
          Alert.alert("Students only", r.payload || "This account can't be used in the mobile app.");
          navigation.navigate("Login");
        }
        return;
      }
      Alert.alert("Verification failed", data?.message || "Try again");
    } catch (e: any) {
      const body = e?.response?.data || {};
      if (body.requiresNewOtp) {
        setOtp("");
        Alert.alert("Request a new code", body.message || "This code can no longer be used.");
      } else if (typeof body.attemptsRemaining === "number") {
        Alert.alert(
          "Invalid code",
          `${body.attemptsRemaining} attempt${body.attemptsRemaining === 1 ? "" : "s"} remaining.`
        );
      } else {
        Alert.alert("Verification failed", errorMessage(e, "Try again"));
      }
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    try {
      await apiResendOtp(email);
      setCooldown(60);
      Alert.alert("Code sent", "Check your inbox and spam folder.");
    } catch (e: any) {
      const retryAfter = Number(e?.response?.data?.retryAfter);
      if (retryAfter > 0) setCooldown(retryAfter);
      Alert.alert("Couldn't resend", errorMessage(e, "Retry shortly"));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 80, backgroundColor: C.bg }}>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: "800" }}>Verify your email</Text>
      <Text style={{ color: C.muted, marginTop: 6 }}>
        Enter the 6-digit code sent to {email}. It expires in 5 minutes, so check your spam folder too.
      </Text>
      <TextInput
        value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, ""))}
        keyboardType="number-pad" maxLength={6} autoComplete="one-time-code"
        placeholder="••••••" placeholderTextColor={C.muted}
        style={{
          backgroundColor: C.input, color: C.text, borderColor: C.border, borderWidth: 1,
          borderRadius: 10, padding: 14, marginTop: 24, marginBottom: 16,
          fontSize: 20, textAlign: "center", letterSpacing: 8,
        }}
      />
      <Button title="Verify" onPress={onVerify} loading={loading} loadingTitle="Verifying…" />
      <Button
        title={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        onPress={onResend} loading={resending} disabled={cooldown > 0}
        variant="ghost" style={{ marginTop: 12 }}
      />
      <Button title="Back to sign in" onPress={() => navigation.navigate("Login")}
        variant="ghost" style={{ marginTop: 12 }} />
    </View>
  );
}
