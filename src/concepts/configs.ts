export const config = () => ({
  JSR_REGISTRY_URL: Deno.env.get('DENO_REGISTRY_URL') ?? 'https://jsr.io',
  MAX_REDIRECTS: Number(Deno.env.get('DENO_MAX_REDIRECTS')) || 10,
})
