import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});
