🔐 SecureSight – AI-Powered Verification Suite

SecureSight is an AI-based verification platform designed for colleges, institutions, and individuals to verify documents, detect AI-generated content, check for plagiarism, and validate website authenticity. It aims to eliminate fraud in education, hiring, and research using cutting-edge AI.

🚀 Core Features
🧠 AI Content Verification
Detect if documents or text are AI-generated using models like Gemini and GPT detectors.

Combines statistical perplexity + model inferences for reliable judgment.

📄 Document Plagiarism Detection
Upload student papers or documents.

Get a structured plagiarism score and report, highlighting copied segments and risk factors.

🔍 Website Legitimacy Check
Input any URL to verify:

Purpose and intent of the site (via Gemini)

Safe Browsing status (Google)

Similar websites and trust comparison (Google Search + AI)

Historical phishing/fraud data (internal DB)

🧾 Report Storage & Verification
Admins (college staff) can access reports in a secure dashboard.

Each analysis is saved for reference and cross-verification.

🤖 AI Chat Assistant (Coming Soon)
Ask the chatbot about nearby places (like hotels/hangouts) during event registrations.

| Layer    | Tech                                              |
| -------- | ------------------------------------------------- |
| Frontend | React + Tailwind + ShadCN UI                      |
| Backend  | Hono (TypeScript) + Gemini + Prisma               |
| Database | PostgreSQL (Aiven-hosted)                         |
| ML Tools | Gemini API, GPT-2 Perplexity (local), HuggingFace |
| Hosting  | Vercel (frontend) + Cloudflare Workers            |

🧪 How It Works
Document Upload → Verified for AI content + plagiarism.

Link Check → Validated using AI + Safe Browsing APIs.

Analysis → AI gives confidence scores, plagiarism % and verdicts.

Report → Results saved for staff in dashboard with history.

.
├── frontend/          # React + Tailwind + ShadCN UI
├── backend/           # Hono server + Gemini, GPT2 etc.
├── prisma/            # DB schema
├── utils/             # Perplexity model, checkers
├── public/            # Assets

📄 License
MIT License. You're free to use, extend, and share — with attribution.

👨‍💻 Author
Made with ❤️ by Arman Datt
Bennett University | 1st Year | CS-AI
GitHub • LinkedIn
