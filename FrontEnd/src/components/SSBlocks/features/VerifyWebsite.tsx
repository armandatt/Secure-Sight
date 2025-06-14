"use client"

import type React from "react"

import { useState } from "react"
import { Link } from "react-router-dom"
import { Globe, ArrowLeft, Search, CheckCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import axios from "axios"
import { BACKEND_URL } from "@/config"

const VerifyWebsites = () => {
  const [url, setUrl] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [PlagiarismAnalysis, setAiAnalysis] = useState<any>(null);


  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    setIsScanning(true)
    setScanComplete(false)
    setScanProgress(0)
    const response = await axios.post(`${BACKEND_URL}/api/v1/verify/verifyWebsite`, {url} , {
      headers: {
        Authorization: `${localStorage.getItem("token")}`
      }
    })

    const data_set = await response.data.PlagiarismAnalysis
    if (response.status == 200) {
      setAiAnalysis(data_set);
    } else {
      console.error("Error fetching AI analysis:", response.statusText);
    }

    // Simulate scanning progress
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsScanning(false)
          setScanComplete(true)
          return 100
        }
        return prev + 10
      })
    }, 500)
  }

  function ProgressBar({ value }: { value: number }) {
    return(
    <div className="h-4 rounded-full bg-gray-700">
                        <div className="h-4 rounded-full bg-green-500" style={{ width: `${value}%` }}></div>
                      </div>)
  }

  console.log(PlagiarismAnalysis?.AdjustedScore);
  console.log(PlagiarismAnalysis?.AdjustedRisk);
  console.log(PlagiarismAnalysis?.Summary);

  return (
    <div className="flex min-h-screen flex-col bg-[#0c0e16]">
      <header className="border-b border-gray-800 bg-[#0c0e16]">
        <div className="flex h-16 items-center px-6 md:px-10">
          <Button asChild variant="ghost" className="mr-4 text-gray-300 hover:text-white">
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            <h1 className="text-xl font-bold text-white">Verify Websites</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 md:px-10">
        <Card className="mx-auto max-w-3xl bg-[#13151f] text-white">
          <CardHeader>
            <CardTitle>Website Plagiarism Scanner</CardTitle>
            <CardDescription className="text-gray-400">
              Check if a website contains plagiarized content or copyright infringements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScan} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="url" className="text-sm font-medium text-gray-300">
                  Enter GitHub Repo Link
                  (*Readme is mandatory)
                </label>
                {/* <p>mandatory</p> */}
                <div className="flex gap-2">
                  <Input
                    id="url"
                    type="url"
                    placeholder=""
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    className="flex-1 border-gray-700 bg-[#1c1f2e] text-white"
                  />
                  <Button
                    type="submit"
                    disabled={isScanning || !url}
                    className="bg-blue-500 text-white hover:bg-blue-600"
                  >
                    {isScanning ? "Scanning..." : "Scan"}
                    <Search className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>

            {isScanning && (
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Scanning website...</span>
                  <span>{scanProgress}%</span>
                </div>
                <Progress value={scanProgress} className="h-2 bg-gray-700" indicatorClassName="bg-blue-500" />
              </div>
            )}

            {scanComplete && (
              <div className="mt-6 space-y-4">
                <Alert className="border-green-500/20 bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertTitle className="text-green-500">Scan Complete</AlertTitle>
                  <AlertDescription className="text-gray-300">
                    We've analyzed the website content for plagiarism.
                  </AlertDescription>
                </Alert>

                <Tabs defaultValue="results" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-[#1c1f2e]">
                    <TabsTrigger value="results">Results</TabsTrigger>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    {/* <TabsTrigger value="report">Report</TabsTrigger> */}
                  </TabsList>
                  <TabsContent value="results" className="mt-4 space-y-4">
                    <div className="rounded-lg bg-[#1c1f2e] p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-medium">Plagiarism Score</h3>

                        
                          { PlagiarismAnalysis && (
                            parseInt(PlagiarismAnalysis.AdjustedScore) <= 30 ? (
                              <div className="flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1 text-sm text-green-500">
                                <span>Plagiarism Score</span>
                                <span className="font-bold">{PlagiarismAnalysis.AdjustedScore}%</span>
                              </div>
                            ) : parseInt(PlagiarismAnalysis.AdjustedScore) < 70 && parseInt(PlagiarismAnalysis.AdjustedScore) >30? (
                              <div className="flex items-center gap-2 rounded-full bg-yellow-500/20 px-3 py-1 text-sm text-yellow-500">
                                <span>Plagiarism Score</span>
                                <span className="font-bold">{PlagiarismAnalysis.AdjustedScore}%</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-sm text-red-500">
                                <span>Plagiarism Score</span>
                                <span className="font-bold">{PlagiarismAnalysis.AdjustedScore}%</span>
                              </div>
                            )
                          )}

                      <div className="flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-sm text-red-500">
                                <span>Risk</span>
                                
                                <span className="font-bold">{PlagiarismAnalysis?.AdjustedRisk}%</span>
                              </div>


                      </div>
                      <ProgressBar value={parseInt(PlagiarismAnalysis?.AdjustedScore) || 0} />
                      <div className="mt-2 flex justify-between text-xs text-gray-400">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-[#1c1f2e] p-4">
                      <h3 className="mb-3 text-lg font-medium">Summary</h3>
                      <ul className="space-y-2 text-gray-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>{PlagiarismAnalysis?.summary}</span>
                          {/* <span className="text-sm text-gray-400">({PlagiarismAnalysis?.matchedContent})</span> */}
                        </li>
                        {/* <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Content compared against 10M+ sources</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          <span>2 minor matches found (see details)</span>
                        </li> */}
                      </ul>
                    </div>
                  </TabsContent>

                  <TabsContent value="details" className="mt-4">
                    <div className="rounded-lg bg-[#1c1f2e] p-4">
                      <h3 className="mb-3 text-lg font-medium">Matched Content</h3>
                      <div className="space-y-4">
                        <div className="rounded border border-yellow-500/20 bg-yellow-500/10 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium text-white">{PlagiarismAnalysis?.matchedContent || "null"}</span>
                            {/* <span className="text-sm text-yellow-500">8% match</span> */}
                          </div>
                          {/* <p className="text-sm text-gray-300">
                            "Our advanced technology provides cutting-edge solutions for businesses of all sizes..."
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-gray-400">Similar to: example-source.com</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-gray-400 hover:text-white"
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </Button>
                          </div> */}
                        </div>

                        {/* <div className="rounded border border-yellow-500/20 bg-yellow-500/10 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium text-white">About Page - Paragraph 4</span>
                            <span className="text-sm text-yellow-500">4% match</span>
                          </div>
                          <p className="text-sm text-gray-300">
                            "Founded in 2020, we've quickly established ourselves as leaders in the industry..."
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-gray-400">Similar to: another-site.org</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-gray-400 hover:text-white"
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </Button>
                          </div>
                        </div> */}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="report" className="mt-4">
                    <div className="rounded-lg bg-[#1c1f2e] p-4">
                      <h3 className="mb-3 text-lg font-medium">Detailed Report</h3>
                      <p className="mb-4 text-gray-300">
                        Download or share the complete plagiarism analysis report for this website.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button className="bg-blue-500 text-white hover:bg-blue-600">Download PDF</Button>
                        <Button
                          variant="outline"
                          className="border-gray-700 text-gray-300 hover:bg-[#252a3d] hover:text-white"
                        >
                          Share Report
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col items-start border-t border-gray-800 text-sm text-gray-400">
            <p>Our website scanner checks content against billions of web pages, academic papers, and publications.</p>
            <p className="mt-2">
              For more advanced scanning options, try our{" "}
              <Link to="/verify-documents" className="text-blue-400 hover:underline">
                Document Verification
              </Link>{" "}
              tool.
            </p>
          </CardFooter>
        </Card>
      </main>

      <footer className="border-t border-gray-800 py-6 text-center text-sm text-gray-400">
        <p>© 2025 SecureSight. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default VerifyWebsites

