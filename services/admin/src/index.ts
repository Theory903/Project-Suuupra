import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env.PORT || 8099;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'admin-dashboard',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP admin_dashboard_requests_total Total requests to admin dashboard
# TYPE admin_dashboard_requests_total counter
admin_dashboard_requests_total 1
`);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Suuupra Admin Dashboard',
    version: '1.0.0',
    status: 'operational'
  });
});

app.listen(PORT, () => {
  console.log(`Admin Dashboard running on port ${PORT}`);
});
