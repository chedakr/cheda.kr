import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Env } from '@/typings';
import { users as usersTable } from '@/db/schema';

type ErrorResponse = {
	error: string;
	error_description: string;
};

type AccessTokenResponse = {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: string;
};

type RefreshTokenResponse = {
	access_token: string;
	token_type: string;
	expires_in: string;
};

type DeleteTokenRespone = {
	access_token: string;
	result: string;
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

type NidVerifyResponse = NidApiResponse<{
	token: string;
	expire_date: string;
	allowed_profile: string;
	client_id: string;
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

app.use('*', cors({
	origin: (origin, c) => {
		if (c.env.DEV) {
			return origin;
		}

		try {
			const originUrl = new URL(origin);
			if (originUrl.hostname === 'cheda.kr' || originUrl.hostname.endsWith('.cheda.kr')) {
				return origin;
			}
		} catch (e) {}

		return 'https://cheda.kr';
	},
	credentials: true,
}));

app.get('/logout', async (c) => {
	let prevUrl = 'https://cheda.kr/';
	try {
		prevUrl = new URL(c.req.query('prevUrl') ?? c.req.header('Referer') ?? '').toString();
	} catch (e) {}

	const sessionId = getCookie(c, 'session_id');
	if (!sessionId) {
		return c.redirect(prevUrl);
	}

	const cache = await caches.open('auth');
	const matched = await cache.match(new Request(`http://localhost/__auth/${sessionId}`, { method: 'GET' }));

	if (!matched) {
		return c.redirect(prevUrl);
	}
	const user = JSON.parse(await collectResponse(matched));

	/*
	const url = new URL('https://nid.naver.com/oauth2.0/token');
	url.searchParams.append('grant_type', 'delete');
	url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
	url.searchParams.append('client_secret', c.env.OAUTH_CLIENT_SECRET_NAVER);
	url.searchParams.append('access_token', user.accessToken);
	url.searchParams.append('service_provider', 'NAVER');

	const response = await fetch(url);
	const result = await response.json() as DeleteTokenRespone;
	*/

	await cache.delete(new Request(`http://localhost/__auth/${sessionId}`, { method: 'GET' }));

	const db = drizzle(c.env.DB);
	await db.update(usersTable)
		.set({
			accessToken: null,
			refreshToken: null,
			expireAt: null,
			updatedAt: new Date(),
		})
		.where(eq(usersTable.userId, user.userId));

	deleteCookie(c, 'session_id');

	return c.redirect(prevUrl);
});

app.get('/login', async (c) => {
	let prevUrl = 'https://cheda.kr/';
	try {
		prevUrl = new URL(c.req.query('prevUrl') ?? c.req.header('Referer') ?? '').toString();
	} catch (e) {}

	const cache = await caches.open('auth');
	const sessionId = getCookie(c, 'session_id');
	if (sessionId) {
		const matched = await cache.match(new Request(`http://localhost/__auth/${sessionId}`, { method: 'GET' }));
		if (matched) {
			const user = JSON.parse(await collectResponse(matched));
			const expireAt = new Date(user.expireAt).getTime();
			if (Date.now() < expireAt) {
				return c.redirect(prevUrl);
			}
			const url = new URL('https://nid.naver.com/oauth2.0/token');
			url.searchParams.append('grant_type', 'refresh_token');
			url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
			url.searchParams.append('client_secret', c.env.OAUTH_CLIENT_SECRET_NAVER);
			url.searchParams.append('refresh_token', user.refreshToken);

			const response = await fetch(url);
			const result = await response.json() as RefreshTokenResponse;

			const headers = {
				'Authorization': `Bearer ${result.access_token}`,
			};
			const [me, verify] = await Promise.all([
				fetch('https://openapi.naver.com/v1/nid/me', { headers }).then(r => r.json()) as Promise<NidMeResponse>,
				fetch('https://openapi.naver.com/v1/nid/verify?info=true', { headers }).then(r => r.json()) as Promise<NidVerifyResponse>
			]);


			const db = drizzle(c.env.DB);

			await db.update(usersTable)
				.set({
					userName: me.response.nickname,
					userImage: me.response.profile_image,
					accessToken: result.access_token,
					tokenType: result.token_type,
					expireAt: new Date(verify.response.expire_date),
					updatedAt: new Date(),
				})
				.where(eq(usersTable.userId, me.response.id));

			deleteCookie(c, 'session_id');

			const newSessionId = crypto.randomUUID();

			await cache.put(
				new Request(`http://localhost/__auth/${newSessionId}`, { method: 'GET' }),
				new Response(JSON.stringify({
					userId: me.response.id,
					userName: me.response.nickname,
					userImage: me.response.profile_image,
					createdAt: new Date(),
					updatedAt: new Date(),
					accessToken: result.access_token,
					refreshToken: user.refreshToken,
					tokenType: result.token_type,
					expireAt: new Date(verify.response.expire_date),
				}), {
					headers: {
						'Cache-Control': `max-age=${result.expires_in}`,
					},
				}),
			);


			setCookie(c, 'session_id', newSessionId, {
				httpOnly: true,
				expires: new Date(Date.now() + parseInt(result.expires_in) * 1000),
				...c.env.DEV ? {} : {
					secure: true,
					domain: '.cheda.kr',
				},
			});
			return c.redirect(prevUrl);
		}
	}

	const prevState = getCookie(c, 'state');
	if (prevState) {
		await cache.delete(new Request(`http://localhost/__auth/${prevState}`, { method: 'GET' }));
	}

	const url = new URL(`https://nid.naver.com/oauth2.0/authorize`);
	url.searchParams.append('response_type', 'code');
	url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
	url.searchParams.append('redirect_uri', `${c.env.API_ORIGIN}/services/auth/v1/callback`);

	const state = crypto.randomUUID();
	url.searchParams.append('state', state);

	await cache.put(
		new Request(`http://localhost/__auth/${state}`, { method: 'GET' }),
		new Response(prevUrl, {
			headers: {
				'Cache-Control': 'max-age=600',
			},
		}),
	);

	setCookie(c, 'state', state, {
		httpOnly: true,
		...c.env.DEV ? {} : {
			secure: true,
			domain: '.cheda.kr',
		},
	});

	return c.redirect(url.toString());
});

app.get('/callback', async (c) => {
	const state = getCookie(c, 'state');
	deleteCookie(c, 'state');

	if (!state) {
		return c.json({ message: 'Forbidden' }, 403);
	}

	const cache = await caches.open('auth');
	const cached = await cache.match(new Request(`http://localhost/__auth/${state}`, { method: 'GET' }));
	if (!cached) {
		return c.json({ message: 'Forbidden' }, 403);
	}
	const prevUrl = await collectResponse(cached);

	const code = c.req.query('code');
	if (!code) {
		return c.redirect(prevUrl);
	}

	if (!state || state !== c.req.query('state')) {
		return c.json({ message: 'Invalid request' }, 400);
	}

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
	const result = await response.json() as AccessTokenResponse;

	const headers = {
		'Authorization': `Bearer ${result.access_token}`,
	};

	const [me, verify] = await Promise.all([
		fetch('https://openapi.naver.com/v1/nid/me', { headers }).then(r => r.json()) as Promise<NidMeResponse>,
		fetch('https://openapi.naver.com/v1/nid/verify?info=true', { headers }).then(r => r.json()) as Promise<NidVerifyResponse>
	]);

	const db = drizzle(c.env.DB);

	const user = {
		userId: me.response.id,
		userName: me.response.nickname,
		userImage: me.response.profile_image,
		createdAt: new Date(),
		updatedAt: new Date(),
		accessToken: result.access_token,
		refreshToken: result.refresh_token,
		tokenType: result.token_type,
		expireAt: new Date(verify.response.expire_date),
	};

	try {
		await db.insert(usersTable)
			.values(user);
	} catch (e) {
		await db.update(usersTable)
			.set({
				userName: user.userName,
				userImage: user.userImage,
				accessToken: user.accessToken,
				tokenType: user.tokenType,
				expireAt: user.expireAt,
				updatedAt: user.updatedAt,
			})
			.where(eq(usersTable.userId, user.userId));
	}

	const sessionId = crypto.randomUUID();

	await cache.put(
		new Request(`http://localhost/__auth/${sessionId}`, { method: 'GET' }),
		new Response(JSON.stringify(user), {
			headers: {
				'Cache-Control': `max-age=${result.expires_in}`,
			},
		}),
	);
	setCookie(c, 'session_id', sessionId, {
		httpOnly: true,
		expires: new Date(Date.now() + parseInt(result.expires_in) * 1000),
		...c.env.DEV ? {} : {
			secure: true,
			domain: '.cheda.kr',
		},
	});

	return c.redirect(prevUrl);
});

app.get('/me', async (c) => {
	const sessionId = getCookie(c, 'session_id');
	if (!sessionId) {
		return c.json({ message: 'Unauthorized' }, 401);
	}

	const cache = await caches.open('auth');
	const matched = cache.match(new Request(`http://localhost/__auth/${sessionId}`, { method: 'GET' }));

	if (!matched) {
		return c.json({ message: 'Unauthorized' }, 401);
	}
	const user = JSON.parse(await collectResponse(await matched));

	const response = fetch('https://openapi.naver.com/v1/nid/me', {
		headers: {
			'Authorization': `Bearer ${user.accessToken}`,
		},
	});

	const result = await response.then(r => r.json()) as NidMeResponse;

	return c.json({
		name: result.response.nickname,
		image: result.response.profile_image,
	});
});

export default app;
