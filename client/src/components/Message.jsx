import React from 'react';
import { useAppContext } from '../context/AppContext';
import { User, Bot, Mail, Calendar, Image as ImageIcon, Volume2, Mic } from 'lucide-react';
import Markdown from 'react-markdown';
import moment from 'moment';

const Message = ({ message }) => {
  const { theme } = useAppContext();
  const isUser = message.role === 'user';
  const isDark = theme === 'dark';

  return (
    <div className={`flex items-start gap-3 my-3 sm:my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Assistant Avatar */}
      {!isUser && (
        <div
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            backgroundColor: isDark ? '#2A1F1A' : '#FCEEEB',
            color: isDark ? '#E57A63' : '#D0321E',
          }}
        >
          <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      )}

      {/* Message Content */}
      <div
        className="max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3"
        style={{
          backgroundColor: isUser
            ? isDark ? '#243763' : '#1E2E6E'
            : isDark ? '#17203A' : '#FFFFFF',
          color: isUser
            ? '#FFFFFF'
            : isDark ? '#ECEEF3' : '#222222',
          border: isUser
            ? 'none'
            : isDark ? '1px solid #273350' : '1px solid #E2E5EA',
          boxShadow: !isUser && !isDark ? '0 1px 2px rgba(30, 46, 110, 0.04)' : 'none',
        }}
      >
        {/* Message Header */}
        <div className="flex items-center gap-2 mb-2">
          {message.type === 'email' && <Mail className="w-4 h-4" />}
          {message.type === 'deadline' && <Calendar className="w-4 h-4" />}
          {message.isImage && <ImageIcon className="w-4 h-4" />}
          {message.type === 'voice' && (
            <div className="flex items-center gap-1">
              <Mic className="w-4 h-4" />
              <span className="text-xs opacity-75">Voice Message</span>
            </div>
          )}
          {message.isVoiceResponse && <Volume2 className="w-4 h-4" />}
          <span className="text-xs font-medium opacity-75">
            {isUser ? 'You' : 'UniAssist'}
          </span>
        </div>

        {/* Message Body */}
        <div className="text-sm sm:text-base">
          {/* Voice message processing indicator */}
          {message.type === 'voice' && message.isProcessing && (
            <div
              className="flex items-center gap-2 text-sm"
              style={{ color: isDark ? '#E57A63' : '#D0321E' }}
            >
              <Mic className="w-4 h-4 animate-pulse" />
              <span>Processing voice message...</span>
            </div>
          )}

          {/* Voice response indicator (assistant) */}
          {message.isVoiceResponse && (
            <div
              className="flex items-center gap-2 text-xs mb-2"
              style={{ color: isDark ? '#E57A63' : '#D0321E' }}
            >
              <Volume2 className="w-3 h-3" />
              <span>Response to your voice message</span>
            </div>
          )}

          {/* Regular message content */}
          {message.isImage ? (
            <img
              src={message.content}
              alt="Generated"
              className="w-full max-w-md mt-2 rounded-lg"
              loading="lazy"
            />
          ) : (
            <div className="wrap-break-words">
              <Markdown
                components={{
                  code({ className, children, ...props }) {
                    return (
                      <code
                        className={`${className} px-1 py-0.5 rounded text-sm`}
                        style={{
                          backgroundColor: isDark ? '#121A2E' : '#F5F6F8',
                          color: isDark ? '#ECEEF3' : '#222222',
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  pre({ children, ...props }) {
                    return (
                      <pre
                        className="p-3 rounded-lg overflow-x-auto my-2 text-sm"
                        style={{
                          backgroundColor: isDark ? '#121A2E' : '#F5F6F8',
                          color: isDark ? '#ECEEF3' : '#222222',
                        }}
                        {...props}
                      >
                        {children}
                      </pre>
                    );
                  },
                }}
              >
                {message.content}
              </Markdown>
            </div>
          )}

          {/* Voice message metadata */}
          {message.type === 'voice' && message.voiceMeta && (
            <div
              className="text-xs mt-2"
              style={{ color: isUser ? 'rgba(255,255,255,0.7)' : isDark ? '#A9B2C7' : '#5A6372' }}
            >
              Duration: {message.voiceMeta.duration}s
              {message.voiceMeta.transcriptionService && (
                <span className="ml-2">
                  • Service: {message.voiceMeta.transcriptionService}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div
          className="text-xs mt-3"
          style={{
            color: isUser
              ? 'rgba(255,255,255,0.7)'
              : isDark ? '#A9B2C7' : '#5A6372',
          }}
        >
          {moment(message.timestamp).format('h:mm A')}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            backgroundColor: isDark ? '#243763' : '#EEF1FA',
            color: isDark ? '#ECEEF3' : '#1E2E6E',
          }}
        >
          <User className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      )}
    </div>
  );
};

export default Message;
