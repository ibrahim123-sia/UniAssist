import React, { useState } from "react";
import { Text, Alert, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useTheme } from "../../hooks/useTheme";
import { apiRegister } from "../../api/auth";
import { errorMessage } from "../../api/client";
import { isStudentEmail, STUDENT_EMAIL_HINT } from "../../utils/validation";

export default function RegisterScreen({ navigation }: any) {
  const { C } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const trimmedName = name.trim();
    const normalized = email.trim().toLowerCase();
    if (!trimmedName || !normalized || !password) return Alert.alert("All fields required");
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return Alert.alert("Name must be between 2 and 80 characters");
    }
    if (!isStudentEmail(normalized)) return Alert.alert("Invalid email", STUDENT_EMAIL_HINT);
    if (password.length < 6) return Alert.alert("Password must be at least 6 characters");
    if (password !== confirm) return Alert.alert("Passwords don't match");

    setLoading(true);
    try {
      await apiRegister(trimmedName, normalized, password);
      navigation.navigate("OtpVerify", { email: normalized, cooldown: 60 });
    } catch (e: any) {
      if (e?.response?.status === 429) {
        // A code for this email is still live — enter it instead of re-registering.
        Alert.alert("Code already sent", errorMessage(e));
        navigation.navigate("OtpVerify", { email: normalized });
      } else {
        // 503 = the university email isn't configured yet; the server's
        // message says so.
        Alert.alert("Registration failed", errorMessage(e, "Try again"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: C.text, fontSize: 22, fontWeight: "800" }}>Create your account</Text>
        <Text style={{ color: C.muted, marginTop: 4, marginBottom: 20 }}>
          {STUDENT_EMAIL_HINT}.
        </Text>

        <Input label="Full name" value={name} onChangeText={setName} maxLength={80} />
        <Input label="Student email" value={email} onChangeText={setEmail}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
        <Input label="Password (min 6)" value={password} onChangeText={setPassword} secureTextEntry />
        <Input label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry />

        <Button title="Create account" onPress={onSubmit} loading={loading} loadingTitle="Sending code…" />
        <Pressable onPress={() => navigation.navigate("Login")} style={{ alignItems: "center", marginTop: 18 }}>
          <Text style={{ color: C.link }}>Already have an account? Sign in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
