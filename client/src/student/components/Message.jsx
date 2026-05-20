import React from 'react';
import { useSelector } from 'react-redux';
import { User, Bot, Mail, Calendar, Image as ImageIcon, Volume2, Mic } from 'lucide-react';
import Markdown from 'react-markdown';
import moment from 'moment';

const Message = ({ message }) => {
  const theme = useSelector((s) => s.theme.theme);
  const isUser = message.role === 'user';
  const isDark = theme === 'dark';

  return (
    <div className={`flex items-start gap-3 my-3 sm:my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Assistant Avatar */}
      {!isUser && (
        <div
          className="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0"
          style={{
            backgroundColor: isDark ? '#2A1F1A' : '#FCE6E4',
            color: isDark ? '#C48A4A' : '#E63027',
          }}
        >
          <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      )}

      {/* Message Content */}
      <div
        className="max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-2"
        style={{
          backgroundColor: isUser
            ? isDark ? '#1E2A47' : '#1E2A66'
            : isDark ? '#16203A' : '#FFFFFF',
          color: isUser
            ? '#FFFFFF'
            : isDark ? '#ECEEF5' : '#1F2330',
          border: isUser
            ? 'none'
            : isDark ? '1px solid #2A3656' : '1px solid #D8DAE6',
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
              style={{ color: isDark ? '#C48A4A' : '#E63027' }}
            >
              <Mic className="w-4 h-4 animate-pulse" />
              <span>Processing voice message...</span>
            </div>
          )}

          {/* Voice response indicator (assistant) */}
          {message.isVoiceResponse && (
            <div
              className="flex items-center gap-2 text-xs mb-2"
              style={{ color: isDark ? '#C48A4A' : '#E63027' }}
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
                          backgroundColor: isDark ? '#0B1120' : '#F2F3F8',
                          color: isDark ? '#ECEEF5' : '#1F2330',
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
                          backgroundColor: isDark ? '#0B1120' : '#F2F3F8',
                          color: isDark ? '#ECEEF5' : '#1F2330',
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
              style={{ color: isUser ? 'rgba(255,255,255,0.7)' : isDark ? '#9AA5BD' : '#5A6372' }}
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
              : isDark ? '#9AA5BD' : '#5A6372',
          }}
        >
          {moment(message.timestamp).format('h:mm A')}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div
          className="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0"
          style={{
            backgroundColor: isDark ? '#1E2A47' : '#E7E8F0',
            color: isDark ? '#ECEEF5' : '#1E2A66',
          }}
        >
          <User className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      )}
    </div>
  );
};

export default Message;
