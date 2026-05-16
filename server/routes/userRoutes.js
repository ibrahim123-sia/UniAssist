import express from 'express'
import {
  registerUser,
  verifyOtp,
  resentOtp,
  forgetPassword,
  resetPassword,
  loginUser,
  getUser,
  updateProfile,
  changePassword,
} from '../controllers/userController.js'
import { protect } from '../middlewares/auth.js'
import { avatarUpload, handleUploadError } from '../middlewares/upload.js'

const userRouter = express.Router()

// Apply rate limiter to OTP-related routes
userRouter.post('/resend-otp', resentOtp)
userRouter.post('/forgot-password', forgetPassword)

// Public routes
userRouter.post('/register', registerUser)
userRouter.post('/verify-otp', verifyOtp)
userRouter.post('/reset-password', resetPassword)
userRouter.post('/login', loginUser)

// Protected routes
userRouter.get('/get', protect, getUser)
userRouter.patch(
  '/profile',
  protect,
  avatarUpload.single('avatar'),
  handleUploadError,
  updateProfile
)
userRouter.post('/change-password', protect, changePassword)

export default userRouter