import { Hono } from 'hono'
import VerifyRouter from './routes/verify'
import userRouter from './routes/user';
import {cors} from 'hono/cors';


const app = new Hono<{
  Bindings: {
    DATABASE_URL: string
    JWT_SECRET: string
  }
}>();

app.use('/*', cors({
  origin: 'https://secure-sight-git-master-armandatts-projects.vercel.app/',
  credentials: true,
  maxAge: 3600, // Cache preflight response for 1 hour
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'Accept', 'Origin', 'Referer', 'User-Agent', 'Cache-Control'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}))
app.route("/api/v1/user" , userRouter);
app.route("/api/v1/verify" , VerifyRouter);


export default app
