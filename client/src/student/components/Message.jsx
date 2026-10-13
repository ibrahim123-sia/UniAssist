import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  User,
  Bot,
  Mail,
  Calendar,
  Image as ImageIcon,
  Volume2,
  Mic,
  Info,
  MessageCircleQuestion,
  Check,
  Loader2,
  FileWarning,
} from 'lucide-react';
import MarkdownContent from '../../components/MarkdownContent';
import ComplaintForm, { ComplaintResult } from './ComplaintForm';
import moment from 'moment';

// One chat bubble. Memoised and fed only stable props (primitives, the
// message object from the store, and index-taking callbacks the page
// creates once), so typing in the composer or a new reply arriving doesn't
// re-render — or re-parse the markdown of — every earlier message.
//
// `askState` drives the "Ask an admin" action on assistant replies:
// undefined (not asked) | 'sending' | 'sent'. Omit `onAskAdmin` to hide it.
// "Register a complaint": `complaint` is undefined | { open: true } (form
// showing) | { result } (filed); omit `onRegisterComplaint` to hide it.
// `question` is the user question this reply answered (for the complaint
// form's department suggestion).
const Message = ({
  message,
  index,
  chatId,
  question,
  onAskAdmin,
  askState,
  onRegisterComplaint,
  complaint,
  onComplaintCancel,
  onComplaintFiled,
}) => {
  const theme = useSelector((s) => s.theme.theme);
  const isUser = message.role === 'user';
  const isDark = theme === 'dark';
  const muted = isDark ? '#9AA5BD' : '#5A6372';
  // The server already forwarded this one to the admins (auto-captured). A
  // stored message may only carry the questionId, so that counts too.
  const escalated =
    !isUser &&
    message.answered === false &&
    (message.escalated === true || !!message.questionId);
  const askStatus = escalated ? 'sent' : askState;
  const showAsk = !isUser && !message.isImage && typeof onAskAdmin === 'function';
  const showComplaint = !isUser && !message.isImage && typeof onRegisterComplaint === 'function';
  const complaintState = complaint?.result ? 'filed' : complaint?.open ? 'open' : undefined;
  // The server flagged the question as a likely personal complaint: offer it
  // up front instead of only as a small action.
  const promptComplaint = showComplaint && message.suggestComplaint === true && !complaintState;

  const ask = useCallback(() => onAskAdmin?.(index), [onAskAdmin, index]);
  const openComplaint = useCallback(() => onRegisterComplaint?.(index), [onRegisterComplaint, index]);
  const cancelComplaint = useCallback(() => onComplaintCancel?.(index), [onComplaintCancel, index]);
  const filedComplaint = useCallback((result) => onComplaintFiled?.(index, result), [onComplaintFiled, index]);

  const complaintPanel = complaint?.result ? (
    <ComplaintResult result={complaint.result} isDark={isDark} />
  ) : complaint?.open ? (
    <ComplaintForm
      chatId={chatId}
      question={question}
      isDark={isDark}
      onCancel={cancelComplaint}
      onFiled={filedComplaint}
    />
  ) : null;

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
            <div className="wrap-break-word">
              <MarkdownContent content={message.content} isDark={isDark} />
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

        {escalated && (
          <div
            className="flex items-start gap-1.5 text-xs mt-2 px-2 py-1.5 rounded-lg"
            style={{
              backgroundColor: isDark ? 'rgba(196,138,74,0.12)' : '#FFF4E0',
              color: isDark ? '#E0B887' : '#7A5300',
            }}
          >
            <Info className="w-3.5 h-3.5 mt-px shrink-0" />
            <span>
              I couldn&apos;t answer this — it has been sent to the university admin. You&apos;ll be
              notified when they reply.
            </span>
          </div>
        )}

        {promptComplaint && (
          <div
            className="flex flex-wrap items-center gap-2 text-xs mt-2 px-2 py-1.5 rounded-lg"
            style={{
              backgroundColor: isDark ? 'rgba(230,48,39,0.10)' : '#FCE6E4',
              color: isDark ? '#ECEEF5' : '#1F2330',
            }}
          >
            <FileWarning className="w-3.5 h-3.5 shrink-0" style={{ color: isDark ? '#C48A4A' : '#E63027' }} />
            <span className="flex-1 min-w-[160px]">Is this a complaint? Register it with the department.</span>
            <button
              type="button"
              onClick={openComplaint}
              className="px-2 py-1 rounded-md font-medium text-white"
              style={{ backgroundColor: isDark ? '#E63027' : '#1E2A66' }}
            >
              Register a complaint
            </button>
          </div>
        )}

        {complaintPanel}

        {/* Timestamp + actions */}
        <div
          className="flex items-center gap-3 text-xs mt-2"
          style={{ color: isUser ? 'rgba(255,255,255,0.7)' : muted }}
        >
          <span>{moment(message.timestamp).format('h:mm A')}</span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {showComplaint && !promptComplaint && (
              <button
                type="button"
                onClick={openComplaint}
                disabled={!!complaintState}
                className="inline-flex items-center gap-1 rounded px-1 -mx-1 transition-colors disabled:cursor-default enabled:hover:underline"
                style={{ color: complaintState === 'filed' ? (isDark ? '#6FB58A' : '#2F8A56') : muted }}
                title={
                  complaintState === 'filed'
                    ? 'A complaint was registered from this chat'
                    : 'Send this problem to the right department as an official complaint'
                }
              >
                {complaintState === 'filed' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <FileWarning className="w-3.5 h-3.5" />
                )}
                {complaintState === 'filed' ? 'Complaint registered' : 'Register a complaint'}
              </button>
            )}
            {showAsk && (
              <button
                type="button"
                onClick={ask}
                disabled={!!askStatus}
                className="inline-flex items-center gap-1 rounded px-1 -mx-1 transition-colors disabled:cursor-default enabled:hover:underline"
                style={{ color: askStatus === 'sent' ? (isDark ? '#6FB58A' : '#2F8A56') : muted }}
                title={
                  askStatus === 'sent'
                    ? 'The university admin has this question'
                    : 'Send the question above to the university admin'
                }
              >
                {askStatus === 'sending' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : askStatus === 'sent' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <MessageCircleQuestion className="w-3.5 h-3.5" />
                )}
                {askStatus === 'sending' ? 'Sending…' : askStatus === 'sent' ? 'Sent to admin' : 'Ask an admin'}
              </button>
            )}
          </div>
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

export default memo(Message);
