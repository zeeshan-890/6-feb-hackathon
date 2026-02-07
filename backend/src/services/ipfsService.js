const axios = require('axios');
const FormData = require('form-data');

const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

/**
 * Upload JSON content to IPFS via Pinata
 * @param {object} content - JSON content to upload
 * @param {string} name - Name for the file
 * @returns {Promise<{success: boolean, hash?: string, error?: string}>}
 */
async function uploadJSON(content, name = 'rumor') {
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
        // Development mode - return mock hash
        console.log('⚠️  Pinata not configured - using mock IPFS hash');
        const mockHash = 'Qm' + require('crypto').randomBytes(22).toString('hex');
        return { success: true, hash: mockHash };
    }

    try {
        const response = await axios.post(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
            pinataContent: content,
            pinataMetadata: {
                name: `${name}-${Date.now()}`,
            },
        }, {
            headers: {
                'Content-Type': 'application/json',
                'pinata_api_key': process.env.PINATA_API_KEY,
                'pinata_secret_api_key': process.env.PINATA_SECRET_KEY,
            }
        });

        return { success: true, hash: response.data.IpfsHash };
    } catch (error) {
        console.error('IPFS upload failed:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Upload a file to IPFS via Pinata
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type
 * @returns {Promise<{success: boolean, hash?: string, error?: string}>}
 */
async function uploadFile(buffer, filename, mimeType) {
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
        console.log('⚠️  Pinata not configured - using mock IPFS hash');
        const mockHash = 'Qm' + require('crypto').randomBytes(22).toString('hex');
        return { success: true, hash: mockHash };
    }

    try {
        const formData = new FormData();
        formData.append('file', buffer, {
            filename,
            contentType: mimeType,
        });
        formData.append('pinataMetadata', JSON.stringify({
            name: `evidence-${Date.now()}-${filename}`,
        }));

        const response = await axios.post(`${PINATA_API_URL}/pinning/pinFileToIPFS`, formData, {
            headers: {
                ...formData.getHeaders(),
                'pinata_api_key': process.env.PINATA_API_KEY,
                'pinata_secret_api_key': process.env.PINATA_SECRET_KEY,
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });

        return { success: true, hash: response.data.IpfsHash };
    } catch (error) {
        console.error('IPFS file upload failed:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get content from IPFS
 * @param {string} hash - IPFS hash
 * @returns {Promise<{success: boolean, content?: any, error?: string}>}
 */
async function getContent(hash) {
    try {
        const response = await axios.get(`${PINATA_GATEWAY}/${hash}`);
        return { success: true, content: response.data };
    } catch (error) {
        console.error('IPFS fetch failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get IPFS gateway URL for a hash
 * @param {string} hash - IPFS hash
 * @returns {string} Gateway URL
 */
function getGatewayUrl(hash) {
    return `${PINATA_GATEWAY}/${hash}`;
}

module.exports = {
    uploadJSON,
    uploadFile,
    getContent,
    getGatewayUrl,
};
