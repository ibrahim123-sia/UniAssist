// pages/Credits.jsx
import React, { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import toast from "react-hot-toast";
import Sidebar from "../components/Sidebar";
import MobileMenuButton from "../components/MobileMenuButton";
import { 
  CreditCard, 
  CheckCircle, 
  Zap, 
  Crown, 
  Sparkles,
  ArrowRight,
  Shield,
  Mic,
  Mail,
  MessageSquare,
  Headphones,
  Coins,
  Trophy
} from "lucide-react";

const Credits = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { token, axios, theme, user } = useAppContext();

  const fetchPlans = async () => {
    try {
      const { data } = await axios.get("/api/credit/plan", {
        headers: { Authorization: token },
      });
      if (data.success) {
        setPlans(data.plans);
      } else {
        toast.error(data.message || "Failed to fetch plans");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const purchasePlan = async (planId) => {
    try {
      const { data } = await axios.post(
        "/api/credit/purchase",
        { planId },
        {
          headers: { Authorization: token },
        }
      );

      if (data.success) {
        window.location.href = data.url;
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Purchase failed");
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-t-4 border-blue-600 border-solid rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Default plans in PKR
  const defaultPlans = [
    {
      _id: "basic",
      name: "Basic",
      price: 499,
      credits: 100,
      features: [
        "100 AI Credits",
        "Text Q&A (1 credit/query)",
        "Voice Query (2 credits/query)",
        "Job opportunities ",
        "Basic Support"
      ],
      popular: false
    },
    {
      _id: "pro",
      name: "Pro",
      price: 999,
      credits: 250,
      features: [
        "250 AI Credits",
        "Everything in Basic",
        "Job opportunities",
        "University Events Access",
        ""
      ],
      popular: true
    },
    {
      _id: "premium",
      name: "Premium",
      price: 1999,
      credits: 600,
      features: [
        "600 AI Credits",
        "Everything in Pro",
        "24/7 Priority Support",
        "Job opportunities",
        "University Events Access"
      ],
      popular: false
    }
  ];

  const displayPlans = plans.length > 0 ? plans : defaultPlans;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Menu Button */}
      <MobileMenuButton 
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />
      
      {/* Sidebar */}
     
      
      {/* Main Content */}
      <div className={`flex-1 overflow-y-auto transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-linear-to-b from-gray-900 to-gray-800' 
          : 'bg-linear-to-b from-blue-50 to-gray-50'
      }`}>
        
        {/* Mobile Header */}
        <header className={`md:hidden sticky top-0 z-10 border-b ${
          theme === 'dark' 
            ? 'bg-gray-900/95 border-gray-700 backdrop-blur-lg' 
            : 'bg-white/95 border-gray-200 backdrop-blur-lg'
        }`}>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <div className="flex flex-col items-center">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  Credits Store
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">Power up your assistant</p>
              </div>
              
              <div className="w-8"></div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="p-4 md:p-6 lg:p-8">
          {/* Header Section */}
          <div className="max-w-4xl mx-auto text-center mb-6 md:mb-8">
            <div className="flex flex-col items-center gap-4 mb-4">
              <div className="p-4 bg-linear-to-r from-blue-600 to-indigo-600 rounded-2xl">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  Credit Plans
                </h1>
                <p className={`text-sm md:text-base mt-1 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Purchase credits to power your UniAssist experience
                </p>
              </div>
            </div>

            {/* Current Credits Card */}
            <div className={`max-w-md mx-auto p-4 md:p-6 rounded-xl mb-6 ${
              theme === 'dark'
                ? 'bg-gray-800/50 border border-gray-700'
                : 'bg-white/50 border border-gray-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Zap className={`w-6 h-6 ${
                    theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'
                  }`} />
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Your Credits
                    </h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {user?.credits || 0}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => purchasePlan("pro")}
                  className="px-4 py-2 text-sm bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700"
                >
                  Get More
                </button>
              </div>
              
              {/* Credit Usage Legend */}
              <div className={`grid grid-cols-3 gap-2 p-3 rounded-lg ${
                theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-100/50'
              }`}>
                <div className="text-center">
                  <MessageSquare className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">1 credit</p>
                </div>
                <div className="text-center">
                  <Mic className="w-4 h-4 text-green-500 mx-auto mb-1" />
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">2 credits</p>
                </div>
                <div className="text-center">
                  <Mail className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">1 credit</p>
                </div>
              </div>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="max-w-6xl mx-auto mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {displayPlans.map((plan) => (
                <div
                  key={plan._id}
                  className={`rounded-xl border transition-all duration-300 hover:scale-[1.02] flex flex-col h-full ${
                    plan.popular
                      ? theme === 'dark'
                        ? 'border-purple-500 bg-linear-to-b from-purple-900/20 to-gray-900 shadow-lg'
                        : 'border-purple-400 bg-linear-to-b from-purple-50 to-white shadow-lg'
                      : theme === 'dark'
                      ? 'border-gray-700 bg-linear-to-b from-gray-800/50 to-gray-900'
                      : 'border-gray-200 bg-linear-to-b from-white to-gray-50 shadow'
                  }`}
                >
                  {/* Plan Header */}
                  <div className={`p-4 md:p-6 border-b ${
                    theme === 'dark'
                      ? 'border-gray-700'
                      : 'border-gray-100'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {plan.name}
                      </h3>
                      {plan.popular && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-linear-to-r from-purple-500 to-pink-500 text-white rounded-full">
                          <Crown className="w-3 h-3" />
                          Popular
                        </span>
                      )}
                    </div>
                    
                    {/* Price in PKR */}
                    <div className="mb-3">
                      <div className="flex items-baseline">
                        <span className={`text-2xl md:text-3xl font-bold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          Rs. {plan.price}
                        </span>
                        <span className={`ml-2 text-xs ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          / one-time
                        </span>
                      </div>
                      <p className={`text-xs md:text-sm ${
                        plan.popular
                          ? theme === 'dark'
                            ? 'text-purple-300'
                            : 'text-purple-600'
                          : theme === 'dark'
                          ? 'text-blue-400'
                          : 'text-blue-600'
                      } font-medium`}>
                        <Coins className="w-4 h-4 inline mr-1" />
                        {plan.credits} AI Credits
                      </p>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="p-4 md:p-6 flex-1">
                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                            plan.popular
                              ? 'text-green-500'
                              : theme === 'dark'
                              ? 'text-blue-400'
                              : 'text-blue-500'
                          }`} />
                          <span className={`text-xs md:text-sm ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Purchase Button */}
                  <div className="p-4 md:p-6 pt-0">
                    <button
                      onClick={() => {
                        toast.promise(purchasePlan(plan._id), {
                          loading: 'Processing...',
                          success: 'Redirecting to payment...',
                          error: 'Purchase failed'
                        });
                      }}
                      className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm ${
                        plan.popular
                          ? 'bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                          : theme === 'dark'
                          ? 'bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                          : 'bg-linear-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white'
                      }`}
                    >
                      {plan.popular ? "Get Premium" : "Buy Now"}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    
                    {/* Per Credit Cost */}
                    <p className={`text-center text-xs mt-2 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Rs. {(plan.price / plan.credits).toFixed(2)} per credit
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Information */}
          <div className="max-w-4xl mx-auto">
            {/* How Credits Work */}
            <div className={`p-4 md:p-6 rounded-xl mb-4 ${
              theme === 'dark'
                ? 'bg-gray-800/30 border border-gray-700'
                : 'bg-white/50 border border-gray-200'
            }`}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                How Credits Work
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Text Q&A</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">1 credit per question answered</p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Mic className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Voice Query</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">2 credits per voice query processed</p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">Job opportunities</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">see relevant job opportunities</p>
                </div>
              </div>
            </div>

            {/* Support and Security */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-xl flex items-start gap-3 ${
                theme === 'dark'
                  ? 'bg-gray-800/30 border border-gray-700'
                  : 'bg-blue-50/50 border border-blue-100'
              }`}>
                <Shield className="w-6 h-6 text-green-500 shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    100% Secure Payments
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    All transactions are encrypted. We support all major Pakistani payment methods including JazzCash, EasyPaisa, and bank transfers.
                  </p>
                </div>
              </div>
              
              <div className={`p-4 rounded-xl flex items-start gap-3 ${
                theme === 'dark'
                  ? 'bg-gray-800/30 border border-gray-700'
                  : 'bg-gray-50/50 border border-gray-200'
              }`}>
                <Headphones className="w-6 h-6 text-blue-500 shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    24/7 Support
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Need help? Contact our support team at support@uniassist.pk or call us at 021-111-222-333
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Credits;