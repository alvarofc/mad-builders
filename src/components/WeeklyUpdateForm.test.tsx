import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import WeeklyUpdateForm from './WeeklyUpdateForm';

it('preserves the weekly questions, constraints, and conditional commitment fields', () => {
  for (const hasPromise of [false, true]) {
    for (const canSetNextPromise of [false, true]) {
      const html = renderToStaticMarkup(<WeeklyUpdateForm
        draftKey="weekly:builder:1" weekId={1} commitmentId={hasPromise ? 2 : undefined}
        promise={hasPromise ? 'Ship the demo' : null} canSetNextPromise={canSetNextPromise}
        editing={false} late={false} stages={[{ value: 'idea', label: 'Exploring an idea' }]}
        initialValues={{ projectSentence: 'A useful project', summary: 'Shipped a demo', status: 'complete', nextPromise: 'Launch it', feedbackRequest: '', projectUrl: '', projectStage: 'idea', proofUrl: '' }}
      />);
      for (const question of [
        'What are you building in a sentence?', 'What did you accomplish this week?',
        'What would you like feedback on from the community?', 'Project website',
        'Which of these best describes the stage of your project?', 'Proof URL',
      ]) expect(html).toContain(question);
      expect(html.includes('Did you do everything you planned?')).toBe(hasPromise);
      expect(html.includes('What do you want to have done by the end of next week?')).toBe(canSetNextPromise);
      expect(html).toContain('action="/api/result/publish"');
      expect(html).toContain('maxLength="1000"');
      expect(html).toContain('type="url"');
      expect(html).toContain('role="progressbar"');
      if (!hasPromise) expect(html).toContain('name="status" value="submitted"');
    }
  }
});
