import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { Env } from '@/typings';

type OAuthResponse = {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
};

type NidApiResponse<TResponse> = {
	resultcode: string;
	message: string;
	response: TResponse;
};

type NidMeResponse = NidApiResponse<{
	id: string;
	nickname: string;
	profile_image: string;
}>;

const collectResponse = async (response?: Response, fallback: string = '') => {
	if (response == null) {
		return fallback;
	}

	let result = '';
	for await (const value of response.body!) {
		result += new TextDecoder().decode(value);
	}
	return result || fallback;
};


const app = new Hono<{ Bindings: Env }>();

app.get('/login', async (c) => {
	const cache = await caches.open('auth');
	const prevState = getCookie(c, 'state');
	if (prevState) {
		await cache.delete(new Request(`http://localhost/__auth/${prevState}`, { method: 'GET' }));
	}

	const url = new URL(`https://nid.naver.com/oauth2.0/authorize`);
	url.searchParams.append('response_type', 'code');
	url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
	url.searchParams.append('redirect_uri', 'http://localhost:8787/services/auth/v1/callback');

	const state = crypto.randomUUID();
	url.searchParams.append('state', state);

	let prevUrl = 'https://cheda.kr/';
	try {
		prevUrl = new URL(c.req.query('prevUrl') ?? c.req.header('Referer') ?? '').toString();
	} catch (e) {}

	await cache.put(
		new Request(`http://localhost/__auth/${state}`, { method: 'GET' }),
		new Response(prevUrl, {
			headers: {
				'Cache-Control': 'max-age=600',
			},
		}),
	);

	setCookie(c, 'state', state, { httpOnly: true });

	return c.redirect(url.toString());
});

app.get('/callback', async (c) => {
	const code = c.req.query('code');
	const state = getCookie(c, 'state');

	deleteCookie(c, 'state');

	const cache = await caches.open('auth');
	const cached = await cache.match(new Request(`http://localhost/__auth/${state}`, { method: 'GET' }));

	if (!code || !state || state !== c.req.query('state') || !cached) {
		return c.json({ message: 'Invalid request' }, 400);
	}
	const prevUrl = await collectResponse(cached);

	await cache.delete(new Request(`http://localhost/__auth/${state}`, { method: 'GET' }));

	const url = new URL('https://nid.naver.com/oauth2.0/token');
	url.searchParams.append('grant_type', 'authorization_code');
	url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
	url.searchParams.append('client_secret', c.env.OAUTH_CLIENT_SECRET_NAVER);
	url.searchParams.append('code', code);

	const response = await fetch(url);

	if (!response.ok) {
		return c.redirect(prevUrl);
	}
	const result = await response.json() as OAuthResponse;

	const headers = {
		'Authorization': `Bearer ${result.access_token}`,
	};

	console.debug({
		...result as {},
		me: await fetch('https://openapi.naver.com/v1/nid/me', { headers }).then(r => r.json()) ?? {},
		verify: await fetch('https://openapi.naver.com/v1/nid/verify?info=true', { headers }).then(r => r.json()) ?? {},
	})
	return c.redirect(prevUrl);
});

export default app;
