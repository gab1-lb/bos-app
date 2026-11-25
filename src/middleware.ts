import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { DEMO_ROLE, MEMORY_COOKIE, MEMORY_MEMBERS_COOKIE, isDemo, isMemoryMode, memoryStatus, parseOverrides, personaIdForRole } from './lib/session';

const PUBLIC = ['/login', '/auth/callback', '/attente'];
const isPublic = (path: string) => PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

function redirect(req: NextRequest, path: string, base?: NextResponse) {
  const url = req.nextUrl.clone();
  const [pathname, search] = path.split('?');
  url.pathname = pathname;
  url.search = search ? `?${search}` : '';
  const res = NextResponse.redirect(url);
  base?.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

const NOT_ACTIVE = { pending: '/attente', denied: '/attente?refus=1' } as const;

async function memoryGate(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // Role / status decisions an admin made in this browser (memory mode keeps no server state).
  const overrides = parseOverrides(req.cookies.get(MEMORY_MEMBERS_COOKIE)?.value);
  if (path === '/login') {
    const id = personaIdForRole(req.nextUrl.searchParams.get('as'));
    if (!id) return isDemo() ? redirect(req, '/') : NextResponse.next();
    const status = memoryStatus(id, overrides);
    const next = req.nextUrl.searchParams.get('next');
    const home = next && /^\/(?![/\\])/.test(next) && !next.startsWith('/login') ? next : '/';
    const res = redirect(req, status === 'pending' || status === 'denied' ? NOT_ACTIVE[status] : home);
    res.cookies.set(MEMORY_COOKIE, id, { path: '/', sameSite: 'lax' });
    return res;
  }
  if (isPublic(path)) return NextResponse.next();
  const status = memoryStatus(req.cookies.get(MEMORY_COOKIE)?.value, overrides);
  if (status === 'none' && isDemo()) {
    // Demo visitors enter straight away, on the page their link pointed to, as the default persona.
    // No redirect: where cookies are refused (embedded previews, strict browsers) a redirect would loop.
    const res = NextResponse.next();
    res.cookies.set(MEMORY_COOKIE, personaIdForRole(DEMO_ROLE)!, { path: '/', sameSite: 'lax' });
    return res;
  }
  if (status === 'none') return redirect(req, '/login');
  if (status === 'pending' || status === 'denied') return redirect(req, NOT_ACTIVE[status]);
  return NextResponse.next();
}

async function supabaseGate(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );
  // Refreshes the session cookies when needed.
  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  if (path === '/auth/callback') return res;
  if (!user) return isPublic(path) ? res : redirect(req, '/login', res);

  const { data: member } = await supabase.from('members').select('status').eq('id', user.id).maybeSingle();
  const status = member?.status as string | undefined;
  if (status === 'active') return path === '/login' ? redirect(req, '/', res) : res;
  const dest = status === 'pending' ? '/attente' : '/attente?refus=1';
  if (path === '/attente' && (status === 'pending') === !req.nextUrl.searchParams.has('refus')) return res;
  return redirect(req, dest, res);
}

export async function middleware(req: NextRequest) {
  return isMemoryMode() ? memoryGate(req) : supabaseGate(req);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|terrain\\.svg$|tour-(?:fr|en)\\.mp4$|tour-poster\\.jpg$|demo/.*\\.pdf$).*)'],
};
