import { createAuthClient } from 'better-auth/client';

// Wires the GitHub button on every page that can start a session: /login and
// the first step of /build. The button carries its own post-login destination.
export function attachGithubSignIn(): void {
  const signInButton = document.querySelector<HTMLButtonElement>('[data-github-sign-in]');
  const authStatus = document.querySelector<HTMLElement>('[data-auth-status]');

  signInButton?.addEventListener('click', async () => {
    signInButton.disabled = true;
    if (authStatus) authStatus.textContent = 'Opening GitHub...';

    try {
      const authClient = createAuthClient();
      const { error } = await authClient.signIn.social({
        provider: 'github',
        callbackURL: signInButton.dataset.callback || '/build',
      });
      if (error) throw error;
    } catch {
      signInButton.disabled = false;
      if (authStatus) authStatus.textContent = 'GitHub sign-in failed. Try again.';
    }
  });
}
