import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { getResetPasswordEmailHtml } from './email-template';
import { FROM_EMAIL, resend } from "./resend";
// If your Prisma file is located elsewhere, you can change the path

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql", // or "mysql", "postgresql", ...etc
    }),
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,
        // If you want to enable auto sign in after sign up, set this to true
        sendResetPassword: async ({ user, url, token }) => {

            console.log({
                user: user,
                url: url,
                token: token
            });
            
            // your can use the url parameter or create your own url wiring to frontend with the token and send it to the user
            const redirUrl = `http://localhost:3000/reset-password?token=${token}`;
            const emailResult = getResetPasswordEmailHtml(user.email, redirUrl);

            const sendEmailResult = await resend.emails.send({
                from: FROM_EMAIL,
                to: user.email,
                subject: "Reset your password",
                html: emailResult
            });
            console.log("Email send result: ", sendEmailResult);

        },

    },
});