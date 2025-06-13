import { Hono } from "hono";
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from "@prisma/extension-accelerate";
import { decode, sign, verify } from 'hono/jwt';
import VerifyRouter from "./verify";


// import { signupInput ,signinInput } from '../../../common/src/index';

export const userRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string
    JWT_SECRET: string
  }
  Variables: {
    userID: string
  }
}>();


userRouter.post('/signin', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate())

  const body = await c.req.json();
  try {
    const user = await prisma.user.findFirst({
      where: {
        username: body.username,
        password: body.password,
      },
      select: {
        id: true,
      }
    })

    if (!user) {
      c.status(403);
      return c.json({ error: 'User not found' })
    }

    const token = await sign({ id: user.id }, c.env.JWT_SECRET)
    return c.json({
      jwt: token,
    })


  } catch (error) {
    console.error(error)
    return c.text("Error finding user")
  }

})


userRouter.post('/signup', async (c) => {

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate())

  const body = await c.req.json();


  try {
    const user = await prisma.user.create({
      data: {
        username: body.username,
        name: body.name,
        password: body.password,
      }
    })

    const token = await sign({ id: user.id }, c.env.JWT_SECRET)
    console.log("User created:", user)
    console.log("JWT:", token)
    return c.json({
      jwt: token
    })


  } catch (error) {
    console.error(error)
    return c.text("Error creating user")
  }
})

export default userRouter