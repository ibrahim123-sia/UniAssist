import React, { useState, useEffect, useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import {
  Calendar,
  MapPin,
  Users,
  ExternalLink,
  Clock,
  Hash,
  AlertCircle,
  Filter,
} from "lucide-react";
import axios from "axios";
import moment from "moment";

const Events = () => {
  const { theme } = useAppContext();
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeClubFilter, setActiveClubFilter] = useState("all");
  const [activeTimeFilter, setActiveTimeFilter] = useState("all");

  // Your Apify API endpoint
  const APIFY_API_URL = import.meta.env.VITE_APIFY_API_URL;

  // Club filters
  const clubFilters = [
    { id: "all", name: "All Events", icon: Users },
    {
      id: "maju",
      name: "MAJU Official",
      color: "bg-blue-100 dark:bg-blue-900/30",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      id: "acm",
      name: "ACM MAJU",
      color: "bg-purple-100 dark:bg-purple-900/30",
      textColor: "text-purple-600 dark:text-purple-400",
    },
    {
      id: "mlsa",
      name: "MLSA MAJU",
      color: "bg-green-100 dark:bg-green-900/30",
      textColor: "text-green-600 dark:text-green-400",
    },
    {
      id: "gdg",
      name: "GDG MAJU",
      color: "bg-red-100 dark:bg-red-900/30",
      textColor: "text-red-600 dark:text-red-400",
    },
  ];

  // Time filters
  const timeFilters = [
    { id: "all", name: "All Events" },
    { id: "upcoming", name: "Upcoming" },
    { id: "ongoing", name: "Ongoing" },
    { id: "past", name: "Past Events" },
  ];

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [events, activeClubFilter, activeTimeFilter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(APIFY_API_URL);

      console.log("API Response:", response.data);

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error("Invalid data format from API");
      }

      // Get current date and 30 days ago
      const now = moment();
      const thirtyDaysAgo = moment().subtract(30, "days");

      // Process and map the data
      const processedEvents = response.data
        .map((event, index) => {
          const text = event.text || event.description || event.content || "";
          const url = event.url || event.link || event.postUrl || "";
          const author = String(
            event.author || event.company || event.name || "Unknown"
          );
          const createdAt =
            event.createdAt || event.timestamp || event.date || new Date();

          // Check if post is within last 30 days
          const postDate = moment(createdAt);
          const isWithin30Days = postDate.isAfter(thirtyDaysAgo);

          // Skip posts older than 30 days
          if (!isWithin30Days) {
            return null;
          }

          // Extract date from text (multiple patterns)
          let eventDate = null;
          let eventDateText = "";
          let hasDate = false;

          // Pattern 1: "20th December 2025" format
          const dateMatch1 = text.match(
            /(\d{1,2})(?:st|nd|rd|th)?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*\s*\d{4}/i
          );

          // Pattern 2: "December 20, 2025" format
          const dateMatch2 = text.match(
            /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*\s*(\d{1,2}),?\s*\d{4}/i
          );

          // Pattern 3: "20/12/2025" or "12/20/2025" format
          const dateMatch3 = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/);

          // Pattern 4: "2025-12-20" format
          const dateMatch4 = text.match(/\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/);

          if (dateMatch1) {
            // Extract and clean the date string
            const day = dateMatch1[1];
            const month = dateMatch1[2].substring(0, 3);
            const yearMatch = text.match(
              new RegExp(dateMatch1[0] + ".*?(\\d{4})")
            );
            const year = yearMatch ? yearMatch[1] : new Date().getFullYear();
            eventDateText = `${parseInt(day)} ${month} ${year}`;
            eventDate = moment(eventDateText, "D MMM YYYY").toDate();
            hasDate = true;
          } else if (dateMatch2) {
            const month = dateMatch2[1].substring(0, 3);
            const day = dateMatch2[2];

            // extract year directly
            const year = dateMatch2[0].match(/\d{4}/)[0];

            eventDateText = `${day} ${month} ${year}`;
            eventDate = moment(eventDateText, "D MMM YYYY", true).toDate();
            hasDate = moment(eventDate).isValid();
          } else if (dateMatch3) {
            eventDateText = dateMatch3[0];
            eventDate = moment(eventDateText, [
              "DD/MM/YYYY",
              "MM/DD/YYYY",
              "DD-MM-YYYY",
              "MM-DD-YYYY",
            ]).toDate();
            hasDate = true;
          } else if (dateMatch4) {
            eventDateText = dateMatch4[0];
            eventDate = moment(eventDateText, "YYYY-MM-DD").toDate();
            hasDate = true;
          }

          // Determine event source
          let source = "maju";
          const lowerAuthor = author.toLowerCase();
          const lowerText = String(text).toLowerCase();

          if (
            lowerAuthor.includes("acm") ||
            lowerText.includes("acm") ||
            lowerText.includes("#acm")
          )
            source = "acm";
          else if (
            lowerAuthor.includes("mlsa") ||
            lowerAuthor.includes("microsoft learn") ||
            lowerText.includes("#mlsa") ||
            lowerText.includes("microsoft")
          )
            source = "mlsa";
          else if (
            lowerAuthor.includes("gdg") ||
            lowerText.includes("#gdg") ||
            lowerText.includes("google developer")
          )
            source = "gdg";
          else if (lowerAuthor.includes("maju") || lowerText.includes("maju"))
            source = "maju";

          // Extract hashtags
          const hashtags = text.match(/#\w+/g) || [];

          // Extract time
          const timeMatch =
            text.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\b/i) ||
            text.match(/\b\d{1,2}\s*(?:AM|PM|am|pm)\b/i);

          // Extract location - multiple patterns
          let location = "MAJU"; // Default location

          const locationPatterns = [
            /📍\s*(.+?)(?=\n|$|🕒|📅|🔗|💬)/,
            /Venue:\s*(.+?)(?=\n|$)/i,
            /Location:\s*(.+?)(?=\n|$)/i,
            /📍(.+?)(?=\n|$)/,
            /at\s+(.+?)(?=\n|$|💬|✅)/i,
            /in\s+(.+?)(?=\n|$|💬|✅)/i,
            /NASTP/i,
            /Karachi/i,
            /Auditorium/i,
            /DG-C\d/i,
            /D Block/i,
            /MAJU Sports Zone/i,
            /Block A/i,
          ];

          for (const pattern of locationPatterns) {
            const match = text.match(pattern);
            if (match) {
              location = match[1] ? match[1].trim() : match[0].trim();
              // Clean up location
              location = location
                .replace(/^📍\s*/, "")
                .replace(/^Venue:\s*/i, "")
                .replace(/^Location:\s*/i, "");
              break;
            }
          }

          // Calculate event status - ONLY if we have a real date
          let isUpcoming = false;
          let isOngoing = false;
          let isPast = false;
          let timeStatus = "unknown"; // unknown, upcoming, ongoing, past

          if (hasDate && eventDate) {
            const eventMoment = moment(eventDate);
            const eventEndMoment = eventMoment.clone().add(1, "day"); // Assume 1-day event

            if (eventMoment.isAfter(now)) {
              isUpcoming = true;
              timeStatus = "upcoming";
            } else if (now.isBetween(eventMoment, eventEndMoment)) {
              isOngoing = true;
              timeStatus = "ongoing";
            } else {
              isPast = true;
              timeStatus = "past";
            }
          } else {
            // No date or date is TBA - mark as unknown
            timeStatus = "unknown";
          }

          return {
            id: event.id || `event-${index}-${Date.now()}`,
            title: extractTitle(text),
            description: cleanDescription(text),
            date: eventDate,
            formattedDate: hasDate
              ? moment(eventDate).format("MMM DD, YYYY")
              : "Date TBA",
            time: timeMatch ? timeMatch[0] : "Time TBA",
            location: location || "MAJU",
            url,
            author,
            source,
            hashtags: hashtags.slice(0, 5),
            registrationLink: extractRegistrationLink(text) || url,
            isUpcoming,
            isOngoing,
            isPast,
            hasDate,
            timeStatus,
            isWithin30Days,
          };
        })
        .filter((event) => event !== null); // Remove null events (older than 30 days)

      // Sort events: upcoming first, then unknown (no date), then past
      processedEvents.sort((a, b) => {
        // If both have dates
        if (a.hasDate && b.hasDate) {
          if (a.isUpcoming && b.isUpcoming) {
            return new Date(a.date) - new Date(b.date); // Closest upcoming first
          }
          if (a.isUpcoming) return -1;
          if (b.isUpcoming) return 1;
          if (a.isOngoing && !b.isOngoing) return -1;
          if (b.isOngoing && !a.isOngoing) return 1;
          return new Date(b.date) - new Date(a.date); // Recent past first
        }

        // If one has date and one doesn't, date goes first
        if (a.hasDate && !b.hasDate) return -1;
        if (!a.hasDate && b.hasDate) return 1;

        // Both have no date - sort by some other criteria (like author)
        return a.author.localeCompare(b.author);
      });

      setEvents(processedEvents);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError(`Failed to load events: ${err.message}. Check your API URL.`);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const extractTitle = (text) => {
    // Look for title patterns
    const titlePatterns = [
      /^(.+?)(?=\n|💬|✅|📍|🕒|📅)/, // First line before emojis
      /Workshop Spotlight:\s*(.+?)(?=\n|💬|✅)/i,
      /Speaker Spotlight:\s*(.+?)(?=\n|💬|✅)/i,
      /(.+?)💬/,
      /^(.+?)\n/,
    ];

    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim().length > 10) {
        const title = match[1].trim();
        return title.length > 100 ? title.substring(0, 100) + "..." : title;
      }
    }

    // Fallback: first 100 chars
    const firstLine = text.split("\n")[0] || text.substring(0, 100);
    return firstLine.length > 100
      ? firstLine.substring(0, 100) + "..."
      : firstLine;
  };

  const cleanDescription = (text) => {
    let cleaned = text
      .replace(/(https?:\/\/[^\s]+)/g, "")
      .replace(/[💬✅📍🕒📅🔗]/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned.length > 150 ? cleaned.substring(0, 150) + "..." : cleaned;
  };

  const extractRegistrationLink = (text) => {
    const linkMatch = text.match(/(https?:\/\/[^\s]+)/);
    return linkMatch ? linkMatch[0] : null;
  };

  const applyFilters = () => {
    let result = [...events];

    // Apply club filter
    if (activeClubFilter !== "all") {
      result = result.filter((event) => event.source === activeClubFilter);
    }

    // Apply time filter
    if (activeTimeFilter !== "all") {
      switch (activeTimeFilter) {
        case "upcoming":
          result = result.filter((event) => event.timeStatus === "upcoming");
          break;
        case "ongoing":
          result = result.filter((event) => event.timeStatus === "ongoing");
          break;
        case "past":
          result = result.filter((event) => event.timeStatus === "past");
          break;
      }
    }

    setFilteredEvents(result);
  };

  const filterByClub = (clubId) => {
    setActiveClubFilter(clubId);
  };

  const filterByTime = (timeId) => {
    setActiveTimeFilter(timeId);
  };

  // Calculate stats
  const eventStats = useMemo(() => {
    return {
      total: events.length,
      upcoming: events.filter((e) => e.timeStatus === "upcoming").length,
      ongoing: events.filter((e) => e.timeStatus === "ongoing").length,
      past: events.filter((e) => e.timeStatus === "past").length,
      unknown: events.filter((e) => e.timeStatus === "unknown").length,
      acm: events.filter((e) => e.source === "acm").length,
      mlsa: events.filter((e) => e.source === "mlsa").length,
      gdg: events.filter((e) => e.source === "gdg").length,
      maju: events.filter((e) => e.source === "maju").length,
    };
  }, [events]);

  // Loading state
  if (loading) {
    return (
      <div
        className={`h-screen flex items-center justify-center ${
          theme === "dark" ? "bg-gray-900" : "bg-gray-50"
        }`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p
            className={`${
              theme === "dark" ? "text-gray-300" : "text-gray-600"
            }`}
          >
            Loading events from LinkedIn...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`h-screen flex items-center justify-center ${
          theme === "dark" ? "bg-gray-900" : "bg-gray-50"
        }`}
      >
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2
            className={`text-xl font-bold mb-2 ${
              theme === "dark" ? "text-white" : "text-gray-800"
            }`}
          >
            API Connection Error
          </h2>
          <p
            className={`mb-4 ${
              theme === "dark" ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {error}
          </p>
          <button
            onClick={fetchEvents}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-screen ${
        theme === "dark" ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      {/* Fixed Header */}
      <div className="shrink-0 sticky top-0 z-10 bg-inherit border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-purple-600">
                University Events
              </h1>
              <p
                className={`text-sm md:text-base ${
                  theme === "dark" ? "text-gray-300" : "text-gray-600"
                }`}
              >
                All Events Of MAJU & Sociaties • Last 30 days
              </p>
            </div>
            <button
              onClick={fetchEvents}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                theme === "dark"
                  ? "bg-blue-900/30 text-blue-300 hover:bg-blue-800/40"
                  : "bg-blue-100 text-blue-600 hover:bg-blue-200"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <div
                className={`text-sm px-3 py-1 rounded-full ${
                  theme === "dark"
                    ? "bg-green-900/30 text-green-300"
                    : "bg-green-100 text-green-600"
                }`}
              >
                {eventStats.upcoming} upcoming
              </div>
              <div
                className={`text-sm px-3 py-1 rounded-full ${
                  theme === "dark"
                    ? "bg-yellow-900/30 text-yellow-300"
                    : "bg-yellow-100 text-yellow-600"
                }`}
              >
                {eventStats.ongoing} ongoing
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-6">
          {/* Filters Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3
                className={`text-lg font-semibold ${
                  theme === "dark" ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Filters
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Club Filter */}
              <div>
                <h4
                  className={`text-sm font-medium mb-3 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Filter by Club
                </h4>
                <div className="flex flex-wrap gap-2">
                  {clubFilters.map((club) => {
                    const Icon = club.icon;
                    const count =
                      club.id === "all"
                        ? events.length
                        : events.filter((e) => e.source === club.id).length;

                    return (
                      <button
                        key={club.id}
                        onClick={() => filterByClub(club.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                          activeClubFilter === club.id
                            ? club.id === "all"
                              ? "bg-blue-600 text-white"
                              : `${club.color} ${club.textColor} border border-current`
                            : theme === "dark"
                            ? "bg-gray-800 hover:bg-gray-700 text-gray-300"
                            : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-300"
                        }`}
                      >
                        {club.icon && <Icon className="w-4 h-4" />}
                        <span>{club.name}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            theme === "dark" ? "bg-gray-700" : "bg-gray-200"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Filter */}
              <div>
                <h4
                  className={`text-sm font-medium mb-3 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Filter by Time
                </h4>
                <div className="flex flex-wrap gap-2">
                  {timeFilters.map((timeFilter) => {
                    let count = 0;
                    switch (timeFilter.id) {
                      case "all":
                        count = events.length;
                        break;
                      case "upcoming":
                        count = eventStats.upcoming;
                        break;
                      case "ongoing":
                        count = eventStats.ongoing;
                        break;
                      case "past":
                        count = eventStats.past;
                        break;
                    }

                    return (
                      <button
                        key={timeFilter.id}
                        onClick={() => filterByTime(timeFilter.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                          activeTimeFilter === timeFilter.id
                            ? timeFilter.id === "all"
                              ? "bg-blue-600 text-white"
                              : timeFilter.id === "upcoming"
                              ? "bg-green-600 text-white"
                              : timeFilter.id === "ongoing"
                              ? "bg-yellow-600 text-white"
                              : "bg-gray-600 text-white"
                            : theme === "dark"
                            ? "bg-gray-800 hover:bg-gray-700 text-gray-300"
                            : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-300"
                        }`}
                      >
                        <span>{timeFilter.name}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            theme === "dark" ? "bg-gray-700" : "bg-gray-200"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Active Filters Info */}
            {(activeClubFilter !== "all" || activeTimeFilter !== "all") && (
              <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Showing {filteredEvents.length} events
                    {activeClubFilter !== "all" &&
                      ` from ${
                        clubFilters.find((c) => c.id === activeClubFilter)?.name
                      }`}
                    {activeTimeFilter !== "all" &&
                      ` (${
                        timeFilters.find((t) => t.id === activeTimeFilter)?.name
                      })`}
                  </span>
                  <button
                    onClick={() => {
                      setActiveClubFilter("all");
                      setActiveTimeFilter("all");
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Events Grid */}
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <h3
                className={`text-xl font-semibold mb-2 ${
                  theme === "dark" ? "text-gray-300" : "text-gray-700"
                }`}
              >
                No events found
              </h3>
              <p
                className={`mb-4 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {activeClubFilter !== "all" || activeTimeFilter !== "all"
                  ? "No events match the selected filters."
                  : "No events found in the last 30 days."}
              </p>
              {(activeClubFilter !== "all" || activeTimeFilter !== "all") && (
                <button
                  onClick={() => {
                    setActiveClubFilter("all");
                    setActiveTimeFilter("all");
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Show All Events
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((event) => {
                  const clubConfig = clubFilters.find(
                    (c) => c.id === event.source
                  );

                  return (
                    <div
                      key={event.id}
                      className={`rounded-xl overflow-hidden border transition-all hover:shadow-lg ${
                        theme === "dark"
                          ? "bg-gray-800 border-gray-700 hover:border-gray-600"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {/* Event Header */}
                      <div
                        className={`p-5 border-b ${
                          theme === "dark"
                            ? "border-gray-700"
                            : "border-gray-100"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                              clubConfig?.color || "bg-gray-100"
                            } ${clubConfig?.textColor || "text-gray-600"}`}
                          >
                            <span className="font-medium">
                              {clubConfig?.name || event.author}
                            </span>
                          </div>

                          {/* Status Badge */}
                          {event.timeStatus === "upcoming" && (
                            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-xs font-medium">
                              Upcoming
                            </span>
                          )}
                          {event.timeStatus === "ongoing" && (
                            <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full text-xs font-medium">
                              Ongoing
                            </span>
                          )}
                          {event.timeStatus === "past" && (
                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-medium">
                              Past Event
                            </span>
                          )}
                          {event.timeStatus === "unknown" && (
                            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium">
                              Date TBA
                            </span>
                          )}
                        </div>

                        <h3
                          className={`font-bold text-lg mb-2 line-clamp-2 ${
                            theme === "dark" ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {event.title}
                        </h3>

                        <p
                          className={`text-sm mb-4 line-clamp-3 ${
                            theme === "dark" ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          {event.description}
                        </p>
                      </div>

                      {/* Event Details */}
                      <div className="p-5">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Calendar
                              className={`w-4 h-4 ${
                                theme === "dark"
                                  ? "text-gray-400"
                                  : "text-gray-500"
                              }`}
                            />
                            <span
                              className={`text-sm ${
                                theme === "dark"
                                  ? "text-gray-300"
                                  : "text-gray-700"
                              }`}
                            >
                              {event.formattedDate}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <Clock
                              className={`w-4 h-4 ${
                                theme === "dark"
                                  ? "text-gray-400"
                                  : "text-gray-500"
                              }`}
                            />
                            <span
                              className={`text-sm ${
                                theme === "dark"
                                  ? "text-gray-300"
                                  : "text-gray-700"
                              }`}
                            >
                              {event.time}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <MapPin
                              className={`w-4 h-4 ${
                                theme === "dark"
                                  ? "text-gray-400"
                                  : "text-gray-500"
                              }`}
                            />
                            <span
                              className={`text-sm ${
                                theme === "dark"
                                  ? "text-gray-300"
                                  : "text-gray-700"
                              }`}
                            >
                              {event.location}
                            </span>
                          </div>
                        </div>

                        {/* Hashtags */}
                        {event.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {event.hashtags.map((tag, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                  theme === "dark"
                                    ? "bg-gray-700 text-gray-300"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                <Hash className="w-3 h-3" />
                                {tag.replace("#", "")}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Action Button */}
                        <div className="mt-6">
                          <a
                            href={event.registrationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
                            text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
                          >
                            <ExternalLink className="w-4 h-4" />
                            {event.timeStatus === "past"
                              ? "View Event Recap"
                              : "View Event Details"}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stats Footer */}
              <div
                className={`mt-8 p-6 rounded-xl ${
                  theme === "dark"
                    ? "bg-gray-800"
                    : "bg-white border border-gray-200"
                }`}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                  <div>
                    <div
                      className={`text-2xl font-bold mb-1 ${
                        theme === "dark" ? "text-blue-400" : "text-blue-600"
                      }`}
                    >
                      {eventStats.total}
                    </div>
                    <div
                      className={`text-sm ${
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Total Events
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold mb-1 text-green-600 dark:text-green-400">
                      {eventStats.upcoming}
                    </div>
                    <div
                      className={`text-sm ${
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Upcoming
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold mb-1 text-yellow-600 dark:text-yellow-400">
                      {eventStats.ongoing}
                    </div>
                    <div
                      className={`text-sm ${
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Ongoing
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold mb-1 text-purple-600 dark:text-purple-400">
                      {eventStats.acm}
                    </div>
                    <div
                      className={`text-sm ${
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      ACM Events
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Events;
