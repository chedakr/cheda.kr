import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import auth from './services/auth/v1/route';
import { Env } from '@/typings';

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
	console.error(`${err}`);

	if (err instanceof HTTPException) {
		return c.json({ message: err.message }, err.status);
	}
	return c.json({ message: 'Internal Server Error' }, 500);
});

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

		return origin;
	},
}));

app.get('/', async (c) => {
	return c.json({ message: c.env.DEV ? 'Hello, World!' : 'OK' });
});

app.route('/services/auth/v1', auth);

export default app;
