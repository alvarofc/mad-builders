import { useEffect, useId, useRef, useState } from 'react';
import { MessageScroller } from '@shadcn/react/message-scroller';
import { track } from '@vercel/analytics';
import WeeklyUpdateForm, { type WeeklyUpdateProps } from './WeeklyUpdateForm';
import { coachResponseSchema, conversationSchema, type CoachMessage } from '../lib/weekly-chat';
import { audienceChangesSchema, socialPostsSchema, type AudienceChange, type SocialPost } from '../lib/socials';
import { submitApiForm } from '../scripts/submit-api-form';
import '../styles/weekly-chat.css';

type Props = WeeklyUpdateProps & { projectName: string; userId: string; socialEnabled?: boolean; socialVersion?: string };
const socialRequest = 'Review my social activity for this project and week. Suggest only relevant new facts that are not already in my draft.';
const openingRequest = 'Help me start my weekly check-in using the context already available.';

export default function WeeklyUpdateChat(props: Props) {
  if (!props.improveEnabled) return <WeeklyUpdateForm {...props} />;
  return <Conversation key={`${props.userId}:${props.draftKey}`} {...props} />;
}

function Conversation(props: Props) {
  const id = useId();
  const chatKey = `${props.draftKey}:chat:${props.userId}`;
  const [values, setValues] = useState(props.initialValues);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [openingReply, setOpeningReply] = useState('');
  const [input, setInput] = useState('');
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [socialAudience, setSocialAudience] = useState<AudienceChange[]>([]);
  const [socialSuggestion, setSocialSuggestion] = useState('');
  const [suggestedChanges, setSuggestedChanges] = useState<ReturnType<typeof coachResponseSchema.parse>['changes'] | null>(null);
  const [socialCheckedKey, setSocialCheckedKey] = useState('');
  const autoStarted = useRef(false);
  const [automatic, setAutomatic] = useState(false);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [socialWarnings, setSocialWarnings] = useState<string[]>([]);
  const [socialStatus, setSocialStatus] = useState<'idle' | 'ok' | 'error' | 'unlinked'>('idle');
  const [pendingMessage, setPendingMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const startedAt = useRef(Date.now());
  const tracked = useRef(false);
  const inFlight = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const reviewRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(props.draftKey) || 'null');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        setValues(Object.fromEntries(Object.entries(props.initialValues).map(([key, value]) => [key, typeof saved[key] === 'string' ? saved[key] : value])));
      }
      const chat = JSON.parse(localStorage.getItem(chatKey) || 'null');
      const parsed = conversationSchema.safeParse(chat?.messages);
      if (parsed.success && parsed.data.every((message, i) => message.role === (i % 2 ? 'assistant' : 'user')) && parsed.data.length % 2 === 0) {
        setMessages(parsed.data);
        const opening = coachResponseSchema.shape.reply.safeParse(chat.openingReply);
        if (opening.success) setOpeningReply(opening.data);
        if (typeof chat.input === 'string') setInput(chat.input.slice(0, 3000));
        const sources = socialPostsSchema.safeParse(chat.socialPosts);
        if (sources.success) setSocialPosts(sources.data);
        const audience = audienceChangesSchema.safeParse(chat.socialAudience);
        if (audience.success) setSocialAudience(audience.data);
        const suggestions = coachResponseSchema.shape.changes.safeParse(chat.suggestedChanges);
        if (suggestions.success) setSuggestedChanges(suggestions.data);
        if (typeof chat.socialSuggestion === 'string') setSocialSuggestion(chat.socialSuggestion.slice(0, 1000));
        if (typeof chat.socialCheckedKey === 'string') setSocialCheckedKey(chat.socialCheckedKey);
        if (chat.socialStatus === 'error' || chat.socialStatus === 'unlinked') setSocialStatus(chat.socialStatus);
        else if (chat.socialStatus === 'ok' && chat.socialCheckedKey === checkKey) setSocialStatus('ok');
      }
    } catch { setDraftStatus('Browser saving is unavailable. Keep this tab open.'); }
    setReady(true);
    return () => requestRef.current?.abort();
  }, []);

  // Save drafts independently of model calls, including unsent messages and manual edits.
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(props.draftKey, JSON.stringify(values));
      localStorage.setItem(chatKey, JSON.stringify({ messages, openingReply, input, socialPosts, socialAudience, socialSuggestion, suggestedChanges, socialCheckedKey, socialStatus }));
      setDraftStatus('Draft and conversation saved on this browser.');
    } catch { setDraftStatus('Could not save on this browser. Keep this tab open.'); }
  }, [ready, values, messages, openingReply, input, socialPosts, socialAudience, socialSuggestion, suggestedChanges, socialCheckedKey, socialStatus]);

  useEffect(() => { if (reviewing) reviewRef.current?.focus(); else if (ready) inputRef.current?.focus(); }, [reviewing]);

  const checkKey = `${props.socialVersion ?? ''}:${new Date().toISOString().slice(0, 10)}`;
  useEffect(() => {
    if (!ready || autoStarted.current || messages.length >= 40) return;
    const opening = !openingReply && !messages.length;
    const checkSocial = Boolean(props.socialEnabled && socialCheckedKey !== checkKey);
    if (!opening && !checkSocial) return;
    autoStarted.current = true;
    void send(checkSocial, true, false, opening);
  }, [ready, props.socialEnabled, props.socialVersion, openingReply, messages.length]);

  function markStarted() {
    if (!tracked.current) { track('weekly_update_started'); tracked.current = true; }
  }

  async function send(includeSocialPosts = false, automaticCheck = false, refreshSocialPosts = false, opening = false) {
    if (!ready || inFlight.current || saving || (!opening && !includeSocialPosts && !input.trim()) || messages.length >= 40) return;
    const content = opening ? openingRequest : includeSocialPosts ? socialRequest : input.trim();
    const next: CoachMessage[] = [...messages, { role: 'user', content }];
    inFlight.current = true;
    setPending(true);
    setPendingMessage(content);
    setImporting(includeSocialPosts);
    setAutomatic(automaticCheck);
    setError('');
    if (!automaticCheck) markStarted();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), includeSocialPosts ? 110_000 : 55_000);
    try {
      const response = await fetch('/api/result/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ projectId: props.projectId, weekId: props.weekId, messages: next,
          draft: { summary: values.summary, nextPromise: values.nextPromise, feedbackRequest: values.feedbackRequest },
          ...(opening ? { opening: true } : openingReply ? { openingReply } : {}),
          ...(includeSocialPosts ? { includeSocialPosts: true, ...(refreshSocialPosts ? { refreshSocialPosts: true } : {}) } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not reply. Try sending your message again.');
      const answer = coachResponseSchema.parse(data);
      const sources = includeSocialPosts ? socialPostsSchema.parse(data.socialPosts ?? []) : undefined;
      const audience = includeSocialPosts ? audienceChangesSchema.parse(data.socialAudience ?? []) : undefined;
      if (opening) setOpeningReply(answer.reply);
      else setMessages([...next, { role: 'assistant', content: answer.reply }]);
      if (!includeSocialPosts && !opening) setInput('');
      if (sources) {
        setSocialPosts(current => [...new Map([...current, ...sources].map(post => [post.url, post])).values()].slice(-20));
        const warnings = Array.isArray(data.socialWarnings) ? data.socialWarnings.filter((warning: unknown) => typeof warning === 'string').slice(0, 8) : [];
        setSocialWarnings(warnings);
        setSocialAudience(audience ?? []);
        setSocialStatus(warnings.length ? 'error' : data.socialAccountCount === 0 ? 'unlinked' : data.socialAccountCount > 0 ? 'ok' : 'idle');
        setSocialCheckedKey(checkKey);
      }
      // A welcome is conversation, never permission to edit the draft.
      if (!opening && includeSocialPosts) {
        const suggestion = answer.changes.summary;
        if (suggestion) setSocialSuggestion(suggestion);
      } else if (!opening) {
        setSuggestedChanges({ ...answer.changes, nextPromise: props.canSetNextPromise ? answer.changes.nextPromise : null });
      }
      if (typeof data.historyCount === 'number') setHistoryCount(data.historyCount);
    } catch (error) {
      if (includeSocialPosts) { setSocialStatus('error'); setSocialCheckedKey(checkKey); }
      setError(error instanceof Error && error.name !== 'AbortError' && error.name !== 'ZodError'
        ? error.message : 'The reply did not arrive. Your message and draft are still here. Try again.');
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
      setPending(false);
      setImporting(false);
      setAutomatic(false);
      requestRef.current = null;
      if (!automaticCheck) inputRef.current?.focus();
    }
  }

  const welcome = openingReply || (values.summary.trim()
    ? `Welcome back. Your draft is here, so we’ve got a head start. What’s worth adding or changing?`
    : props.promise
      ? `The plan was: “${props.promise}”. How did reality compare? Rough notes welcome.`
      : socialPosts.length || socialAudience.length
        ? `We’ve got some clues from your socials. What’s the story behind this week’s work?`
        : `What’s the story with ${props.projectName} this week? Small wins and messy bits count too.`);
  const socialCheckState = importing ? 'loading' : socialStatus === 'ok' && socialCheckedKey !== checkKey ? 'idle' : socialStatus;
  const socialCheckLabel = { idle: 'Not checked yet', loading: 'Checking…', ok: 'Last check succeeded', error: 'Check incomplete · retry', unlinked: 'No accounts connected' }[socialCheckState];

  function field(name: string, label: string, max: number, required = false) {
    return <label className="work-field" key={name}>
      <span>{label}</span>
      <textarea name={name} value={values[name] ?? ''} maxLength={max} minLength={required ? 5 : undefined} required={required}
        disabled={saving} rows={name === 'summary' ? 6 : 3} onChange={event => { markStarted(); setValues(current => ({ ...current, [name]: event.target.value })); }} />
      <small>{(values[name] ?? '').length} / {max}</small>
    </label>;
  }

  return <div className="weekly-chat" data-reviewing={reviewing}>
    <div className="coach-layout">
      <section className="coach-conversation" aria-label="Weekly check-in chat" hidden={reviewing}>
        {ready ? <MessageScroller.Provider defaultScrollPosition="last-anchor">
          <MessageScroller.Root className="coach-scroller">
            <MessageScroller.Viewport className="coach-viewport" aria-label="Conversation">
              <MessageScroller.Content className="coach-messages">
                <MessageScroller.Item messageId="welcome" className="coach-message" data-role="assistant">
                  <span className="coach-speaker">mad.builders · AI coach</span><p>{pending && automatic && !openingReply && !messages.length ? 'Let me catch up on your week…' : welcome}</p>
                </MessageScroller.Item>
                {messages.map((message, index) => <MessageScroller.Item key={index} messageId={String(index)} scrollAnchor={message.role === 'user'} className="coach-message" data-role={message.role}>
                  <span className="coach-speaker">{message.content === socialRequest ? 'Social check' : message.role === 'user' ? 'You' : 'mad.builders'}</span><p>{message.content}</p>
                </MessageScroller.Item>)}
                {suggestedChanges && (['summary', 'nextPromise', 'feedbackRequest'] as const).map(key => {
                  const suggestion = suggestedChanges[key];
                  if (suggestion === null || (key === 'nextPromise' && !props.canSetNextPromise)) return null;
                  const label = { summary: 'This week', nextPromise: 'Next week’s goal', feedbackRequest: 'Community question' }[key];
                  return <MessageScroller.Item key={key} messageId={`suggestion-${key}`} className="coach-message coach-source">
                    <section aria-label={`Suggested change: ${label}`}>
                      <span className="coach-speaker">Suggested change · {label}</span>
                      {values[key] && <><p className="work-label">Current draft</p><p>{values[key]}</p></>}
                      <p className="work-label">Proposed text</p><p>{suggestion || 'Remove the community question.'}</p>
                      <button type="button" className="work-button secondary" disabled={pending || saving} onClick={() => {
                        markStarted(); setValues(current => ({ ...current, [key]: suggestion }));
                        setSuggestedChanges(current => current ? { ...current, [key]: null } : null);
                      }}>Apply to draft</button>
                      <button type="button" className="coach-reset" disabled={pending || saving}
                        onClick={() => setSuggestedChanges(current => current ? { ...current, [key]: null } : null)}>Dismiss</button>
                    </section>
                  </MessageScroller.Item>;
                })}
                {pending && pendingMessage !== openingRequest && <MessageScroller.Item messageId={String(messages.length)} scrollAnchor className="coach-message" data-role="user"><span className="coach-speaker">{importing ? 'Social check' : 'You'}</span><p>{pendingMessage}</p></MessageScroller.Item>}
              </MessageScroller.Content>
            </MessageScroller.Viewport>
            <MessageScroller.Button className="coach-scroll-button" direction="end">Latest message ↓</MessageScroller.Button>
          </MessageScroller.Root>
        </MessageScroller.Provider> : <div className="coach-scroller" role="status">Loading your conversation…</div>}
        <p className="coach-activity" role="status">{importing ? 'Checking social activity for relevant progress…' : pending ? 'Thinking about your update…' : ''}</p>
        <form className="coach-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
          <label htmlFor={`${id}-message`} className="visually-hidden">Your message</label>
          <textarea ref={inputRef} id={`${id}-message`} value={input} onChange={event => setInput(event.target.value)}
            placeholder="Ask about your project, talk through an idea, or share progress…" maxLength={3000} rows={2} disabled={!ready || (pending && !automatic) || saving}
            onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
          <div className="coach-composer-actions"><small>Chat first. Review before publishing.</small><button className="work-button" type="submit" disabled={!ready || pending || saving || !input.trim() || messages.length >= 40}>Send ↑</button></div>
        </form>
        {error && <p role="alert" className="work-status">{error}</p>}
        {error && !openingReply && !messages.length && <button type="button" className="coach-reset" disabled={pending || saving}
          onClick={() => void send(false, true, false, true)}>Retry welcome</button>}
        {messages.length >= 40 && <p className="work-note">Review your draft, or start a new conversation to keep refining it.</p>}
        <div className="coach-next">
          <button type="button" className="work-button secondary" disabled={!ready || (pending && !automatic)} onClick={() => setReviewing(true)}>Review & edit draft →</button>
        </div>
        <details className="coach-context"><summary>About this chat</summary>
          {messages.length > 0 && <button type="button" className="coach-reset" disabled={pending || saving} onClick={() => { autoStarted.current = false; setOpeningReply(''); setSuggestedChanges(null); setMessages([]); setError(''); }}>New conversation, keep draft</button>}
          <p>To welcome you and reply, we share your project description and stage, this week’s goal, up to four previous updates, your draft and this conversation with Cerebras.</p>
          {historyCount !== null && <p>{historyCount ? `Using ${historyCount} previous ${historyCount === 1 ? 'update' : 'updates'} from this project.` : 'No previous updates yet. We’ll build from what you share here.'}</p>}
          <p>The conversation stays on this browser.</p>
        </details>
      </section>
      <aside className="coach-draft" aria-label="Your draft" hidden={!reviewing}>
        <div className="coach-draft-heading"><p className="work-label">Final review</p><span className="coach-private">Not published</span></div>
        {reviewing && <>
          <h3 ref={reviewRef} tabIndex={-1}>Make it yours.</h3>
          <p className="work-note">Check the facts and next week’s goal. You can edit every field before publishing.</p>
          <form className="work-form coach-review" action="/api/result/publish" method="post" onSubmit={async event => {
            event.preventDefault();
            if (!ready || saving || pending) return;
            const form = event.currentTarget;
            if (!form.reportValidity()) return;
            setSaving(true);
            try { await submitApiForm(form, props.draftKey, startedAt.current); }
            finally { setSaving(false); }
          }}>
            <input type="hidden" name="projectId" value={props.projectId} />
            {props.commitmentId ? <input type="hidden" name="commitmentId" value={props.commitmentId} /> : <input type="hidden" name="weekId" value={props.weekId} />}
            {field('summary', 'This week', 1000, true)}
            {props.promise ? <label className="work-field"><span>How much of your goal did you complete?</span><small>{props.promise}</small>
              <select name="status" disabled={saving} required value={values.status} onChange={event => setValues(current => ({ ...current, status: event.target.value }))}>
                <option value="">Choose an outcome</option><option value="complete">All of it</option><option value="partial">Some of it</option><option value="missed">None of it</option>
              </select></label> : <input type="hidden" name="status" value="submitted" />}
            {props.canSetNextPromise && field('nextPromise', 'Next week’s goal', 280, true)}
            {field('feedbackRequest', 'A question for the community (optional)', 500)}
            {field('projectSentence', 'What are you building?', 280, true)}
            <label className="work-field"><span>Project stage</span><select name="projectStage" disabled={saving} required value={values.projectStage} onChange={event => setValues(current => ({ ...current, projectStage: event.target.value }))}>
              {props.stages.map(stage => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
            </select></label>
            {(['projectUrl', 'proofUrl'] as const).map(name => <label className="work-field" key={name}><span>{name === 'projectUrl' ? 'Project website (optional)' : 'Proof URL (optional)'}</span>
              <input type="url" disabled={saving} name={name} value={values[name]} placeholder="https://" maxLength={2048} pattern="https://.*" onChange={event => setValues(current => ({ ...current, [name]: event.target.value }))} />
            </label>)}
            <p className="work-note">{props.late ? 'This update will be public and locked after publishing.' : 'This update will be public. You can edit until voting opens.'}</p>
            <div className="questionnaire-actions">
              <button type="button" className="work-button secondary" disabled={saving} onClick={() => setReviewing(false)}>Back to chat</button>
              <button type="submit" className="work-button" disabled={!ready || saving || pending}>{saving ? 'Saving…' : props.editing ? 'Save changes' : 'Publish update'}</button>
            </div>
            <p className="work-status" data-form-status aria-live="polite" />
          </form>
        </>}
      </aside>
      <details className="coach-context coach-socials">
        <summary>Social context{socialPosts.length ? ` · ${socialPosts.length} sources` : ''}<span className="coach-social-status" data-state={socialCheckState} role="status"><span className="coach-status-dot" aria-hidden="true" />{socialCheckLabel}</span></summary>
        <p>When you open an update, we check your saved LinkedIn and X accounts for relevant progress. We share those URLs with HarvestAPI or TwitterAPI.io and send posts and metrics to Cerebras for review. You decide what to publish.</p>
        <p>We read one recent page per account and reuse daily snapshots. Older or busy weeks may be incomplete. Follower comparisons start after two dated observations; interactions are totals at the time checked. <a href="/settings#socials">Manage social links</a>.</p>
        <button type="button" className="work-button secondary" disabled={!ready || pending || saving || messages.length >= 40}
          onClick={() => { setReviewing(false); void send(true, false, true); }}>{importing ? 'Refreshing…' : 'Refresh social activity'}</button>
        <p>One extra refresh per account per day. Repeated clicks reuse that refresh.</p>
        {socialSuggestion && !values.summary.includes(socialSuggestion) && <div className="coach-source">
          <p className="work-label">Suggested addition</p><p>{socialSuggestion}</p>
          <button type="button" className="work-button secondary" disabled={pending || saving || `${values.summary}\n\n${socialSuggestion}`.trim().length > 1000}
            onClick={() => { markStarted(); setValues(current => ({ ...current, summary: [current.summary.trim(), socialSuggestion].filter(Boolean).join('\n\n') })); setSocialSuggestion(''); }}>Add to draft</button>
          <button type="button" className="coach-reset" onClick={() => setSocialSuggestion('')}>Dismiss suggestion</button>
          {`${values.summary}\n\n${socialSuggestion}`.trim().length > 1000 && <p>Shorten your draft before adding this, or copy the useful parts.</p>}
        </div>}
        {socialAudience.map(change => <article className="coach-source" key={change.account}>
          <a href={change.account} target="_blank" rel="noopener noreferrer nofollow">{change.scope === 'company' ? 'Company' : 'Personal'} {change.platform === 'x' ? 'X' : 'LinkedIn'} ↗</a>
          <p>{change.before.toLocaleString()} → {change.after.toLocaleString()} followers ({change.change > 0 ? '+' : ''}{change.change.toLocaleString()}) between {change.from.slice(0, 10)} and {change.to.slice(0, 10)}.</p>
          <p>{change.relevance}</p>
        </article>)}
        {socialWarnings.map((warning, i) => <p key={i} role="status">{warning}</p>)}
        {socialPosts.map(post => <article className="coach-source" key={post.url}>
          <a href={post.url} target="_blank" rel="noopener noreferrer nofollow">{post.scope === 'company' ? 'Company' : 'Personal'} · {post.platform === 'x' ? 'X' : 'LinkedIn'} · {new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', dateStyle: 'medium' }).format(new Date(post.publishedAt))} ↗</a>
          <p>{post.text}</p>
          {post.relevance && <p>Why it matters: {post.relevance}</p>}
          {post.engagement && <p>{[
            post.engagement.likes != null ? `${post.engagement.likes.toLocaleString()} likes` : '',
            post.engagement.comments != null ? `${post.engagement.comments.toLocaleString()} comments / replies` : '',
            post.engagement.shares != null ? `${post.engagement.shares.toLocaleString()} shares` : '',
            post.engagement.views != null ? `${post.engagement.views.toLocaleString()} views` : '',
          ].filter(Boolean).join(' · ')}{post.observedAt ? ` (as of ${post.observedAt.slice(0, 10)})` : ''}</p>}
          {post.performance && <p>{post.performance.multiple}× the median interactions of {post.performance.sampleSize} older posts. This is a small sample of cumulative counts.</p>}
          <button type="button" className="coach-reset" disabled={pending || saving || values.proofUrl === post.url}
            onClick={() => { markStarted(); setValues(current => ({ ...current, proofUrl: post.url })); }}>
            {values.proofUrl === post.url ? 'Selected as proof link' : 'Use as proof link'}
          </button>
        </article>)}
      </details>
      <p className={`coach-save-status${draftStatus === 'Draft and conversation saved on this browser.' ? ' visually-hidden' : ''}`} role="status">{draftStatus}</p>
    </div>
  </div>;
}
