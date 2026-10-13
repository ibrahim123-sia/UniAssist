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
import {
  loginLimiter,
  loginIpLimiter,
  otpSendLimiter,
  otpSendIpLimiter,
  otpVerifyLimiter,
} from '../middlewares/rateLimit.js'

const userRouter = express.Router()

// Public routes — rate limited (OTP brute force, email bombing, password spraying)
userRouter.post('/register', otpSendIpLimiter, otpSendLimiter, registerUser)
userRouter.post('/resend-otp', otpSendIpLimiter, otpSendLimiter, resentOtp)
userRouter.post('/forgot-password', otpSendIpLimiter, otpSendLimiter, forgetPassword)
userRouter.post('/verify-otp', otpVerifyLimiter, verifyOtp)
userRouter.post('/reset-password', otpVerifyLimiter, resetPassword)
userRouter.post('/login', loginIpLimiter, loginLimiter, loginUser)

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