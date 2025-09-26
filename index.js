import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';

import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import authenticationRoutes from './routes/authenticationRoutes.js';
import { connectDB } from './db/config.js';
import termsRoutes from './routes/termsRoutes.js';
import specs from './db/swagger.js';
import locationsRoutes from './routes/locationsRoutes.js';
import itemsRoutes from './routes/itemsRoutes.js';
import companiesRoutes from './routes/companiesRoutes.js';
import { verifyToken } from './middleware/auth.js';
import { requestLogger } from './middleware/requestLogger.js';
import transferOrderRoutes from './routes/transferOrderRoutes.js';
import fdRoutes from './routes/fdRoutes.js';
import productVarientRoutes from './routes/productVarientRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;
connectDB();

app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('Dynamics External Exposed API');
});

app.use(requestLogger);

app.use('/api', verifyToken);
app.use('/api', itemsRoutes);
app.use('/api', vendorRoutes);
app.use('/api/transfer-orders', transferOrderRoutes);
app.use('/api/po', purchaseOrderRoutes);
app.use('/api/auth', authenticationRoutes);
app.use('/api/terms', termsRoutes);
app.use('/api', productVarientRoutes )
app.use('/api/fd', fdRoutes)
app.use('/api/locations', locationsRoutes);
app.use('/api/companies', companiesRoutes);



app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    swaggerOptions: { persistAuthorization: true }
}));

app.get('/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
    });
});


app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`JWT Issuer: ${process.env.JWT_ISSUER}`);
    console.log(`JWT Audience: ${process.env.JWT_AUDIENCE}`);
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Swagger: http://localhost:${PORT}/docs`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

//app.use('/api/fields', fieldsRoutes); //deprecated