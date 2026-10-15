import React, { createContext, useContext } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";

// Manrope (same as the web). Load these with expo-font's useFonts.
export const fontAssets = {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
};

// React Native can't pick a weight out of one custom family (Android ignores
// fontWeight), so each weight maps to its own Manrope file.
const familyFor = (weight: unknown): string => {
  const w = weight === "bold" ? 700 : weight === "normal" || weight == null ? 400 : Number(weight) || 400;
  if (w >= 800) return "Manrope_800ExtraBold";
  if (w >= 700) return "Manrope_700Bold";
  if (w >= 600) return "Manrope_600SemiBold";
  if (w >= 500) return "Manrope_500Medium";
  return "Manrope_400Regular";
};

// The family of the enclosing <Text>, so nested text without its own weight
// keeps inheriting (e.g. a plain span inside a bold line stays bold).
const ParentFont = createContext<string | null>(null);

let applied = false;

/**
 * Makes every <Text> and <TextInput> render in Manrope, turning `fontWeight`
 * into the matching Manrope family. Explicit non-Manrope families (e.g.
 * monospace) are left alone. Call once, before the first render.
 */
export const applyGlobalFont = () => {
  if (applied) return;
  applied = true;
  for (const Comp of [Text, TextInput] as any[]) {
    const render = Comp.render;
    if (typeof render !== "function") continue;
    Comp.render = function patchedRender(props: any, ref: any) {
      const parent = useContext(ParentFont);
      const flat = StyleSheet.flatten(props.style) || {};
      if (flat.fontFamily && !String(flat.fontFamily).startsWith("Manrope")) {
        return render.call(this, props, ref);
      }
      const { fontWeight, ...rest } = flat;
      // Own weight → its family; nested without a weight → inherit; else Regular.
      const family = fontWeight != null ? familyFor(fontWeight) : Comp === Text && parent ? null : familyFor(null);
      const style = family ? [rest, { fontFamily: family }] : rest;
      return (
        <ParentFont.Provider value={family ?? parent}>
          {render.call(this, { ...props, style }, ref)}
        </ParentFont.Provider>
      );
    };
  }
};
