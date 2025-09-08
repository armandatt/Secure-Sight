import { Hono } from "hono";
import { verify } from "hono/jwt";
import axios from "axios";
import { createStorage } from "unstorage";
import memoryDriver from 'unstorage/drivers/memory';
// import vision from '@google-cloud/vision';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from "@prisma/extension-accelerate";
import fetch from "node-fetch";
import AdmZip from "adm-zip";
import { Octokit } from "@octokit/rest";
import { env } from "process";
import { unzipSync, strFromU8 } from "fflate";
import JSZip from "jszip";
import path from "path";
import fs from 'fs';
import jwt from 'jsonwebtoken';
import crypto from "crypto";
import OpenAI from "openai";


export const VerifyRouter = new Hono<{
    Bindings: {
        GitHub_URL: any;
        DATABASE_URL: string
        JWT_SECRET: string
    },
    Variables: {
        userID: string
    }
}>();

const apiKey = "AIzaSyCVS5v3xWz0-Oni_FomTC1PC8EoiU-25Lc";
const api_url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
const safe_browsing_api_key = "AIzaSyAYqtgxH4PkAJXqdeGSTx1gNTFn4m6vCsw";
const safe_browsing_url = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${safe_browsing_api_key}`
// const vision_api_key = "AIzaSyBVILqrCBv00tSGU3p6uf_bPG2iyfHHlDM";
// const Api_key = "AIzaSyA1R18mylAcJaOrChf6i8iQqrML73VCbL8";
// const search_id = "b6120d91992ae4fa8";

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: 'sk-52fb024b475647ef9c5e148bb7dca298'
});

dotenv.config({ path: '././.env' });

// GitHub App credentials (load from env)
const APP_ID = process.env.GITHUB_APP_ID || 1752945; // Default to a test ID if not set
if (!APP_ID) throw new Error("Missing GitHub App ID");
const INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID || 80011575;
const PRIVATE_KEY = (process.env.GITHUB_PRIVATE_KEY || `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEAy4dIBk7jCHn1jrnbjrbtaIMDxjSzrITO2bsMfFqzz8x5b6gpH3ohm4vYdJEcEl2QXPN0EWBy82syVw2YIzr8mu7gj+sMXeVUFo96vRuGnGuwFzZY67tmo++VcVi5N95v/R4hyy8LG8KKdfPZpaV+HqNHMgmYbVFOx0IcJX3HfjAzACAFWfdyTRH/zwcYddhwMoqWbDK65qSfIIMRuh59UBe/e+y+ytuoVG07NpNcEqaxBIge4un3UHOEKKhBuBj3q7LWeQPW3ww8FrfZpcaT8evKXz3VknzLmxqQG4hq9ZCQan1XxVIFUy7UDDl/LFnrzpblNjNfcUbGFvViCtQD9wIDAQABAoIBAFD3yJd52qgMnLvjBI2KCHiDZoT7gl8nloLX/ueZzd7lIYpiA7oaBDS1Na9p6xkDT+MqlwoyrIhaJPSs29FoLgYU8hFPGORhz0oKWnHQ+YRQ8wTJAicFrpeZQIKPIWAwhazUx+zlEi5A/oReNj/HzpyxqCkn2BPlPMnYawofN7XjESS3CyBRR22qGD+L0JM2Qa8sqP3Wgea53sKHBgpSsbpWzbTZo8FEQ5NU03sWRukeX9oFUlBa4c8blUHKYvnIpzU3K9vOeblieW83lzcJollSunERUHKHE+hGd5FoMdpxgclidDzF78KIxNxiIVReNARDZrJVMJU0IV+GBG/TMoECgYEA7XYNNxVsc/62RjJmEmzlsFPYfyjqUEYlRRJoW1nRML+fWA6hegmqF7jCwG5Yy31lVQNXyNsm2WxUjY4FfWabc6gMBEb6grKwFqQPMWG4FNybnqHcXy5B2bvB9Wp8rAnxJ2ZbklTpxYX/s2PG4s1KuRIbX1ctp3uuyR5EQGaFqQkCgYEA22sLMBIl5luyd3SHGa60LJxV8rY1fPTnTOTO021VlfX0M3fnqLjyDCyC5raJkXP53ikzCvUsRrfsBNkCZWMM3OCOERYMktvhvCwH4JnTpce7l7YJ3MkEScc1GbX/OVtKTBSqKQzcYfeErSLrciAQw/RCizwlgN8AykUM10ZIhP8CgYEAuD3tOPz9Xe6WPFbkTY2ClVIo21jCnLAgQLxsjdxda+Zx2t/XOBoBiFBJgwbbDF/p3JEwbl5jgTUFUaOM7ORM3urXEAaGXhwIdjiqtRTtv/n/IJDTrGH2o9qDPkh2HQHFw10u1ZXen+w9HlHfQaApRvkeldXNTXKwhclfCVzCfgkCgYEAp+pxc2ZQDsxZ9cT9pw/l3sX9mHMM2AXsBRKNnYvslYjWS5UVei+fPOXLf5huCxxAOl45K8eZDL2wJ72TcdetflNzJWxETxdq10Cy/pV6PUJvM5kiTw6e8386CeUX3uMYJsUhu6yV83si1AUHPh1/9xY03q023jrLNgBF5XFqCi0CgYEAyqGoD7wOS2ZR4hr8iO1/UHFAf8md/rni9iwhC0pPOC3l69XY4uCFyDvsc/DscV2TtecksrMlHjTvivi+fE++njaqSaxOwAgf1xFXUbP1m+gt3Uw167Uyhr1uwu90AWqchVZLQqJ94R8H9jF3XOrALSi9MdUO2NAQcstFWijEYfQ=
-----END RSA PRIVATE KEY-----`).replace(/\\n/g, '\n'); // PEM as env var
function detectKeyTypeAndAlgorithm(key: string | Buffer<ArrayBufferLike> | crypto.PrivateKeyInput | crypto.JsonWebKeyInput) {
    try {
        const obj = crypto.createPrivateKey(key);
        const type = obj.asymmetricKeyType;
        if (type === "rsa") return { key, alg: "RS256" };
        if (type === "ec") return { key, alg: "ES256" };
        throw new Error(`Unsupported key type: ${type}`);
    } catch (err) {
        const errorMessage = typeof err === "object" && err !== null && "message" in err ? (err as { message: string }).message : String(err);
        throw new Error(`Invalid private key: ${errorMessage}`);
    }
}

const { alg: JWT_ALGORITHM } = detectKeyTypeAndAlgorithm(PRIVATE_KEY);

export { APP_ID, INSTALLATION_ID, PRIVATE_KEY, JWT_ALGORITHM };

let cachedInstallationToken: string | null = null;
let cachedInstallationTokenExpiry = 0; // unix timestamp in seconds

function getAppJwt() {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
        {
            iat: now - 60,      // backdate 1 min for clock drift
            exp: now + 8 * 60,  // expire in 8 min (GitHub max is 10)
            iss: APP_ID,
        },
        PRIVATE_KEY,
        { algorithm: 'RS256' }
    );
}

async function getInstallationToken() {
    const now = Math.floor(Date.now() / 1000);

    // If we have a token valid for >2 more minutes, reuse it
    if (cachedInstallationToken && cachedInstallationTokenExpiry - now > 120) {
        return cachedInstallationToken;
    }

    // Always create a fresh JWT when requesting new installation token
    const appOctokit = new Octokit({ auth: getAppJwt() });

    const { data } = await appOctokit.request(
        `POST /app/installations/${INSTALLATION_ID}/access_tokens`
    );

    cachedInstallationToken = data.token;
    // Expire 3 minutes before actual expiry for safety
    cachedInstallationTokenExpiry =
        Math.floor(new Date(data.expires_at).getTime() / 1000) - 180;

    return cachedInstallationToken;
}

export async function githubRequest(endpoint: string, params = {}) {
    const token = await getInstallationToken();
    const octokit = new Octokit({ auth: token });
    return octokit.request(endpoint, params);
}

VerifyRouter.use("/*", async (c, next) => {
    const header = await c.req.header('authorization') || "";
    const user = await verify(header, c.env.JWT_SECRET)
    if (user) {
        // @ts-ignore
        c.set("userID", user.id);
        await next();
    } else {
        c.status(403);
        return c.json({ error: "Unauthorized" });
    }
})

VerifyRouter.use("getUserData", async (c) => {
    const userID = c.get("userID");
    console.log("User ID from context:", userID);
    if (!userID) {
        return c.json({ error: "User not authenticated" }, 401);
    }

    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());

    try {
        const user = await prisma.user.findUnique({
            where: { id: userID },
            select: { id: true, name: true, username: true }
        });
        console.log("Fetched user data:", user);

        if (!user) {
            return c.json({ error: "User not found" }, 404);
        }

        return c.json(user)
    } catch (error) {
        console.error("Error fetching user data:", error);
        return c.json({ error: "Internal server error" }, 500);
    }
});



// This handles both URL and Buffer-based ZIPs
export async function extractZipFromUrlOrBuffer(input: string | Uint8Array) {
    let uint8Array: Uint8Array;

    if (typeof input === "string") {
        const zipResponse = await fetch(input);
        if (!zipResponse.ok) {
            throw new Error(`Failed to fetch ZIP: ${zipResponse.statusText}`);
        }
        uint8Array = new Uint8Array(await zipResponse.arrayBuffer());
    } else if (input instanceof Uint8Array) {
        uint8Array = input;
    } else {
        throw new Error("Invalid ZIP input: must be a URL string or Uint8Array buffer");
    }

    const zipEntries = unzipSync(uint8Array);
    const filenames = Object.keys(zipEntries);

    console.log("Found ZIP entries:", filenames.length);

    let readmeText = "";
    let codeText = "";
    const detectedExtensions: string[] = [];

    // Expanded extension set
    const validExts = [
        // Core
        "js", "jsx", "ts", "tsx", "py", "rs", "java", "cpp", "c", "cs", "go", "rb", "php", "swift", "kt", "scala", "dart",
        // Frontend frameworks
        "vue", "svelte",
        // Config & build files
        "json", "yaml", "yml", "xml", "toml", "gradle",
        // Shell / scripting
        "sh", "bash", "bat", "ps1",
        // Data science / notebooks
        "ipynb", "r",
        // Others
        "m", "mm", // Objective-C
        "hs"       // Haskell
    ];

    for (const filename of filenames) {
        const file = zipEntries[filename];
        if (!file?.length) continue;

        const lowerName = filename.toLowerCase();

        try {
            if (
                readmeText === "" &&
                lowerName.includes("readme") &&
                (lowerName.endsWith(".md") || lowerName.endsWith(".txt") || !lowerName.includes("."))
            ) {
                readmeText = strFromU8(file, true).trim();
                console.log(`Found README: ${filename}`);
                continue;
            }

            const extMatch = lowerName.match(/\.([a-z0-9]+)$/i);
            if (extMatch) {
                const ext = extMatch[1].toLowerCase();
                if (validExts.includes(ext)) {
                    const content = strFromU8(file, true);
                    codeText += `\n\n// ${filename}\n${content}`;
                    if (!detectedExtensions.includes(ext)) {
                        detectedExtensions.push(ext);
                    }
                }
            }
        } catch (e) {
            console.warn(`Failed to decode ${filename}:`, e);
        }
    }

    if (!readmeText && !codeText) {
        throw new Error("No README or code files found in the ZIP.");
    }

    return { readmeText, codeText, detectedExtensions };
}



VerifyRouter.post('/verifyWebsite', async (c) => {
    ;
    console.log("Request received at /verifyWebsite");

    let repoUrl = "";
    try {
        const jsonBody = await c.req.json();
        repoUrl = jsonBody.url || "";
    } catch (err) {
        repoUrl = "";
    }

    const link = typeof repoUrl === "string" ? repoUrl.trim() : repoUrl;
    const regex = /github\.com\/([^/]+)\/([^/]+?)(?:\.git|\/|$)/;
    const match = link.match(regex);
    if (!match) return new Response("Invalid GitHub URL", { status: 400 });

    const owner = match[1];
    const repo = match[2];

    // Type for GitHub tree items
    type GitTreeItem = {
        path: string;
        mode: string;
        type: string;
        sha: string;
        size?: number;
        url: string;
    };

    // Get repo file structure using GitHub App auth
    async function getRepoFileStructure(owner: string, repo: string) {
        try {
            // Get default branch
            const branchData: any = await githubRequest("GET /repos/{owner}/{repo}", {
                owner,
                repo
            });
            const defaultBranch = branchData.data.default_branch;

            // Get branch details to fetch commit SHA
            const branchDetails: any = await githubRequest(
                "GET /repos/{owner}/{repo}/branches/{branch}",
                {
                    owner,
                    repo,
                    branch: defaultBranch
                }
            );

            const treeSha = branchDetails.data.commit.sha;

            // Get the entire file tree
            const fileTree: any = await githubRequest("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
                owner,
                repo,
                tree_sha: treeSha,
                recursive: "1"
            });

            if (fileTree.data.truncated) {
                console.warn(`⚠️ GitHub API truncated file tree for ${repo}`);
            }

            const allFiles = (fileTree.data.tree as GitTreeItem[]).filter(
                item => item.type === "blob"
            );

            return allFiles.map(item => item.path);
        } catch (err) {
            console.error(`Failed to fetch repo structure for ${owner}/${repo}:`, err);
            return [];
        }
    }

    async function fetchFileSnippet(owner: string, repo: string, path: string): Promise<string> {
        try {
            const res: any = await githubRequest("GET /repos/{owner}/{repo}/contents/{path}", {
                owner,
                repo,
                path
            });

            if (Array.isArray(res.data) || !res.data.content) return "";
            if (res.data.size && res.data.size > 100000) return ""; // skip very large files

            const content = Buffer.from(res.data.content, "base64").toString("utf-8");
            const lines = content.split("\n");

            // Strategy: pick snippet either from start, middle, or random
            const strategy = Math.random();
            let startIndex = 0;

            if (strategy < 0.4) {
                // First real code
                const firstCodeIndex = lines.findIndex(line => {
                    const trimmed = line.trim();
                    return (
                        trimmed &&
                        !trimmed.startsWith("import") &&
                        !trimmed.startsWith("export ") &&
                        !trimmed.startsWith("//") &&
                        !trimmed.startsWith("/*") &&
                        !trimmed.startsWith("*") &&
                        !trimmed.startsWith("*/")
                    );
                });
                startIndex = firstCodeIndex !== -1 ? firstCodeIndex : 0;
            } else if (strategy < 0.8) {
                // Middle part
                startIndex = Math.floor(lines.length / 2);
            } else {
                // Random window
                startIndex = Math.floor(Math.random() * Math.max(1, lines.length - 25));
            }

            return lines.slice(startIndex, startIndex + 25).join("\n");

        } catch (err) {
            console.warn(`Failed to fetch or decode snippet for ${path}:`, err);
            return "";
        }
    }

    const CODE_EXTENSIONS = [
        "py", "js", "ts", "tsx", "jsx", "cpp", "c", "h", "hpp",
        "java", "kt", "go", "rb", "cs", "php", "rs", "swift", "m", "mm"
    ];

    function isCodeFilePath(path: string): boolean {
        return CODE_EXTENSIONS.some((ext) => path.endsWith("." + ext));
    }

    async function getCodeSnippetsForGemini(owner: string, repo: string) {
        const MAX_TOTAL_SNIPPET_CHARS = 4000;
        const MAX_FILES = 12;

        const allPaths = await getRepoFileStructure(owner, repo);
        const logicFileSnippets: Record<string, string> = {};

        let totalChars = 0;
        let fileCount = 0;

        for (const path of allPaths) {
            if (!isCodeFilePath(path)) continue;
            if (fileCount >= MAX_FILES || totalChars >= MAX_TOTAL_SNIPPET_CHARS) break;

            const snippet = await fetchFileSnippet(owner, repo, path);
            const trimmed = snippet
                .split("\n")
                .filter((line) => {
                    const t = line.trim();
                    return (
                        t &&
                        !t.startsWith("import") &&
                        !t.startsWith("export ") &&
                        !t.startsWith("//") &&
                        !t.startsWith("/*") &&
                        !t.startsWith("*") &&
                        !t.startsWith("*/")
                    );
                })
                .join("\n")
                .trim();

            // Skip if snippet is too short after cleaning
            if (trimmed.length < 10) continue;

            // Stop if we’d exceed the total character limit
            if (totalChars + trimmed.length > MAX_TOTAL_SNIPPET_CHARS) break;

            logicFileSnippets[path] = trimmed;
            totalChars += trimmed.length;
            fileCount += 1;
        }

        return logicFileSnippets;
    }


    const logicFileSnippets = await getCodeSnippetsForGemini(owner, repo);

    let prompt = `
You are given code snippets from a GitHub repository.

Primary task:
- Identify only the core logic files that implement backend logic, API routes, business workflows, or critical functionality.
- Ignore generic authentication boilerplate (e.g., user models, login/signup routes, JWT/session middleware).
- If a file imports another file containing unique business logic, include both.
- Focus on files where the implementation represents **unique logic** rather than standard/common patterns.

If no backend/business logic exists:
- Instead return the most important implementation files (e.g., rendering engine, algorithms, state management).
- Never return an empty list.

Ignore:
- UI styling-only files, static assets, boilerplate configs, generic auth/login code.

Output format (STRICT):
Return ONLY the file paths, one per line, no extra text.

\n\n`;

    for (const [filename, snippet] of Object.entries(logicFileSnippets)) {
        const snippetBlock = `// ${filename}\n${snippet}\n\n`;
        if ((prompt.length + snippetBlock.length) > 12000) break;
        prompt += snippetBlock;
    }

    // Get important files using OpenAI
    let deepSeekReply = "";
    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "deepseek-chat",
            temperature: 0,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        });
        deepSeekReply = completion.choices[0]?.message?.content || "";
    } catch (error) {
        console.error("Error during OpenAI chat completion:", error);
        deepSeekReply = "";
    }
    console.log("DeepSeek raw output:", deepSeekReply);

    // Extract file names from LLM output
    let detectedFiles: string[] = [];
    const fileLines = deepSeekReply.split("\n").map((l: string) => l.trim()).filter(Boolean);

    for (const line of fileLines) {
        CODE_EXTENSIONS.forEach((ext) => {
            if (line.includes("." + ext)) {
                const clean = line.match(/[\w\/\-.]+\.[\w]+/)?.[0];
                if (clean && !detectedFiles.includes(clean)) detectedFiles.push(clean);
            }
        });
    }

    // Post-process: follow imports from detected files
    function includeImportedLogicFiles(filesList: string[]) {
        for (const file of [...filesList]) {
            const snippet = logicFileSnippets[file];
            if (snippet) {
                // Match both ES imports and CommonJS requires
                const importMatches = snippet.match(/(?:from\s+['"](.+)['"]|require\(['"](.+)['"]\))/g) || [];
                for (const match of importMatches) {
                    const importedPath = match.match(/['"](.+)['"]/)?.[1];
                    if (importedPath && !importedPath.startsWith(".")) continue; // skip external packages
                    const resolvedPath = importedPath?.replace(/^\.\//, "");
                    if (resolvedPath) {
                        const matchFile = Object.keys(logicFileSnippets).find((p) =>
                            p.endsWith(resolvedPath) ||
                            p.endsWith(resolvedPath + ".ts") ||
                            p.endsWith(resolvedPath + ".js") ||
                            p.endsWith(resolvedPath + ".tsx") ||
                            p.endsWith(resolvedPath + ".jsx")
                        );
                        if (matchFile && !filesList.includes(matchFile)) {
                            filesList.push(matchFile);
                        }
                    }
                }
            }
        }
    }

    includeImportedLogicFiles(detectedFiles);

    // 🚨 Extra safeguard: remove auth/login boilerplate files if still included
    detectedFiles = detectedFiles.filter((file) => {
        const lower = file.toLowerCase();
        return !(
            lower.includes("login") ||
            lower.includes("signup") ||
            lower.includes("register") ||
            lower.includes("auth") ||
            lower.includes("jwt") ||
            lower.includes("user")
        );
    });

    // Warn-only safeguard if model returns too many files
    if (detectedFiles.length > 100) {
        console.warn("Unusually high number of files detected:", detectedFiles.length);
    }

    // Fallback: if no files detected, return largest files + their imports
    if (detectedFiles.length === 0) {
        console.warn("No files detected by Gemini — falling back to largest code files.");
        detectedFiles = Object.keys(logicFileSnippets)
            .sort((a, b) => logicFileSnippets[b].length - logicFileSnippets[a].length)
            .slice(0, 5);

        // include imports for fallback files
        includeImportedLogicFiles(detectedFiles);
    }

    const importantLogicFiles = detectedFiles;
    const originalPrompt = prompt;
    const deepSeekRawOutput = deepSeekReply;

    console.log("Important logic files detected:", importantLogicFiles);
    if (importantLogicFiles.length === 0) {
        return c.json({ error: "No important logic files detected." }, 404);
    }
    console.log("Original prompt sent to Gemini:", originalPrompt);


    async function createCustomZipFromRepo(owner: string, repo: string) {
        const zip = new JSZip();
        const MAX_FILES = 20;
        const MAX_TOTAL_CONTENT_SIZE = 30_000; // 30 KB

        // 1️⃣ Get default branch
        const repoInfo = await githubRequest("GET /repos/{owner}/{repo}", {
            owner,
            repo
        });
        const branch = repoInfo.data.default_branch;

        // 2️⃣ Get commit SHA for branch
        const refData = await githubRequest("GET /repos/{owner}/{repo}/git/ref/{ref}", {
            owner,
            repo,
            ref: `heads/${branch}`,
        });
        const commitSha = refData.data.object.sha;

        // 3️⃣ Get commit details -> real tree SHA (safer than commitSha directly)
        const commitData = await githubRequest("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", {
            owner,
            repo,
            commit_sha: commitSha,
        });
        const treeSha = commitData.data.tree.sha;

        // 4️⃣ Get full repo tree
        const treeData = await githubRequest("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
            owner,
            repo,
            tree_sha: treeSha,
            recursive: "true",
        });

        // 5️⃣ Filter to target files, prioritize README, LICENSE, package.json, etc.
        const filesToInclude = treeData.data.tree
            .filter((file: { type: string; path: string; }) =>
                file.type === "blob" &&
                (
                    file.path.toLowerCase().includes("readme") ||
                    file.path.toLowerCase().includes("license") ||
                    file.path.toLowerCase().endsWith("package.json") ||
                    file.path.toLowerCase().endsWith("requirements.txt") ||
                    CODE_EXTENSIONS.some(ext => file.path!.toLowerCase().endsWith("." + ext))
                )
            )
            .sort((a: { path: string; }, b: { path: string; }) => {
                if (a.path.toLowerCase().includes("readme")) return -1;
                if (b.path.toLowerCase().includes("readme")) return 1;
                return 0;
            });

        let totalSize = 0;
        let addedFiles = 0;

        // 6️⃣ Fetch blobs with concurrency control
        const concurrencyLimit = 5;
        const queue: Promise<void>[] = [];

        async function processFile(file: any) {
            if (addedFiles >= MAX_FILES || totalSize >= MAX_TOTAL_CONTENT_SIZE) return;
            if (file.size && (totalSize + file.size) > MAX_TOTAL_CONTENT_SIZE) return;

            try {
                const blob = await githubRequest("GET /repos/{owner}/{repo}/git/blobs/{file_sha}", {
                    owner,
                    repo,
                    file_sha: file.sha!,
                });

                const content = Buffer.from(blob.data.content, "base64").toString("utf-8");

                if ((totalSize + content.length) > MAX_TOTAL_CONTENT_SIZE) return;

                zip.file(file.path!, content);
                totalSize += content.length;
                addedFiles += 1;
            } catch (err) {
                console.warn(`Skipping file due to fetch error: ${file.path}`, err);
            }
        }

        for (const file of filesToInclude) {
            if (queue.length >= concurrencyLimit) {
                await Promise.race(queue);
            }
            const p = processFile(file).finally(() => {
                const idx = queue.indexOf(p);
                if (idx >= 0) queue.splice(idx, 1);
            });
            queue.push(p);
        }

        await Promise.all(queue);

        return await zip.generateAsync({ type: "uint8array" });
    }

    async function handleRepoAnalysis(owner: string, repo: string) {
        let branch = "main"; // default in case of failure

        try {
            // Get branch first so both paths use same value
            const repoInfo = await githubRequest("GET /repos/{owner}/{repo}", {
                owner,
                repo
            });
            branch = repoInfo.data.default_branch;

            // Try minimal ZIP approach
            const customZipBuffer = await createCustomZipFromRepo(owner, repo);
            const { readmeText, codeText, detectedExtensions } =
                await extractZipFromUrlOrBuffer(customZipBuffer);

            return {
                source: "custom-buffer",
                branch,
                readmeText,
                codeText,
                detectedExtensions,
            };
        } catch (err) {
            console.warn("Custom zipping failed, falling back to full repo ZIP", err);

            // Fallback to full repo zip from GitHub
            try {
                const fallbackZipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
                const { readmeText, codeText, detectedExtensions } =
                    await extractZipFromUrlOrBuffer(fallbackZipUrl);

                return {
                    source: "fallback-zip-url",
                    branch,
                    readmeText,
                    codeText,
                    detectedExtensions,
                };
            } catch (fallbackErr) {
                console.error("Both custom and fallback ZIP failed", fallbackErr);
                return {
                    source: "error",
                    branch,
                    readmeText: "",
                    codeText: "",
                    detectedExtensions: [],
                    error: typeof fallbackErr === "object" && fallbackErr !== null && "message" in fallbackErr
                        ? (fallbackErr as { message: string }).message
                        : String(fallbackErr),
                };
            }
        }
    }

    // Usage
    const extractedContent = await handleRepoAnalysis(owner, repo);
    let { readmeText, codeText, detectedExtensions } = extractedContent;

    // Ensure codeText always has content
    if (!codeText || !codeText.trim()) {
        codeText = "// No source code found in the uploaded ZIP.";
    }


    // Improved prompt with stricter exclusions
    const prompt1 = `
Your task: Extract 5–6 keywords that best represent the main technical purpose, core functionality, or problem domain of the project.

🚫 Do NOT include:
Generic terms like API, backend, frontend, web app, website, mobile app, library, framework, tool, SDK, CLI.
Setup or environment instructions (npm install, pip install, docker compose up, etc.).
Development/editor tools (Docker, Devcontainers, VS Code, Remote Development, Configuration).
Deployment instructions, file paths, or shell commands.
Version numbers, usernames, or repository names.

✅ Only include:
Core frameworks, languages, or architectures used.
Algorithms, models, or techniques implemented.
Problem domain / target application areas.
Key features that define the project’s main function.

Output format (single line):
keyword1 OR keyword2 OR keyword3 OR keyword4 OR keyword5 OR keyword6

README content:
${readmeText.slice(0, 2000)}
`;

    let aiAnalysis = "";
    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: prompt1 }],
            model: "deepseek-chat",
            temperature: 0,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        });
        aiAnalysis = completion.choices[0]?.message?.content || "";
    } catch (error) {
        console.error("Error during OpenAI chat completion:", error);
        aiAnalysis = "";
    }
    console.log("DeepSeek raw output:", aiAnalysis);

    const text_content = aiAnalysis || "";
    console.log("Raw AI Keywords:", text_content);

    const forbiddenPatterns = [
        /\bnpm\b/i,
        /\brun\b/i,
        /\binstall\b/i,
        /\byarn\b/i,
        /\bpip\b/i,
        /\bdocker\b/i,
        /\bcompose\b/i,
        /\bdev\b/i,
        /\bstart\b/i,
        /\bbuild\b/i,
        /\bconfig(uration)?\b/i,
        /\btool(ing)?\b/i,
        /\bremote\b/i,
        /\bcli\b/i,
        /\bversion\b/i,
        /\bsetup\b/i
    ];

    const cleanedKeywords = text_content
        .replace(/[^a-zA-Z0-9\s|\-]/g, "") // keep hyphenated terms like "real-time"
        .split(/\s+OR\s+/i)
        .map((k: string) => k.trim())
        .filter((k: string, idx, arr) =>
            k.length > 1 &&
            !forbiddenPatterns.some(p => p.test(k)) &&
            arr.indexOf(k) === idx // dedupe
        )
        .slice(0, 6);

    const safeQuery = cleanedKeywords
        .map((k: string) => (k.includes(" ") ? `"${k}"` : k)) // wrap multi-word terms in quotes
        .join(" OR ")
        .slice(0, 256); // GitHub search max length safeguard

    console.log("Cleaned keyword query:", safeQuery);

    // ===================== Language Detection =====================
    const promptLang = `
Extract the main programming languages or frameworks used in this repository.

Rules:
- Only return language names (like: JavaScript, TypeScript, Python, C++, Java, Go, Ruby, PHP, Swift, Kotlin).
- If multiple languages are clearly used, list them separated by OR.
- If README is unclear, just return "Unknown".
- Do not include tools like Docker, npm, pip, etc.

README content:
${readmeText.slice(0, 2000)}
`;

    let detectedLang = "Unknown";
    try {
        const langCompletion = await openai.chat.completions.create({
            messages: [{ role: "system", content: promptLang }],
            model: "deepseek-chat",
            temperature: 0,
        });
        detectedLang = langCompletion.choices[0]?.message?.content?.trim() || "Unknown";
    } catch (err) {
        console.error("Error detecting repo language:", err);
    }
    console.log("Detected language(s):", detectedLang);

    const langQuery =
        detectedLang !== "Unknown" && !detectedLang.includes("Unknown")
            ? ` language:${detectedLang.split(" OR ")[0]}`
            : "";


    // ===================== Similar Repo Search =====================
    async function findSimilarRepos() {
        try {
            const maxQueryLength = 240; // leave buffer for GitHub operators
            const baseSuffix = ` in:name,description,readme${langQuery}`;
            const queries: string[] = [];

            // If query is too long, split safely
            if (safeQuery.length > maxQueryLength) {
                const parts = safeQuery.split(/\s+OR\s+/);
                let buffer = "";

                for (const part of parts) {
                    const next = buffer ? buffer + " OR " + part : part;
                    if ((next + baseSuffix).length > maxQueryLength) {
                        if (buffer) queries.push(buffer);
                        buffer = part;
                    } else {
                        buffer = next;
                    }
                }
                if (buffer) queries.push(buffer);
            } else {
                queries.push(safeQuery);
            }

            // Collect results
            let allRepos: any[] = [];
            for (const q of queries) {
                const res = await githubRequest("GET /search/repositories", {
                    q: `${q}${baseSuffix}`.slice(0, 256), // safeguard
                    sort: "best match",
                    order: "desc",
                    per_page: 30 // fetch more, we'll trim later
                });
                allRepos = allRepos.concat(res.data.items || []);
            }

            // Deduplicate
            const uniqueRepos = Array.from(
                new Map(allRepos.map((r: any) => [r.full_name, r])).values()
            );

            // ✅ Verify existence and trim to 15 real repos
            const verified: any[] = [];
            for (const repo of uniqueRepos) {
                if (verified.length >= 15) break;
                try {
                    await githubRequest("GET /repos/{owner}/{repo}", {
                        owner: repo.full_name.split("/")[0],
                        repo: repo.full_name.split("/")[1]
                    });
                    verified.push(repo);
                } catch {
                    // skip invalid or inaccessible repos
                }
            }

            return verified.map((repo: any) => ({
                name: repo.full_name,
                stars: repo.stargazers_count,
                created_at: repo.created_at,
                description: repo.description || "",
                html_url: repo.html_url,
                language: repo.language || "Unknown"
            }));
        } catch (err) {
            console.error("Error searching similar repos:", err);
            return [];
        }
    }


    async function fetchFileContentFromGitHub(owner: string, repo: string, path: string) {
        try {
            const res = await githubRequest("GET /repos/{owner}/{repo}/contents/{path}", {
                owner,
                repo,
                path
            });
            const fileData = res.data as any;

            if (Array.isArray(fileData)) throw new Error(`"${path}" is a directory, not a file.`);
            if (!fileData.content) throw new Error(`No content found at path "${path}"`);

            return Buffer.from(fileData.content, "base64").toString("utf-8");
        } catch (err: any) {
            console.warn(`Failed to fetch ${owner}/${repo}/${path}: ${err.message}`);
            return "";
        }
    }

    async function findReadmePath(owner: string, repo: string) {
        let files: any[] = [];
        try {
            const res = await githubRequest("GET /repos/{owner}/{repo}/contents", { owner, repo });
            files = res.data || [];
        } catch {
            // ignore
        }

        let readmeFile = files.find((f: any) => /^readme(\..+)?$/i.test(f.name));

        if (!readmeFile) {
            try {
                const resDocs = await githubRequest("GET /repos/{owner}/{repo}/contents/docs", { owner, repo });
                const docsFiles = resDocs.data || [];
                readmeFile = docsFiles.find((f: any) => /^readme(\..+)?$/i.test(f.name));
            } catch {
                // no docs folder
            }
        }

        const fallbackPaths = ["README.md", "README", "README.txt"];
        for (const p of fallbackPaths) {
            try {
                const content = await fetchFileContentFromGitHub(owner, repo, p);
                if (content) return p;
            } catch { }
        }

        return readmeFile?.path || "README.md";
    }

    // ===================== Similar Repo Content Fetching =====================
    async function fetchSimilarRepoContent(similarRepos: any[], isFork: boolean, repoSizeKB: number) {
        const results: {
            repo: string,
            created_at: string,
            similarReadmeText: string,
            similarCodeText: string,
            plagiarismScore: number
        }[] = [];

        const detectedExtensions = [
            "js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "cs", "go", "rb", "php", "rs", "swift", "kt"
        ];

        function cleanCodeContent(content: string): string {
            return content
                .replace(/^\s*(import|from|require).*$/gm, "")
                .replace(/\/\/.*$/gm, "")
                .replace(/\/\*[\s\S]*?\*\//gm, "")
                .replace(/^\s*#.*$/gm, "")
                .replace(/\n\s*\n/g, "\n");
        }

        function isUsefulFile(path: string): boolean {
            const lower = path.toLowerCase();
            if (
                lower.includes("test") ||
                lower.includes("spec") ||
                lower.includes("docs") ||
                lower.includes("example") ||
                lower.endsWith(".md") ||
                lower.includes("config") ||
                lower.includes("build") ||
                lower.includes("dist") ||
                lower.includes("node_modules") ||
                lower.includes("auth") ||      // 🔴 ignore auth files
                lower.includes("login") ||     // 🔴 ignore login files
                lower.includes("signup")       // 🔴 ignore signup files
            ) return false;

            return detectedExtensions.some(ext => lower.endsWith("." + ext)) ||
                /src|packages|scripts|main|app/i.test(lower);
        }

        async function fetchImportantCode(owner: string, repo: string, sha: string, MAX_CHARS = 5000) {
            let collectedCode = "";

            try {
                const { data: treeData } = await githubRequest(
                    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
                    { owner, repo, tree_sha: sha, recursive: "true" }
                );

                const fileTree = (treeData.tree || []).filter(
                    (file: any) => file.type === "blob" && isUsefulFile(file.path)
                );

                fileTree.sort((a: any, b: any) => {
                    const aImp = /main|app|index|server|verify/i.test(a.path) ? -1 : 1;
                    const bImp = /main|app|index|server|verify/i.test(b.path) ? -1 : 1;
                    return aImp - bImp;
                });

                for (const file of fileTree) {
                    if (collectedCode.length >= MAX_CHARS) break;
                    try {
                        const fileText = await fetchFileContentFromGitHub(owner, repo, file.path);
                        if (fileText.length < 50) continue;

                        const cleaned = cleanCodeContent(fileText);
                        if (cleaned.length < 50) continue;

                        const remaining = MAX_CHARS - collectedCode.length;
                        const safeSlice = cleaned.slice(0, remaining).split("\n").slice(0, -1).join("\n");
                        collectedCode += "\n" + safeSlice;
                    } catch (err: any) {
                        console.warn(`Warning: Error fetching ${file.path} from ${owner}/${repo}: ${err.message}`);
                    }
                }
            } catch (err: any) {
                console.warn(`Warning: Error fetching code tree for ${owner}/${repo}: ${err.message}`);
            }

            if (!collectedCode.trim()) {
                collectedCode = "// Fallback: no important code found in repo\nfunction placeholder() { return 'dummy code'; }";
            }
            return collectedCode.slice(0, MAX_CHARS);
        }

        // ------------------- Fetch all repos in parallel -------------------
        const validRepos: any[] = [];
        for (const similar of similarRepos) {
            if (validRepos.length >= 15) break; // ✅ ensure exactly 15 valid repos
            const [simOwner, simRepo] = similar.name.split("/");
            if (!simOwner || !simRepo) continue;

            try {
                // validate repo exists
                await githubRequest("GET /repos/{owner}/{repo}", { owner: simOwner, repo: simRepo });
                validRepos.push(similar);
            } catch {
                continue; // skip invalid repos
            }
        }

        const fetchPromises = validRepos.map(async (similar) => {
            const [simOwner, simRepo] = similar.name.split("/");
            if (!simOwner || !simRepo) return null;

            try {
                let similarReadmeText = "";
                const readmePath = await findReadmePath(simOwner, simRepo);
                if (readmePath) {
                    similarReadmeText = await fetchFileContentFromGitHub(simOwner, simRepo, readmePath);
                }

                const repoInfo = await githubRequest("GET /repos/{owner}/{repo}", { owner: simOwner, repo: simRepo });
                const defaultBranch = repoInfo.data.default_branch;
                const createdAt = repoInfo.data.created_at;

                const branchInfo = await githubRequest("GET /repos/{owner}/{repo}/branches/{branch}", {
                    owner: simOwner,
                    repo: simRepo,
                    branch: defaultBranch
                });
                const commitSha = branchInfo.data.commit.sha;

                const similarCodeText = await fetchImportantCode(simOwner, simRepo, commitSha, 5000);

                // ------------------- Apply criteria -------------------
                let plagiarismScore = 5; // default minimum
                if (isFork) {
                    plagiarismScore = repoSizeKB < 500 ? 85 : 90;
                }

                return {
                    repo: `${simOwner}/${simRepo}`,
                    created_at: createdAt,
                    similarReadmeText: similarReadmeText || "Fallback: No README found",
                    similarCodeText: similarCodeText || "// Fallback: No code found",
                    plagiarismScore
                };
            } catch (err: any) {
                console.warn(`Warning: Failed fetching content for ${simOwner}/${simRepo}: ${err.message}`);
                return null;
            }
        });

        const settledResults = await Promise.allSettled(fetchPromises);
        for (const r of settledResults) {
            if (r.status === "fulfilled" && r.value) results.push(r.value);
        }

        return results;
    }


    // ==================== HEURISTICS & ADJUSTMENTS ====================
    // ===================== CHUNKING UTILS =====================
    function chunkReadmeByParagraphs(text: string, approxSize = 2000): string[] {
        const paragraphs = text.split(/\n{2,}/);
        const chunks: string[] = [];
        let buffer = "";

        for (const p of paragraphs) {
            buffer += p + "\n\n";
            if (buffer.length >= approxSize || /^#+\s/.test(p) || buffer.length >= approxSize * 1.5) {
                chunks.push(buffer);
                buffer = "";
            }
        }
        if (buffer) chunks.push(buffer);
        return chunks;
    }

    function chunkCodeByFunctions(text: string, approxLines = 300): string[] {
        const lines = text.split("\n");
        const chunks: string[] = [];
        let buffer: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            buffer.push(lines[i]);
            if (
                buffer.length >= approxLines ||
                /^(export\s+)?(function|class|interface|type|enum)\s+/.test(lines[i]) ||
                /^\s*def\s+/.test(lines[i]) ||
                buffer.length >= approxLines * 2
            ) {
                chunks.push(buffer.join("\n"));
                buffer = [];
            }
        }
        if (buffer.length) chunks.push(buffer.join("\n"));
        return chunks;
    }

    // ===================== PROMPT TEMPLATES =====================
    function makeReadmePrompt(userChunk: string, similarChunk: string) {
        return `
You are comparing two GitHub README chunks.

User README:
${userChunk}

Similar README:
${similarChunk}

Rules:
- README Plagiarism Score MUST be between 5–100 (never below 5).
- If repo is clearly a fork/duplicate, plagiarism score ≥ 70.
- Focus ONLY on core features, functional description.
- If content is minimal or unrelated, still provide a score ≥5 with reason.

Return STRICTLY:
**README Plagiarism Score:** <5–100>
**Idea Uniqueness:** <Low | Moderate | High>
**Matched Content:** <list actual matched content>
**Summary:** <short 2–3 lines>
`;
    }

    function makeCodePrompt(userChunk: string, similarChunk: string) {
        return `
You are comparing source code from two repositories.

User Code:
${userChunk}

Similar Code:
${similarChunk}

Rules:
- Code Plagiarism Score MUST be between 5–100 (never below 5).
- If repo looks forked or nearly identical, plagiarism score ≥ 70.
- Ignore standard imports, comments, configs.
- Evaluate ONLY unique algorithms, logic, and structure.

Risk Levels:
- Low: 5–30
- Moderate: 31–60
- High: 61–100

Return STRICTLY:
**Code Plagiarism Score:** <5–100>
**Risk Percentage:** <5–100>
**Matched Code:** <non-boilerplate matches>
**Summary:** <short 2–3 lines>
`;
    }

    // ===================== CHUNK COMPARISON =====================
    async function compareChunks(userChunks: string[], simChunks: string[], isCode = false, isFork = false, repoSizeKB = 0) {
        if (isFork) {
            const forkScore = repoSizeKB < 500 ? 85 : 90;
            return userChunks.map(() => `**${isCode ? "Code Plagiarism Score" : "README Plagiarism Score"}:** ${forkScore}
**Matched ${isCode ? "Code" : "Content"}:** Repo is a fork
**Summary:** Fork override applied`);
        }

        const results = await Promise.all(userChunks.map(async (chunk, i) => {
            const simChunk = simChunks[i] || simChunks[i % simChunks.length] || "";
            const prompt = isCode ? makeCodePrompt(chunk, simChunk) : makeReadmePrompt(chunk, simChunk);

            try {
                const res = await openai.chat.completions.create({
                    messages: [{ role: "system", content: prompt }],
                    model: "deepseek-chat",
                    temperature: 0,
                    top_p: 1
                });
                const content = res.choices?.[0]?.message?.content || "";
                if (!content || content.length < 50) {
                    // Fallback similarity
                    const userWords = new Set(chunk.split(/\s+/));
                    const simWords = new Set(simChunk.split(/\s+/));
                    const commonWords = [...userWords].filter(w => simWords.has(w));
                    const similarityRatio = Math.min(100, Math.round((commonWords.length / Math.max(userWords.size, 1)) * 100));
                    const guessedScore = Math.min(Math.max(isCode ? similarityRatio + 20 : similarityRatio + 5, 5), 100);
                    return `**${isCode ? "Code Plagiarism Score" : "README Plagiarism Score"}:** ${guessedScore}
**Matched ${isCode ? "Code" : "Content"}:** Fallback estimated matches
**Summary:** Fallback score based on content similarity`;
                }
                return content;
            } catch {
                return `**${isCode ? "Code Plagiarism Score" : "README Plagiarism Score"}:** 10
**Matched ${isCode ? "Code" : "Content"}:** Error fallback
**Summary:** Could not get AI comparison`;
            }
        }));
        return results;
    }



    // ===================== AGGREGATION =====================
    function aggregateScores(results: string[], label: string, chunks?: string[]) {
        let total = 0, count = 0, maxHighScore = -1;
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            const match = r.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(\\d+)`, "i"));
            if (match) {
                const score = parseInt(match[1], 10);
                if (score >= 70 && score > maxHighScore) maxHighScore = score;
                const weight = chunks ? Math.min(chunks[i].length / 1000, 5) : 1;
                total += score * weight;
                count += weight;
            }
        }
        if (maxHighScore >= 70) return maxHighScore; // ensure high chunk dominates
        return Math.min(Math.max(count > 0 ? Math.round(total / count) : 5, 5), 100);
    }

    // ===================== MAIN EXECUTION =====================
    const mainRepoInfo = await githubRequest("GET /repos/{owner}/{repo}", { owner, repo });
    const isFork = mainRepoInfo.data?.fork === true;
    const repoSizeKB = mainRepoInfo.data?.size || 0;

    const similarRepos = await findSimilarRepos();
    const similarRepoContents = await fetchSimilarRepoContent(similarRepos, isFork, repoSizeKB);

    const readmeChunks = chunkReadmeByParagraphs(readmeText, 2000);
    const codeChunks = chunkCodeByFunctions(codeText, 300);

    const MAX_SIM_CHUNKS = 50;
    const similarReadmeChunks = Array.isArray(similarRepoContents) && similarRepoContents.length
        ? similarRepoContents.map(repo => chunkReadmeByParagraphs(repo.similarReadmeText || "", 2000)).flat().slice(0, MAX_SIM_CHUNKS)
        : [""];

    const similarCodeChunks = Array.isArray(similarRepoContents) && similarRepoContents.length
        ? similarRepoContents.map(repo => chunkCodeByFunctions(repo.similarCodeText || "", 300)).flat().slice(0, MAX_SIM_CHUNKS)
        : [""];

    const readmeResults = await compareChunks(readmeChunks, similarReadmeChunks, false, isFork, repoSizeKB);
    const codeResults = await compareChunks(codeChunks, similarCodeChunks, true, isFork, repoSizeKB);

    const finalReadmeScore = aggregateScores(readmeResults, "README Plagiarism Score", readmeChunks);
    const finalCodeScore = aggregateScores(codeResults, "Code Plagiarism Score", codeChunks);

    console.log("Final README Score:", finalReadmeScore);
    console.log("Final Code Score:", finalCodeScore);
    // console.log("Similar repo contents:", similarRepoContents);


    // ==================== RESULT EXTRACTION HELPERS ====================
    function extractWithRegex(
        text: string,
        patterns: { [key: string]: RegExp },
        defaults: { [key: string]: any }
    ) {
        const result: Record<string, any> = {};
        for (const key in patterns) {
            const match = text.match(patterns[key]);
            result[key] = match ? match[1].trim() : defaults[key];
        }
        return result;
    }

    // --- README results ---
    const ReadmeResult = readmeResults.join("\n\n") || "";

    // --- final readme score from chunks ---
    const readmeChunkFinalScore = (() => {
        const scores = readmeResults
            .map(r => {
                const m = r.match(/\*\*README Plagiarism Score:\*\*\s*(\d+)/i);
                return m ? parseInt(m[1], 10) : undefined;
            })
            .filter((s): s is number => typeof s === "number");
        if (scores.some(s => s >= 70)) return Math.max(...scores);
        return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 5;
    })();

    const readmeData = extractWithRegex(
        ReadmeResult,
        {
            plagiarismScore: /\*\*README Plagiarism Score:\*\*\s*(\d+)/i,
            ideaUniqueness: /\*\*Idea Uniqueness:\*\*\s*(.*)/i,
            matchedContent: /\*\*Matched Content:\*([\s\S]*?)(?=\n\*\*|$)/i,
            summary: /\*\*Summary:\*([\s\S]*?)(?=\n\*\*|$)/i,
        },
        {
            plagiarismScore: readmeChunkFinalScore,
            ideaUniqueness: "Not found",
            matchedContent: "No matched content found.",
            summary: "No summary found.",
        }
    );
    readmeData.plagiarismScore = Math.max(5, parseInt(readmeData.plagiarismScore, 10) || 5);

    // --- Code results ---
    const CodeResult = codeResults.join("\n\n") || "";

    // --- final code score from chunks ---
    const codeChunkFinalScore = (() => {
        const scores = codeResults
            .map(r => {
                const m = r.match(/\*\*Code Plagiarism Score:\*\*\s*(\d+)/i);
                return m ? parseInt(m[1], 10) : undefined;
            })
            .filter((s): s is number => typeof s === "number");
        if (scores.some(s => s >= 70)) return Math.max(...scores);
        return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 5;
    })();

    const codeData = extractWithRegex(
        CodeResult,
        {
            codePlagiarismScore: /\*\*Code Plagiarism Score:\*\*\s*(\d+)/i,
            riskPercentage: /\*\*Risk Percentage:\*\*\s*(\d+)/i,
            matchedCode: /\*\*Matched Code:\*([\s\S]*?)(?=\n\*\*|$)/i,
            summary: /\*\*Summary:\*([\s\S]*?)(?=\n\*\*|$)/i,
        },
        {
            codePlagiarismScore: codeChunkFinalScore,
            riskPercentage: -1,
            matchedCode: "No matched code found.",
            summary: "No summary found.",
        }
    );

    // ==================== HEURISTICS & ADJUSTMENTS ====================
    const repoInfo = await githubRequest("GET /repos/{owner}/{repo}", { owner, repo });
    const isFork_final = repoInfo.data?.fork === true;
    const repoSizeKB_final = repoInfo.data?.size || 0;

    const codeSummary = codeData.summary || "";
    const hasHighStructuralMatch = /\bstructure\b/i.test(codeSummary);

    const codeExtensions = [".js", ".ts", ".py", ".java", ".cpp", ".c"];
    const isCodeTextFile = codeExtensions.some(ext => codeText.endsWith(ext));

    const hasHumanComments = isCodeTextFile && /(^|\s)(\/\/|#|\/\*|\*\s)/.test(codeText);
    const hasRandomVariableNames = isCodeTextFile && /\b[a-z]{1,2}\d?\b/.test(codeText);
    const hasLargeDuplicatedBlocks =
        isCodeTextFile &&
        (/(.)\1{30,}/.test(codeText) || codeText.split("\n").some(line => line.length > 100 && /[{};]/.test(line)));

    function extractDependenciesFromCode(code: string): string[] {
        try {
            const pkgMatch = code.match(/({[\s\S]*?"dependencies"[\s\S]*?})/);
            if (pkgMatch) return Object.keys(JSON.parse(pkgMatch[1]).dependencies || {});
        } catch { }
        if (/requirements\.txt/i.test(code))
            return code
                .split("\n")
                .map(l => l.trim())
                .filter(l => l && !l.startsWith("#"));
        return [];
    }

    const dependencyList = extractDependenciesFromCode(codeText);
    const similarDependencyList = Array.isArray(similarRepoContents) && similarRepoContents.length > 0
        ? extractDependenciesFromCode(similarRepoContents[0].similarCodeText || "")
        : [];
    const hasIdenticalDependencyList =
        dependencyList.length > 0 &&
        dependencyList.every(dep => similarDependencyList.includes(dep));

    // --- Adjustment logic ---
    let adjustmentLog: string[] = [];
    let adjustedCodePlagiarismScore = parseInt(codeData.codePlagiarismScore, 10) || 5;
    let adjustedCodeRiskPercentage = parseInt(codeData.riskPercentage, 10) || 5;

    // Fork adjustment
    if (isFork_final) {
        const delta = Math.min(adjustedCodePlagiarismScore * 0.15, 15);
        adjustedCodePlagiarismScore += delta;
        adjustedCodeRiskPercentage += 5;
        adjustmentLog.push(`Fork detected: +${Math.round(delta)} plagiarism score, +5% risk`);
    }

    // Structural similarity
    if (hasHighStructuralMatch) {
        adjustedCodePlagiarismScore += 15;
        adjustmentLog.push("Structural similarity detected: +15 plagiarism score");
    }

    // Large duplicated blocks
    if (hasLargeDuplicatedBlocks) {
        adjustedCodePlagiarismScore += 10;
        adjustedCodeRiskPercentage += 5;
        adjustmentLog.push("Large duplicated code blocks: +10 plagiarism score, +5% risk");
    }

    // Identical dependencies
    if (hasIdenticalDependencyList) {
        adjustedCodePlagiarismScore += 5;
        adjustmentLog.push("Identical dependency list: +5 plagiarism score");
    }

    // Human comments reduce score
    if (hasHumanComments) {
        adjustedCodePlagiarismScore -= 5;
        adjustmentLog.push("Human comments detected: -5 plagiarism score");
    }

    // Random variable names reduce score
    if (hasRandomVariableNames) {
        adjustedCodePlagiarismScore -= 8;
        adjustmentLog.push("Random short variable names detected: -8 plagiarism score");
    }

    // Missing code adjustments
    const codeMissing = !codeText || codeText.trim().length === 0;
    if (codeMissing) {
        if (isFork_final && repoSizeKB_final < 500) {
            adjustedCodePlagiarismScore = Math.max(adjustedCodePlagiarismScore, 25);
            adjustmentLog.push("Code missing in small forked repo: set plagiarism to 25");
        } else if (!isFork_final && repoSizeKB_final < 100) {
            adjustedCodePlagiarismScore = Math.max(adjustedCodePlagiarismScore, 10);
            adjustmentLog.push("Code missing in tiny original repo: set plagiarism to 10");
        } else if (repoSizeKB_final >= 500) {
            adjustedCodePlagiarismScore = 100;
            adjustedCodeRiskPercentage = 100;
            adjustmentLog.push("Large repo missing code: max plagiarism and risk applied");
        }
    }

    // Clamp values
    adjustedCodePlagiarismScore = Math.min(Math.max(Math.round(adjustedCodePlagiarismScore), 5), 100);
    adjustedCodeRiskPercentage = Math.min(Math.max(Math.round(adjustedCodeRiskPercentage), 0), 100);

    // ================== OVERALL SCORE ==================
    let overallPlagiarismScore = Math.round(
        readmeData.plagiarismScore * 0.3 + adjustedCodePlagiarismScore * 0.7
    );

    // Ensure any high code score dominates
    overallPlagiarismScore = Math.max(overallPlagiarismScore, adjustedCodePlagiarismScore, readmeData.plagiarismScore);

    // Clamp again
    overallPlagiarismScore = Math.min(Math.max(overallPlagiarismScore, 5), 100);

    // ================== AGGREGATED MATCHED CONTENTS ==================
    const aggregatedMatchedCode = codeResults
        .map(r => r.match(/\*\*Matched Code:\*\*([\s\S]*?)(?=\n\*\*|$)/i)?.[1].trim() || "")
        .filter(Boolean)
        .join("\n\n");

    const aggregatedCodeSummary = codeResults
        .map(r => r.match(/\*\*Summary:\*\*([\s\S]*?)(\n|$)/i)?.[1].trim() || "")
        .filter(Boolean)
        .join(" ");

    const aggregatedMatchedReadme = readmeResults
        .map(r => r.match(/\*\*Matched Content:\*\*([\s\S]*?)(?=\n\*\*|$)/i)?.[1].trim() || "")
        .filter(Boolean)
        .join("\n\n");

    const aggregatedReadmeSummary = readmeResults
        .map(r => r.match(/\*\*Summary:\*\*([\s\S]*?)(\n|$)/i)?.[1].trim() || "")
        .filter(Boolean)
        .join(" ");

    return c.json({
        PlagiarismAnalysis: {
            OriginalCodeScore: codeData.codePlagiarismScore,
            AdjustedCodeScore: adjustedCodePlagiarismScore,
            OriginalCodeRisk: codeData.riskPercentage,
            AdjustedCodeRisk: adjustedCodeRiskPercentage,
            isFork: isFork_final,
            hasHighStructuralMatch,
            hasHumanComments,
            hasRandomVariableNames,
            hasLargeDuplicatedBlocks,
            hasIdenticalDependencyList,
            matchedCode: aggregatedMatchedCode,
            codeSummary: aggregatedCodeSummary,
            overallPlagiarismScore,
            adjustmentLog,
            ReadmeScore: readmeData.plagiarismScore,
            IdeaUniqueness: readmeData.ideaUniqueness,
            matchedReadmeContent: aggregatedMatchedReadme,
            readmeSummary: aggregatedReadmeSummary
        }
    });


});

VerifyRouter.post('/verifyEmail', async (c) => {

    const linkRegex = /(https?:\/\/[^\s]+)/g;

    let emailContent = "";
    try {
        const jsonBody = await c.req.json();
        emailContent = jsonBody.emailContent || "";
    } catch (err) {
        emailContent = "";
    }
    // const { emailContent } = await c.req.json() ;

    const formData = await c.req.raw.formData().catch(() => null);
    const file = formData?.get("file") as File | null;

    const buffer = file ? await file.arrayBuffer() : null;
    const base64Image = buffer ? Buffer.from(buffer).toString("base64") : null;

    const links = String(emailContent).trim().match(linkRegex) || [];
    if (emailContent.length === 0 && !file) {
        return c.json({ msg: "No email content found." }, 400);
    }
    const prompt1 = `Analyze this email (**If its Image then first do OCR very deeply and carefully extract text from it) for phishing characteristics and return a risk score (0-100) like (**RiskScore: **) with reasoning with heading then a small para to explain it(return like a list **Detected Threats: **):\n\n${emailContent.length === 0 ? base64Image : emailContent} and give me a risk Percentage(like **Risk Percentage: **) \n\n also Analyze this link and check if it is fake or not(return like **Link Analysis: If it is fake, return "ALERT: Suspicious link detected." If safe, return "SAFE: No issues found.") No extra text. \n\n${links} `;
    try {
        const llm = await axios.post(
            api_url,
            {
                contents: [{ parts: [{ text: prompt1 }] }],
                generationConfig: {
                    temperature: 0.2,
                    topK: 1,
                    topP: 0.1,
                    maxOutputTokens: 512,
                }
            },
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );


        const aiAnalysisText = llm.data.candidates[0]?.content?.parts[0]?.text || "";
        console.log(aiAnalysisText)


        const riskScoreMatch = aiAnalysisText.match(/\*\*RiskScore:\s*(\d+)\*\*/i);
        console.log(riskScoreMatch)
        const riskScore = riskScoreMatch ? parseInt(riskScoreMatch[1], 10) : "N/A";



        const threatsMatch = aiAnalysisText.match(/\*\*Detected Threats:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/i);
        const detectedThreats = threatsMatch ? threatsMatch[1].trim() : "No threats detected";
        console.log(detectedThreats)




        const linkAnalysisMatch = aiAnalysisText.match(/\*\*Link Analysis:\*\*\s*(ALERT: .*?|SAFE: .*?)(?:\n|$)/i);
        const linkAnalysis = linkAnalysisMatch ? linkAnalysisMatch[1].trim() : "No link analysis found.";
        console.log(linkAnalysis)



        const riskPercentage = aiAnalysisText.match(/\*\*Risk Percentage:\s*(\d+)%\*\*/i);
        const riskPercentageValue = riskPercentage ? parseInt(riskPercentage[1], 10) : "N/A";
        console.log(riskPercentageValue)




        const google_api = await axios.post(
            safe_browsing_url,
            {
                client: { clientId: "SecureSight", clientVersion: "1.0" },
                threatInfo: {
                    threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
                    platformTypes: ["ANY_PLATFORM"],
                    threatEntryTypes: ["URL"],
                    threatEntries: links.map((url: string) => ({ url }))
                }
            }
        );

        let googleApiResponce = google_api.data;

        return c.json({
            phishingAnalysis: {
                riskScore,
                detectedThreats,
                linkAnalysis,
                riskPercentageValue
            },
            GoogleSafeBrowsing: googleApiResponce,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            }
        });


    } catch (error) {
        console.error(error)
        return c.status(404);
    }
})

const storage = createStorage({ driver: memoryDriver() });

VerifyRouter.post("/verifyDocument", async (c) => {
    try {

        // Get the uploaded file
        const formData = await c.req.raw.formData().catch(() => null);
        const file = formData?.get("file") as File | null;
        if (!file) {
            return c.json({ message: "No file uploaded." }, 400);
        }
        // Convert file to Base64 for Google Vision API
        const buffer = await file.arrayBuffer();
        //   const base64Image = Buffer.from(buffer).toString("base64");


        //   const visionResponse = await axios.post(
        //     `https://vision.googleapis.com/v1/images:annotate?key=${vision_api_key}`,
        //     {
        //       requests: [
        //         {
        //           image: { content: base64Image },
        //           features: [{ type: "TEXT_DETECTION" }],
        //         },
        //       ],
        //     },
        //     { headers: { "Content-Type": "application/json" } }
        //   );

        //   const extractedText =
        //     visionResponse.data.responses?.[0]?.textAnnotations?.[0]?.description || "";

        //   if (!extractedText) {
        //     return c.json({ message: "No text found in document." }, 400);
        //   }


        const prompt = `Analyze the text in this Image, first do OCR and extract text from the image very carefully and see the major content is written by ai or human, cuz it can happen that some of the content can be written by human so analyze it very properly and then determine if it was AI-generated or human-written. Return either "AI-Generated" or "Human-Written" only. No extra text, i dosent want any extra text please.`;

        const llmResponse = await axios.post(
            api_url,
            {
                contents: [{ parts: [{ text: prompt }] }],
            },
            { headers: { "Content-Type": "application/json" } }
        );

        const aiCheckResult = llmResponse.data || "Unknown";


        return c.json({
            // extractedText,
            aiDetection: aiCheckResult,
        });
    } catch (error) {
        console.error("Error:", error);
        return c.status(500);
    }
});

VerifyRouter.post('/verifyAiGeneratedContent', async (c) => {
    let text = "";
    try {
        const jsonBody = await c.req.json();
        // console.log("Received JSON body:", jsonBody);
        text = jsonBody.content || "";
    } catch (err) {
        return c.json({ error: "Invalid JSON" }, 500);
    }

    if (!text || text.trim().length === 0) {
        return c.json({ error: "Text is required" }, 500);
    }
    console.log("Received text for AI detection:", text);

    // Better prompt asking Gemini for structured JSON
    const prompt = `
        You are an expert in detecting AI-generated content. NowAdays, AI-generated content is becoming more tricky to identify as it can be mixed with human-written text.

        Analyze the following text and Return(*Strictly only in this format*)not json only text:

        **is_ai_generated:** true or false
        **HowMuchOfItFeltAiGenerated:** 0-100
        **Human content:** true or false
        **HowMuchOfItFeltHumanWritten:** 0-100
        **human content reason:** short and specific reason
        **reason:** short and specific reason
        
        Text:
        """
        ${text}
        """`;

    try {
        const responce = await openai.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "deepseek-reasoner",
        });

        const resultText = responce.choices?.[0]?.message?.content || "{}";
        console.log(resultText);

        const is_ai_generatedMatch = resultText.match(/\*\*is_ai_generated:\*\*\s*(true|false)/i);
        const is_ai_generated = is_ai_generatedMatch ? is_ai_generatedMatch[1].toLowerCase() === "true" : true;
        console.log("Is AI Generated:", is_ai_generated);

        const confidenceMatch = resultText.match(/\*\*HowMuchOfItFeltAiGenerated:\*\*\s*(\d+)/i);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1], 10) : -1;
        console.log("Confidence:", confidence);
        const relativeCondifence = 97 - confidence;

        const humanContentMatch = resultText.match(/\*\*Human content:\*\*\s*(true|false)/i);
        const humanContent = humanContentMatch ? humanContentMatch[1].toLowerCase() === "true" : false;
        console.log("Human Content:", humanContent);

        const humanContentConfidenceMatch = resultText.match(/\*\*HowMuchOfItFeltHumanWritten:\*\*\s*(\d+)/i);
        const humanContentConfidence = humanContentConfidenceMatch ? parseInt(humanContentConfidenceMatch[1], 10) : -1;
        console.log("Human Content Confidence:", humanContentConfidence);

        const humanContentReasonMatch = resultText.match(/\*\*human content reason:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/i);
        const humanContentReason = humanContentReasonMatch ? humanContentReasonMatch[1].trim() : "No reason provided.";
        console.log("Human Content Reason:", humanContentReason);

        const reasonMatch = resultText.match(/\*\*reason:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/i);
        const reason = reasonMatch ? reasonMatch[1].trim() : "No reason provided.";
        console.log("Reason:", reason);


        return c.json({
            AiTextAnalysis: {
                is_ai_generated: is_ai_generated,
                Confidence: confidence,
                // relativeConfidence: -relativeCondifence,
                reason: reason,
                humanContent: humanContent,
                humanContentConfidence: humanContentConfidence,
                humanContentReason: humanContentReason
            },
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            }

        });
    } catch (error) {
        console.error("Gemini API error:", error);
        return c.json({ error: "Failed to reach AI detection service." }, 500);
    }
});



export default VerifyRouter;



