import React from "react";
import ListingsScreen from "./ListingsScreen";

// Jobs the admin added from links on the web portal (GET /api/listings?kind=job).
export default function JobsScreen({ navigation }: any) {
  return <ListingsScreen kind="job" navigation={navigation} />;
}
