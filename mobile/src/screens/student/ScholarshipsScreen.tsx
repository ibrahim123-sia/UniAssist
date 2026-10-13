import React from "react";
import ListingsScreen from "./ListingsScreen";

// Scholarships the admin added from links on the web portal
// (GET /api/listings?kind=scholarship).
export default function ScholarshipsScreen({ navigation }: any) {
  return <ListingsScreen kind="scholarship" navigation={navigation} />;
}
