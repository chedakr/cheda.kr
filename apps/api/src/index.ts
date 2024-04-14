import { Hono } from 'hono';
import auth from './services/auth/v1/route';

const app = new Hono();

app.get('/', async (c) => {
	return c.json({ message: 'Hello, World!' });
});

app.route('/services/auth/v1', auth);

export default app;
