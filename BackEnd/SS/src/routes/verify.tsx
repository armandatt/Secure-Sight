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
const vision_api_key = "AIzaSyBVILqrCBv00tSGU3p6uf_bPG2iyfHHlDM";
const Api_key = "AIzaSyA1R18mylAcJaOrChf6i8iQqrML73VCbL8";
const search_id = "b6120d91992ae4fa8";


dotenv.config();

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

    // Case 1: URL string — fetch from GitHub
    if (typeof input === "string") {
        const zipResponse = await fetch(input);
        if (!zipResponse.ok) {
            throw new Error(`Failed to fetch ZIP: ${zipResponse.statusText}`);
        }

        const arrayBuffer = await zipResponse.arrayBuffer();
        uint8Array = new Uint8Array(arrayBuffer);
    }
    // Case 2: Already a buffer (manually zipped from Octokit files)
    else if (input instanceof Uint8Array) {
        uint8Array = input;
    } else {
        throw new Error("Invalid ZIP input: must be a URL string or Uint8Array buffer");
    }

    const zipEntries = unzipSync(uint8Array);
    const filenames = Object.keys(zipEntries);

    console.log("Found ZIP entries:", filenames);

    let readmeText = "";
    let codeText = "";
    let detectedExtensions: string[] = [];

    for (const filename of filenames) {
        const file = zipEntries[filename];
        if (!file || file.length === 0) continue;

        const lowerName = filename.toLowerCase();

        try {
            // Detect README (once)
            if (lowerName.includes("readme") && lowerName.endsWith(".md") && readmeText === "") {
                readmeText = strFromU8(file, true);
                console.log(`✅ Found README: ${filename}`);
            }

            const extMatch = lowerName.match(/\.(\w+)$/);
            if (extMatch) {
                const ext = extMatch[1];
                const validExts = ["js", "ts", "py", "rs", "java", "cpp", "cs", "go", "rb", "php"];
                if (validExts.includes(ext)) {
                    const content = strFromU8(file, true);
                    codeText += `\n\n// ${filename}\n${content}`;
                    if (!detectedExtensions.includes(ext)) {
                        detectedExtensions.push(ext);
                    }
                }
            }
        } catch (e) {
            console.warn(`❌ Failed to decode ${filename}:`, e);
        }
    }

    if (!readmeText && !codeText) {
        throw new Error("No README or code files found in the ZIP.");
    }

    return { readmeText, codeText, detectedExtensions };
}


VerifyRouter.post('/verifyWebsite', async (c) => {
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());

    const GitHub_Url = c.env.GitHub_URL;
    const octokit = new Octokit({ auth: GitHub_Url });

    console.log("Request received at /verifyWebsite");

    let repoUrl = "";
    try {
        const jsonBody = await c.req.json();
        repoUrl = jsonBody.url || "";
    } catch (err) {
        repoUrl = "";
    }

    const link = typeof repoUrl === "string" ? repoUrl.trim() : repoUrl;
    const regex = /github\.com\/([^/]+)\/([^/]+)/;
    const match = link.match(regex);
    if (!match) return new Response("Invalid GitHub URL", { status: 400 });

    const owner = match[1];
    const repo = match[2];

    async function getRepoFileStructure(owner: string, repo: string) {
        const branchData = await octokit.repos.get({ owner, repo });
        const defaultBranch = branchData.data.default_branch;

        const branchDetails = await octokit.repos.getBranch({
            owner,
            repo,
            branch: defaultBranch,
        });

        const treeSha = branchDetails.data.commit.sha;

        const fileTree = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: treeSha,
            recursive: "1",
        });

        const allFiles = fileTree.data.tree.filter((item) => item.type === "blob");

        return allFiles.map((file) => file.path);
    }

    async function fetchFileSnippet(owner: string, repo: string, path: string): Promise<string> {
        try {
            const res = await octokit.repos.getContent({ owner, repo, path });
            const fileData = res.data as any;

            if (Array.isArray(fileData) || !fileData.content) return "";

            const content = Buffer.from(fileData.content, "base64").toString("utf-8");
            const lines = content.split("\n");

            // Extract lines 20–45 if available
            const snippet = lines.slice(19, 45).join("\n");

            return snippet;
        } catch (err) {
            console.warn(`Failed to fetch or decode snippet for ${path}:`, err);
            return "";
        }
    }

    const CODE_EXTENSIONS = ["py", "js", "ts", "cpp", "java", "go", "rb", "cs"];
    function isCodeFile(path: string): boolean {
        return CODE_EXTENSIONS.some((ext) => path.endsWith("." + ext));
    }

    async function getCodeSnippetsForGemini(owner: string, repo: string) {
        const MAX_TOTAL_SNIPPET_CHARS = 4000;
        const MAX_FILES = 12;

        const allPaths = await getRepoFileStructure(owner, repo);
        const logicFileSnippets: { [filename: string]: string } = {};

        let totalChars = 0;
        let fileCount = 0;

        for (const path of allPaths) {
            if (!isCodeFile(path)) continue;
            if (fileCount >= MAX_FILES || totalChars >= MAX_TOTAL_SNIPPET_CHARS) break;

            const snippet = await fetchFileSnippet(owner, repo, path);
            const trimmed = snippet.trim();
            if (trimmed.length < 10) continue;

            if ((totalChars + trimmed.length) > MAX_TOTAL_SNIPPET_CHARS) break;

            logicFileSnippets[path] = trimmed;
            totalChars += trimmed.length;
            fileCount += 1;
        }

        return logicFileSnippets;
    }


    // 👇 CALL THIS FIRST
    const logicFileSnippets = await getCodeSnippetsForGemini(owner, repo);

    // 🧠 Then prepare the prompt for Gemini
    let prompt = `These are code snippets from a GitHub repo. Identify only the important core logic files (ignore UI, boilerplate, setup):\n\n`;
    for (const [filename, snippet] of Object.entries(logicFileSnippets)) {
        const snippetBlock = `// ${filename}\n${snippet}\n\n`;
        if ((prompt.length + snippetBlock.length) > 12000) break;

        prompt += `// ${filename}\n${snippet}\n\n`;
    }

    const llm_important_files = await axios.post(`${api_url}`, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,
            topK: 1,
            topP: 0.1,
            maxOutputTokens: 512,
        }
    }, {
        headers: { "Content-Type": "application/json" }
    });

    const geminiReply = llm_important_files.data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 🧾 Extract file names
    const detectedFiles: string[] = [];
    const fileLines = geminiReply.split("\n");

    for (const line of fileLines) {
        CODE_EXTENSIONS.forEach((ext) => {
            if (line.includes("." + ext)) {
                const clean = line.match(/[\w\/\-.]+\.[\w]+/)?.[0];
                if (clean && !detectedFiles.includes(clean)) detectedFiles.push(clean);
            }
        });
    }

    const importantLogicFiles = detectedFiles;
    const originalPrompt = prompt;
    const geminiRawOutput = geminiReply;

    console.log("Important logic files detected:", importantLogicFiles);
    if (importantLogicFiles.length === 0) {
        return c.json({ error: "No important logic files detected." }, 404);
    }
    console.log("Original prompt sent to Gemini:", originalPrompt);
    console.log("Gemini raw output:", geminiRawOutput);


    const repoInfo = await octokit.repos.get({ owner, repo });
    const branch = repoInfo.data.default_branch;



    // 2. helper function: createCustomZipFromRepo
    async function createCustomZipFromRepo(owner: string, repo: string, branch = "main") {
        const zip = new JSZip();
        const MAX_FILES = 20;
        const MAX_TOTAL_CONTENT_SIZE = 30000; // 30 KB

        const { data: refData } = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
        });

        const commitSha = refData.object.sha;
        const { data: treeData } = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: commitSha,
            recursive: "true",
        });

        const filesToInclude = treeData.tree.filter(file =>
            file.type === "blob" &&
            (
                file.path.toLowerCase().includes("readme") ||
                /\.(js|ts|py|rs|java|cpp|cs|go|rb|php)$/i.test(file.path)
            )
        );

        let totalSize = 0;
        let addedFiles = 0;

        for (const file of filesToInclude) {
            if (addedFiles >= MAX_FILES || totalSize >= MAX_TOTAL_CONTENT_SIZE) break;

            const { data: blob } = await octokit.rest.git.getBlob({
                owner,
                repo,
                file_sha: file.sha!,
            });

            const content = Buffer.from(blob.content, "base64").toString("utf-8");

            if ((totalSize + content.length) > MAX_TOTAL_CONTENT_SIZE) break;

            zip.file(file.path!, content);
            totalSize += content.length;
            addedFiles += 1;
        }

        return await zip.generateAsync({ type: "uint8array" });
    }


    // 3. main handler: handleRepoAnalysis
    async function handleRepoAnalysis(owner: string, repo: string, branch = "main") {
        try {
            // Try minimal ZIP
            const customZipBuffer = await createCustomZipFromRepo(owner, repo, branch);
            const { readmeText, codeText, detectedExtensions } = await extractZipFromUrlOrBuffer(customZipBuffer);

            return {
                source: "custom-buffer",
                readmeText,
                codeText,
                detectedExtensions,
            };
        } catch (err) {
            console.warn("⚠️ Custom zipping failed, falling back to full repo ZIP", err);

            const fallbackZipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
            const { readmeText, codeText, detectedExtensions } = await extractZipFromUrlOrBuffer(fallbackZipUrl);

            return {
                source: "fallback-zip-url",
                readmeText,
                codeText,
                detectedExtensions,
            };
        }
    }

    const extractedContent = await handleRepoAnalysis(owner, repo, branch);
    let { readmeText, codeText, detectedExtensions } = extractedContent;


    if (!codeText.trim()) {
        codeText = "// No source code found in the uploaded ZIP.";
    }

    const prompt1 = `
        You are given a README of a GitHub repository. Your task is to extract **5-6 keywords** that represent **only the main technical purpose or functional topic** of the project. 
        Do not include environment setup terms like: Docker, Devcontainers, VS Code, Containerization, Tooling, Configuration, Remote Development, unless they are **core** to the repo’s functionality.

        Format example: 
        "python OR algorithms OR sorting OR searching OR graph"

        Now extract keywords from the following README:\n\n${readmeText.slice(0, 2000)}`;

    const llm = await axios.post(api_url, {
        contents: [{ parts: [{ text: prompt1 }] }],
        generationConfig: {
            temperature: 0.2,
            topK: 1,
            topP: 0.1,
            maxOutputTokens: 512
        }
    }, {
        headers: { "Content-Type": "application/json" }
    });

    const aiAnalysis = llm.data || "Unknown";
    const text_content = aiAnalysis.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Raw AI Keywords:", text_content);

    const cleanedKeywords = text_content
        .replace(/[^a-zA-Z0-9\s|]/g, '') // remove special characters
        .split(/\s+OR\s+/i)              // split using OR
        .filter((k: string) => k.length > 1 && !["Docker", "Devcontainers", "Tooling", "Remote Development", "Configuration"].includes(k))
        .slice(0, 6);                    // take top 6 max

    const safeQuery = cleanedKeywords.join(" OR ").slice(0, 256);
    console.log("Cleaned keyword query:", safeQuery);

    async function findSimilarRepos() {
        const res = await octokit.search.repos({
            q: safeQuery,
            sort: "stars",
            order: "desc",
            per_page: 3,
        });
        return res.data.items;
    }

    async function fetchFileContentFromGitHub(owner: string, repo: string, path: string) {
        const res = await octokit.repos.getContent({ owner, repo, path });
        const fileData = res.data as any;

        if (Array.isArray(fileData)) throw new Error(`\"${path}\" is a directory, not a file.`);
        if (!fileData.content) throw new Error(`No content found at path \"${path}\"`);

        return Buffer.from(fileData.content, "base64").toString("utf-8");
    }

    let similarReadmeText = ""
    let similarCodeText = "";
    const similarRepos = await findSimilarRepos()

    if (similarRepos.length === 0) return c.json({ error: "No similar repositories found." }, 404);

    for (const similar of similarRepos) {
        const simOwner = similar.owner?.login || "";
        const simRepo = similar.name;

        try {
            similarReadmeText = await fetchFileContentFromGitHub(simOwner, simRepo, "README.md");
        } catch { }

        try {

            const MAX_SIMILAR_CODE_CHARS = 1500;

            function isImportantFile(name: string): boolean {
                return /main|app|index|server/i.test(name);
            }

            try {
                const repoContent = await octokit.repos.getContent({ owner: simOwner, repo: simRepo, path: "" });
                let fileTree = repoContent.data as any[];

                // Optional: prioritize important filenames first
                fileTree = fileTree.sort((a, b) => {
                    const aImp = isImportantFile(a.name) ? -1 : 1;
                    const bImp = isImportantFile(b.name) ? -1 : 1;
                    return aImp - bImp;
                });

                for (const file of fileTree) {
                    const fname = file.name.toLowerCase();

                    if (
                        detectedExtensions.some(ext => fname.endsWith("." + ext)) &&
                        similarCodeText.length < MAX_SIMILAR_CODE_CHARS
                    ) {
                        try {
                            const fileText = await fetchFileContentFromGitHub(simOwner, simRepo, file.path);
                            if (fileText.length > 100) {
                                const remaining = MAX_SIMILAR_CODE_CHARS - similarCodeText.length;
                                similarCodeText += "\n" + fileText.slice(0, remaining);
                            }
                        } catch { /* ignore single file errors */ }
                    }

                    if (similarCodeText.length >= MAX_SIMILAR_CODE_CHARS) break;
                }
            } catch { /* ignore repo errors */ }

            similarCodeText = similarCodeText.slice(0, MAX_SIMILAR_CODE_CHARS);

        } catch { }

        if (similarReadmeText && similarCodeText) break;
    }

    console.log("Similar README text:", similarReadmeText);
    console.log("Similar code text:", similarCodeText);

    const comparisonPrompt = `
        User README:\n${readmeText.slice(0, 1000)}
        User Code:\n${codeText.slice(0, 1000)}
        Similar README:\n${similarReadmeText.slice(0, 1000)}
        Similar Code:\n${similarCodeText.slice(0, 1000)}
        if Risk level is moderate then plagarism score should be between 45- 60, when hight then >= 70 , when less then score should be less than 30
        Is there code/structure/text similarity?
        
        Return(*Strictly only in this format*):
        **plagiarism Score:** <0-100>
        **Risk Percentage:** <0-100>
        **Matched Content:** <text>
        **Summary:** <text>`;

    const geminiCompare = await axios.post(
        api_url,
        {
            contents: [{ parts: [{ text: comparisonPrompt }] }],
            generationConfig: {
                temperature: 0.2,
                topK: 1,
                topP: 0.1,
                maxOutputTokens: 512
            }
        },
        { headers: { "Content-Type": "application/json" } },

    );

    const result = geminiCompare.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Gemini comparison result:", result);

    const plagiarismScoreMatch = result.match(/\*\*plagiarism Score:\*\*\s*(\d+)/i);

    const plagiarismScore = plagiarismScoreMatch ? parseInt(plagiarismScoreMatch[1], 10) : -1;

    console.log("Plagiarism Score:", plagiarismScore);

    const riskPercentageMatch = result.match(/\*\*Risk Percentage:\*\*\s*(\d+)/i);

    const riskPercentage = riskPercentageMatch ? parseInt(riskPercentageMatch[1], 10) : -1;

    console.log("Risk Percentage:", riskPercentage);

    const matchedContentMatch = result.match(/\*\*Matched Content:\*\*\s*([\s\S]*?)\n\*\*/i);
    const matchedContent = matchedContentMatch ? matchedContentMatch[1].trim() : "No matched content found.";
    console.log("Matched Content:", matchedContent);

    const summaryMatch = result.match(/\*\*Summary:\*\*\s*([\s\S]*?)(\n|$)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : "No summary found.";
    console.log("Summary:", summary);



    let adjustedPlagiarismScore = plagiarismScore;
    let adjustedRiskPercentage = riskPercentage;

    // Check for fork status using GitHub API
    const isFork = repoInfo.data.fork === true;

    // Heuristic checks (placeholder logic — you can improve it later)
    const hasHighStructuralMatch = summary.toLowerCase().includes("structure");
    const hasHumanComments = /#|\/\/|\/\*/.test(codeText);  // checks for human comments
    const hasRandomVariableNames = /\b[a-z]{1,2}\b/.test(codeText); // checks for short/ambiguous variable names

    if (isFork) {
        adjustedPlagiarismScore *= 1.1; // Increase score by 20% if it's a fork
        adjustedRiskPercentage += 15;
    }

    if (hasHighStructuralMatch) {
        adjustedPlagiarismScore += 20;
        adjustedRiskPercentage += 10;
    }

    if (hasHumanComments || hasRandomVariableNames) {
        adjustedPlagiarismScore -= 10;
    }

    adjustedPlagiarismScore = Math.min(Math.max(Math.round(adjustedPlagiarismScore), 0), 100);
    adjustedRiskPercentage = Math.min(Math.max(Math.round(adjustedRiskPercentage), 0), 100);

    try {
        await prisma.repoAnalysis.create({
            data: { repoUrl, readmeText, codeText }
        });
    } catch (error) {
        console.error("Error saving repo analysis:", error);
    }

    return c.json({
        PlagiarismAnalysis: {
            OriginalScore: plagiarismScore,
            AdjustedScore: adjustedPlagiarismScore,
            OriginalRisk: riskPercentage,
            AdjustedRisk: adjustedRiskPercentage,
            isFork,
            hasHighStructuralMatch,
            hasHumanComments,
            hasRandomVariableNames,
            matchedContent,
            summary
        }
    });
})

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
        You are an expert in detecting AI-generated content. NowAdays, AI-generated content is becoming more tricky to identify, very carefully see that the vocabulary is complicated if you feel in any two lines the vocab is complicated then it is AI generated

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
        const response = await axios.post(
            api_url,
            {
                contents: [{ parts: [{ text: prompt }] }],
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

        const resultText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
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



