import React, { useEffect, useState } from "react";
import {
  View, Text, KeyboardAvoidingView, Platform, Alert, ScrollView, Pressable,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { GraduationCap } from "lucide-react-native";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useTheme } from "../../hooks/useTheme";
import { login, clearNotice } from "../../redux/slices/authSlice";
import { apiResendOtp } from "../../api/auth";
import { errorMessage } from "../../api/client";
import type { AppDispatch, RootState } from "../../redux/store";

export default function LoginScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { C } = useTheme();
  const loading = useSelector((s: RootState) => s.auth.loading);
  // A stored staff/admin session that restoreSession refused.
  const notice = useSelector((s: RootState) => s.auth.notice);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!notice) return;
    Alert.alert("Students only", notice);
    dispatch(clearNotice());
  }, [notice, dispatch]);

  const onSubmit = async () => {
    if (!email.trim() || !password) return Alert.alert("Both fields required");
    const r = await dispatch(login({ email, password }));
    if (!login.rejected.match(r)) return; // navigator switches on the new token

    const f = r.payload;
    if (f?.needsVerification && f.email) {
      // Unverified account: send a fresh code and continue on the OTP step.
      let justSent = false;
      try {
        await apiResendOtp(f.email);
        justSent = true;
        Alert.alert("Verify your email", "Your email isn't verified yet. We sent you a new code.");
      } catch (e) {
        Alert.alert("Verify your email", errorMessage(e, f.message));
      }
      navigation.navigate("OtpVerify", { email: f.email, cooldown: justSent ? 60 : 0 });
      return;
    }
    Alert.alert(
      f?.notStudent ? "Students only" : f?.blocked ? "Account blocked" : "Login failed",
      f?.message || "Login failed"
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 80 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 14,
            backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
          }}>
            <GraduationCap color={C.onPrimary} size={32} />
          </View>
          <Text style={{ color: C.heading, fontSize: 22, fontWeight: "800", marginTop: 12 }}>
            UniAssist
          </Text>
          <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
            MAJU University Assistant — for students
          </Text>
        </View>

        <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none"
          autoCorrect={false} keyboardType="email-address" autoComplete="email"
          placeholder="sp23bscs0178@maju.edu.pk" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry
          autoComplete="password" placeholder="Your password" onSubmitEditing={onSubmit} />

        <Button title="Sign in" onPress={onSubmit} loading={loading} loadingTitle="Signing in…" style={{ marginTop: 4 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
          <Pressable onPress={() => navigation.navigate("ForgotPassword", { email: email.trim() })}>
            <Text style={{ color: C.link, fontSize: 13 }}>Forgot password?</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Register")}>
            <Text style={{ color: C.link, fontSize: 13 }}>Create account →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
