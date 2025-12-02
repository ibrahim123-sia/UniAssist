import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { 
  Send, 
  Brain, 
  GraduationCap,
  Sun,
  Moon,
  Mail,
  Calendar,
  Book,
  Clock,
  Info,
  MessageSquare,
  Sparkles,
  Users,
  Building,
  CreditCard,
  Mic,
  Disc,
  X,
  Volume2
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const GuestChat = () => {
  const { theme, setTheme } = useAppContext();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm UniAssist, your MAJU university assistant. I can help you with admissions information, programs, fees, deadlines, and campus life. How can I help you today?",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Voice recording states (guest version - simplified)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Voice recording for guests (demo only)
  const startRecording = () => {
    toast.info("Voice feature requires registration");
    // In real app, would show registration prompt
    navigate('/register');
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecordingTime(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: userMessage,
      sender: 'user',
      timestamp: new Date()
    }]);

    setIsLoading(true);

    try {
      // Call your backend API for guest queries
      const { data } = await axios.post('/api/chat/guest', {
        message: userMessage,
        context: 'guest_query'
      });

      if (data.success) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          text: data.reply,
          sender: 'bot',
          timestamp: new Date()
        }]);
      } else {
        throw new Error(data.message || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to get response. Please try again.');
      
      // Fallback responses for common queries
      const fallbackResponse = getFallbackResponse(userMessage);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: fallbackResponse,
        sender: 'bot',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getFallbackResponse = (query) => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('program') || lowerQuery.includes('course')) {
      return "MAJU offers undergraduate and graduate programs in Computer Science, Business Administration, Engineering, Media Sciences, and Law. For detailed information, please visit the official MAJU website or contact admissions@maju.edu.pk";
    } else if (lowerQuery.includes('admission') || lowerQuery.includes('requirement')) {
      return "Admission requirements vary by program. Generally, you need a minimum of 60% marks in intermediate/HSC, along with passing the entrance test and interview. International students need equivalent qualifications.";
    } else if (lowerQuery.includes('deadline') || lowerQuery.includes('apply')) {
      return "Fall semester applications typically close by August 15th, and Spring semester by January 15th. Early applications are encouraged. Exact dates may vary each year.";
    } else if (lowerQuery.includes('fee') || lowerQuery.includes('cost')) {
      return "Fee structure depends on the program. For accurate and current fee information, please contact the accounts office at accounts@maju.edu.pk or check the official fee schedule on the MAJU website.";
    } else if (lowerQuery.includes('campus') || lowerQuery.includes('facility')) {
      return "MAJU campus includes modern classrooms, libraries, computer labs, sports facilities, cafeterias, and student lounges. The campus is located in Islamabad with excellent facilities.";
    } else {
      return "I'm here to help with MAJU university information. For specific queries about admissions, programs, fees, or campus life, please ask. You can also visit the official MAJU website or contact the admissions office for detailed information.";
    }
  };

  const suggestedTopics = [
    { icon: <Book className="w-4 h-4" />, text: "What programs does MAJU offer?" },
    { icon: <Users className="w-4 h-4" />, text: "Admission requirements?" },
    { icon: <Calendar className="w-4 h-4" />, text: "Application deadlines?" },
    { icon: <CreditCard className="w-4 h-4" />, text: "Fee structure?" },
    { icon: <Building className="w-4 h-4" />, text: "Campus facilities?" },
    { icon: <Mail className="w-4 h-4" />, text: "Write an email to faculty" }
  ];

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-linear-to-b from-blue-50 via-white to-gray-50'}`}>
      {/* Mobile Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar for Guests (Simplified) */}
      <div className={`flex flex-col h-screen w-72 ${
        theme === 'dark' 
          ? 'bg-gray-900/95 border-gray-700 backdrop-blur-lg' 
          : 'bg-white/95 border-gray-200 backdrop-blur-lg'
      } border-r transition-transform duration-300 fixed md:relative z-40
      ${isMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        
        {/* Close button for mobile */}
        <button
          onClick={() => setIsMenuOpen(false)}
          className="md:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Logo Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-r from-blue-600 to-indigo-600 rounded-lg">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                UniAssist<span className="text-blue-600 dark:text-blue-400">.ai</span>
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                MAJU University Assistant
              </p>
            </div>
          </div>
        </div>

        {/* Guest Info */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-linear-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Guest User
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Limited Access Mode
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4">
          <button
            onClick={() => navigate('/register')}
            className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
            text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Register for Full Access
          </button>
        </div>

        {/* Suggested Topics */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Quick Start Topics
          </h3>
          
          <div className="space-y-2">
            {suggestedTopics.map((topic, index) => (
              <button
                key={index}
                onClick={() => setInputMessage(topic.text)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  theme === 'dark'
                    ? 'hover:bg-gray-800/50'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {topic.icon}
                  <p className={`text-sm font-medium ${
                    theme === "dark" ? "text-gray-200" : "text-gray-800"
                  }`}>
                    {topic.text}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Theme & Auth */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-100/50 dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="w-4 h-4 text-purple-400" />
              ) : (
                <Sun className="w-4 h-4 text-yellow-500" />
              )}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Theme
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={theme === "dark"}
                onChange={toggleTheme}
                className="sr-only peer"
              />
              <div className={`w-10 h-5 rounded-full peer ${
                theme === "dark" ? "bg-purple-600" : "bg-gray-300"
              }`}></div>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                theme === "dark" ? "translate-x-5" : ""
              }`}></div>
            </label>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/login')}
              className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/register')}
              className="flex-1 px-3 py-2 text-sm bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700"
            >
              Register
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden md:ml-0">
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
                  UniAssist<span className="text-blue-600 dark:text-blue-400">.ai</span>
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">Guest Mode</p>
              </div>
              
              <div className="w-8"></div>
            </div>
          </div>
        </header>

        {/* Guest Limitations Banner */}
        <div className={`px-4 py-2 border-b ${
          theme === 'dark' 
            ? 'bg-yellow-900/20 border-yellow-800/30' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Info className={`w-4 h-4 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} />
              <p className={`text-xs ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Guest Mode: Information only. 
                <button 
                  onClick={() => navigate('/register')}
                  className="underline hover:no-underline font-medium ml-1"
                >
                  Register for voice, email & deadline features
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 flex flex-col p-4 md:p-6 xl:px-30 max-md:p-2 overflow-hidden">
          {/* Welcome Message when no chats */}
          {messages.length <= 1 && (
            <div className={`mb-4 p-4 md:p-6 rounded-xl ${
              theme === 'dark'
                ? 'bg-linear-to-r from-gray-800 to-gray-900 border border-gray-700'
                : 'bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100'
            }`}>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="p-3 bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Welcome to UniAssist!
                  </h2>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    Ask me anything about Muhammad Ali Jinnah University. I can help with admissions, programs, fees, deadlines, and campus information.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages Area */}
          <div
            ref={messagesEndRef}
            className="flex-1 mb-3 overflow-y-auto overscroll-contain scroll-smooth"
            style={{
              WebkitOverflowScrolling: "touch",
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3`}
              >
                <div className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.sender === 'user'
                    ? theme === 'dark'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-blue-600 text-white rounded-br-none'
                    : theme === 'dark'
                      ? 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'
                      : 'bg-white text-gray-800 rounded-bl-none border border-gray-200 shadow-sm'
                }`}>
                  <div className="flex items-start gap-2">
                    {message.sender === 'bot' && (
                      <Brain className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    )}
                    <p className="text-sm md:text-base wrap-break-words">{message.text}</p>
                  </div>
                  <p className={`text-xs mt-2 ${
                    message.sender === 'user'
                      ? 'text-blue-200'
                      : theme === 'dark'
                        ? 'text-gray-400'
                        : 'text-gray-500'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  theme === 'dark'
                    ? 'bg-gray-800 border border-gray-700'
                    : 'bg-white border border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Registration Prompts */}
          {messages.length > 1 && (
            <div className={`mb-3 p-4 rounded-xl ${
              theme === 'dark'
                ? 'bg-gray-800/50 border border-gray-700'
                : 'bg-blue-50/50 border border-blue-100'
            }`}>
              <div className="flex flex-col sm:flex-row items-start gap-3">
                <Mail className={`w-5 h-5 mt-0.5 shrink-0 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1 text-sm">
                    Want more features?
                  </h4>
                  <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    Register to unlock voice messages, email automation, and deadline tracking.
                  </p>
                  <button
                    onClick={() => navigate('/register')}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    Register now for full access →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-2 rounded-xl border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 shadow-sm">
            <div className="flex gap-1.5">
              {/* Voice Button (Disabled for guests) */}
              <button
                type="button"
                onClick={startRecording}
                className="px-2.5 py-1.5 rounded-lg border text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700 cursor-not-allowed"
                title="Register to enable voice messages"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
              
              {/* Input Field */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask about MAJU university..."
                  className="w-full pl-3 pr-10 py-1.5 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm rounded-lg border border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                  disabled={isLoading}
                />
              </div>
              
              {/* Send Button */}
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className={`px-3 py-1.5 rounded-lg transition-all shrink-0 flex items-center justify-center ${
                  isLoading || !inputMessage.trim()
                    ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                    : 'bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                }`}
              >
                <Send className={`w-3.5 h-3.5 ${isLoading || !inputMessage.trim() ? 'text-gray-500' : 'text-white'}`} />
              </button>
            </div>
            
            {/* Guest Info */}
            <div className="flex items-center justify-between mt-1.5 px-1">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Guest Mode
                </span>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                <button onClick={() => navigate('/register')} className="text-blue-600 dark:text-blue-400 hover:underline">
                  Register for more →
                </button>
              </div>
            </div>
          </form>

          {/* Guest Instructions */}
          <div className="mt-2">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
              <span className="flex items-center justify-center gap-1">
                <Info className="w-2.5 h-2.5" />
                Guest access: Information only • No voice messages • No data saved
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestChat;