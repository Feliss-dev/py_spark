# BigData Analytics Frontend

A comprehensive analytics dashboard built with Next.js 15, React, and Tailwind CSS for visualizing big data processing results and promotion effectiveness analysis.

## Features

- **📤 File Upload**: Drag & drop interface for CSV/Excel files with validation
- **📊 Job Management**: Track processing status and manage analysis jobs
- **🔍 Comprehensive Analytics**:
  - Sales volume analysis and promotion effectiveness
  - Rating impact assessment
  - Revenue efficiency metrics
  - Price lift modeling with scenario analysis
- **📈 Interactive Charts**: Built with Recharts for data visualization
- **🎨 Modern UI**: shadcn/ui components with Tailwind CSS
- **⚡ Performance**: SWR for data caching and background updates
- **📱 Responsive**: Desktop-first with mobile support

## Tech Stack

- **Framework**: Next.js 15 (Pages Router)
- **UI Library**: React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Data Fetching**: SWR for caching and revalidation
- **Charts**: Recharts
- **File Upload**: react-dropzone
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+ and npm/yarn
- Backend API server running (FastAPI + PySpark)

## Setup Instructions

### 1. Install Dependencies

```bash
cd frontend
npm install

# Install additional required packages
npm install date-fns react-dropzone recharts swr
```

### 2. Environment Configuration

Create `.env.local` file:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# For production, replace with your backend URL
# NEXT_PUBLIC_API_URL=https://your-backend-api.com/api
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### 4. Build for Production

```bash
npm run build
npm start
```

## Backend API Requirements

The frontend expects these backend endpoints to be available:

### Job Management

- `POST /api/jobs/upload` - Upload CSV/Excel files
- `GET /api/jobs/list` - List all uploaded jobs
- `GET /api/jobs/status/{job_id}` - Get job status and metadata

### Data Processing

- `POST /api/jobs/classify/{job_id}` - Run promotion classification
- `POST /api/jobs/analyze/{job_id}` - Run comprehensive analysis
- `GET /api/jobs/analyze/{job_id}/results` - Get analysis results

### Analytics

- `GET /api/jobs/analysis/{job_id}/efficiency` - Get efficiency metrics
- `POST /api/jobs/price-lift/{job_id}` - Run price lift modeling

### File Downloads

- `GET /api/jobs/download/{job_id}` - Download processed data

## Expected Data Format

Your CSV/Excel files should contain these columns:

| Column         | Description                           |
| -------------- | ------------------------------------- |
| `product_name` | Name/title of the product             |
| `product_type` | Category or type of product           |
| `sales_volume` | Number of units sold                  |
| `price`        | Product price                         |
| `sale_time`    | Time of sale                          |
| `date`         | Sale date                             |
| `platform`     | Sales platform (e.g., Shopee, Lazada) |
| `brand`        | Product brand                         |
| `reviews`      | Number of reviews                     |
| `rating`       | Product rating                        |

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── upload/         # File upload components
│   │   ├── jobs/           # Job management components
│   │   ├── analysis/       # Analysis result components
│   │   └── ui/             # shadcn/ui base components
│   ├── hooks/              # Custom React hooks
│   │   ├── use-jobs.ts     # Job management hooks
│   │   ├── use-job-data.ts # Analysis data hooks
│   │   └── use-upload.ts   # File upload hooks
│   ├── lib/                # Utility libraries
│   │   └── api-client.ts   # Backend API client
│   ├── pages/              # Next.js pages
│   │   └── dashboard/      # Dashboard pages
│   │       ├── index.tsx   # Main dashboard
│   │       └── [jobId].tsx # Job analysis page
│   ├── types/              # TypeScript type definitions
│   │   └── api.ts          # API response types
│   └── styles/             # Global styles
├── public/                 # Static assets
├── .env.local             # Environment variables
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## Key Components

### Dashboard (`/dashboard`)

- Upload new datasets
- View all processing jobs
- Monitor job status and progress
- Quick access to job actions

### Job Analysis (`/dashboard/[jobId]`)

- **Comprehensive Tab**: Sales analysis, rating impact, efficiency metrics
- **Efficiency Tab**: Revenue metrics and market penetration
- **Price Modeling Tab**: Interactive price lift analysis with scenario planning
- **Raw Data Tab**: File information and column validation

## Usage Guide

### 1. Upload Data

1. Go to Dashboard → Upload Data tab
2. Drag & drop or select your CSV/Excel file
3. System validates file structure automatically
4. File appears in Jobs list when upload completes

### 2. Process Data

1. Go to Dashboard → Manage Jobs tab
2. Find your uploaded file
3. Click "Classify" to detect promotions
4. Click "Analyze" to run comprehensive analysis
5. Click "View Results" when processing completes

### 3. Analyze Results

1. Click on any completed job to open analysis page
2. **Comprehensive**: View sales lift, rating impact, business insights
3. **Efficiency**: Review revenue metrics and market penetration
4. **Price Modeling**: Run scenarios to predict price change impacts
5. **Raw Data**: Check file details and column validation

### 4. Price Lift Modeling

1. Open job analysis page → Price Modeling tab
2. Configure analysis parameters:
   - Primary price change (e.g., -0.10 for 10% reduction)
   - Multiple scenarios (e.g., [-0.15, -0.10, -0.05, 0.05, 0.10, 0.15])
   - Group analysis by product_type, brand, or platform
3. Click "Run Price Lift Analysis"
4. Review model performance, scenario results, and business insights

## API Integration

The frontend uses SWR for efficient data fetching with features like:

- **Automatic Caching**: Reduces API calls and improves performance
- **Background Updates**: Keeps data fresh without blocking UI
- **Error Handling**: Graceful error states and retry logic
- **Loading States**: Skeleton loaders and progress indicators

## Troubleshooting

### Common Issues

1. **API Connection Errors**

   - Check backend server is running on correct port
   - Verify `NEXT_PUBLIC_API_URL` in `.env.local`
   - Check CORS settings on backend

2. **File Upload Failures**

   - Ensure file has required columns
   - Check file size (max 50MB)
   - Verify file format (CSV, XLS, XLSX)

3. **Analysis Not Loading**
   - Check job status is 'completed' or 'classified'
   - Verify backend processing completed successfully
   - Check browser console for API errors

### Development Tips

- Use browser DevTools Network tab to debug API calls
- Check browser console for JavaScript errors
- Use SWR DevTools for cache inspection
- Enable verbose logging in development

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is part of the BigData Analytics Platform for educational purposes.
