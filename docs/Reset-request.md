# Issue 01
When I enter a email that doesn't exist, better-auth respond with the following object.
```json
{
  "data": {
    "status": true,
    "message": "If this email exists in our system, check your email for the reset link"
  },
  "error": null
}
```
And in project terminal this error is shown:

`ERROR [Better Auth]: Reset Password: User not found { email: 'example@gmail.com' }`

I want the custom response if the user isn't exist in system
# Solution
Looking at your issue, better-auth masks the "user not found" error for security reasons (to prevent email enumeration attacks). However, you can customize this behavior.

Here are two solutions:

## Solution 1: Create a Custom API Route (Recommended)

This gives you full control over the response:

Create `app/api/auth/forgot-password/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: "User with this email does not exist",
            code: "USER_NOT_FOUND",
          },
        },
        { status: 404 }
      );
    }

    // If user exists, trigger password reset
    const result = await auth.api.sendPasswordResetEmail({
      email,
      redirectURL: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    });

    return NextResponse.json({
      data: {
        status: true,
        message: "Password reset link sent to your email",
      },
      error: null,
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      {
        data: null,
        error: {
          message: "Failed to process password reset request",
        },
      },
      { status: 500 }
    );
  }
}
```

Then update your `forget-pass.tsx` to call this endpoint:

```typescript
const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setLoading(true);
  try {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();

    if (response.ok) {
      setSuccess(result.data.message || "Reset link sent to your email");
      setError("");
    } else {
      setError(result.error?.message || "Something went wrong");
      setSuccess("");
    }
  } catch (err) {
    setError("Failed to send reset link");
    setSuccess("");
  } finally {
    setLoading(false);
  }
};
```

## Solution 2: Modify better-auth Config (Less Secure)

If you want to disable the security masking in better-auth itself, update auth.ts:

```typescript
export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,
        // Add this to customize error handling
        sendResetPassword: async (ctx, request) => {
            const { email, url, token } = request;
            
            // Get user
            const user = await prisma.user.findUnique({
                where: { email },
            });
            
            if (!user) {
                throw new Error("User not found");
            }
            
            // Send email here
            // await resend.emails.send({...})
        },
    },
});
```

**I recommend Solution 1** because it:
- ✅ Maintains security best practices
- ✅ Gives you full control over responses
- ✅ Works better with your frontend error handling
- ✅ Keeps your auth logic separate from business logic

# Issue 02
If I use default better-auth behaviour for `reset request` currently available and someone try to abuse the send reset link button by clicking multiple time how can I prevent?

# Solution

To prevent abuse of the password reset button, you can use **client-side throttling** + **backend rate limiting**. Here are the solutions:

## Solution 1: Client-Side Throttling (Quick Fix)

Update `forget-pass.tsx` to add a cooldown timer:

```typescript
const [cooldown, setCooldown] = useState(0);

const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setLoading(true);
  
  const result = await requestPasswordReset({ email });
  
  if(result.data?.status) {
    setSuccess(result.data.message || "Reset link sent to your email");
    
    // Prevent spamming - 60 second cooldown
    setCooldown(60);
    const interval = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  } else {
    setError(result.error?.message || "Something went wrong");
  }
  
  setLoading(false);
};

// Update button
<Button 
  type="submit" 
  disabled={loading || cooldown > 0}
>
  {loading ? "Sending..." : cooldown > 0 ? `Retry in ${cooldown}s` : "Send Reset Link"}
</Button>
```

## Solution 2: Backend Rate Limiting (Recommended for Security)

Create a rate limiter middleware. Add to `lib/rate-limit.ts`:

```typescript
import { headers } from "next/headers";

const requestLimits = new Map<string, { count: number; resetTime: number }>();

export async function rateLimitByEmail(email: string, maxRequests = 3, windowMs = 3600000) { // 1 hour
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
  const key = `${email}:${ip}`;
  
  const now = Date.now();
  const limit = requestLimits.get(key);

  if (limit && now < limit.resetTime) {
    if (limit.count >= maxRequests) {
      return {
        success: false,
        retryAfter: Math.ceil((limit.resetTime - now) / 1000),
      };
    }
    limit.count++;
  } else {
    requestLimits.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
  }

  return { success: true };
}
```

Then use it in your password reset endpoint. If using the custom route from Solution 1:

```typescript
import { rateLimitByEmail } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Rate limit check
    const rateLimitCheck = await rateLimitByEmail(email, 3, 3600000); // 3 requests per hour
    
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: `Too many requests. Please try again in ${rateLimitCheck.retryAfter} seconds`,
            code: "RATE_LIMIT_EXCEEDED",
          },
        },
        { status: 429 }
      );
    }

    // Rest of your logic...
  } catch (error) {
    // ...
  }
}
```

## Solution 3: Database-Based Rate Limiting (Most Persistent)

Add to Prisma schema and track reset requests:

```prisma
model PasswordReset {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  email     String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  used      Boolean  @default(false)

  @@index([email])
  @@index([createdAt])
}
```

Then check in your endpoint:

```typescript
const recentRequest = await prisma.passwordReset.findFirst({
  where: {
    email,
    createdAt: {
      gte: new Date(Date.now() - 3600000), // Last 1 hour
    },
  },
  orderBy: { createdAt: "desc" },
});

if (recentRequest) {
  return NextResponse.json(
    {
      data: null,
      error: {
        message: "Password reset already requested. Check your email or try again later",
      },
    },
    { status: 429 }
  );
}
```

---

## Recommendation

**Use Solution 1 + Solution 2 together:**
- **Solution 1** (client-side): Provides instant UX feedback, prevents rapid clicks
- **Solution 2** (backend): Protects against bot attacks and multiple IPs

This gives you both **user experience** and **security**.