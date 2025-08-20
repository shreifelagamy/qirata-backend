import nodemailer from 'nodemailer';

// Email service configuration using Mailtrap SMTP
const emailConfig = {
    host: process.env.MAIL_HOST || 'sandbox.smtp.mailtrap.io',
    port: parseInt(process.env.MAIL_PORT || '587'),
    secure: false, // Use STARTTLS
    auth: {
        user: process.env.MAIL_USERNAME || 'dff41a22b28084',
        pass: process.env.MAIL_PASSWORD
    }
};

// Create reusable transporter
const transporter = nodemailer.createTransport(emailConfig);

// Test the connection configuration
transporter.verify((error: any, success: any) => {
    if (error) {
        console.error('Email configuration error:', error);
    } else {
        console.log('📧 Email service ready to send messages');
    }
});

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Send email using Mailtrap SMTP
 */
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
    try {
        const mailOptions = {
            from: `${process.env.MAIL_FROM_NAME || 'Qirata'} <${process.env.MAIL_FROM_EMAIL || 'noreply@qirata.com'}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text || options.html.replace(/<[^>]*>/g, '') // Strip HTML for text version
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        return true;
    } catch (error) {
        console.error('Failed to send email:', error);
        return false;
    }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email: string, resetUrl: string): Promise<boolean> => {
    const subject = 'Reset Your Qirata Password';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="color: #2c3e50; margin: 0;">Qirata</h1>
                </div>
                
                <div style="background-color: white; padding: 30px; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #2c3e50; margin-top: 0;">Reset Your Password</h2>
                    
                    <p>Hello,</p>
                    
                    <p>You requested to reset your password for your Qirata account. Click the button below to set a new password:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                            Reset Password
                        </a>
                    </div>
                    
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
                    
                    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
                    
                    <p style="color: #6c757d; font-size: 14px;">
                        If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
                    </p>
                    
                    <p style="color: #6c757d; font-size: 14px;">
                        This link will expire in 15 minutes for security reasons.
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;

    return await sendEmail({ to: email, subject, html });
};

/**
 * Send email verification email
 */
export const sendEmailVerification = async (email: string, verificationUrl: string): Promise<boolean> => {
    const subject = 'Verify Your Qirata Account';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="color: #2c3e50; margin: 0;">Qirata</h1>
                </div>
                
                <div style="background-color: white; padding: 30px; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #2c3e50; margin-top: 0;">Verify Your Email Address</h2>
                    
                    <p>Welcome to Qirata!</p>
                    
                    <p>To complete your account setup and start using Qirata, please verify your email address by clicking the button below:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" 
                           style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                            Verify Email Address
                        </a>
                    </div>
                    
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #28a745;">${verificationUrl}</p>
                    
                    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
                    
                    <p style="color: #6c757d; font-size: 14px;">
                        If you didn't create a Qirata account, you can safely ignore this email.
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;

    return await sendEmail({ to: email, subject, html });
};
