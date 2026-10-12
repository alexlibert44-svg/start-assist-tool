// Resolves the signed-in user of an /api request from its "Authorization: Bearer <token>" header.
const cache = new WeakMap<Request, Promise<string | null>>();

export function userIdFromRequest(request: Request): Promise<string | null> {
  let p = cache.get(request);
  if (!p) {
    p = (async () => {
      const h = request.headers.get("authorization") ?? "";
      const token = h.startsWith("Bearer ") ? h.slice(7) : "";
      if (token.split(".").length !== 3) return null;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    })();
    cache.set(request, p);
  }
  return p;
}

export async function requireUserId(request: Request): Promise<string> {
  const id = await userIdFromRequest(request);
  if (!id) throw new Error("Unauthorized");
  return id;
}
