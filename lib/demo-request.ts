export function buildDemoSignUpUrl(params: { email: string; source: string }) {
  const signUpParams = new URLSearchParams({
    email: params.email,
    source: params.source,
  });
  return `/sign-up?${signUpParams.toString()}`;
}
