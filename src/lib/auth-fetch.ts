import { supabase } from "@/integrations/supabase/client";

// Adds the signed-in user's token to every same-origin /api request, so the app's existing
// fetch calls stay unchanged while the server can scope data to the user.
let installed = false;
export function installAuthFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isApi = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);
    if (!isApi) return original(input, init);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return original(input, { ...init, headers });
  };
}
