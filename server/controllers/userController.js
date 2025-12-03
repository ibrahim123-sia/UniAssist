import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Chat from "../models/Chat.js";
import nodemailer from "nodemailer";
import User from "../models/User.js";

const transporter = nodemailer.createTransport({
  service: "outlook",
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    ciphers: "SSLv3",
  },
});

function generateotp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateJWT(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

export const registerUser=async(req,res)=>{
    const {name,email,password}=req.body

    try {
        const userExist=await User.findone({email})

        if(userExist?.isVerified){
            return res.status(409).json({
                success:false,
                message:"User Already Exist, Please Login"
            })

        }

        const otp=generateotp()
    } catch (error) {
        
    }
}