import { env } from './config/env.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`ERP Portal API listening on 0.0.0.0:${env.PORT}`);
});
