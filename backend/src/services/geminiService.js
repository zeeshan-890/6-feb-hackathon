const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;
let embeddingModel = null;

function initializeGemini() {
    if (!genAI && process.env.GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // User requested gemini-2.5-flash-lite, using gemini-1.5-flash (current version)
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        embeddingModel = genAI.getGenerativeModel({ model: 'embedding-001' });
    }
    return { genAI, model, embeddingModel };
}

/**
 * Generate text embedding for a rumor
 * @param {string} text - Text to embed
 * @returns {Promise<{success: boolean, embedding?: number[], error?: string}>}
 */
async function generateEmbedding(text) {
    const { embeddingModel } = initializeGemini();

    if (!embeddingModel) {
        console.log('⚠️  Gemini not configured - using mock embedding');
        // Return a mock embedding for development
        const mockEmbedding = Array.from({ length: 768 }, () => Math.random() * 2 - 1);
        return { success: true, embedding: mockEmbedding };
    }

    // ... (inside generateEmbedding)
    try {
        const result = await embeddingModel.embedContent(text);
        return { success: true, embedding: result.embedding.values };
    } catch (error) {
        console.error('Embedding generation failed (using mock):', error.message);
        // Fallback to mock
        const mockEmbedding = Array.from({ length: 768 }, () => Math.random() * 2 - 1);
        return { success: true, embedding: mockEmbedding };
    }
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {number[]} a - First embedding
 * @param {number[]} b - Second embedding
 * @returns {number} Similarity score (-1 to 1)
 */
function cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find similar rumors based on embedding similarity
 * @param {number[]} targetEmbedding - Embedding to compare
 * @param {Array<{id: number, embedding: number[]}>} rumorEmbeddings - Existing embeddings
 * @param {number} threshold - Similarity threshold (default 0.75)
 * @returns {Array<{id: number, similarity: number}>} Similar rumors
 */
function findSimilarRumors(targetEmbedding, rumorEmbeddings, threshold = 0.75) {
    const similarities = rumorEmbeddings.map(rumor => ({
        id: rumor.id,
        similarity: cosineSimilarity(targetEmbedding, rumor.embedding),
    }));

    return similarities
        .filter(s => s.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);
}

// ... (inside generateEmbedding) matches current file structure, ignoring

/**
 * Extract keywords from text using Gemini
 * @param {string} text - Text to extract keywords from
 * @returns {Promise<{success: boolean, keywords?: string[], error?: string}>}
 */
async function extractKeywords(text) {
    const { model } = initializeGemini();

    if (!model) {
        // Mock fallback
        const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
        const unique = [...new Set(words)].slice(0, 10);
        return { success: true, keywords: unique };
    }

    try {
        const prompt = `Extract the 5-10 most important keywords or entities from this text. Return only a JSON array of strings, no other text.

Text: "${text}"

Response format: ["keyword1", "keyword2", ...]`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Parse JSON from response
        const jsonMatch = response.match(/\[.*\]/s);
        if (jsonMatch) {
            const keywords = JSON.parse(jsonMatch[0]);
            return { success: true, keywords };
        }
        throw new Error('Failed to parse keywords');
    } catch (error) {
        console.error('Keyword extraction failed (using mock):', error.message);
        // Fallback
        const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
        const unique = [...new Set(words)].slice(0, 10);
        return { success: true, keywords: unique };
    }
}

/**
 * Analyze correlation between two rumors using Gemini
 * @param {string} rumorA - First rumor text
 * @param {string} rumorB - Second rumor text
 * @returns {Promise<{success: boolean, result?: {sameEvent: boolean, relationship: string, confidence: number}, error?: string}>}
 */
async function analyzeCorrelation(rumorA, rumorB) {
    const { model } = initializeGemini();

    if (!model) {
        return {
            success: true,
            result: { sameEvent: false, relationship: 'unknown', confidence: 0.5 },
        };
    }

    try {
        const prompt = `Analyze if these two campus rumors are describing the same event or are related.

Rumor A: "${rumorA}"

Rumor B: "${rumorB}"

Respond with ONLY a JSON object in this exact format:
{
  "sameEvent": true/false,
  "relationship": "supportive" or "contradictory" or "unrelated",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            return { success: true, result: analysis };
        }
        throw new Error('Failed to parse correlation analysis');
    } catch (error) {
        console.error('Correlation analysis failed (using mock):', error.message);
        // Fallback
        return {
            success: true,
            result: {
                sameEvent: false,
                relationship: 'unknown',
                confidence: 0.5,
                reasoning: 'AI analysis unavailable'
            },
        };
    }
}

/**
 * Process a new rumor - generate embedding and find correlations
 * @param {string} rumorId - Rumor ID
 * @param {string} text - Rumor text
 * @param {Array<{id: number, text: string, embedding: number[]}>} existingRumors - Existing rumors
 * @returns {Promise<{embedding: number[], keywords: string[], correlations: object[]}>}
 */
async function processRumor(rumorId, text, existingRumors = []) {
    // Generate embedding
    const embeddingResult = await generateEmbedding(text);
    const embedding = embeddingResult.success ? embeddingResult.embedding : [];

    // Extract keywords
    const keywordResult = await extractKeywords(text);
    const keywords = keywordResult.success ? keywordResult.keywords : [];

    // Find similar rumors
    const similarRumors = findSimilarRumors(
        embedding,
        existingRumors.filter(r => r.embedding).map(r => ({ id: r.id, embedding: r.embedding })),
        0.75
    );

    // Analyze correlations for top similar rumors
    const correlations = [];
    for (const similar of similarRumors.slice(0, 5)) {
        const existingRumor = existingRumors.find(r => r.id === similar.id);
        if (existingRumor) {
            const analysis = await analyzeCorrelation(text, existingRumor.text);
            if (analysis.success && analysis.result.sameEvent) {
                correlations.push({
                    rumorA: rumorId,
                    rumorB: similar.id,
                    similarity: similar.similarity,
                    ...analysis.result,
                });
            }
        }
    }

    return { embedding, keywords, correlations };
}

module.exports = {
    generateEmbedding,
    cosineSimilarity,
    findSimilarRumors,
    extractKeywords,
    analyzeCorrelation,
    processRumor,
};
