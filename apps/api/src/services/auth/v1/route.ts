import { Hono, MiddlewareHandler, Context } from 'hono';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import * as jose from 'jose';
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

const JWT_PREFIX = 'http:cheda.kr/';

type SessionPayload = PrefixRoot<typeof JWT_PREFIX, {
	user: {
		userId: string;
		userName: string;
		userImage: string;
		accessToken: string;
	};
}>;

type SecuredSessionPayload = PrefixRoot<typeof JWT_PREFIX, {
	user: {
		refreshToken: string;
	};
}>;

type StatePayload = PrefixRoot<typeof JWT_PREFIX, {
	state: {
		id: string;
		url: string;
	};
}>;

type PrefixRoot<TPrefix extends string, TValue extends { [k: string]: any }> = {
	[k in keyof TValue as k extends string ? `${TPrefix}${k}` : never]: TValue[k];
};

function prefixRoot<
	const TPrefix extends string,
	const TValue extends { [k: string]: any }
>(prefix: TPrefix, value: TValue) {
	return Object.fromEntries(
		Object.entries(value).map(([k, v]) => [`${prefix}${k}`, v])
	) as PrefixRoot<TPrefix, TValue>;
}

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

const withPrevUrl: MiddlewareHandler<{
	Bindings: Env;
	Variables: {
		privateKey: jose.KeyLike;
		publicKey: jose.KeyLike;
		prevUrl: string;
	};
}> = async (c, next) => {
	let prevUrl = 'https://cheda.kr/';
	try {
		prevUrl = new URL(c.req.query('prevUrl') ?? c.req.header('Referer') ?? '').toString();

		const stateCookie = getCookie(c, 'state');
		if (stateCookie) {
			const jwt = await jose.compactDecrypt(stateCookie, c.var.privateKey);
			const payload = await verifyToken<StatePayload>(c, jwt.plaintext);

			prevUrl = payload['http:cheda.kr/state'].url;

			deleteCookie(c, 'state', {
				httpOnly: true,
				...c.env.DEV ? {} : {
					secure: true,
					domain: '.cheda.kr',
				},
			});
		}
	} catch (e) {
		console.error(e);
	}

	c.set('prevUrl', prevUrl);

	await next();
};

const u8ToString = (arr: Uint8Array) => {
	return Array.from(arr).map(b => String.fromCharCode(b)).join('');
};

const verifyToken = async <T extends Record<string, any>, C extends Context = Context>(context: C, token: string | Uint8Array) => {
	const publicKey = await jose.importSPKI(u8ToString(jose.base64url.decode(context.env.JWT_PUBLIC_KEY)), 'ES256');
	const { payload } = await jose.jwtVerify<T>(token, publicKey);
	return payload;
};

const signToken = async <
	T extends Record<string, any>,
	C extends Context = Context
>(
	context: C,
	payload: T,
	expires: string | number | Date
) => {
	const privateKey = await jose.importPKCS8(u8ToString(jose.base64url.decode(context.env.JWT_SECRET_KEY)), 'ES256');
	const jwt = await new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'ES256' })
		.setExpirationTime(expires)
		.sign(privateKey);

	return jwt;
};

const encryptToken = async <C extends Context = Context>(context: C, token: string) => {
	const publicKey = await jose.importSPKI(u8ToString(jose.base64url.decode(context.env.JWT_PUBLIC_KEY)), 'ECDH-ES');
	const jwe = await new jose.CompactEncrypt(new TextEncoder().encode(token))
		.setProtectedHeader({ alg: 'ECDH-ES', enc: 'A256GCM' })
		.encrypt(publicKey);

	return jwe;
};

const decryptToken = async <C extends Context = Context>(context: C, token: string) => {
	const privateKey = await jose.importPKCS8(u8ToString(jose.base64url.decode(context.env.JWT_SECRET_KEY)), 'ECDH-ES');
	const result = await jose.compactDecrypt(token, privateKey);
	return result.plaintext;
};

const deleteSessionCookies = (c: Context) => {
	deleteCookie(c, 'session_id', {
		sameSite: 'None',
		secure: true,
		...c.env.DEV ? {} : {
			domain: '.cheda.kr',
		},
	});
	deleteCookie(c, 'session_sid', {
		httpOnly: true,
		sameSite: 'None',
		secure: true,
		...c.env.DEV ? {} : {
			domain: '.cheda.kr',
		},
	});
};

const withSession: MiddlewareHandler<{
	Bindings: Env,
	Variables: {
		publicKey: jose.KeyLike;
		privateKey: jose.KeyLike;
		prevUrl: string;
		session: {
			user: SessionPayload['http:cheda.kr/user'];
		};
	};
}> = async (c, next) => {
	const sessionId = getCookie(c, 'session_id');
	const sessionSid = getCookie(c, 'session_sid');

	let user;
	try {
		const payload = await verifyToken<SessionPayload>(c, sessionId ?? '');
		user = payload['http:cheda.kr/user'];
	} catch (e) {
		if (!sessionSid) {
			return c.json({ message: 'Unauthorized' }, 401);
		}
		const securedToken = await decryptToken(c, sessionSid ?? '');
		const securedPayload = await verifyToken<SecuredSessionPayload>(c, securedToken);
		const { refreshToken } = securedPayload['http:cheda.kr/user'];

		const url = new URL('https://nid.naver.com/oauth2.0/token');
		url.searchParams.append('grant_type', 'refresh_token');
		url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
		url.searchParams.append('client_secret', c.env.OAUTH_CLIENT_SECRET_NAVER);
		url.searchParams.append('refresh_token', refreshToken);

		const response = await fetch(url);
		const result = await response.json() as RefreshTokenResponse;

		const headers = {
			'Authorization': `Bearer ${result.access_token}`,
		};

		const [meResult, verifyResult] = await Promise.all([
			fetch('https://openapi.naver.com/v1/nid/me', { headers }).then(r => r.json()) as Promise<NidMeResponse>,
			fetch('https://openapi.naver.com/v1/nid/verify?info=true', { headers }).then(r => r.json()) as Promise<NidVerifyResponse>
		]);

		user = {
			userId: meResult.response.id,
			userName: meResult.response.nickname,
			userImage: meResult.response.profile_image,
			accessToken: result.access_token,
		};
		const expires = new Date(verifyResult.response.expire_date);

		const session = await signToken(
			c,
			prefixRoot(JWT_PREFIX, {
				user,
			}) satisfies SessionPayload,
			expires
		);

		setCookie(c, 'session_id', session, {
			expires,
			sameSite: 'None',
			secure: true,
			...c.env.DEV ? {} : {
				domain: '.cheda.kr',
			},
		});
	}
	c.set('session', { user });

	await next();
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

app.get(
	'/logout',
	csrf({
		origin: (origin, c) => {
			if (c.env.DEV) {
				return true;
			}
			return /https:\/\/(\w+\.)cheda\.kr/.test(origin);
		},
	})
);

app.get('/logout', withPrevUrl, async (c) => {
	try {
		// access token 갱신 요청으로 이전 토큰을 무효화
		const sessionSid = getCookie(c, 'session_sid')!;
		const securedToken = await decryptToken(c, sessionSid);
		const securedPayload = await verifyToken<SecuredSessionPayload>(c, securedToken);
		const { refreshToken } = securedPayload['http:cheda.kr/user'];

		const url = new URL('https://nid.naver.com/oauth2.0/token');
		url.searchParams.append('grant_type', 'refresh_token');
		url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
		url.searchParams.append('client_secret', c.env.OAUTH_CLIENT_SECRET_NAVER);
		url.searchParams.append('refresh_token', refreshToken);

		const response = await fetch(url);
		await response.json() as RefreshTokenResponse;
	} finally {
		deleteSessionCookies(c);
		return c.redirect(c.var.prevUrl);
	}
});

app.get('/login', withPrevUrl, async (c) => {
	const url = new URL(`https://nid.naver.com/oauth2.0/authorize`);
	url.searchParams.append('response_type', 'code');
	url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
	url.searchParams.append('redirect_uri', `${c.env.API_ORIGIN}/services/auth/v1/callback`);

	const state: StatePayload = prefixRoot(JWT_PREFIX, {
		state: {
			id: crypto.randomUUID(),
			url: c.var.prevUrl,
		},
	});
	url.searchParams.append('state', state['http:cheda.kr/state'].id);

	const expires = new Date(Date.now() + 1000 * 60 * 5);

	const jwt = await signToken(c, state, expires);
	const jwe = await encryptToken(c, jwt);

	setCookie(c, 'state', jwe, {
		httpOnly: true,
		expires,
		...c.env.DEV ? {} : {
			secure: true,
			domain: '.cheda.kr',
		},
	});

	return c.redirect(url.toString());
});

app.get('/callback', async (c) => {
	let state: StatePayload | undefined;
	try {
		const cookie = getCookie(c, 'state')!;

		const jwt = await decryptToken(c, cookie);
		const payload = await verifyToken<StatePayload>(c, jwt);

		state = payload;
	} catch (e) {
		console.error(e);
		/* noop */
	} finally {
		deleteCookie(c, 'state', {
			httpOnly: true,
			...c.env.DEV ? {} : {
				secure: true,
				domain: '.cheda.kr',
			},
		});
	}

	if (!state) {
		return c.json({ message: 'Invalid state' }, 403);
	}

	const code = c.req.query('code');
	if (!code) {
		return c.redirect(state['http:cheda.kr/state'].url);
	}

	const { id, url: prevUrl } = state['http:cheda.kr/state'];

	if (!id || id !== c.req.query('state')) {
		return c.json({ message: 'Invalid request' }, 400);
	}

	const url = new URL('https://nid.naver.com/oauth2.0/token');
	url.searchParams.append('grant_type', 'authorization_code');
	url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
	url.searchParams.append('client_secret', c.env.OAUTH_CLIENT_SECRET_NAVER);
	url.searchParams.append('code', code);
	url.searchParams.append('state', id);

	const response = await fetch(url);

	if (!response.ok) {
		return c.redirect(prevUrl);
	}
	const result = await response.json() as AccessTokenResponse;

	const headers = {
		'Authorization': `Bearer ${result.access_token}`,
	};

	const [meResult, verifyResult] = await Promise.all([
		fetch('https://openapi.naver.com/v1/nid/me', { headers }).then(r => r.json()) as Promise<NidMeResponse>,
		fetch('https://openapi.naver.com/v1/nid/verify?info=true', { headers }).then(r => r.json()) as Promise<NidVerifyResponse>
	]);

	const now = new Date();
	const user = {
		userId: meResult.response.id,
		userName: meResult.response.nickname,
		userImage: meResult.response.profile_image,
		createdAt: now,
		updatedAt: now,
		accessToken: result.access_token,
		refreshToken: result.refresh_token,
		tokenType: result.token_type,
	};
	const expires = new Date(verifyResult.response.expire_date);

	const db = drizzle(c.env.DB);
	try {
		await db.insert(usersTable)
			.values({
				userId: meResult.response.id,
				userName: meResult.response.nickname,
				userImage: meResult.response.profile_image,
				userType: 'normal',
				createdAt: now,
				updatedAt: now,
			});
	} catch (e) {
		await db.update(usersTable)
			.set({
				userName: meResult.response.nickname,
				userImage: meResult.response.profile_image,
				updatedAt: now,
			})
			.where(eq(usersTable.userId, user.userId));
	}

	const session = await signToken(
		c,
		prefixRoot(JWT_PREFIX, {
			user: {
				userId: user.userId,
				userName: user.userName,
				userImage: user.userImage,
				accessToken: user.accessToken,
			},
		}) satisfies SessionPayload,
		expires
	);

	const monthLater = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
	let securedSession = await signToken(
		c,
		prefixRoot(JWT_PREFIX, {
			user: {
				refreshToken: user.refreshToken,
			},
		}) satisfies SecuredSessionPayload,
		monthLater,
	);
	securedSession = await encryptToken(c, securedSession);

	setCookie(c, 'session_id', session, {
		expires,
		sameSite: 'None',
		secure: true,
		...c.env.DEV ? {} : {
			domain: '.cheda.kr',
		},
	});

	setCookie(c, 'session_sid', securedSession, {
		httpOnly: true,
		sameSite: 'None',
		secure: true,
		expires: monthLater,
		...c.env.DEV ? {} : {
			domain: '.cheda.kr',
		},
	});

	return c.redirect(prevUrl);
});

app.get('/me', withSession, async (c) => {
	const { user } = c.var.session;

	const response = await fetch('https://openapi.naver.com/v1/nid/me', {
		headers: {
			'Authorization': `Bearer ${user.accessToken}`,
		},
	});

	if (!response.ok) {
		if (response.status === 401) {
			throw new HTTPException(401, { message: 'Unauthorized' });
		}
		throw new HTTPException(500, { message: 'Internal Server Error' });
	}

	const result = await response.json() as NidMeResponse;

	return c.json({
		id: result.response.id,
		name: result.response.nickname,
		image: result.response.profile_image,
	});
});

app.delete('/me', withSession, async (c) => {
	const { user } = c.var.session;

	const url = new URL('https://nid.naver.com/oauth2.0/token');
	url.searchParams.append('grant_type', 'delete');
	url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
	url.searchParams.append('client_secret', c.env.OAUTH_CLIENT_SECRET_NAVER);
	url.searchParams.append('access_token', user.accessToken);
	url.searchParams.append('service_provider', 'NAVER');

	const response = await fetch(url);
	const result = await response.json() as DeleteTokenRespone;

	const db = drizzle(c.env.DB);

	await db.delete(usersTable)
		.where(eq(usersTable.userId, user.userId));

	deleteSessionCookies(c);

	return c.json(result);
});

export default app;
