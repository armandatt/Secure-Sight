import { Hono } from 'hono'
import VerifyRouter from './routes/verify'
import userRouter from './routes/user';
import {cors} from 'hono/cors';


const app = new Hono()

app.use("/*" , cors())
app.route("/api/v1/user" , userRouter);
app.route("/api/v1/verify" , VerifyRouter);


export default app
