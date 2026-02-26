"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../.env.local') });
(0, dotenv_1.config)();
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const openai_1 = require("./openai");
admin.initializeApp();
const openaiSecret = (0, params_1.defineSecret)('OPENAI_API_KEY');
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
function getOpenAiApiKey() {
    return process.env.OPENAI_API_KEY ?? openaiSecret.value();
}
async function verifyAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        await admin.auth().verifyIdToken(token);
        next();
    }
    catch {
        res.status(401).json({ error: 'unauthorized' });
    }
}
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
app.post('/parse', verifyAuth, async (req, res) => {
    const { text, now } = req.body;
    if (!text || text.trim().length === 0) {
        res.status(400).json({ error: 'text is required' });
        return;
    }
    const nowISO = now ?? new Date().toISOString();
    try {
        const apiKey = getOpenAiApiKey();
        const event = await (0, openai_1.parseEventWithAI)({ text: text.trim(), nowISO }, apiKey);
        res.json(event);
    }
    catch (err) {
        console.error('[/parse] error:', err);
        res.status(500).json({ error: 'parse failed' });
    }
});
exports.api = (0, https_1.onRequest)({
    cors: true,
    secrets: [openaiSecret],
}, app);
//# sourceMappingURL=index.js.map