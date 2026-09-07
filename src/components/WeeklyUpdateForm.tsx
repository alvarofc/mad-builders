import { useEffect, useRef, useState } from 'react';
import { Questionnaire } from '@shadcn/react/questionnaire';
import { track } from '@vercel/analytics';
import { submitApiForm } from '../scripts/submit-api-form';
import '../styles/questionnaire.css';

type Props = {
  draftKey: string;
  commitmentId?: number;
  weekId?: number;
  promise?: string | null;
  canSetNextPromise: boolean;
  editing: boolean;
  late: boolean;
  stages: readonly { value: string; label: string }[];
  initialValues: Record<string, string>;
};

type Question = {
  name: string;
  title: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  description?: string;
  choices?: readonly { value: string; label: string }[];
  type?: 'url';
};

export default function WeeklyUpdateForm(props: Props) {
  const [values, setValues] = useState(props.initialValues);
  const [ready, setReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState('Drafts stay on this browser until you publish.');
  const startedAt = useRef(Date.now());
  const tracked = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState('projectSentence');

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(props.draftKey) || 'null');
      if (draft && typeof draft === 'object' && !Array.isArray(draft)) {
        setValues(Object.fromEntries(Object.entries(props.initialValues).map(([name, value]) =>
          [name, typeof draft[name] === 'string' ? draft[name] : value])));
        setDraftStatus('Your draft is restored.');
      }
    } catch {
      setDraftStatus('Draft saving is unavailable. Keep this tab open.');
    }
    setReady(true);
  }, [props.draftKey]);

  const questions: Question[] = [
    { name: 'projectSentence', title: 'What are you building in a sentence?', required: true, minLength: 5, maxLength: 280 },
    { name: 'summary', title: 'What did you accomplish this week?', required: true, minLength: 5, maxLength: 1000, placeholder: 'A few concrete lines are enough.', description: props.promise ? `Here's what you planned to do this week: ${props.promise}` : undefined },
    ...(props.promise ? [{ name: 'status', title: 'Did you do everything you planned?', required: true, choices: [
      { value: 'complete', label: 'all of it' }, { value: 'partial', label: 'some of it' }, { value: 'missed', label: 'none of it' },
    ] }] : []),
    ...(props.canSetNextPromise ? [{ name: 'nextPromise', title: 'What do you want to have done by the end of next week?', required: true, minLength: 5, maxLength: 280 }] : []),
    { name: 'feedbackRequest', title: 'What would you like feedback on from the community?', maxLength: 500, placeholder: 'Optional. A specific question helps people help you.' },
    { name: 'projectUrl', title: 'Project website', type: 'url', placeholder: 'https://' },
    { name: 'projectStage', title: 'Which of these best describes the stage of your project?', required: true, choices: props.stages },
    { name: 'proofUrl', title: 'Proof URL', type: 'url', placeholder: 'Optional: a demo, launch, commit, or post', description: 'A link lets other builders see what you made.' },
  ];

  function saveDraft(form: HTMLFormElement) {
    if (!ready) return;
    if (!tracked.current) { track('weekly_update_started'); tracked.current = true; }
    try {
      const data = new FormData(form);
      const values = Object.fromEntries(questions.map(({ name }) => [name, String(data.get(name) ?? '')]));
      localStorage.setItem(props.draftKey, JSON.stringify(values));
      setDraftStatus('Draft saved on this browser.');
    } catch {
      setDraftStatus('Draft could not be saved. Keep this tab open.');
    }
  }

  return (
    <Questionnaire.Root
      key={ready ? 'restored' : 'initial'}
      className="work-form weekly-questionnaire"
      items={questions}
      onItemChange={setActiveQuestion}
      ref={formRef}
      noValidate={false}
      onKeyDownCapture={(event) => {
        if (event.target instanceof HTMLTextAreaElement && event.key === 'Enter' && !event.metaKey && !event.ctrlKey) event.stopPropagation();
      }}
      method="post"
      action="/api/result/publish"
      aria-busy={!ready || saving}
      onChange={(event) => {
        const form = event.currentTarget;
        // Wait for shadcn to update which native controls contribute to FormData.
        setTimeout(() => saveDraft(form), 0);
      }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ready || saving) return;
        const form = event.currentTarget;
        setSaving(true);
        try { await submitApiForm(form, props.draftKey, startedAt.current); }
        finally { setSaving(false); }
      }}
    >
      <p className="draft-status" role="status">{draftStatus}</p>
      {props.commitmentId ? <input type="hidden" name="commitmentId" value={props.commitmentId} /> : <input type="hidden" name="weekId" value={props.weekId} />}
      {!props.promise && <input type="hidden" name="status" value="submitted" />}
      <Questionnaire.Progress className="work-label" />
      {questions.map((question) => (
        <Questionnaire.Item key={question.name} name={question.name} required={question.required} className="questionnaire-item"
          onStatusChange={(status) => {
            if (status === 'skipped') setTimeout(() => { if (formRef.current) saveDraft(formRef.current); }, 0);
          }}
        >
          <Questionnaire.Title className="questionnaire-title">{question.title}</Questionnaire.Title>
          {question.description && <Questionnaire.Description className="work-note">{question.description}</Questionnaire.Description>}
          <Questionnaire.Choices className={question.choices ? 'questionnaire-choices' : 'work-field'}>
            {question.choices ? question.choices.map((choice) => (
              <Questionnaire.Choice key={choice.value} value={choice.value} defaultChecked={values[question.name] === choice.value} className="questionnaire-choice">
                <Questionnaire.ChoiceInput />
                <Questionnaire.ChoiceLabel>{choice.label}</Questionnaire.ChoiceLabel>
              </Questionnaire.Choice>
            )) : (
              <Questionnaire.Input
                aria-label={question.name === 'projectSentence' ? 'Project description' : question.title}
                value={values[question.name]}
                onChange={(event) => setValues((current) => ({ ...current, [question.name]: event.target.value }))}
                type={question.type}
                render={question.type === 'url' ? <input inputMode="url" /> : <textarea />}
                minLength={question.minLength}
                maxLength={question.maxLength}
                placeholder={question.placeholder}
                required={question.required}
              />
            )}
          </Questionnaire.Choices>
          <Questionnaire.Error className="work-status" />
        </Questionnaire.Item>
      ))}
      <p className="draft-status">{props.late ? 'Your update is public and locked after publishing.' : 'Your update is public after publishing. You can edit until voting opens.'}</p>
      <div className="questionnaire-actions">
        <Questionnaire.Previous className="work-button secondary" disabled={!ready || saving}>Previous</Questionnaire.Previous>
        <Questionnaire.Skip className="work-button secondary" disabled={!ready || saving}>{activeQuestion === 'proofUrl' ? (props.editing ? 'Skip and save changes' : 'Skip and publish update') : 'Skip'}</Questionnaire.Skip>
        <Questionnaire.Next className="work-button" disabled={!ready || saving}>Next</Questionnaire.Next>
        <Questionnaire.Submit className="work-button" disabled={!ready || saving}>{props.editing ? 'save changes' : 'publish update'}</Questionnaire.Submit>
      </div>
      <p className="work-status" data-form-status aria-live="polite"></p>
    </Questionnaire.Root>
  );
}
