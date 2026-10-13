import React from "react";
import ListingsScreen from "./ListingsScreen";

// Events the admin added from links or by hand on the web portal
// (GET /api/listings?kind=event): Upcoming by default, Past on request.
export default function EventsScreen({ navigation }: any) {
  return <ListingsScreen kind="event" navigation={navigation} />;
}
