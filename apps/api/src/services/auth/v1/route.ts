import { Hono, MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
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

function prefixRoot<
	const TPrefix extends string,
	const TValue extends { [k: string]: any }
>(prefix: TPrefix, value: TValue) {
	return Object.fromEntries(
		Object.entries(value).map(([k, v]) => [`${prefix}${k}`, v])
	) as { [k in keyof TValue as k extends string ? `${TPrefix}${k}` : never]: TValue[keyof TValue] };
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
			const jwt = await jose.compactDecrypt(getCookie(c, 'state')!, c.var.privateKey);
			const { payload } = await jose.jwtVerify<{ id: string; url: string }>(jwt.plaintext, c.var.publicKey);

			prevUrl = payload.url;

			deleteCookie(c, 'state');
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

const withPrivateKey: MiddlewareHandler<{
	Bindings: Env;
	Variables: {
		privateKey: jose.KeyLike;
	};
}> = async (c, next) => {
	const privateKey = await jose.importPKCS8(u8ToString(jose.base64url.decode(c.env.JWT_SECRET_KEY)), 'ES256');
	c.set('privateKey', privateKey);

	await next();
};

const withPublicKey: MiddlewareHandler<{
	Bindings: Env;
	Variables: {
		publicKey: jose.KeyLike;
	};
}> = async (c, next) => {
	const publicKey = await jose.importSPKI(u8ToString(jose.base64url.decode(c.env.JWT_PUBLIC_KEY)), 'ES256');
	c.set('publicKey', publicKey);

	await next();
};

const withSessionId: MiddlewareHandler<{
	Bindings: Env,
	Variables: {
		publicKey: jose.KeyLike;
		privateKey: jose.KeyLike;
		prevUrl: string
	};
}> = async (c, next) => {
	class InvalidToken extends Error {}

	try {
		const sessionId = getCookie(c, 'session_id');
		if (!sessionId) throw new InvalidToken();

		const { payload } = await jose.jwtVerify(sessionId, c.var.publicKey);
		const user = payload['http:cheda.kr/user'] as any;

		const threshold = 1000 * 60 * 10;
		if (new Date(user.expireAt).getTime() <= Date.now() + threshold) {
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

			const [meResult, verifyResult] = await Promise.all([
				fetch('https://openapi.naver.com/v1/nid/me', { headers }).then(r => r.json()) as Promise<NidMeResponse>,
				fetch('https://openapi.naver.com/v1/nid/verify?info=true', { headers }).then(r => r.json()) as Promise<NidVerifyResponse>
			]);

			const userPatch = {
				userName: meResult.response.nickname,
				userImage: meResult.response.profile_image,
				accessToken: result.access_token,
				tokenType: result.token_type,
				expireAt: new Date(verifyResult.response.expire_date),
				updatedAt: new Date(),
			};

			const db = drizzle(c.env.DB);
			await db.update(usersTable)
				.set(userPatch)
				.where(eq(usersTable.userId, meResult.response.id));

		       	const expires = new Date(Date.now() + parseInt(result.expires_in) * 1000);
		       	const jwt = await new jose.SignJWT({ ...user, ...userPatch })
				.setProtectedHeader({ alg: 'ES256' })
				.setExpirationTime(expires)
				.sign(c.var.privateKey);

			setCookie(c, 'session_id', jwt, {
				expires,
				...c.env.DEV ? {} : {
					secure: true,
					domain: '.cheda.kr',
				},
			});
		}
	} catch (e) {
		if (e instanceof InvalidToken) {
			deleteCookie(c, 'session_id');
			return c.json({ message: 'Unauthorized' }, 401);
		}
		throw e;
	}
	await next();
};

app.get('/logout', withPublicKey, withPrevUrl, async (c) => {
	const sessionId = getCookie(c, 'session_id');
	if (!sessionId) {
		return c.redirect(c.var.prevUrl);
	}

	const { payload } = await jose.jwtVerify(sessionId, c.var.publicKey);
	const user = payload['http:cheda.kr/user'] as any;

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

	const db = drizzle(c.env.DB);
	await db.update(usersTable)
		.set({
			accessToken: null,
			expireAt: null,
			updatedAt: new Date(),
		})
		.where(eq(usersTable.userId, user.userId));

	deleteCookie(c, 'session_id');

	return c.redirect(c.var.prevUrl);
});

app.get('/login', withPrivateKey, withPublicKey, withPrevUrl, async (c) => {
	const url = new URL(`https://nid.naver.com/oauth2.0/authorize`);
	url.searchParams.append('response_type', 'code');
	url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
	url.searchParams.append('redirect_uri', `${c.env.API_ORIGIN}/services/auth/v1/callback`);

	const state = {
		id: crypto.randomUUID(),
		url: c.var.prevUrl,
	};
	url.searchParams.append('state', state.id);

	const expires = new Date(Date.now() + 1000 * 60 * 5);

	const jwt = await new jose.SignJWT(state)
		.setProtectedHeader({ alg: 'ES256' })
		.setExpirationTime(expires)
		.sign(c.var.privateKey);

	const publicKey = await jose.importSPKI(u8ToString(jose.base64url.decode(c.env.JWT_PUBLIC_KEY)), 'ECDH-ES');
	const jwe = await new jose.CompactEncrypt(new TextEncoder().encode(jwt))
		.setProtectedHeader({ alg: 'ECDH-ES', enc: 'A256GCM' })
		.encrypt(publicKey);

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

app.get('/callback', withPrivateKey, withPublicKey, async (c) => {
	let state: { id: string; url: string } | null = null;
	try {
		const cookie = getCookie(c, 'state')!;

		const privateKey = await jose.importPKCS8(u8ToString(jose.base64url.decode(c.env.JWT_SECRET_KEY)), 'ECDH-ES');
		const jwt = await jose.compactDecrypt(cookie, privateKey);

		const { payload } = await jose.jwtVerify<{ id: string; url: string }>(jwt.plaintext, c.var.publicKey);
		state = payload;
	} catch (e) {
		console.error(e);
		/* noop */
	} finally {
		deleteCookie(c, 'state');
	}

	if (!state) {
		return c.json({ message: 'Invalid state' }, 403);
	}

	const code = c.req.query('code');
	if (!code) {
		return c.redirect(state.url);
	}

	if (!state.id || state.id !== c.req.query('state')) {
		return c.json({ message: 'Invalid request' }, 400);
	}

	const url = new URL('https://nid.naver.com/oauth2.0/token');
	url.searchParams.append('grant_type', 'authorization_code');
	url.searchParams.append('client_id', c.env.OAUTH_CLIENT_ID_NAVER);
	url.searchParams.append('client_secret', c.env.OAUTH_CLIENT_SECRET_NAVER);
	url.searchParams.append('code', code);

	const response = await fetch(url);

	if (!response.ok) {
		return c.redirect(state.url);
	}
	const result = await response.json() as AccessTokenResponse;

	const headers = {
		'Authorization': `Bearer ${result.access_token}`,
	};

	const [meResult, verifyResult] = await Promise.all([
		fetch('https://openapi.naver.com/v1/nid/me', { headers }).then(r => r.json()) as Promise<NidMeResponse>,
		fetch('https://openapi.naver.com/v1/nid/verify?info=true', { headers }).then(r => r.json()) as Promise<NidVerifyResponse>
	]);

	const db = drizzle(c.env.DB);

	const user = {
		userId: meResult.response.id,
		userName: meResult.response.nickname,
		userImage: meResult.response.profile_image,
		createdAt: new Date(),
		updatedAt: new Date(),
		accessToken: result.access_token,
		refreshToken: result.refresh_token,
		tokenType: result.token_type,
		expireAt: new Date(verifyResult.response.expire_date),
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
				refreshToken: user.refreshToken,
				tokenType: user.tokenType,
				expireAt: user.expireAt,
				updatedAt: user.updatedAt,
			})
			.where(eq(usersTable.userId, user.userId));
	}

	const payload = prefixRoot('http:cheda.kr/', {
		user: {
			userId: user.userId,
			userName: user.userName,
			userImage: user.userImage,
			accessToken: user.accessToken,
			expireAt: user.expireAt,
			updatedAt: user.updatedAt,
		},
	});
	const jwt = await new jose.SignJWT({ ...payload })
		.setProtectedHeader({ alg: 'ES256' })
		.setExpirationTime(user.expireAt)
		.sign(c.var.privateKey);

	setCookie(c, 'session_id', jwt, {
		expires: new Date(Date.now() + parseInt(result.expires_in) * 1000),
		...c.env.DEV ? {} : {
			secure: true,
			domain: '.cheda.kr',
		},
	});
	return c.redirect(state.url);
});

app.get('/me', withPublicKey, withSessionId, async (c) => {
	const sessionId = getCookie(c, 'session_id');
	if (!sessionId) {
		return c.json({ message: 'Unauthorized' }, 401);
	}

	const { payload } = await jose.jwtVerify(sessionId, c.var.publicKey);
	const user = payload['http:cheda.kr/user'] as any;

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
