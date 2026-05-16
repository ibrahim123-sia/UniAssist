import nodemailer from "nodemailer";
import Notification from "../models/Notification.js";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: "SSLv3",
  },
});

const emailTemplate = ({ heading, body, link }) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <div style="background: #1E2E6E; color: white; padding: 15px; border-radius: 10px 10px 0 0; text-align: center;">
      <h1 style="margin: 0;">UniAssist</h1>
    </div>
    <div style="padding: 25px;">
      <h2 style="color: #1E2E6E;">${heading}</h2>
      <p>${body}</p>
      ${
        link
          ? `<p style="margin-top: 24px;"><a href="${link}" style="background: #1E2E6E; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px;">View in UniAssist</a></p>`
          : ""
      }
      <p style="color: #666; font-size: 12px; margin-top: 24px;">UniAssist | MAJU Student Portal</p>
    </div>
  </div>
`;

// Send an email to an arbitrary address WITHOUT creating an in-app notification.
// Used for security alerts (e.g. "your sign-in email was just changed") that
// need to reach the OLD address, which is no longer attached to any user record.
export const sendDirectEmail = async ({ to, subject, heading, body, link }) => {
  if (!to) return;
  try {
    const clientBase = process.env.CLIENT_URL || "";
    const fullLink = clientBase && link ? `${clientBase}${link}` : null;
    await transporter.sendMail({
      from: `"UniAssist" <${process.env.EMAIL_USER}>`,
      to,
      subject: subject || heading,
      html: emailTemplate({
        heading: heading || subject,
        body: body || "",
        link: fullLink,
      }),
      text: `${heading || subject}${fullLink ? `\n\nOpen: ${fullLink}` : ""}`,
    });
  } catch (err) {
    console.error("sendDirectEmail failed:", err.message);
  }
};

export const notify = async (
  user,
  { type, issueId, message, link, emailSubject, emailHeading, emailBody }
) => {
  try {
    await Notification.create({
      userId: user._id,
      type,
      issueId: issueId || null,
      message,
      link: link || "",
    });
  } catch (err) {
    console.error("notify: failed to create notification doc", err.message);
  }

  if (user.email) {
    try {
      const clientBase = process.env.CLIENT_URL || "";
      const fullLink = clientBase && link ? `${clientBase}${link}` : null;

      await transporter.sendMail({
        from: `"UniAssist" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: emailSubject || message,
        html: emailTemplate({
          heading: emailHeading || message,
          body: emailBody || message,
          link: fullLink,
        }),
        text: `${message}${fullLink ? `\n\nOpen: ${fullLink}` : ""}`,
      });
    } catch (err) {
      console.error("notify: email send failed", err.message);
    }
  }
};
