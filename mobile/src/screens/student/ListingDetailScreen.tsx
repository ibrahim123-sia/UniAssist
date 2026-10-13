import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { ExternalLink, MapPin, Calendar, Clock } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import {
  DeadlineBadge, deadlineInfo, eventInfo, posterUri, registerUrl, EventStatusBadge,
  applyLinkUrl, openLink, OriginalPostLink,
} from "../../components/ListingParts";
import type { Listing } from "../../api/listings";

const Field = ({ label, value, C }: { label: string; value?: string | null; C: any }) =>
  value && String(value).trim() ? (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 }}>
      <Text style={{ color: C.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 12, fontWeight: "600", flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  ) : null;

const Section = ({ title, body, C }: { title: string; body?: string | null; C: any }) =>
  body && body.trim() ? (
    <Card style={{ marginTop: 12 }}>
      <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, marginBottom: 6 }}>{title}</Text>
      <Text selectable style={{ color: C.text, fontSize: 13, lineHeight: 19 }}>{body.trim()}</Text>
    </Card>
  ) : null;

const KIND_TITLES: Record<string, string> = { job: "Job", scholarship: "Scholarship", event: "Event" };

// Full-width poster at its own aspect ratio (known once it loads); hidden if
// the image can't be loaded.
const Poster = ({ uri, title, C }: { uri: string; title: string; C: any }) => {
  const [ratio, setRatio] = useState(4 / 3);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image source={{ uri }} resizeMode="contain" accessibilityLabel={`${title} poster`}
      onLoad={(e) => {
        const { width, height } = e.nativeEvent.source || ({} as any);
        if (width > 0 && height > 0) setRatio(Math.max(0.5, Math.min(2.5, width / height)));
      }}
      onError={() => setFailed(true)}
      style={{ width: "100%", aspectRatio: ratio, borderRadius: 14, backgroundColor: C.surfaceAlt, marginBottom: 12 }} />
  );
};

// Opened from the Jobs/Scholarships/Events lists and shows the list item it
// was given (the list already has every field; like the web, no per-item
// request). Opened without one, it goes back to the list.
export default function ListingDetailScreen({ route, navigation }: any) {
  const { C } = useTheme();
  const listing: Listing | null = route.params?.listing || null;

  useEffect(() => {
    if (!listing) {
      navigation.goBack();
      return;
    }
    navigation.setOptions({ title: KIND_TITLES[listing.kind] || "Details" });
  }, [navigation, listing]);

  if (!listing) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  const dl = deadlineInfo(listing.deadline);
  // "Apply" only for a separate application link; the source page is always
  // reachable through "Original post" (same rule as the web).
  const applyUrl = applyLinkUrl(listing);
  const job = listing.kind === "job";
  const event = listing.kind === "event";

  if (event) {
    const info = eventInfo(listing);
    const poster = posterUri(listing);
    // Register while registration is open (separate link only).
    const register = registerUrl(listing);
    return (
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        {poster ? <Poster uri={poster} title={listing.title} C={C} /> : null}
        <Card>
          <Text selectable style={{ color: C.text, fontWeight: "800", fontSize: 18 }}>{listing.title}</Text>
          {listing.organization ? (
            <Text style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>By {listing.organization}</Text>
          ) : null}
          <View style={{ marginTop: 10 }}><EventStatusBadge listing={listing} /></View>
          <View style={{ gap: 6, marginTop: 10 }}>
            {info ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Calendar color={C.muted} size={13} />
                <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>{info.dateLabel}</Text>
              </View>
            ) : null}
            {info?.timeLabel ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Clock color={C.muted} size={13} />
                <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>{info.timeLabel}</Text>
              </View>
            ) : null}
            {listing.location ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MapPin color={C.muted} size={13} />
                <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>{listing.location}</Text>
              </View>
            ) : null}
          </View>
          {dl && !info?.past ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
              <Text style={{ color: C.muted, fontSize: 12 }}>Registration deadline {dl.date}</Text>
              <DeadlineBadge deadline={listing.deadline} />
            </View>
          ) : null}
          {register ? (
            <Button title="Register" onPress={() => openLink(register)}
              icon={<ExternalLink color={C.onNavy} size={14} />} style={{ marginTop: 12 }} />
          ) : null}
          <OriginalPostLink listing={listing} style={{ marginTop: 12 }} />
        </Card>

        <Section title="About this event" body={listing.description} C={C} />
        <Section title="Requirements" body={listing.requirements} C={C} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
      <Card>
        <Text selectable style={{ color: C.text, fontWeight: "800", fontSize: 18 }}>{listing.title}</Text>
        {listing.organization ? (
          <Text style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>{listing.organization}</Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 10 }}>
          <DeadlineBadge deadline={listing.deadline} />
          {listing.location ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MapPin color={C.muted} size={12} />
              <Text style={{ color: C.muted, fontSize: 12 }}>{listing.location}</Text>
            </View>
          ) : null}
          {dl ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Calendar color={C.muted} size={12} />
              <Text style={{ color: C.muted, fontSize: 12 }}>Deadline {dl.date}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ marginTop: 10 }}>
          {job ? (
            <>
              <Field label="Employment type" value={listing.employmentType} C={C} />
              <Field label="Salary" value={listing.salary} C={C} />
            </>
          ) : (
            <>
              <Field label="Funding" value={listing.fundingType} C={C} />
              <Field label="Amount" value={listing.amount} C={C} />
              <Field label="Degree level" value={listing.degreeLevel} C={C} />
            </>
          )}
        </View>
        {applyUrl ? (
          <Button title={dl?.closed ? "Application page" : "Apply"} onPress={() => openLink(applyUrl)}
            icon={<ExternalLink color={C.onNavy} size={14} />} style={{ marginTop: 12 }} />
        ) : null}
        <OriginalPostLink listing={listing} style={{ marginTop: 12 }} />
      </Card>

      <Section title="Description" body={listing.description} C={C} />
      <Section title="Requirements" body={listing.requirements} C={C} />
      {!job ? <Section title="Eligibility" body={listing.eligibility} C={C} /> : null}
    </ScrollView>
  );
}
