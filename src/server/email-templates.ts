import css from '../styles/global.css?raw';
import { SITE as site } from '../config/seo';

export type EmailKind = 'welcome' | 'checkin' | 'voting';

const green = css.match(/--green:\s*([^;]+)/)![1].trim();
const cream = css.match(/--cream:\s*([^;]+)/)![1].trim();
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!);

export function renderEmail(kind: EmailKind, {
  unsubscribeUrl,
  needsResult = true,
  needsPromise = true,
}: { unsubscribeUrl: string; needsResult?: boolean; needsPromise?: boolean }) {
  if (new URL(unsubscribeUrl).protocol !== 'https:') throw new Error('Unsubscribe URL must use HTTPS');
  if (kind === 'checkin' && !needsResult && !needsPromise) throw new Error('No check-in action needed');
  const messages = {
    welcome: {
      subject: 'Start with one thing', label: 'Welcome to mad.builders',
      paragraphs: ['Introduce your project, post what you got done, and set next week’s goals.', 'Keep the first update small. Start with what you’re building and what moved forward.'],
      cta: 'Post your first update', path: '/build', note: 'One week at a time.',
    },
    checkin: {
      subject: 'This week, in your words', label: 'Your weekly check-in',
      paragraphs: [needsResult && needsPromise ? 'Post what you got done and set next week’s goals.' : needsResult ? 'Post what you got done.' : 'Set next week’s goals.',
        needsResult ? 'Partial counts. Nothing counts too, if you say what happened.' : 'Keep it small. Pick something you can get done in a week.'],
      cta: needsResult ? 'Post your update' : 'Set next week’s goals', path: '/build',
      note: needsResult ? 'Post by Sunday, 18:00 Madrid for this week’s ranking.' : 'One week at a time.',
    },
    voting: {
      subject: 'Ten comparisons, then the leaderboard', label: 'Your weekly vote',
      paragraphs: ['Other builders posted their work. You pick which of two got further, ten times.', 'Finish your comparisons and the early leaderboard opens up.'],
      cta: 'Start voting', path: '/vote', note: 'Voting closes Monday, 18:00 Madrid.',
    },
  };
  const { subject, label, paragraphs, cta, path, note } = messages[kind];
  const reason = kind === 'welcome' ? 'You’re receiving this because you joined mad.builders.' : 'You’re receiving this because you have weekly reminders enabled.';
  const body = paragraphs.map((paragraph) => `<p style="margin:0 0 18px;font-size:18px;line-height:1.6;">${escapeHtml(paragraph)}</p>`).join('');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:${cream};color:${green};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${cream}"><tr><td align="center" style="padding:40px 20px;">
<!--[if mso]><table role="presentation" width="560"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 0 48px;"><a href="${site}" style="color:${green};"><img src="${site}/logo/mad-builders-green.png" alt="mad.builders" width="200" style="display:block;border:0;width:200px;max-width:100%;height:auto;"></a></td></tr>
<tr><td><p style="margin:0 0 16px;font:12px/1.5 'Courier New',monospace;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(label)}</p>
<h1 style="margin:0 0 28px;font-size:36px;line-height:1.15;letter-spacing:-1px;font-weight:600;">${escapeHtml(subject)}</h1>
${body}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 24px;"><tr><td bgcolor="${green}" style="border-radius:4px;mso-padding-alt:16px 24px;"><a href="${site}${path}" style="display:inline-block;padding:16px 24px;border:1px solid ${green};border-radius:4px;color:${cream};background-color:${green};font:14px/1.3 'Courier New',monospace;text-decoration:none;font-weight:bold;">${escapeHtml(cta)} &rarr;</a></td></tr></table>
<p style="margin:0;font-size:13px;line-height:1.6;">${escapeHtml(note)}</p></td></tr>
<tr><td style="padding-top:44px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${green};padding-top:22px;">
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;">mad.builders<br>The builders’ house in Madrid.</p>
<p style="margin:0 0 16px;font-size:12px;line-height:1.6;"><a href="${site}" style="color:${green};text-decoration:underline;">Visit mad.builders</a></p>
<p style="margin:0;font-size:11px;line-height:1.6;">${escapeHtml(reason)} <a href="${escapeHtml(unsubscribeUrl)}" style="color:${green};text-decoration:underline;">Unsubscribe</a></p>
</td></tr></table></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  const text = [subject, ...paragraphs, `${cta}: ${site}${path}`, note, 'mad.builders\nThe builders’ house in Madrid.', `Visit mad.builders: ${site}`, reason, `Unsubscribe: ${unsubscribeUrl}`].join('\n\n');
  return { subject, html, text };
}
