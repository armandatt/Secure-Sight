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
  origin: '*',
  allowHeaders: ['*'],
  allowMethods: ['*'],
  credentials: true
}))

app.route("/api/v1/user" , userRouter);
app.route("/api/v1/verify" , VerifyRouter);


export default app
