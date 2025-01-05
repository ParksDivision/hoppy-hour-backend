import express from 'express'
import router from './routes';
const app = express()

app.use(express.json())

// Mount the routes
app.use('/', router);

export default app