import { useEffect, useId, useRef, useState } from 'react';
import { MessageScroller } from '@shadcn/react/message-scroller';
import { track } from '@vercel/analytics';
import WeeklyUpdateForm, { type WeeklyUpdateProps } from './WeeklyUpdateForm';
import { coachResponseSchema, conversationSchema, type CoachMessage } from '../lib/weekly-chat';
import { submitApiForm } from '../scripts/submit-api-form';
import '../styles/weekly-chat.css';

type Props = WeeklyUpdateProps & { projectName: string; userId: string };

export default function WeeklyUpdateChat(props: Props) {
  if (!props.improveEnabled) return <WeeklyUpdateForm {...props} />;
  return <Conversation key={`${props.userId}:${props.draftKey}`} {...props} />;
}

function Conversation(props: Props) {
  const id = useId();
  const chatKey = `${props.draftKey}:chat:${props.userId}`;
  const [values, setValues] = useState(props.initialValues);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  const [draftStatus, setDraftStatus] = useState('Nothing is published until you review it.');
  const [historyCount, setHistoryCount] = useState<number | null>(null);
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
        if (typeof chat.input === 'string') setInput(chat.input.slice(0, 3000));
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
      localStorage.setItem(chatKey, JSON.stringify({ messages, input }));
      setDraftStatus('Draft and conversation saved on this browser.');
    } catch { setDraftStatus('Could not save on this browser. Keep this tab open.'); }
  }, [ready, values, messages, input]);

  useEffect(() => { if (reviewing) reviewRef.current?.focus(); }, [reviewing]);

  function markStarted() {
    if (!tracked.current) { track('weekly_update_started'); tracked.current = true; }
  }

  async function send() {
    if (!ready || inFlight.current || saving || !input.trim() || messages.length >= 40) return;
    const content = input.trim();
    const next: CoachMessage[] = [...messages, { role: 'user', content }];
    inFlight.current = true;
    setPending(true);
    setError('');
    markStarted();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 55_000);
    try {
      const response = await fetch('/api/result/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ projectId: props.projectId, weekId: props.weekId, messages: next,
          draft: { summary: values.summary, nextPromise: values.nextPromise, feedbackRequest: values.feedbackRequest } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not reply. Try sending your message again.');
      const answer = coachResponseSchema.parse(data);
      setMessages([...next, { role: 'assistant', content: answer.reply }]);
      setInput('');
      setValues(current => ({ ...current, ...Object.fromEntries(Object.entries(answer.changes)
        .filter(([key, value]) => value !== null && (key !== 'nextPromise' || props.canSetNextPromise))) }));
      setHistoryCount(data.historyCount);
    } catch (error) {
      setError(error instanceof Error && error.name !== 'AbortError' && error.name !== 'ZodError'
        ? error.message : 'The reply did not arrive. Your message and draft are still here. Try again.');
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
      setPending(false);
      requestRef.current = null;
      inputRef.current?.focus();
    }
  }

  const welcome = props.promise
    ? `This week you planned to: ${props.promise}\nWhat happened? Tell me what moved forward, what got stuck, or what surprised you.`
    : `Let’s look at this week for ${props.projectName}. What moved forward, and what did you learn? Rough notes are fine.`;

  function field(name: string, label: string, max: number, required = false) {
    return <label className="work-field" key={name}>
      <span>{label}</span>
      <textarea name={name} value={values[name] ?? ''} maxLength={max} minLength={required ? 5 : undefined} required={required}
        disabled={saving} rows={name === 'summary' ? 6 : 3} onChange={event => { markStarted(); setValues(current => ({ ...current, [name]: event.target.value })); }} />
      <small>{(values[name] ?? '').length} / {max}</small>
    </label>;
  }

  return <div className="weekly-chat" data-reviewing={reviewing}>
    <header className="coach-heading">
      <img src="/logo/mad-builders-icon-512.png" alt="" width="36" height="36" />
      <div><h3>Let’s work through your week.</h3><p>{props.projectName} · AI check-in coach</p></div>
    </header>
    <div className="coach-layout">
      <section className="coach-conversation" aria-label="Weekly check-in chat" hidden={reviewing}>
        <MessageScroller.Provider defaultScrollPosition="end">
          <MessageScroller.Root className="coach-scroller">
            <MessageScroller.Viewport className="coach-viewport" aria-label="Conversation">
              <MessageScroller.Content className="coach-messages">
                <MessageScroller.Item messageId="welcome" className="coach-message" data-role="assistant">
                  <span className="coach-speaker">mad.builders</span><p>{welcome}</p>
                </MessageScroller.Item>
                {messages.map((message, index) => <MessageScroller.Item key={index} messageId={String(index)} className="coach-message" data-role={message.role}>
                  <span className="coach-speaker">{message.role === 'user' ? 'You' : 'mad.builders'}</span><p>{message.content}</p>
                </MessageScroller.Item>)}
                {pending && <MessageScroller.Item messageId="pending" className="coach-message" data-role="user"><span className="coach-speaker">You</span><p>{input.trim()}</p></MessageScroller.Item>}
              </MessageScroller.Content>
            </MessageScroller.Viewport>
            <MessageScroller.Button className="coach-scroll-button" direction="end">Latest message ↓</MessageScroller.Button>
          </MessageScroller.Root>
        </MessageScroller.Provider>
        <p className="coach-activity" role="status">{pending ? 'Thinking about your update…' : ''}</p>
        <form className="coach-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
          <label htmlFor={`${id}-message`} className="work-label">Your message</label>
          <textarea ref={inputRef} id={`${id}-message`} value={input} onChange={event => setInput(event.target.value)}
            placeholder="What did you try, ship, or learn?" maxLength={3000} rows={3} disabled={!ready || pending || saving}
            onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
          <div className="coach-composer-actions"><small>Rough notes are enough.</small><button className="work-button" type="submit" disabled={!ready || pending || saving || !input.trim() || messages.length >= 40}>Send ↑</button></div>
        </form>
        {error && <p role="alert" className="work-status">{error}</p>}
        {messages.length >= 40 && <p className="work-note">Review your draft, or start a new conversation to keep refining it.</p>}
        {messages.length > 0 && <button type="button" className="coach-reset" disabled={pending || saving} onClick={() => { setMessages([]); setError(''); }}>New conversation, keep draft</button>}
        <details className="coach-context"><summary>What the coach knows</summary>
          <p>When you send a message, we share your project description and stage, this week’s goal, up to four previous updates, your draft and this conversation with Cerebras.</p>
          {historyCount !== null && <p>{historyCount ? `Using ${historyCount} previous ${historyCount === 1 ? 'update' : 'updates'} from this project.` : 'No previous updates yet. We’ll build from what you share here.'}</p>}
          <p>The conversation stays on this browser. Only the reviewed update is published.</p>
        </details>
      </section>
      <aside className="coach-draft" aria-label="Your draft">
        <div className="coach-draft-heading"><p className="work-label">{reviewing ? 'Final review' : 'Your draft'}</p><span className="coach-private">Not published</span></div>
        {reviewing ? <>
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
              <button type="submit" className="work-button" disabled={!ready || saving}>{saving ? 'Saving…' : props.editing ? 'Save changes' : 'Publish update'}</button>
            </div>
            <p className="work-status" data-form-status aria-live="polite" />
          </form>
        </> : <>
          <h3>This week</h3><p className={`coach-draft-text${values.summary ? '' : ' empty'}`}>{values.summary || 'The useful bits from our conversation will take shape here.'}</p>
          {props.canSetNextPromise && <><h3>Next week</h3><p className={`coach-draft-text${values.nextPromise ? '' : ' empty'}`}>{values.nextPromise || 'One clear priority, with a finish line you agree to.'}</p></>}
          {values.feedbackRequest && <><h3>Ask the community</h3><p className="coach-draft-text">{values.feedbackRequest}</p></>}
          <button type="button" className="work-button secondary" disabled={!ready || pending} onClick={() => setReviewing(true)}>Review & edit draft →</button>
          <p className="work-note">You can also write the update yourself.</p>
        </>}
        <p className="coach-save-status" role="status">{draftStatus}</p>
      </aside>
    </div>
  </div>;
}
