const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://localhost:3001/api';
const EMAIL = `test_${Date.now()}@university.edu.pk`;

async function runTest() {
    console.log('🧪 Starting Auth Flow Verification...');

    try {
        // 1. Send Code
        console.log(`\n📧 Sending code to ${EMAIL}...`);
        const sendRes = await axios.post(`${API_URL}/auth/send-code`, { email: EMAIL });
        console.log('✅ Code sent:', sendRes.data);

        // In dev mode, the code might be returned or logged. 
        // Assuming devCode in response or fixed code for test environment if configured
        // For this test, if using the real emailService, we can't get the code easily without checking logs/email.
        // BUT, if we are in dev mode, we might have printed it to console.

        // WORKAROUND: For automated testing, we need the code.
        // Let's assume the user has to check console or we use a fixed dev code if enabled.
        // If not, this script will fail here.

        let code = '123456';
        if (sendRes.data.devCode) {
            code = sendRes.data.devCode;
            console.log(`🔑 Dev Code received: ${code}`);
        } else {
            console.log('⚠️ No dev code returned. Please check backend logs and enter manually if running interactively (not supported here).');
            // Check if we can proceed. Proceeding might fail if code is wrong.
        }

        // 2. Register
        console.log('\n📝 Registering...');
        const regRes = await axios.post(`${API_URL}/auth/register`, { email: EMAIL, code });
        console.log('✅ Registration successful!');
        console.log('Token:', regRes.data.token);
        console.log('Wallet:', regRes.data.walletAddress);
        console.log('On-Chain Status:', regRes.data.onChainStatus);

        const token = regRes.data.token;

        // 3. Login / Me
        console.log('\n👤 Fetching Profile...');
        const meRes = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Profile:', meRes.data);

        // 4. Create Rumor
        console.log('\n📢 Creating Rumor...');
        const rumorData = {
            title: 'Test Rumor via Script',
            description: 'This is a test rumor created by the verification script.',
        };

        // We need to handle file upload (multipart/form-data)
        // using a simple form boundary or just axios with form-data
        // For simplicity, failing this step implies basic auth is working
        console.log('✅ Auth flow verified! (Skipping file upload in simple script)');

    } catch (error) {
        console.error('❌ Test Failed:', error.response ? error.response.data : error.message);
    }
}

runTest();
