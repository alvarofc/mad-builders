import { useRef, useState } from 'react';
import { normalizeSocialUrl, socialPlatforms, type SocialLinks, type SocialPlatform } from '../lib/socials';
import '../styles/social-accounts.css';
import SocialLogo from './SocialLogo';

function detectPlatform(value: string): SocialPlatform | null {
  try {
    const host = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`).hostname.replace(/^www\./, '').toLowerCase();
    if (!host.includes('.')) return null;
    return host === 'linkedin.com' ? 'linkedin' : ['x.com', 'twitter.com'].includes(host) ? 'x'
      : host === 'github.com' ? 'github' : host === 'instagram.com' ? 'instagram' : 'website';
  } catch { return null; }
}

type Scope = 'personal' | 'company';
type Props = { projectId: string; personal: SocialLinks; company: SocialLinks; available: { linkedin: boolean; x: boolean }; saved: boolean };

export default function SocialAccounts(props: Props) {
  const [accounts, setAccounts] = useState({ personal: props.personal, company: props.company });
  const [editor, setEditor] = useState<{ scope: Scope; platform?: SocialPlatform } | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const saving = useRef(false);
  const confirmed = useRef(accounts);
  async function save(next: typeof accounts) {
    if (saving.current) return;
    saving.current = true;
    setAccounts(next); setSaveState('saving'); setSaveError('');
    const body = new URLSearchParams({ projectId: props.projectId });
    for (const scope of ['personal', 'company'] as const) {
      for (const { key } of socialPlatforms) {
        if ((confirmed.current[scope][key] ?? '') !== (next[scope][key] ?? '')) body.set(`${scope}.${key}`, next[scope][key] ?? '');
      }
    }
    try {
      const response = await fetch('/api/socials', { method: 'POST', headers: { Accept: 'application/json' }, body, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      if (result.saved !== true) throw new Error('Could not confirm the save. Try again.');
      confirmed.current = next;
      setSaveState('saved');
    } catch (cause) {
      setSaveError(cause instanceof Error && cause.name === 'Error' ? cause.message : 'Could not save. Check your connection and retry.');
      setSaveState('error');
    } finally { saving.current = false; }
  }
  const detectedPlatform = detectPlatform(url);
  function edit(scope: Scope, platform?: SocialPlatform) {
    setEditor({ scope, platform }); setUrl(platform ? accounts[scope][platform] ?? '' : ''); setError('');
  }
  function add() {
    if (!editor || saving.current) return;
    try {
      const value = url.trim().match(/^https?:\/\//i) ? url.trim() : `https://${url.trim()}`;
      const platform = detectPlatform(url);
      if (!platform) throw new Error('Paste a full account URL.');
      if (platform === 'website' && editor.scope === 'company') throw new Error('Add your project website in the Profile tab.');
      let normalized: string | undefined;
      try { normalized = normalizeSocialUrl(value, platform, editor.scope === 'company'); }
      catch { throw new Error(platform === 'linkedin' ? `Use a LinkedIn ${editor.scope === 'company' ? 'company page' : 'personal profile'} URL.` : 'Use an https:// account URL, rather than a post link.'); }
      if (accounts[editor.scope][platform] && editor.platform !== platform) throw new Error('That platform is already listed. Use Edit to change its account.');
      const next = { ...accounts[editor.scope] };
      if (editor.platform) delete next[editor.platform];
      next[platform] = normalized;
      void save({ ...accounts, [editor.scope]: next }); setEditor(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check this URL and try again.'); }
  }
  return <form className="social-accounts" method="post" action="/api/socials" onSubmit={event => {
    event.preventDefault();
    if (editor) add();
  }}>
    <input type="hidden" name="projectId" value={props.projectId} />
    <p className="work-note">Add where you share your work. We’ll look for relevant progress when you write an update. These links also appear on your public profile.</p>
    {(['personal', 'company'] as const).map(scope => <section className="social-group" key={scope} aria-labelledby={`social-${scope}`}>
      <header className="social-group-heading">
        <div><h3 id={`social-${scope}`}>{scope === 'personal' ? 'Your accounts' : 'Project accounts'}</h3>
          <p>{scope === 'personal' ? 'The places you post as yourself.' : 'Shared with your project’s co-owners.'}</p></div>
        <button type="button" className="social-action" disabled={editor !== null || saveState === 'saving'} onClick={() => edit(scope)}>+ Add account<span className="visually-hidden"> to {scope === 'personal' ? 'your accounts' : 'project accounts'}</span></button>
      </header>
      {socialPlatforms.map(({ key, label }) => {
        const account = accounts[scope][key];
        return <div key={key}>
          <input type="hidden" name={`${scope}.${key}`} value={account ?? ''} />
          {account && <div className="social-account">
            <span className="social-platform" aria-hidden="true"><SocialLogo platform={key} /></span>
            <div className="social-account-info"><a href={account} target="_blank" rel="noopener noreferrer">{account.replace(/^https:\/\/(www\.)?/, '')} ↗</a>
              <small>{label} · {key === 'linkedin' || key === 'x' ? props.available[key] ? 'Used for weekly updates' : 'Checks unavailable' : 'Profile link only'}</small></div>
            <div className="social-row-actions"><button type="button" className="social-action" disabled={editor !== null || saveState === 'saving'} onClick={() => edit(scope, key)} aria-label={`Edit ${scope} ${label}`}>Edit</button>
              <button type="button" className="social-action" disabled={editor !== null || saveState === 'saving'} aria-label={`Remove ${scope} ${label}`} onClick={() => {
                const next = { ...accounts[scope] }; delete next[key]; void save({ ...accounts, [scope]: next });
              }}>Remove</button></div>
          </div>}
        </div>;
      })}
      {!Object.values(accounts[scope]).some(Boolean) && editor?.scope !== scope && <p className="social-empty">No accounts yet. Add a LinkedIn or X profile to get started.</p>}
      {editor?.scope === scope && <div className="social-editor">
        <label className="work-field"><span>{editor.platform ? 'Edit account URL' : 'Account URL'}</span>
          <span className="social-url-input" data-detected={!!detectedPlatform}>
          {detectedPlatform && <span className="social-url-logo"><SocialLogo platform={detectedPlatform} /></span>}
          <input autoFocus type="text" inputMode="url" autoComplete="url" maxLength={2048} value={url} placeholder="Paste your profile URL" aria-invalid={!!error} aria-describedby={`social-help-${scope}`} onChange={event => { setUrl(event.target.value); setError(''); }} /></span></label>
        <p id={`social-help-${scope}`} className="social-help"><span role="status">{detectedPlatform ? `${socialPlatforms.find(platform => platform.key === detectedPlatform)!.label} detected` : 'Paste a profile link. We’ll detect the platform automatically.'}</span></p>
        {error && <p role="alert">{error}</p>}
        <div className="social-editor-actions"><button type="button" className="work-button secondary" onClick={add}>{editor.platform ? 'Update account' : 'Add account'}</button>
          <button type="button" className="social-action" onClick={() => setEditor(null)}>Cancel</button></div>
      </div>}
    </section>)}
    <div className="social-save">
      <span role="status">{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved.' : saveState === 'error' ? '' : 'Changes save automatically.'}</span>
      {saveState === 'error' && <><span role="alert">{saveError} Your changes haven’t been saved.</span><button type="button" className="social-action" onClick={() => void save(accounts)}>Retry save</button></>}
    </div>
    <details className="social-help"><summary>How we use these accounts</summary><p>LinkedIn and X can help us find relevant posts and changes in engagement or followers. Checks run when you open an update, when available. You review the draft before publishing. We keep daily snapshots for comparisons; remove an account to stop future checks. Other links are for your public profile only.</p></details>
  </form>;
}
