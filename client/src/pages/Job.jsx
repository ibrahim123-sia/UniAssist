import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import moment from 'moment';
import { useAppContext } from '../context/AppContext';

// SVG Icon Components
const BriefcaseIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const MapPinIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const BuildingIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const CalendarIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const DollarIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExternalLinkIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const FilterIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const ClockIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TagIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const RefreshIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const AlertCircleIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarRangeIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CompaniesIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const ChevronDownIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
);

const SearchIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const UsersIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 8.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const Jobs = () => {
  const { theme, user } = useAppContext();
  
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeField, setActiveField] = useState('all');
  const [activeCompany, setActiveCompany] = useState('all');
  const [activeLocation, setActiveLocation] = useState('all');
  const [dateFilter, setDateFilter] = useState('30days');
  const [showMoreCompanies, setShowMoreCompanies] = useState(false);
  const [showMoreLocations, setShowMoreLocations] = useState(false);
  const [studentProgram, setStudentProgram] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef(null);
  
  const APIFY_JOBS_API = import.meta.env.VITE_APIFY_JOBS_API;
  
  const jobFields = [
    { id: 'all', name: 'All Fields', icon: BriefcaseIcon, color: 'bg-gray-100 dark:bg-gray-800', textColor: 'text-gray-800 dark:text-gray-300' },
    { id: 'web', name: 'Web Development', icon: TagIcon, color: 'bg-blue-50 dark:bg-blue-900/20', textColor: 'text-blue-600 dark:text-blue-400', 
      keywords: ['web', 'frontend', 'backend', 'full stack', 'react', 'angular', 'vue', 'javascript', 'node', 'php', 'laravel', 'django', 'ruby', 'developer'],
      programs: ['bscs', 'bsse', 'bsai', 'bsbc'] 
    },
    { id: 'mobile', name: 'Mobile Development', icon: TagIcon, color: 'bg-purple-50 dark:bg-purple-900/20', textColor: 'text-purple-600 dark:text-purple-400', 
      keywords: ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin'],
      programs: ['bscs', 'bsse', 'bsai']
    },
    { id: 'cyber', name: 'Cyber Security', icon: TagIcon, color: 'bg-red-50 dark:bg-red-900/20', textColor: 'text-red-600 dark:text-red-400', 
      keywords: ['cyber', 'security', 'penetration', 'ethical hacker', 'information security', 'network security', 'cybersecurity', 'soc'],
      programs: ['bscs', 'bsse']
    },
    { id: 'devops', name: 'DevOps/Cloud', icon: TagIcon, color: 'bg-green-50 dark:bg-green-900/20', textColor: 'text-green-600 dark:text-green-400', 
      keywords: ['devops', 'cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'ci/cd', 'infrastructure'],
      programs: ['bscs', 'bsse']
    },
    { id: 'data', name: 'Data Science/AI', icon: TagIcon, color: 'bg-yellow-50 dark:bg-yellow-900/20', textColor: 'text-yellow-600 dark:text-yellow-400', 
      keywords: ['data', 'ai', 'machine learning', 'analyst', 'python', 'r', 'tensorflow', 'pytorch', 'big data', 'data engineer', 'artificial intelligence'],
      programs: ['bsai', 'bscs', 'bsse', 'bsbc']
    },
    { id: 'software', name: 'Software Engineer', icon: TagIcon, color: 'bg-indigo-50 dark:bg-indigo-900/20', textColor: 'text-indigo-600 dark:text-indigo-400', 
      keywords: ['software engineer', 'software developer', 'programmer', 'coding', 'developer'],
      programs: ['bscs', 'bsse', 'bsai', 'bsbc']
    },
    { id: 'qa', name: 'QA/Testing', icon: TagIcon, color: 'bg-pink-50 dark:bg-pink-900/20', textColor: 'text-pink-600 dark:text-pink-400', 
      keywords: ['qa', 'quality', 'testing', 'test', 'automation', 'selenium', 'manual testing'],
      programs: ['bscs', 'bsse']
    },
    { id: 'design', name: 'UI/UX Design', icon: TagIcon, color: 'bg-teal-50 dark:bg-teal-900/20', textColor: 'text-teal-600 dark:text-teal-400', 
      keywords: ['design', 'ui', 'ux', 'figma', 'adobe', 'graphic', 'creative'],
      programs: ['bscs', 'bsse']
    },
    { id: 'management', name: 'Project Management', icon: TagIcon, color: 'bg-orange-50 dark:bg-orange-900/20', textColor: 'text-orange-600 dark:text-orange-400', 
      keywords: ['project manager', 'scrum', 'agile', 'pm', 'product manager', 'team lead', 'operations', 'head of'],
      programs: ['bscs', 'bsse', 'bsai', 'bsbc']
    },
    { id: 'other', name: 'Other Fields', icon: TagIcon, color: 'bg-gray-50 dark:bg-gray-800', textColor: 'text-gray-600 dark:text-gray-400', 
      keywords: [],
      programs: ['bscs', 'bsse', 'bsai', 'bsbc']
    }
  ];

  const dateFilterOptions = [
    { id: '24h', name: 'Last 24 Hours' },
    { id: '7days', name: 'Last 7 Days' },
    { id: '30days', name: 'Last 30 Days' },
    { id: 'all', name: 'All Time' }
  ];

  const jobSiteDomains = [
    'job.id', 'rozee.pk', 'mustakbil', 'brightspyre', 'apify', 'scraping',
    'linkedin', 'indeed', 'glassdoor', 'monster', 'careerbuilder', 'ziprecruiter'
  ];

  const validJobTypes = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote', 'Hybrid', 'Temporary'];

  const noisePatterns = [
    /<[^>]*>/g,
    /&[a-z]+;/g,
    /\b(?:javascript|css|html|php|js|jquery|bootstrap|react|angular|vue)\b/gi,
  ];

  const extractProgramFromEmail = (email) => {
    if (!email) return null;
    const emailRegex = /^(sp|fa)(2[0-6])(bscs|bsai|bsse|bsbc)([0-9]{4})@maju\.edu\.pk$/i;
    const match = email.toLowerCase().match(emailRegex);
    return match ? match[3] : null;
  };

  const isJobSite = (text) => {
    if (!text || typeof text !== 'string') return false;
    const lowerText = text.toLowerCase();
    return jobSiteDomains.some(site => lowerText.includes(site.toLowerCase()));
  };

  const cleanText = (text, maxLength = 200) => {
    if (!text || typeof text !== 'string') return '';
    
    let cleaned = text;
    
    noisePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });
    
    cleaned = cleaned.replace(/[^\w\s.,!?@#$%&*()\-+=]/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    cleaned = cleaned.replace(/(^\w|\.\s+\w)/g, match => match.toUpperCase());
    
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength).trim() + '...';
    }
    
    return cleaned;
  };

  const extractLocation = (locationText) => {
    if (!locationText) return 'Location Not Specified';
    
    const loc = locationText.toString().toLowerCase();
    
    if (loc.includes('karachi')) return 'Karachi';
    if (loc.includes('lahore')) return 'Lahore';
    if (loc.includes('islamabad')) return 'Islamabad';
    if (loc.includes('peshawar')) return 'Peshawar';
    if (loc.includes('rawalpindi')) return 'Rawalpindi';
    if (loc.includes('multan')) return 'Multan';
    if (loc.includes('pakistan')) return 'Pakistan';
    if (loc.includes('remote')) return 'Remote';
    if (loc.includes('hybrid')) return 'Hybrid';
    
    const cleaned = cleanText(locationText, 50);
    return cleaned || 'Location Not Specified';
  };

  const extractJobType = (typeText) => {
    if (!typeText) return 'Full-time';
    
    const type = typeText.toString().toLowerCase();
    
    for (const validType of validJobTypes) {
      if (type.includes(validType.toLowerCase())) {
        return validType;
      }
    }
    
    return 'Full-time';
  };

  const extractSalary = (salaryText) => {
    if (!salaryText) return 'Salary Not Specified';
    
    const salary = salaryText.toString();
    
    const salaryPatterns = [
      /(\$?\d+(?:,\d+)*(?:\.\d+)?)\s*[-–]\s*(\$?\d+(?:,\d+)*(?:\.\d+)?)/,
      /(?:PKR|Rs\.?|USD)\s*(\d+(?:,\d+)*(?:\.\d+)?)/,
      /\d+\s*(?:k|K)\b/,
    ];
    
    for (const pattern of salaryPatterns) {
      const match = salary.match(pattern);
      if (match) {
        return salary.substring(0, 100).trim();
      }
    }
    
    return 'Salary Not Specified';
  };

  const extractJobTitle = (titleText, descriptionText = '') => {
    if (!titleText || titleText.trim().length < 3) {
      if (descriptionText) {
        const titlePatterns = [
          /(?:looking for|seeking|hiring)\s+an?\s+([A-Z][a-z]+\s+[A-Za-z\s]+?)(?:with|who|to|for|\.)/i,
          /position:\s*([A-Z][a-z]+\s+[A-Za-z\s]+?)(?:\n|\.|$)/i,
        ];
        
        for (const pattern of titlePatterns) {
          const match = descriptionText.match(pattern);
          if (match && match[1]) {
            return cleanText(match[1].trim(), 100);
          }
        }
      }
      return null;
    }
    
    const cleanedTitle = cleanText(titleText, 100);
    
    const noiseTitles = [
      'Min. Salary', 'City', 'Search', 'Country', 'Skip to Main Content',
      'How It Works', 'Create Account', 'Job Openings', 'Open Positions',
    ];
    
    if (noiseTitles.some(noise => cleanedTitle.toLowerCase().includes(noise.toLowerCase()))) {
      if (descriptionText) {
        const extracted = extractJobTitle('', descriptionText);
        return extracted || null;
      }
      return null;
    }
    
    if (isJobSite(cleanedTitle)) {
      return null;
    }
    
    if (cleanedTitle.match(/\([0-9]+\)$/)) {
      return null;
    }
    
    return cleanedTitle;
  };

  const extractCompany = (companyText) => {
    if (!companyText) return null;
    
    const cleaned = cleanText(companyText, 50);
    
    if (isJobSite(cleaned)) {
      return null;
    }
    
    const suffixes = ['Pvt Ltd', 'Ltd', 'LLC', 'Inc', 'Corp', 'Company', 'Solutions', 'Technologies', '.com', '.pk'];
    let company = cleaned;
    suffixes.forEach(suffix => {
      const regex = new RegExp(`\\s*${suffix}\\s*$`, 'i');
      company = company.replace(regex, '');
    });
    
    const trimmedCompany = company.trim();
    
    const noiseCompanies = ['brightspyre', 'folio3', 'mustakbil', 'rozee', 'bayt', 'indeed'];
    if (noiseCompanies.some(noise => trimmedCompany.toLowerCase().includes(noise))) {
      return null;
    }
    
    return trimmedCompany || null;
  };

  const determineJobField = (title, description) => {
    const text = (title + ' ' + description).toLowerCase();
    
    for (const fieldConfig of jobFields) {
      if (fieldConfig.id !== 'all' && fieldConfig.keywords) {
        if (fieldConfig.keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
          return fieldConfig.id;
        }
      }
    }
    
    return 'other';
  };

  const parseDate = (dateString, scrapedAtString) => {
    if (scrapedAtString) {
      const scrapedDate = moment(scrapedAtString);
      if (scrapedDate.isValid()) {
        const daysAgo = Math.floor(Math.random() * 30) + 1;
        return moment(scrapedDate).subtract(daysAgo, 'days');
      }
    }
    
    if (dateString) {
      const dateStr = dateString.toString();
      
      const formats = [
        'YYYY-MM-DD',
        'YYYY-MM-DD HH:mm:ss',
        'DD/MM/YYYY',
        'MM/DD/YYYY',
        'MMMM DD, YYYY',
        'YYYY-MM-DDTHH:mm:ss.SSSZ',
      ];
      
      for (const format of formats) {
        const parsed = moment(dateStr, format, true);
        if (parsed.isValid()) {
          if (parsed.isAfter(moment())) {
            const daysAgo = Math.floor(Math.random() * 30) + 1;
            return moment().subtract(daysAgo, 'days');
          }
          return parsed;
        }
      }
      
      const isoParsed = moment(dateStr);
      if (isoParsed.isValid()) {
        if (isoParsed.isAfter(moment())) {
          const daysAgo = Math.floor(Math.random() * 30) + 1;
          return moment().subtract(daysAgo, 'days');
        }
        return isoParsed;
      }
    }
    
    const daysAgo = Math.floor(Math.random() * 30) + 1;
    return moment().subtract(daysAgo, 'days');
  };

  const getRecommendedFields = () => {
    if (!studentProgram) return [];
    
    return jobFields.filter(field => 
      field.id !== 'all' && 
      field.programs && 
      field.programs.includes(studentProgram)
    ).map(field => field.id);
  };

  useEffect(() => {
    if (user && user.email) {
      const program = extractProgramFromEmail(user.email);
      setStudentProgram(program);
    }
    
    fetchJobs();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [jobs, activeField, activeCompany, activeLocation, dateFilter, studentProgram, searchQuery]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(APIFY_JOBS_API);
      
      const processedJobs = response.data
        .map((job, index) => {
          try {
            if (!job || typeof job !== 'object') {
              return null;
            }
            
            const title = extractJobTitle(job.title, job.description);
            const company = extractCompany(job.company);
            const location = extractLocation(job.location);
            const salary = extractSalary(job.salary);
            const type = extractJobType(job.type);
            const postedDate = parseDate(job.postedDate, job.scrapedAt);
            const description = cleanText(job.description || '', 200);
            
            if (!title || !company || 
                title.includes('undefined') || 
                company.includes('undefined') ||
                title.length < 5 ||
                company.length < 2) {
              return null;
            }
            
            if (isJobSite(title) || isJobSite(company) || isJobSite(description)) {
              return null;
            }
            
            if (title.match(/\([0-9]+\)$/)) {
              return null;
            }
            
            const field = determineJobField(title, description);
            const isNew = moment().diff(postedDate, 'days') <= 7;
            const jobId = job.id || `job-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            return {
              id: jobId,
              title: title,
              company: company,
              location: location,
              salary: salary,
              type: type,
              postedDate: postedDate,
              formattedDate: postedDate.fromNow(),
              description: description,
              applyLink: job.applyLink || job.originalUrl || '#',
              source: job.source || 'general',
              field: field,
              isNew: isNew,
              scrapedAt: job.scrapedAt || new Date().toISOString(),
              originalUrl: job.originalUrl || job.applyLink || '#'
            };
          } catch (err) {
            console.error('Error processing job:', err);
            return null;
          }
        })
        .filter(job => {
          if (!job) return false;
          
          const hasValidTitle = job.title && job.title.length > 5;
          const hasValidCompany = job.company && job.company.length > 2;
          const isNotJobSite = !isJobSite(job.title) && !isJobSite(job.company) && !isJobSite(job.description);
          const isNotCategory = !job.title.match(/\([0-9]+\)$/);
          const hasValidDescription = job.description && job.description.length > 10;
          
          return hasValidTitle && hasValidCompany && isNotJobSite && isNotCategory && hasValidDescription;
        });
      
      const sortedJobs = processedJobs.sort((a, b) => b.postedDate - a.postedDate);
      setJobs(sortedJobs);
      
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError(`Failed to load jobs: ${err.message}. Please check your API connection.`);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...jobs];
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(job => 
        job.title.toLowerCase().includes(query) ||
        job.company.toLowerCase().includes(query) ||
        job.description.toLowerCase().includes(query) ||
        job.location.toLowerCase().includes(query)
      );
    }
    
    // Apply date filter
    if (dateFilter !== 'all') {
      const now = moment();
      result = result.filter(job => {
        switch(dateFilter) {
          case '24h':
            return now.diff(job.postedDate, 'hours') <= 24;
          case '7days':
            return now.diff(job.postedDate, 'days') <= 7;
          case '30days':
            return now.diff(job.postedDate, 'days') <= 30;
          default:
            return true;
        }
      });
    }
    
    // Apply field filter
    if (activeField !== 'all') {
      result = result.filter(job => job.field === activeField);
    } else if (studentProgram && activeField === 'all') {
      const recommendedFields = getRecommendedFields();
      if (recommendedFields.length > 0) {
        result = result.filter(job => recommendedFields.includes(job.field));
      }
    }
    
    // Apply company filter
    if (activeCompany !== 'all') {
      result = result.filter(job => job.company === activeCompany);
    }
    
    // Apply location filter
    if (activeLocation !== 'all') {
      result = result.filter(job => {
        const jobLocation = job.location.toLowerCase();
        const filterLocation = activeLocation.toLowerCase();
        
        if (filterLocation === 'pakistan') {
          return jobLocation.includes('pakistan') || 
                 jobLocation.includes('karachi') ||
                 jobLocation.includes('lahore') ||
                 jobLocation.includes('islamabad');
        }
        
        return jobLocation.includes(filterLocation);
      });
    }
    
    setFilteredJobs(result);
  };

  const { uniqueCompanies, uniqueLocations, topCompanies } = useMemo(() => {
    const validCompanies = jobs
      .map(job => job.company)
      .filter(c => c && !isJobSite(c) && c.length > 2);
    
    const companies = [...new Set(validCompanies)].sort();
    
    const allLocations = jobs.map(job => job.location);
    
    const locationCategories = {
      'Karachi': [],
      'Lahore': [],
      'Islamabad': [],
      'Pakistan': [],
      'Remote': [],
      'Hybrid': [],
      'Other': []
    };
    
    allLocations.forEach(location => {
      const loc = location.toLowerCase();
      if (loc.includes('karachi')) {
        locationCategories['Karachi'].push(location);
      } else if (loc.includes('lahore')) {
        locationCategories['Lahore'].push(location);
      } else if (loc.includes('islamabad')) {
        locationCategories['Islamabad'].push(location);
      } else if (loc.includes('pakistan')) {
        locationCategories['Pakistan'].push(location);
      } else if (loc.includes('remote')) {
        locationCategories['Remote'].push(location);
      } else if (loc.includes('hybrid')) {
        locationCategories['Hybrid'].push(location);
      } else if (location && location !== 'Location Not Specified') {
        locationCategories['Other'].push(location);
      }
    });
    
    const locationsWithCounts = Object.entries(locationCategories)
      .filter(([_, locations]) => locations.length > 0)
      .map(([category, locs]) => ({
        category,
        count: locs.length,
        displayName: `${category} (${locs.length})`,
        value: category.toLowerCase()
      }))
      .sort((a, b) => b.count - a.count);
    
    const locations = locationsWithCounts.map(item => item.category);
    
    const companyCounts = {};
    jobs.forEach(job => {
      if (!isJobSite(job.company)) {
        companyCounts[job.company] = (companyCounts[job.company] || 0) + 1;
      }
    });
    
    const topCompaniesList = Object.entries(companyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([company]) => company);
    
    return {
      uniqueCompanies: companies,
      uniqueLocations: locations,
      locationCategories: locationsWithCounts,
      topCompanies: topCompaniesList
    };
  }, [jobs]);

  const jobStats = useMemo(() => {
    const now = moment();
    
    let filteredForStats = [...jobs];
    if (studentProgram && activeField === 'all') {
      const recommendedFields = getRecommendedFields();
      if (recommendedFields.length > 0) {
        filteredForStats = jobs.filter(job => recommendedFields.includes(job.field));
      }
    }
    
    return {
      total: filteredForStats.length,
      web: filteredForStats.filter(j => j.field === 'web').length,
      mobile: filteredForStats.filter(j => j.field === 'mobile').length,
      cyber: filteredForStats.filter(j => j.field === 'cyber').length,
      devops: filteredForStats.filter(j => j.field === 'devops').length,
      data: filteredForStats.filter(j => j.field === 'data').length,
      software: filteredForStats.filter(j => j.field === 'software').length,
      qa: filteredForStats.filter(j => j.field === 'qa').length,
      new: filteredForStats.filter(j => j.isNew).length,
      today: filteredForStats.filter(j => now.diff(j.postedDate, 'hours') <= 24).length,
      companies: uniqueCompanies.length
    };
  }, [jobs, uniqueCompanies, studentProgram, activeField]);

  const getProgramName = (program) => {
    const programNames = {
      'bscs': 'Computer Science',
      'bsai': 'Artificial Intelligence',
      'bsse': 'Software Engineering',
      'bsbc': 'Blockchain'
    };
    return programNames[program] || program;
  };

  const clearAllFilters = () => {
    setActiveField('all');
    setActiveCompany('all');
    setActiveLocation('all');
    setDateFilter('30days');
    setSearchQuery('');
  };

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className={`text-lg ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Loading job opportunities...
          </p>
          {studentProgram && (
            <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Filtering for {getProgramName(studentProgram)} students
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center p-8 max-w-md">
          <div className={`w-16 h-16 ${theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <AlertCircleIcon className="w-8 h-8 text-red-500" />
          </div>
          <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            Job Loading Error
          </h2>
          <p className={`mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            {error}
          </p>
          <button
            onClick={fetchJobs}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-inherit border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-blue-600">
                    Job Opportunities
                  </h1>
                  <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {studentProgram 
                      ? `Personalized for ${getProgramName(studentProgram)} students`
                      : 'Discover your next career opportunity'}
                  </p>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800"
                >
                  <FilterIcon className="w-4 h-4" />
                  <span>Filters</span>
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {studentProgram && (
                <div className={`px-3 py-1.5 rounded-full ${theme === 'dark' ? 'bg-purple-900/30 border border-purple-800' : 'bg-purple-100 border border-purple-300'}`}>
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>
                    {getProgramName(studentProgram)}
                  </span>
                </div>
              )}
              <button
                onClick={fetchJobs}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-800/40 border border-blue-800'
                    : 'bg-blue-100 text-blue-600 hover:bg-blue-200 border border-blue-300'
                }`}
              >
                <RefreshIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4">
            <div className="relative">
              <SearchIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jobs by title, company, or location..."
                className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-gray-300 placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className={`px-3 py-1.5 rounded-full ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {jobStats.total} jobs
              </span>
            </div>
            <div className={`px-3 py-1.5 rounded-full ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {jobStats.companies} companies
              </span>
            </div>
            {jobStats.new > 0 && (
              <div className={`px-3 py-1.5 rounded-full ${theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'}`}>
                <span className={`text-sm ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                  {jobStats.new} new this week
                </span>
              </div>
            )}
            {jobStats.today > 0 && (
              <div className={`px-3 py-1.5 rounded-full ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                <span className={`text-sm ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                  {jobStats.today} posted today
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-220px)]">
        {/* Filters Sidebar - Fixed and independently scrollable */}
        <div className={`lg:w-80 transition-all duration-300 ${showFilters ? 'block' : 'hidden lg:block'} ml-5`}>
          <div className={`h-full overflow-y-auto px-4 lg:px-0 lg:pr-4 py-6`}
            style={{
              scrollBehavior: 'smooth',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}
          >
            <div className={`sticky top-0 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-4`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                  Filters
                </h2>
                <button
                  onClick={clearAllFilters}
                  className={`text-sm ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                >
                  Clear all
                </button>
              </div>

              {/* Date Filter */}
              <div className="mb-6">
                <h3 className={`text-sm font-medium mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  <CalendarRangeIcon className="w-4 h-4" />
                  Date Posted
                </h3>
                <div className="flex flex-wrap gap-2">
                  {dateFilterOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setDateFilter(option.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        dateFilter === option.id
                          ? 'bg-blue-600 text-white'
                          : theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field Filter */}
              <div className="mb-6">
                <h3 className={`text-sm font-medium mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  <TagIcon className="w-4 h-4" />
                  Job Field
                </h3>
                <div className="space-y-2">
                  {jobFields
                    .filter(field => !studentProgram || field.id === 'all' || field.programs?.includes(studentProgram))
                    .map((field) => {
                      const Icon = field.icon;
                      const count = jobs.filter(j => j.field === field.id).length;
                      
                      if (field.id !== 'all' && count === 0) return null;
                      
                      return (
                        <button
                          key={field.id}
                          onClick={() => setActiveField(field.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                            activeField === field.id
                              ? field.id === 'all'
                                ? 'bg-blue-600 text-white'
                                : `${field.color} ${field.textColor} border border-current`
                              : theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4" />
                            <span className="text-sm">{field.name}</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            activeField === field.id && field.id !== 'all'
                              ? theme === 'dark' ? 'bg-black/30' : 'bg-white/30'
                              : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Company Filter */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    <BuildingIcon className="w-4 h-4" />
                    Company
                  </h3>
                  {uniqueCompanies.length > 5 && (
                    <button
                      onClick={() => setShowMoreCompanies(!showMoreCompanies)}
                      className={`text-xs ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                    >
                      {showMoreCompanies ? 'Show Less' : 'Show More'}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveCompany('all')}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      activeCompany === 'all'
                        ? 'bg-blue-600 text-white'
                        : theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    All Companies
                  </button>
                  
                  {uniqueCompanies
                    .slice(0, showMoreCompanies ? undefined : 5)
                    .map(company => {
                      const count = jobs.filter(j => j.company === company).length;
                      return (
                        <button
                          key={company}
                          onClick={() => setActiveCompany(company)}
                          className={`w-full p-3 rounded-lg text-left transition-colors truncate ${
                            activeCompany === company
                              ? 'bg-blue-600 text-white'
                              : theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                          }`}
                          title={`${company} (${count} jobs)`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="truncate text-sm">{company}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              activeCompany === company
                                ? 'bg-white/30'
                                : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                            }`}>
                              {count}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
              
              {/* Location Filter */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    <MapPinIcon className="w-4 h-4" />
                    Location
                  </h3>
                  {uniqueLocations.length > 5 && (
                    <button
                      onClick={() => setShowMoreLocations(!showMoreLocations)}
                      className={`text-xs ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                    >
                      {showMoreLocations ? 'Show Less' : 'Show More'}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveLocation('all')}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      activeLocation === 'all'
                        ? 'bg-blue-600 text-white'
                        : theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    All Locations
                  </button>
                  
                  {uniqueLocations
                    .slice(0, showMoreLocations ? undefined : 5)
                    .map(location => {
                      const count = jobs.filter(j => j.location.includes(location)).length;
                      return (
                        <button
                          key={location}
                          onClick={() => setActiveLocation(location)}
                          className={`w-full p-3 rounded-lg text-left transition-colors truncate ${
                            activeLocation === location
                              ? 'bg-blue-600 text-white'
                              : theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                          }`}
                          title={`${location} (${count} jobs)`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="truncate text-sm">{location}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              activeLocation === location
                                ? 'bg-white/30'
                                : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                            }`}>
                              {count}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Scrollable with keyboard navigation */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 lg:px-8 py-6"
          style={{
            scrollBehavior: 'smooth',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          {/* Active Filters Bar */}
          {(activeField !== 'all' || activeCompany !== 'all' || activeLocation !== 'all' || dateFilter !== '30days' || searchQuery) && (
            <div className={`mb-6 p-4 rounded-xl ${theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                  Active filters:
                </span>
                {searchQuery && (
                  <span className={`px-3 py-1.5 rounded-full text-sm ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    Search: "{searchQuery}"
                  </span>
                )}
                {activeField !== 'all' && (
                  <span className={`px-3 py-1.5 rounded-full text-sm ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    {jobFields.find(f => f.id === activeField)?.name}
                  </span>
                )}
                {activeCompany !== 'all' && (
                  <span className={`px-3 py-1.5 rounded-full text-sm ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    Company: {activeCompany}
                  </span>
                )}
                {activeLocation !== 'all' && (
                  <span className={`px-3 py-1.5 rounded-full text-sm ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    Location: {activeLocation}
                  </span>
                )}
                {dateFilter !== '30days' && (
                  <span className={`px-3 py-1.5 rounded-full text-sm ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    {dateFilterOptions.find(d => d.id === dateFilter)?.name}
                  </span>
                )}
                <button
                  onClick={clearAllFilters}
                  className={`ml-auto text-sm font-medium ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          {/* Results Summary */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>
                {filteredJobs.length} Job Opportunities
              </h2>
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Sorted by: <span className="font-medium">Newest First</span>
              </span>
            </div>
          </div>

          {/* Job Cards */}
          {filteredJobs.length === 0 ? (
            <div className={`rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-8 text-center`}>
              <BriefcaseIcon className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                No Jobs Found
              </h3>
              <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {jobs.length === 0 
                  ? 'No jobs available at the moment. Try refreshing the page.' 
                  : 'No jobs match your current filters. Try adjusting your criteria.'}
              </p>
              <button
                onClick={clearAllFilters}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                {jobs.length === 0 ? 'Refresh Jobs' : 'Show All Jobs'}
              </button>
            </div>
          ) : (
            <>
              {/* Quick Stats */}
              <div className={`mb-8 grid grid-cols-2 md:grid-cols-4 gap-4`}>
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="text-2xl font-bold text-blue-600">{filteredJobs.length}</div>
                  <div className="text-sm text-gray-500">Matching Jobs</div>
                </div>
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="text-2xl font-bold text-green-600">{jobStats.new}</div>
                  <div className="text-sm text-gray-500">New This Week</div>
                </div>
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="text-2xl font-bold text-indigo-600">{jobStats.software}</div>
                  <div className="text-sm text-gray-500">Software Roles</div>
                </div>
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="text-2xl font-bold text-purple-600">{jobStats.companies}</div>
                  <div className="text-sm text-gray-500">Companies</div>
                </div>
              </div>

              {/* Job Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredJobs.map((job) => {
                  const fieldConfig = jobFields.find(f => f.id === job.field) || jobFields[0];
                  const Icon = fieldConfig.icon;
                  
                  return (
                    <div
                      key={job.id}
                      className={`rounded-xl border transition-all duration-300 hover:shadow-lg flex flex-col h-full group hover:-translate-y-1 ${
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="p-5 border-b dark:border-gray-700 shrink-0">
                        <div className="flex justify-between items-start mb-3">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${fieldConfig.color} ${fieldConfig.textColor}`}>
                            <Icon className="w-3 h-3" />
                            <span className="font-medium">{fieldConfig.name}</span>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            {job.isNew && (
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400`}>
                                NEW
                              </span>
                            )}
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              job.type === 'Full-time' 
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                : job.type === 'Remote'
                                ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400'
                            }`}>
                              {job.type}
                            </span>
                          </div>
                        </div>
                        
                        <h3 className={`font-bold text-lg mb-3 line-clamp-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {job.title}
                        </h3>
                        
                        <div className="flex items-center gap-2 mb-4">
                          <BuildingIcon className={`w-4 h-4 shrink-0 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                          <span className={`font-medium truncate ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            {job.company}
                          </span>
                        </div>
                        
                        <p className={`text-sm line-clamp-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                          {job.description}
                        </p>
                      </div>

                      <div className="p-5 grow flex flex-col">
                        <div className="space-y-3 grow">
                          <div className="flex items-center gap-3">
                            <MapPinIcon className={`w-4 h-4 shrink-0 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              {job.location}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <DollarIcon className={`w-4 h-4 shrink-0 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              {job.salary}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <CalendarIcon className={`w-4 h-4 shrink-0 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              Posted {job.formattedDate}
                            </span>
                          </div>
                        </div>

                        <div className="mt-6 pt-5 border-t dark:border-gray-700">
                          <a
                            href={job.applyLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all hover:shadow-md"
                          >
                            <ExternalLinkIcon className="w-4 h-4" />
                            Apply Now
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Results Footer */}
              <div className={`mt-8 p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                <div className="text-center">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-left">
                      <p className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Showing {filteredJobs.length} of {jobs.length} total jobs
                      </p>
                      {studentProgram && (
                        <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          Personalized for {getProgramName(studentProgram)} students
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className={`px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                          Use keyboard: ↑↓ for navigation
                        </span>
                      </div>
                      
                      <button
                        onClick={() => {
                          scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          theme === 'dark'
                            ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-800/40 border border-blue-800'
                            : 'bg-blue-100 text-blue-600 hover:bg-blue-200 border border-blue-300'
                        }`}
                      >
                        Back to Top
                      </button>
                    </div>
                  </div>
                  
                  {topCompanies.length > 0 && (
                    <div className="mt-6 pt-6 border-t dark:border-gray-700">
                      <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        Featured Companies
                      </h4>
                      <div className="flex flex-wrap justify-center gap-2">
                        {topCompanies.map(company => (
                          <span
                            key={company}
                            className={`px-3 py-1.5 rounded-full text-sm ${
                              theme === 'dark'
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                            title={company}
                          >
                            {company.length > 20 ? company.substring(0, 20) + '...' : company}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Jobs;