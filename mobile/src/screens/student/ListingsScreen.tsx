import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, FlatList, RefreshControl, TextInput, Pressable, ActivityIndicator, Image,
} from "react-native";
import {
  Briefcase, Award, Search, AlertCircle, MapPin, Calendar, Clock, CalendarDays, ExternalLink,
} from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { FilterChip } from "../../components/FilterChip";
import {
  DeadlineBadge, deadlineInfo, listingTypeLine, eventInfo, posterUri, registerUrl,
  EventDateBadge, EventStatusBadge, OriginalPostLink, openLink,
} from "../../components/ListingParts";
import { apiListListings, type Listing, type ListingKind } from "../../api/listings";
import { errorMessage } from "../../api/client";
import type { Palette } from "../../theme/palette";

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 400;

const NOUNS: Record<ListingKind, string> = { job: "job", scholarship: "scholarship", event: "event" };
const PLACEHOLDERS: Record<ListingKind, string> = {
  job: "Search title, company, location",
  scholarship: "Search title, organization, level",
  event: "Search title, organizer, venue",
};

const MetaRow = ({ icon, text, C }: { icon: React.ReactNode; text: string; C: Palette }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
    {icon}
    <Text style={{ color: C.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>{text}</Text>
  </View>
);

// Poster, date block, time, venue, organizer and a Register button while
// registration is open. Tapping the card opens the detail screen.
const EventCard = ({ item, C, onPress }: { item: Listing; C: Palette; onPress: () => void }) => {
  const info = eventInfo(item);
  const poster = posterUri(item);
  const [posterFailed, setPosterFailed] = useState(false);
  const register = registerUrl(item);
  return (
    <Pressable onPress={onPress} style={{ marginHorizontal: 14, marginBottom: 10 }}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {poster && !posterFailed ? (
          <Image source={{ uri: poster }} onError={() => setPosterFailed(true)} resizeMode="cover"
            accessibilityLabel={`${item.title} poster`}
            style={{ width: "100%", height: 150, backgroundColor: C.surfaceAlt, opacity: info?.past ? 0.7 : 1 }} />
        ) : null}
        <View style={{ padding: 14 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <EventDateBadge listing={item} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, flex: 1 }} numberOfLines={2}>
                  {item.title}
                </Text>
                <EventStatusBadge listing={item} />
              </View>
              {item.organization ? (
                <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{item.organization}</Text>
              ) : null}
            </View>
          </View>
          <View style={{ gap: 4, marginTop: 10 }}>
            {info ? <MetaRow icon={<Calendar color={C.muted} size={12} />} text={info.dateLabel} C={C} /> : null}
            {info?.timeLabel ? <MetaRow icon={<Clock color={C.muted} size={12} />} text={info.timeLabel} C={C} /> : null}
            {item.location ? <MetaRow icon={<MapPin color={C.muted} size={12} />} text={item.location} C={C} /> : null}
          </View>
          {register ? (
            <Pressable onPress={() => openLink(register)}
              accessibilityRole="button" accessibilityLabel={`Register for ${item.title}`}
              style={{
                marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 6, backgroundColor: C.navy, paddingVertical: 9, borderRadius: 10,
              }}>
              <ExternalLink color={C.onNavy} size={14} />
              <Text style={{ color: C.onNavy, fontWeight: "600", fontSize: 13 }}>Register</Text>
            </Pressable>
          ) : null}
          <OriginalPostLink listing={item} style={{ marginTop: 10 }} />
        </View>
      </Card>
    </Pressable>
  );
};

// Shared by the Jobs, Scholarships and Events tabs: published listings the
// admin added from links on the web portal (GET /api/listings, same params as
// the web: includeExpired=true for "Show closed", past=true for past events).
export default function ListingsScreen({ kind, navigation }: { kind: ListingKind; navigation: any }) {
  const { C } = useTheme();
  const noun = NOUNS[kind];
  const Icon = kind === "job" ? Briefcase : kind === "scholarship" ? Award : CalendarDays;
  const isEvent = kind === "event";

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  // Events: Upcoming (default) or Past.
  const [past, setPast] = useState(false);
  // Jobs/scholarships: also list ones whose deadline has passed.
  const [showClosed, setShowClosed] = useState(false);
  // Only a pull shows the refresh spinner, not a search or filter change.
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Listing[]>([]);
  // Server rows read so far.
  const [fetched, setFetched] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Responses for an older search/refresh are dropped.
  const requestRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const pastView = isEvent && past;
  const closedToo = !isEvent && showClosed;

  // Reads one server page from `offset`.
  const fetchFrom = useCallback(async (offset: number) => {
    const { data } = await apiListListings({
      kind, limit: PAGE_SIZE, offset,
      ...(query ? { search: query } : {}),
      ...(pastView ? { past: true } : {}),
      ...(closedToo ? { includeExpired: true } : {}),
    });
    const kept: Listing[] = data?.listings || [];
    return { kept, next: offset + kept.length, count: data?.total ?? 0 };
  }, [kind, query, pastView, closedToo]);

  const load = useCallback(async () => {
    const req = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const { kept, next, count } = await fetchFrom(0);
      if (req !== requestRef.current) return;
      setItems(kept);
      setFetched(next);
      setTotal(count);
    } catch (e) {
      if (req === requestRef.current) setError(errorMessage(e, `Couldn't load ${noun}s`));
    } finally {
      if (req === requestRef.current) setLoading(false);
    }
  }, [fetchFrom, noun]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loading || loadingMore || fetched >= total) return;
    const req = requestRef.current;
    setLoadingMore(true);
    try {
      const { kept, next, count } = await fetchFrom(fetched);
      if (req !== requestRef.current) return;
      const seen = new Set(items.map((l) => l._id));
      setItems((prev) => [...prev, ...kept.filter((l) => !seen.has(l._id))]);
      setFetched(next);
      setTotal(count);
    } catch {
      // Scrolling again retries.
    } finally {
      setLoadingMore(false);
    }
  };

  const countLine = `${total} ${isEvent ? (pastView ? "past " : "upcoming ") : closedToo ? "" : "open "}${noun}${total === 1 ? "" : "s"}${query ? ` matching "${query}"` : ""}`;

  // The detail screen shows the list item itself (no extra request).
  const openDetail = (item: Listing) => navigation.navigate("ListingDetail", { listing: item });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: C.input, borderColor: C.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10,
        }}>
          <Search color={C.muted} size={14} />
          <TextInput value={search} onChangeText={setSearch} autoCorrect={false} returnKeyType="search"
            placeholder={PLACEHOLDERS[kind]}
            placeholderTextColor={C.muted}
            style={{ flex: 1, color: C.text, paddingVertical: 9 }} />
        </View>
        <View style={{ flexDirection: "row", marginTop: 10 }}>
          {isEvent ? (
            <>
              <FilterChip label="Upcoming" active={!past} onPress={() => setPast(false)} />
              <FilterChip label="Past" active={past} onPress={() => setPast(true)} />
            </>
          ) : (
            <>
              <FilterChip label="Open" active={!showClosed} onPress={() => setShowClosed(false)} />
              <FilterChip label="Show closed" active={showClosed} onPress={() => setShowClosed(true)} />
            </>
          )}
        </View>
        {!error && !loading ? (
          <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{countLine}</Text>
        ) : null}
        {error && items.length > 0 ? (
          <Text style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{error}. Pull down to retry.</Text>
        ) : null}
      </View>

      {error && items.length === 0 ? (
        <View style={{ padding: 14 }}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AlertCircle color={C.red} size={16} />
              <Text style={{ color: C.text, flex: 1 }}>{error}</Text>
            </View>
            <Pressable onPress={load} style={{ marginTop: 10 }}>
              <Text style={{ color: C.navy, fontWeight: "600" }}>Try again</Text>
            </Pressable>
          </Card>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(l) => l._id}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => {
            if (item.kind === "event") {
              return <EventCard item={item} C={C} onPress={() => openDetail(item)} />;
            }
            const typeLine = listingTypeLine(item);
            const dl = deadlineInfo(item.deadline);
            return (
              <Pressable onPress={() => openDetail(item)} style={{ marginHorizontal: 14, marginBottom: 10 }}>
                <Card>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, flex: 1 }} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <DeadlineBadge deadline={item.deadline} />
                  </View>
                  {item.organization ? (
                    <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{item.organization}</Text>
                  ) : null}
                  {item.location || dl ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                      {item.location ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <MapPin color={C.muted} size={12} />
                          <Text style={{ color: C.muted, fontSize: 12 }}>{item.location}</Text>
                        </View>
                      ) : null}
                      {dl ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Calendar color={C.muted} size={12} />
                          <Text style={{ color: C.muted, fontSize: 12 }}>Deadline {dl.date}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  {typeLine ? <Text style={{ color: C.text, fontSize: 12, marginTop: 6 }}>{typeLine}</Text> : null}
                  {item.description ? (
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }} numberOfLines={3}>
                      {item.description}
                    </Text>
                  ) : null}
                  <OriginalPostLink listing={item} style={{ marginTop: 8 }} />
                </Card>
              </Pressable>
            );
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={C.navy} style={{ marginTop: 30 }} />
            ) : (
              <EmptyState icon={<Icon color={C.muted} size={48} />}
                title={query ? `No ${noun}s found`
                  : isEvent ? (past ? "No past events." : "No upcoming events.")
                  : showClosed ? `No ${noun}s posted yet.` : `No open ${noun}s right now.`}
                description={query ? "Try a different search."
                  : !isEvent && !showClosed ? 'Tap "Show closed" to see past ones, or pull down to refresh.'
                  : "Pull down to refresh."} />
            )
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={C.muted} style={{ marginVertical: 12 }} /> : null}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 30 }}
        />
      )}
    </View>
  );
}
