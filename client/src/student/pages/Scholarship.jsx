import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { GraduationCap, Landmark, Users, Search, ArrowRight, HelpCircle, FileText } from "lucide-react";

const SCHOLARSHIPS = [
  {
    id: "merit",
    title: "Merit-Based Scholarship",
    category: "Academic",
    icon: GraduationCap,
    eligibility: "Based on Board/University results and Admission Test score.",
    details: "Up to 50% or 100% tuition fee waiver for top academic performers during admission, and maintained based on CGPA (typically 3.50+).",
  },
  {
    id: "financial-aid",
    title: "Need-Based Financial Assistance",
    category: "Financial Aid",
    icon: Landmark,
    eligibility: "Students facing financial hardships with proven documentation.",
    details: "Provides partial tuition fee concessions. Requires submission of parents' income tax certificates, utility bills, and salary slips to the Student Financial Center (SFC).",
  },
  {
    id: "sibling",
    title: "Sibling Concession",
    category: "Concessions",
    icon: Users,
    eligibility: "For students whose brother or sister is currently enrolled at MAJU.",
    details: "25% concession on tuition fees for the second sibling currently studying at Muhammad Ali Jinnah University.",
  },
  {
    id: "kinship",
    title: "Kinship Concession",
    category: "Concessions",
    icon: Users,
    eligibility: "For children or siblings of MAJU alumni, faculty, or staff.",
    details: "25% tuition fee concession as a token of appreciation for families associated with the MAJU community.",
  },
  {
    id: "alumni-pg",
    title: "MAJU Alumni PG Scholarship",
    category: "Academic",
    icon: GraduationCap,
    eligibility: "MAJU graduates seeking admission in MS / Postgraduate programs.",
    details: "50% tuition fee waiver for all alumni of Muhammad Ali Jinnah University continuing their education in Master's programs.",
  },
  {
    id: "hec-external",
    title: "HEC & External Scholarships",
    category: "External",
    icon: Landmark,
    eligibility: "As per HEC, PEP, or specific external donor criteria.",
    details: "Administered in cooperation with government bodies and private organizations (e.g., HEC Need-Based Scholarships, Ehsaas Program).",
  },
];

const Scholarship = () => {
  const theme = useSelector((s) => s.theme.theme);
  const [search, setSearch] = useState("");
  const isDark = theme === "dark";

  const C = {
    bg: isDark ? "#0E1422" : "#F2F3F8",
    surface: isDark ? "#16203A" : "#FFFFFF",
    border: isDark ? "#2A3656" : "#D8DAE6",
    text: isDark ? "#ECEEF5" : "#1F2330",
    muted: isDark ? "#9AA5BD" : "#5A6372",
    navy: isDark ? "#E63027" : "#1E2A66",
    red: isDark ? "#C48A4A" : "#E63027",
  };

  const filtered = SCHOLARSHIPS.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.details.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: C.bg, color: C.text }}>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>Scholarships & Financial Aid</h1>
            <p className="text-sm mt-1" style={{ color: C.muted }}>
              Explore financial support opportunities and academic awards at MAJU
            </p>
          </div>
          <Link
            to="/issues/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium text-sm self-start md:self-auto hover:opacity-90 transition-opacity"
            style={{ backgroundColor: C.navy }}
          >
            <HelpCircle className="w-4 h-4" /> Ask SFC / Apply
          </Link>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scholarships (e.g. merit, sibling, financial aid)..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border focus:outline-none"
            style={{
              backgroundColor: C.surface,
              borderColor: C.border,
              color: C.text,
            }}
          />
        </div>

        {/* Scholarship Cards Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: C.border, backgroundColor: C.surface }}>
            <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: C.muted }} />
            <p className="text-base font-medium" style={{ color: C.text }}>No matching scholarships found</p>
            <p className="text-sm mt-1" style={{ color: C.muted }}>Try refining your search keyword.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className="p-5 rounded-xl border flex flex-col justify-between transition-all hover:shadow-md"
                  style={{ backgroundColor: C.surface, borderColor: C.border }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${C.navy}15`, color: C.navy }}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base" style={{ color: C.text }}>{s.title}</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ backgroundColor: C.bg, color: C.muted }}>
                          {s.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm" style={{ color: C.text }}>{s.details}</p>
                    <div className="pt-2 text-xs">
                      <span className="font-medium" style={{ color: C.muted }}>Eligibility: </span>
                      <span style={{ color: C.text }}>{s.eligibility}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SFC Section */}
        <div className="p-6 rounded-xl border flex flex-col sm:flex-row items-center gap-5 justify-between" style={{ backgroundColor: C.surface, borderColor: C.border }}>
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-semibold text-lg" style={{ color: C.text }}>Need help or want to submit an application?</h3>
            <p className="text-sm" style={{ color: C.muted }}>
              Create an official request. Our Student Financial Center (SFC) team will get back to you with the application details.
            </p>
          </div>
          <Link
            to="/issues/new"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border font-medium text-sm hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            style={{ borderColor: C.border, color: C.text }}
          >
            Submit Application Request <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Scholarship;
