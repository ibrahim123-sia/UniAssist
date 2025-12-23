import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import moment from 'moment';

// Correct SVG Icon Components
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

const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeField, setActiveField] = useState('all');
  const [activeCompany, setActiveCompany] = useState('all');
  const [activeLocation, setActiveLocation] = useState('all');
  const [dateFilter, setDateFilter] = useState('30days');
  const [theme, setTheme] = useState('light');
  const scrollContainerRef = useRef(null);
  
  // Your Apify Jobs API
  const APIFY_JOBS_API = import.meta.env.VITE_APIFY_JOBS_API;
  
  // Job Fields/Categories for filtering
  const jobFields = [
    { id: 'all', name: 'All Fields', icon: BriefcaseIcon, color: 'bg-gray-100 dark:bg-gray-800', textColor: 'text-gray-800 dark:text-gray-300' },
    { id: 'web', name: 'Web Development', icon: TagIcon, color: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-600 dark:text-blue-400', keywords: ['web', 'frontend', 'backend', 'full stack', 'react', 'angular', 'vue', 'javascript', 'node', 'php', 'laravel', 'django', 'ruby', 'developer'] },
    { id: 'mobile', name: 'Mobile Development', icon: TagIcon, color: 'bg-purple-100 dark:bg-purple-900/30', textColor: 'text-purple-600 dark:text-purple-400', keywords: ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin'] },
    { id: 'cyber', name: 'Cyber Security', icon: TagIcon, color: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-600 dark:text-red-400', keywords: ['cyber', 'security', 'penetration', 'ethical hacker', 'information security', 'network security', 'cybersecurity', 'soc'] },
    { id: 'devops', name: 'DevOps/Cloud', icon: TagIcon, color: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-600 dark:text-green-400', keywords: ['devops', 'cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'ci/cd', 'infrastructure'] },
    { id: 'data', name: 'Data Science/AI', icon: TagIcon, color: 'bg-yellow-100 dark:bg-yellow-900/30', textColor: 'text-yellow-600 dark:text-yellow-400', keywords: ['data', 'ai', 'machine learning', 'analyst', 'python', 'r', 'tensorflow', 'pytorch', 'big data', 'data engineer'] },
    { id: 'software', name: 'Software Engineer', icon: TagIcon, color: 'bg-indigo-100 dark:bg-indigo-900/30', textColor: 'text-indigo-600 dark:text-indigo-400', keywords: ['software engineer', 'software developer', 'programmer', 'coding', 'developer'] },
    { id: 'qa', name: 'QA/Testing', icon: TagIcon, color: 'bg-pink-100 dark:bg-pink-900/30', textColor: 'text-pink-600 dark:text-pink-400', keywords: ['qa', 'quality', 'testing', 'test', 'automation', 'selenium', 'manual testing'] },
    { id: 'design', name: 'UI/UX Design', icon: TagIcon, color: 'bg-teal-100 dark:bg-teal-900/30', textColor: 'text-teal-600 dark:text-teal-400', keywords: ['design', 'ui', 'ux', 'figma', 'adobe', 'graphic', 'creative'] },
    { id: 'management', name: 'Project Management', icon: TagIcon, color: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-600 dark:text-orange-400', keywords: ['project manager', 'scrum', 'agile', 'pm', 'product manager', 'team lead', 'operations', 'head of'] },
    { id: 'marketing', name: 'Marketing', icon: TagIcon, color: 'bg-cyan-100 dark:bg-cyan-900/30', textColor: 'text-cyan-600 dark:text-cyan-400', keywords: ['marketing', 'brand', 'content', 'digital marketing', 'marketing executive'] },
    { id: 'business', name: 'Business Dev', icon: TagIcon, color: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-600 dark:text-amber-400', keywords: ['business', 'business development', 'sales', 'bdo'] },
    { id: 'other', name: 'Other Fields', icon: TagIcon, color: 'bg-gray-100 dark:bg-gray-800', textColor: 'text-gray-600 dark:text-gray-400', keywords: [] }
  ];

  // Date filter options
  const dateFilterOptions = [
    { id: '24h', name: 'Last 24 Hours' },
    { id: '7days', name: 'Last 7 Days' },
    { id: '30days', name: 'Last 30 Days' },
    { id: 'all', name: 'All Time' }
  ];

  // Comprehensive list of job site domains to exclude
  const jobSiteDomains = [
    // Job portals and aggregators
    'job.id', 'rozee.pk', 'mustakbil', 'brightspyre', 'apify', 'scraping',
    'linkedin', 'indeed', 'glassdoor', 'monster', 'careerbuilder', 'ziprecruiter',
    'dice', 'simplyhired', 'reed', 'totaljobs', 'adzuna', 'cv-library',
    'naukri', 'timesjobs', 'shine', 'jobstreet', 'jobsdb', 'seek',
    'upwork', 'fiverr', 'freelancer', 'guru', 'toptal', 'peopleperhour',
    'remoteok', 'weworkremotely', 'flexjobs', 'angel.co', 'lever',
    'greenhouse', 'workable', 'breezy', 'smartrecruiters', 'icims',
    'jobvite', 'taleo', 'hirestream', 'careers', 'hire', 'recruit',
    'talent', 'staffing', 'employment', 'vacancies', 'positions',
    'openings', 'opportunities', 'jobs', 'job', 'career', 'applicant',
    
    // Navigation and UI elements that might appear as companies
    'Skip to Main Content', 'Min. Salary', 'City', 'Search', 'Country',
    'Advanced Search', 'How It Works', 'Create Account', 'Real Stories',
    'OUR STATISTICS', 'For Jobseekers', 'Browse Opportunities',
    'Trending Searches', 'Trending Jobs', 'Filters', 'Open Positions',
    
    // Pakistani specific job sites
    'rozee', 'mustakbil', 'brightspyre', 'ilmkidunya', 'ilm', 'kidunya',
    'pakistanjobs', 'pakjobs', 'pakistanijobs'
  ];

  // Valid job types
  const validJobTypes = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote', 'Hybrid', 'Temporary'];

  // Noise patterns to remove from text
  const noisePatterns = [
    /<[^>]*>/g, // HTML tags
    /&[a-z]+;/g, // HTML entities
    /\b(?:javascript|css|html|php|js|jquery|bootstrap|react|angular|vue)\b/gi, // Tech stack noise
    /\b(?:click|apply|submit|upload|download|register|signup|login)\b/gi, // Action words
    /\b(?:position|job|opening|vacancy|role|opportunity)\s+\d+\b/gi, // Position numbers
    /\b(?:sample|test|demo|example|placeholder)\b/gi, // Sample/test data
    /\b(?:undefined|null|NaN|N\/A|TBA|TBD)\b/gi, // Undefined values
  ];

  // Check if a string is a job site
  const isJobSite = (text) => {
    if (!text || typeof text !== 'string') return false;
    const lowerText = text.toLowerCase();
    return jobSiteDomains.some(site => lowerText.includes(site.toLowerCase()));
  };

  // Clean text using regex patterns
  const cleanText = (text, maxLength = 200) => {
    if (!text || typeof text !== 'string') return '';
    
    let cleaned = text;
    
    // Remove noise patterns
    noisePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });
    
    // Remove special characters but keep basic punctuation
    cleaned = cleaned.replace(/[^\w\s.,!?@#$%&*()\-+=]/g, ' ');
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Capitalize first letter of each sentence
    cleaned = cleaned.replace(/(^\w|\.\s+\w)/g, match => match.toUpperCase());
    
    // Truncate if needed
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength).trim() + '...';
    }
    
    return cleaned;
  };

  // Extract location from text
  const extractLocation = (locationText) => {
    if (!locationText) return 'Location Not Specified';
    
    const loc = locationText.toString().toLowerCase();
    
    // Check for specific cities
    if (loc.includes('karachi')) return 'Karachi';
    if (loc.includes('lahore')) return 'Lahore';
    if (loc.includes('islamabad')) return 'Islamabad';
    
    // Check for Pakistan
    if (loc.includes('pakistan')) return 'Pakistan';
    
    // Check for remote/hybrid
    if (loc.includes('remote')) return 'Remote';
    if (loc.includes('hybrid')) return 'Hybrid';
    
    // Return cleaned location
    const cleaned = cleanText(locationText, 50);
    return cleaned || 'Location Not Specified';
  };

  // Extract job type from text
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

  // Extract salary information
  const extractSalary = (salaryText) => {
    if (!salaryText) return 'Salary Not Specified';
    
    const salary = salaryText.toString();
    
    // Check for salary patterns
    const salaryPatterns = [
      /(\$?\d+(?:,\d+)*(?:\.\d+)?)\s*[-–]\s*(\$?\d+(?:,\d+)*(?:\.\d+)?)/, // Range: 100,000 - 200,000
      /(?:PKR|Rs\.?|USD)\s*(\d+(?:,\d+)*(?:\.\d+)?)/, // Currency amount: PKR 100,000
      /\d+\s*(?:k|K)\b/, // K notation: 100k
    ];
    
    for (const pattern of salaryPatterns) {
      const match = salary.match(pattern);
      if (match) {
        return salary.substring(0, 100).trim(); // Return first 100 chars of salary info
      }
    }
    
    // Check for "not specified" patterns
    const notSpecifiedPatterns = [
      /salary\s*(?:not\s+)?specified/i,
      /competitive/i,
      /negotiable/i,
      /tba/i,
      /tbd/i,
      /government\s+scale/i,
      /market\s+rate/i,
    ];
    
    for (const pattern of notSpecifiedPatterns) {
      if (pattern.test(salary)) {
        return 'Salary Not Specified';
      }
    }
    
    // If salary looks like nonsense, return default
    if (salary.length < 5 || salary.toLowerCase().includes('undefined')) {
      return 'Salary Not Specified';
    }
    
    return cleanText(salary, 100);
  };

  // Extract job title from various patterns
  const extractJobTitle = (titleText, descriptionText = '') => {
    if (!titleText || titleText.trim().length < 3) {
      // Try to extract title from description
      if (descriptionText) {
        // Look for common job title patterns in description
        const titlePatterns = [
          /(?:looking for|seeking|hiring)\s+an?\s+([A-Z][a-z]+\s+[A-Za-z\s]+?)(?:with|who|to|for|\.)/i,
          /position:\s*([A-Z][a-z]+\s+[A-Za-z\s]+?)(?:\n|\.|$)/i,
          /job title:\s*([A-Z][a-z]+\s+[A-Za-z\s]+?)(?:\n|\.|$)/i,
          /(?:senior|junior|lead|principal)\s+([A-Z][a-z]+\s+[A-Za-z\s]+?)(?:\s+engineer|\s+developer|\s+manager|\s+analyst)/i,
        ];
        
        for (const pattern of titlePatterns) {
          const match = descriptionText.match(pattern);
          if (match && match[1]) {
            return cleanText(match[1].trim(), 100);
          }
        }
      }
      return 'Job Title Not Available';
    }
    
    const cleanedTitle = cleanText(titleText, 100);
    
    // Check if title is noise
    const noiseTitles = [
      'Min. Salary', 'City', 'Search', 'Country', 'Skip to Main Content',
      'Advanced Search', 'How It Works', 'Create Account', 'Job Openings',
      'Open Positions', 'Browse Opportunities', 'Trending Searches',
      'Trending Jobs', 'Filters', 'Why Arbisoft', 'Rozee.pk Position',
      'Folio3 Position', 'Current Openings', 'Call for Proposal',
      'az-block', 'Suggested Job Titles', 'Suggested Companies',
      'Suggested Skills', 'Suggested Institutes', 'Position 1', 'Position 2',
      'Position 3', 'Position 4', 'Position 5', 'Position 6', 'Position 7',
      'Position 8', 'Position 9', 'Position 10'
    ];
    
    if (noiseTitles.some(noise => cleanedTitle.toLowerCase().includes(noise.toLowerCase()))) {
      if (descriptionText) {
        // Try to extract from description
        return extractJobTitle('', descriptionText);
      }
      return 'Job Title Not Available';
    }
    
    return cleanedTitle;
  };

  // Extract company name
  const extractCompany = (companyText) => {
    if (!companyText) return 'Company Not Specified';
    
    const cleaned = cleanText(companyText, 50);
    
    if (isJobSite(cleaned)) {
      return 'Company Not Specified';
    }
    
    // Remove common suffixes
    const suffixes = ['Pvt Ltd', 'Ltd', 'LLC', 'Inc', 'Corp', 'Company', 'Solutions', 'Technologies'];
    let company = cleaned;
    suffixes.forEach(suffix => {
      const regex = new RegExp(`\\s*${suffix}\\s*$`, 'i');
      company = company.replace(regex, '');
    });
    
    return company.trim() || 'Company Not Specified';
  };

  // Determine job field based on title and description
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

  // Parse date from various formats
  const parseDate = (dateString) => {
    if (!dateString) return moment();
    
    const dateStr = dateString.toString();
    
    // Try various date formats
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
        return parsed;
      }
    }
    
    // Try parsing as ISO string
    const isoParsed = moment(dateStr);
    if (isoParsed.isValid()) {
      return isoParsed;
    }
    
    return moment(); // Default to current date
  };

  useEffect(() => {
    fetchJobs();
    // Detect system theme preference
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(darkModeMediaQuery.matches ? 'dark' : 'light');
    
    const handleThemeChange = (e) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    
    darkModeMediaQuery.addEventListener('change', handleThemeChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [jobs, activeField, activeCompany, activeLocation, dateFilter]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching jobs from:', APIFY_JOBS_API);
      const response = await axios.get(APIFY_JOBS_API);
      
      console.log('Raw API Response:', response.data);
      console.log('Total jobs from API:', response.data.length, 'jobs');
      
      // Process and clean job data
      const processedJobs = response.data
        .map((job, index) => {
          try {
            // Skip invalid jobs
            if (!job || typeof job !== 'object') {
              console.log('Skipping invalid job object');
              return null;
            }
            
            // Extract and clean data
            const title = extractJobTitle(job.title, job.description);
            const company = extractCompany(job.company);
            const location = extractLocation(job.location);
            const salary = extractSalary(job.salary);
            const type = extractJobType(job.type);
            const postedDate = parseDate(job.postedDate);
            const description = cleanText(job.description || '', 200);
            const field = determineJobField(title, description);
            
            // Skip if essential data is missing
            if (title === 'Job Title Not Available' || company === 'Company Not Specified') {
              console.log('Skipping job with missing essential data:', { title, company });
              return null;
            }
            
            // Skip if it's clearly a job site or noise
            if (isJobSite(title) || isJobSite(company) || isJobSite(description)) {
              console.log('Skipping job site/noise:', { title, company });
              return null;
            }
            
            // Calculate if job is new (within 7 days)
            const isNew = moment().diff(postedDate, 'days') <= 7;
            
            // Generate unique ID
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
            console.error('Error processing job:', err, job);
            return null;
          }
        })
        .filter(job => {
          if (!job) return false;
          
          // Additional filtering
          const hasValidTitle = job.title && job.title.length > 5 && job.title !== 'Job Title Not Available';
          const hasValidCompany = job.company && job.company.length > 2 && job.company !== 'Company Not Specified';
          const isNotJobSite = !isJobSite(job.title) && !isJobSite(job.company) && !isJobSite(job.description);
          
          return hasValidTitle && hasValidCompany && isNotJobSite;
        });
      
      console.log('Processed jobs:', processedJobs.length);
      console.log('Sample processed jobs:', processedJobs.slice(0, 5));
      
      // Filter only last 30 days data
      const last30DaysJobs = processedJobs.filter(job => {
        const daysDiff = moment().diff(job.postedDate, 'days');
        return daysDiff <= 30;
      });
      
      console.log('Last 30 days jobs:', last30DaysJobs.length);
      setJobs(last30DaysJobs);
      
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError(`Failed to load jobs: ${err.message}. Please check your API connection.`);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...jobs];
    
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
    }
    
    // Apply company filter
    if (activeCompany !== 'all') {
      result = result.filter(job => job.company === activeCompany);
    }
    
    // Apply location filter - match specific cities
    if (activeLocation !== 'all') {
      result = result.filter(job => {
        const jobLocation = job.location.toLowerCase();
        const filterLocation = activeLocation.toLowerCase();
        
        // Special handling for Pakistan cities
        if (filterLocation === 'pakistan') {
          return jobLocation.includes('pakistan') || 
                 jobLocation.includes('karachi') ||
                 jobLocation.includes('lahore') ||
                 jobLocation.includes('islamabad');
        }
        
        return jobLocation.includes(filterLocation);
      });
    }
    
    console.log('Filtered jobs count:', result.length);
    setFilteredJobs(result);
  };

  // Get unique companies and locations for filters
  const { uniqueCompanies, uniqueLocations, topCompanies } = useMemo(() => {
    // Filter out job sites and invalid companies
    const validCompanies = jobs
      .map(job => job.company)
      .filter(c => c && c !== 'Company Not Specified' && !isJobSite(c) && c.length > 2);
    
    const companies = [...new Set(validCompanies)].sort();
    
    // Location filtering - prioritize Pakistan cities
    const allLocations = jobs.map(job => job.location);
    
    // Extract and categorize locations
    const locationCategories = {
      'Karachi': [],
      'Lahore': [],
      'Islamabad': [],
      'Pakistan': [], // For other Pakistan locations
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
    
    // Create location list with counts
    const locationsWithCounts = Object.entries(locationCategories)
      .filter(([_, locations]) => locations.length > 0)
      .map(([category, locs]) => {
        const uniqueLocs = [...new Set(locs)];
        return {
          category,
          count: locs.length,
          displayName: `${category} (${locs.length})`,
          value: category.toLowerCase()
        };
      })
      .sort((a, b) => b.count - a.count);
    
    const locations = locationsWithCounts.map(item => item.category);
    
    // Count jobs per company for top companies
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

  // Calculate stats
  const jobStats = useMemo(() => {
    const now = moment();
    
    return {
      total: jobs.length,
      web: jobs.filter(j => j.field === 'web').length,
      mobile: jobs.filter(j => j.field === 'mobile').length,
      cyber: jobs.filter(j => j.field === 'cyber').length,
      devops: jobs.filter(j => j.field === 'devops').length,
      data: jobs.filter(j => j.field === 'data').length,
      new: jobs.filter(j => j.isNew).length,
      today: jobs.filter(j => now.diff(j.postedDate, 'hours') <= 24).length,
      companies: uniqueCompanies.length
    };
  }, [jobs, uniqueCompanies]);

  // Handle keyboard navigation for scrolling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!scrollContainerRef.current) return;
      
      const { key } = e;
      const scrollStep = 100;
      
      switch(key) {
        case 'ArrowDown':
          scrollContainerRef.current.scrollBy({ top: scrollStep, behavior: 'smooth' });
          break;
        case 'ArrowUp':
          scrollContainerRef.current.scrollBy({ top: -scrollStep, behavior: 'smooth' });
          break;
        case 'PageDown':
          scrollContainerRef.current.scrollBy({ top: 500, behavior: 'smooth' });
          break;
        case 'PageUp':
          scrollContainerRef.current.scrollBy({ top: -500, behavior: 'smooth' });
          break;
        case 'Home':
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          break;
        case 'End':
          scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
          break;
        default:
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className={`h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
            Loading jobs from top companies...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
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
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Fixed Header */}
      <div className="shrink-0 sticky top-0 z-10 bg-inherit border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-blue-600">
                Job Opportunities
              </h1>
              <p className={`text-sm md:text-base ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                {jobStats.companies > 0 
                  ? `Latest jobs from ${jobStats.companies} companies • Last 30 days only`
                  : 'Loading job data...'}
              </p>
            </div>
            <button
              onClick={fetchJobs}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-800/40 border border-blue-800'
                  : 'bg-blue-100 text-blue-600 hover:bg-blue-200 border border-blue-300'
              }`}
            >
              <RefreshIcon className="w-4 h-4" />
              Refresh
            </button>
          </div>
          
          {/* Top Companies Bar */}
          {topCompanies.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <CompaniesIcon className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Top Companies:
              </span>
              <div className="flex flex-wrap gap-2 ml-2">
                {topCompanies.map(company => (
                  <span
                    key={company}
                    className={`px-3 py-1 rounded-full text-xs ${
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 border border-gray-700'
                        : 'bg-gray-100 text-gray-700 border border-gray-300'
                    }`}
                    title={company}
                  >
                    {company.length > 20 ? company.substring(0, 20) + '...' : company}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className={`text-sm px-3 py-1 rounded-full ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
              {filteredJobs.length} jobs • {jobs.length} total in last 30 days
            </div>
            {jobStats.total > 0 && (
              <div className="flex gap-2">
                {jobStats.new > 0 && (
                  <div className={`text-sm px-3 py-1 rounded-full ${theme === 'dark' ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-600'}`}>
                    {jobStats.new} new this week
                  </div>
                )}
                {jobStats.web > 0 && (
                  <div className={`text-sm px-3 py-1 rounded-full ${theme === 'dark' ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                    {jobStats.web} web dev
                  </div>
                )}
                {jobStats.cyber > 0 && (
                  <div className={`text-sm px-3 py-1 rounded-full ${theme === 'dark' ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-600'}`}>
                    {jobStats.cyber} security
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content with hidden scrollbar */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        style={{ 
          scrollBehavior: 'smooth',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {/* CSS to hide scrollbar for Webkit browsers */}
        <style jsx global>{`
          .overflow-y-auto::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        
        <div className="container mx-auto px-4 py-6">
          {/* Filters Section */}
          {jobs.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <FilterIcon className="w-5 h-5 text-gray-500" />
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Filter Jobs
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Date Filter */}
                <div>
                  <h4 className={`text-sm font-medium mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    <CalendarRangeIcon className="w-4 h-4" />
                    Date Posted
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {dateFilterOptions.map((option) => {
                      const count = option.id === 'all' 
                        ? jobs.length 
                        : jobs.filter(job => {
                          const now = moment();
                          switch(option.id) {
                            case '24h':
                              return now.diff(job.postedDate, 'hours') <= 24;
                            case '7days':
                              return now.diff(job.postedDate, 'days') <= 7;
                            case '30days':
                              return now.diff(job.postedDate, 'days') <= 30;
                            default:
                              return true;
                          }
                        }).length;
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => setDateFilter(option.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                            dateFilter === option.id
                              ? 'bg-blue-600 text-white'
                              : theme === 'dark'
                              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                          }`}
                        >
                          <span>{option.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            dateFilter === option.id
                              ? 'bg-white/30'
                              : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Field Filter */}
                <div className="md:col-span-2">
                  <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    By Field / Category
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {jobFields.map((field) => {
                      const Icon = field.icon;
                      const count = field.id === 'all' 
                        ? jobs.length 
                        : jobs.filter(j => j.field === field.id).length;
                      
                      if (count === 0 && field.id !== 'all') return null;
                      
                      return (
                        <button
                          key={field.id}
                          onClick={() => setActiveField(field.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                            activeField === field.id
                              ? field.id === 'all'
                                ? 'bg-blue-600 text-white'
                                : `${field.color} ${field.textColor} border border-current`
                              : theme === 'dark'
                              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{field.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeField === field.id && field.id !== 'all'
                              ? theme === 'dark' ? 'bg-black/30' : 'bg-white/30'
                              : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    }).filter(Boolean)}
                  </div>
                </div>
                
                {/* Company & Location Filters */}
                <div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Company Filter */}
                    <div>
                      <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        By Company
                      </h4>
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        <button
                          onClick={() => setActiveCompany('all')}
                          className={`px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                            activeCompany === 'all'
                              ? 'bg-blue-600 text-white'
                              : theme === 'dark'
                              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                          }`}
                        >
                          All Companies
                        </button>
                        {uniqueCompanies.slice(0, 15).map(company => {
                          const count = jobs.filter(j => j.company === company).length;
                          if (count === 0) return null;
                          
                          return (
                            <button
                              key={company}
                              onClick={() => setActiveCompany(company)}
                              className={`px-3 py-2.5 rounded-lg text-sm transition-colors text-left group ${
                                activeCompany === company
                                  ? 'bg-blue-600 text-white'
                                  : theme === 'dark'
                                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                                  : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                              }`}
                              title={company}
                            >
                              <div className="flex justify-between items-center">
                                <span className="truncate pr-2 group-hover:whitespace-normal group-hover:overflow-visible group-hover:text-clip">
                                  {company}
                                </span>
                                <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full ${
                                  activeCompany === company
                                    ? 'bg-white/30'
                                    : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
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
                    <div>
                      <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        By Location
                      </h4>
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        <button
                          onClick={() => setActiveLocation('all')}
                          className={`px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                            activeLocation === 'all'
                              ? 'bg-blue-600 text-white'
                              : theme === 'dark'
                              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                          }`}
                        >
                          All Locations
                        </button>
                        {uniqueLocations.slice(0, 15).map(location => {
                          const count = jobs.filter(j => j.location.includes(location)).length;
                          if (count === 0) return null;
                          
                          const displayLocation = location === 'Pakistan' ? 'Pakistan (Other)' : location;
                          
                          return (
                            <button
                              key={location}
                              onClick={() => setActiveLocation(location)}
                              className={`px-3 py-2.5 rounded-lg text-sm transition-colors text-left group ${
                                activeLocation === location
                                  ? 'bg-blue-600 text-white'
                                  : theme === 'dark'
                                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                                  : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                              }`}
                              title={location}
                            >
                              <div className="flex justify-between items-center">
                                <span className="truncate pr-2 group-hover:whitespace-normal group-hover:overflow-visible group-hover:text-clip">
                                  {displayLocation}
                                </span>
                                <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full ${
                                  activeLocation === location
                                    ? 'bg-white/30'
                                    : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
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
              
              {/* Active Filters Info */}
              {(activeField !== 'all' || activeCompany !== 'all' || activeLocation !== 'all' || dateFilter !== '30days') && (
                <div className={`mt-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                      Showing {filteredJobs.length} jobs
                      {dateFilter !== '30days' && ` posted ${dateFilterOptions.find(d => d.id === dateFilter)?.name?.toLowerCase()}`}
                      {activeField !== 'all' && ` in ${jobFields.find(f => f.id === activeField)?.name}`}
                      {activeCompany !== 'all' && ` at ${activeCompany}`}
                      {activeLocation !== 'all' && ` in ${activeLocation}`}
                    </span>
                    <button
                      onClick={() => {
                        setActiveField('all');
                        setActiveCompany('all');
                        setActiveLocation('all');
                        setDateFilter('30days');
                      }}
                      className={`text-sm ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} hover:underline transition-colors`}
                    >
                      Clear all filters
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Jobs Grid */}
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <BriefcaseIcon className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {jobs.length === 0 ? 'No Jobs Available' : 'No Jobs Match Filters'}
              </h3>
              <p className={`mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {jobs.length === 0 
                  ? 'No jobs found in the last 30 days. The API might be empty or there might be a connection issue.' 
                  : 'No jobs match the selected filters. Try adjusting your criteria.'}
              </p>
              {jobs.length === 0 ? (
                <button
                  onClick={fetchJobs}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Refresh Jobs
                </button>
              ) : (
                <button
                  onClick={() => {
                    setActiveField('all');
                    setActiveCompany('all');
                    setActiveLocation('all');
                    setDateFilter('30days');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Show All Jobs
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                {filteredJobs.map((job) => {
                  const fieldConfig = jobFields.find(f => f.id === job.field) || jobFields[0];
                  const Icon = fieldConfig.icon;
                  
                  return (
                    <div
                      key={job.id}
                      className={`rounded-xl overflow-hidden border transition-all hover:shadow-lg flex flex-col h-full ${
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Job Header */}
                      <div className={`p-5 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'} flex-shrink-0`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${fieldConfig.color} ${fieldConfig.textColor}`}>
                            <Icon className="w-3 h-3" />
                            <span className="font-medium">{fieldConfig.name}</span>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            {job.isNew && (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                theme === 'dark' 
                                  ? 'bg-green-900/30 text-green-400' 
                                  : 'bg-green-100 text-green-600'
                              }`}>
                                NEW
                              </span>
                            )}
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              job.type === 'Full-time' 
                                ? theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                                : job.type === 'Part-time' 
                                ? theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-600'
                                : job.type === 'Contract'
                                ? theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-600'
                                : job.type === 'Remote'
                                ? theme === 'dark' ? 'bg-teal-900/30 text-teal-400' : 'bg-teal-100 text-teal-600'
                                : theme === 'dark' ? 'bg-gray-900/30 text-gray-400' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {job.type}
                            </span>
                          </div>
                        </div>
                        
                        <h3 className={`font-bold text-lg mb-2 line-clamp-2 min-h-[3.5rem] ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} title={job.title}>
                          {job.title}
                        </h3>
                        
                        <div className="flex items-center gap-2 mb-3">
                          <BuildingIcon className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                          <span className={`font-medium truncate ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} title={job.company}>
                            {job.company}
                          </span>
                        </div>
                        
                        <p className={`text-sm mb-4 line-clamp-3 min-h-[4.5rem] ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} title={job.description}>
                          {job.description}
                        </p>
                      </div>

                      {/* Job Details */}
                      <div className="p-5 grow flex flex-col">
                        <div className="space-y-3 grow">
                          <div className="flex items-center gap-3">
                            <MapPinIcon className={`w-4 h-4 shrink-0 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} title={job.location}>
                              {job.location}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <DollarIcon className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} title={job.salary}>
                              {job.salary}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <CalendarIcon className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              Posted {job.formattedDate}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <ClockIcon className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-sm truncate ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} title={`Source: ${job.source}`}>
                              Source: {job.source}
                            </span>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="mt-6 flex-shrink-0">
                          <a
                            href={job.applyLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md"
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

              {/* Stats Footer */}
              <div className={`mt-8 p-6 rounded-xl ${
                theme === 'dark' 
                  ? 'bg-gray-800' 
                  : 'bg-white border border-gray-200'
              }`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                  <div>
                    <div className={`text-2xl font-bold mb-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                      {filteredJobs.length}
                    </div>
                    <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Filtered Jobs
                    </div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold mb-1 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                      {jobStats.web}
                    </div>
                    <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Web Development
                    </div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold mb-1 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                      {jobStats.cyber}
                    </div>
                    <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Cyber Security
                    </div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold mb-1 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      {jobStats.new}
                    </div>
                    <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      New This Week
                    </div>
                  </div>
                </div>
                
                {/* Navigation Hint */}
                <div className={`mt-6 text-center text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  <p>Use arrow keys (↑↓), Page Up/Down, or Home/End to navigate</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${theme === 'dark' ? '#374151' : '#f3f4f6'};
          border-radius: 3px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? '#6b7280' : '#d1d5db'};
          border-radius: 3px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${theme === 'dark' ? '#9ca3af' : '#9ca3af'};
        }
      `}</style>
    </div>
  );
};

export default Jobs;