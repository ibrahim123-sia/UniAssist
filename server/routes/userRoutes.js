import express from 'express'
import { 
  registerUser,
  verifyOtp,
  resentOtp,
  forgetPassword,
  resetPassword,
  loginUser,
  getUser
} from '../controllers/userController.js'
import { protect } from '../middlewares/auth.js'

const userRouter = express.Router()

// Apply rate limiter to OTP-related routes
userRouter.post('/resend-otp', resentOtp)
userRouter.post('/forgot-password', forgetPassword)

// Public routes
userRouter.post('/register', registerUser)
userRouter.post('/verify-otp', verifyOtp)
userRouter.post('/reset-password', resetPassword)
userRouter.post('/login', loginUser)

// Protected route - get user profile
userRouter.get('/get', protect, getUser)

export default userRouter