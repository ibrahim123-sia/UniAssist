import React from 'react';
import { useAppContext } from '../context/AppContext';
import { User, Bot, Mail, Calendar, Image as ImageIcon, Volume2, Mic } from 'lucide-react';
import Markdown from 'react-markdown';
import moment from 'moment';

const Message = ({ message }) => {
  const { theme } = useAppContext();
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 my-3 sm:my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar */}
      {!isUser && (
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
          theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
        }`}>
          <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
        </div>
      )}

      {/* Message Content */}
      <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? theme === 'dark'
            ? 'bg-blue-600 text-white'
            : 'bg-blue-600 text-white'
          : theme === 'dark'
            ? 'bg-gray-800 border border-gray-700'
            : 'bg-white border border-gray-200 shadow-sm'
      }`}>
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
          {/* Voice message transcription (user) */}
          {message.type === 'voice' && (
            <div className="mb-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 mb-1">
                <Mic className="w-3 h-3" />
                <span>Voice transcribed:</span>
              </div>
              <div className="text-sm">
                {message.content}
              </div>
              {message.voiceMeta && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Duration: {message.voiceMeta.duration}s
                </div>
              )}
            </div>
          )}

          {/* Voice response indicator (assistant) */}
          {message.isVoiceResponse && (
            <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 mb-2">
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
            <div className={`wrap-break-words ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>
              <Markdown
                components={{
                  code({node, inline, className, children, ...props}) {
                    return (
                      <code 
                        className={`${className} ${theme === 'dark' ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-800'} px-1 py-0.5 rounded text-sm`}
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  },
                  pre({node, children, ...props}) {
                    return (
                      <pre 
                        className={`${theme === 'dark' ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-800'} p-3 rounded-lg overflow-x-auto my-2 text-sm`}
                        {...props}
                      >
                        {children}
                      </pre>
                    )
                  }
                }}
              >
                {message.content}
              </Markdown>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className={`text-xs mt-3 ${
          isUser
            ? theme === 'dark' ? 'text-blue-300' : 'text-blue-200'
            : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {moment(message.timestamp).format('h:mm A')}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
          theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
        }`}>
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
        </div>
      )}
    </div>
  );
};

export default Message;