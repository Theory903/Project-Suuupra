import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';

const app = express();
const PORT = process.env.PORT || 8093;

// Configure multer for file uploads
const upload = multer({ dest: '/app/temp/' });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'creator-studio',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP creator_studio_requests_total Total requests to creator studio
# TYPE creator_studio_requests_total counter
creator_studio_requests_total 1

# HELP creator_studio_uploads_total Total file uploads
# TYPE creator_studio_uploads_total counter
creator_studio_uploads_total 0
`);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Suuupra Creator Studio',
    version: '1.0.0',
    status: 'operational',
    features: ['video_upload', 'content_management', 'analytics_dashboard', 'monetization_tools']
  });
});

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({
    message: 'File uploaded successfully',
    file_id: `upload_${Date.now()}`,
    filename: req.file.originalname,
    size: req.file.size,
    uploaded_at: new Date().toISOString()
  });
});

// Content management endpoints
app.get('/content', (req, res) => {
  res.json({
    content: [],
    total: 0,
    page: 1,
    limit: 10
  });
});

app.listen(PORT, () => {
  console.log(`Creator Studio running on port ${PORT}`);
});
