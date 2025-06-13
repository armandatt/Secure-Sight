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
            select: { id: true, name: true,  username: true}
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

async function extractZipFromUrl(zipUrl: string) {
    const zipResponse = await fetch(zipUrl);
    if (!zipResponse.ok) {
        throw new Error(`Failed to fetch ZIP: ${zipResponse.statusText}`);
    }

    const arrayBuffer = await zipResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

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
            if (lowerName.includes("readme") && lowerName.endsWith(".md") && readmeText === "") {
                readmeText = strFromU8(file, true);
                console.log(`Found README: ${filename}`);
            }

            const extMatch = lowerName.match(/\.(\w+)$/);
            if (extMatch) {
                const ext = extMatch[1];
                if (["js", "ts", "py", "rs", "java", "cpp", "cs", "go", "rb", "php"].includes(ext)) {
                    const content = strFromU8(file, true);
                    codeText += `\n\n// ${filename}\n${content}`;
                    if (!detectedExtensions.includes(ext)) detectedExtensions.push(ext);
                }
            }
        } catch (e) {
            console.warn(`Failed to decode ${filename}:`, e);
        }
    }

    if (readmeText === "" && codeText === "") {
        throw new Error("No README or code files found in the ZIP.");
    }

    return { readmeText, codeText, detectedExtensions };
}

VerifyRouter.post('/verifyWebsite', async (c) => {

    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate())

    console.log("Request received at /verifyWebsite");

    let repoUrl = "";
    try {
        const jsonBody = await c.req.json();
        repoUrl = jsonBody.url || "";
    } catch (err) {
        repoUrl = "";
    }

    console.log("Received repo URL:", repoUrl);

    const link = typeof repoUrl === "string" ? repoUrl.trim() : repoUrl;

    const regex = /github\.com\/([^/]+)\/([^/]+)/
    const match = link.match(regex)
    console.log("Received repo link:", link);

    if (!match) return new Response("Invalid GitHub URL", { status: 400 })

    const GitHub_Url = c.env.GitHub_URL;
    console.log("GitHub URL from environment:", GitHub_Url);
    const octokit = new Octokit({ auth: GitHub_Url });

    const owner = match[1]
    const repo = match[2]
    const repoInfo = await octokit.repos.get({ owner, repo });
    const branch = repoInfo.data.default_branch;

    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`

    let extractedContent;
    try {
        extractedContent = await extractZipFromUrl(zipUrl);
    } catch (error) {
        console.error("Extraction failed:", error);
        return c.text("Failed to extract ZIP content: ", 400);
    }

    type ExtractedContent = {
        readmeText: string;
        codeText: string;
        detectedExtensions: string[];
    };
    const zipContent: ExtractedContent = extractedContent as ExtractedContent;

    let { readmeText, codeText, detectedExtensions } = zipContent;

    if (!codeText.trim()) {
        codeText = "// No source code found in the uploaded ZIP.";
    }

    const prompt1 = `
        You are given a README of a GitHub repository. Your task is to extract **5-6 keywords** that represent **only the main technical purpose or functional topic** of the project. 
        Do not include environment setup terms like: Docker, Devcontainers, VS Code, Containerization, Tooling, Configuration, Remote Development, unless they are **core** to the repo’s functionality.

        Format example: 
        "python OR algorithms OR sorting OR searching OR graph"

        Now extract keywords from the following README:\n\n${readmeText.slice(0, 2000)}`;

    const llm = await axios.post(
        api_url,
        { contents: [{ parts: [{ text: prompt1 }] }] },
        { headers: { "Content-Type": "application/json" } }
    );

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
    let similarCodeText = ""
    const similarRepos = await findSimilarRepos()

    if (similarRepos.length === 0) return c.json({ error: "No similar repositories found." }, 404);

    for (const repo of similarRepos) {
        const simOwner = repo.owner?.login || "";
        const simRepo = repo.name;

        try {
            similarReadmeText = await fetchFileContentFromGitHub(simOwner, simRepo, "README.md");
        } catch { }

        try {
            const repoContent = await octokit.repos.getContent({ owner: simOwner, repo: simRepo, path: "" });
            const fileTree = repoContent.data as any[];

            for (const file of fileTree) {
                const fname = file.name.toLowerCase();
                if (detectedExtensions.some(ext => fname.endsWith("." + ext))) {
                    try {
                        similarCodeText = await fetchFileContentFromGitHub(simOwner, simRepo, file.path);
                        if (similarCodeText.length > 100) break;
                    } catch { }
                }
            }
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
        { contents: [{ parts: [{ text: comparisonPrompt }] }] },
        { headers: { "Content-Type": "application/json" } }
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
            GoogleSafeBrowsing: googleApiResponce
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
                Confidence : confidence,
                // relativeConfidence: -relativeCondifence,
                reason: reason,
                humanContent: humanContent,
                humanContentConfidence: humanContentConfidence,
                humanContentReason: humanContentReason
            }

        });
    } catch (error) {
        console.error("Gemini API error:", error);
        return c.json({ error: "Failed to reach AI detection service." }, 500);
    }
});



export default VerifyRouter;



