import twilio from 'twilio';

// Read credentials at runtime (inside functions) so dotenv is guaranteed to be loaded
let client: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        console.error('❌ [Twilio] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing in .env');
        return null;
    }

    if (!client) {
        client = twilio(accountSid, authToken);
        console.log('✅ [Twilio] Client initialized successfully');
    }
    return client;
}

function getVerifyServiceSid(): string {
    const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!sid) {
        throw new Error('TWILIO_VERIFY_SERVICE_SID is missing in .env');
    }
    return sid;
}

/**
 * Send OTP to a phone number via Twilio Verify service.
 * @param phone E.164 format phone number e.g. +923001234567
 */
export async function sendOtp(phone: string): Promise<void> {
    const c = getTwilioClient();
    if (!c) {
        throw new Error('Twilio client could not be initialized. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
    }

    const verifyServiceSid = getVerifyServiceSid();
    console.log(`📤 [Twilio] Sending OTP to ${phone} via Verify service ${verifyServiceSid}`);

    await c.verify.v2.services(verifyServiceSid).verifications.create({
        to: phone,
        channel: 'sms',
    });
}

/**
 * Verify an OTP code for a phone number.
 * @returns true if code is valid, false otherwise
 */
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
    const c = getTwilioClient();
    if (!c) {
        throw new Error('Twilio client could not be initialized');
    }

    const verifyServiceSid = getVerifyServiceSid();
    console.log(`🔍 [Twilio] Verifying OTP for ${phone}`);

    const result = await c.verify.v2.services(verifyServiceSid).verificationChecks.create({
        to: phone,
        code,
    });

    console.log(`🔍 [Twilio] Verification result for ${phone}: ${result.status}`);
    return result.status === 'approved';
}
