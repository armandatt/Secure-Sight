import './App.css'
import { Routes, Route } from "react-router-dom"
import HomePage from "./pages/LandingPage"
import MouseMoveEffect from "./components/SSBlocks/MouseMove"
import SignIn from './components/SSBlocks/SignIn'
import SignUp from './components/SSBlocks/SignUp'
import Dashboard from './pages/DashBoard'
import VerifyWebsites from './components/SSBlocks/features/VerifyWebsite'
import PhishingEmails from './components/SSBlocks/features/PhishingEmail'
import VerifyDocuments from './components/SSBlocks/features/VerifyDocument'
import AIDetection from './components/SSBlocks/features/AIDetection'
import AboutUsPage from './pages/AboutUS'
import ContactPage from './pages/ContactUs'
import SolutionsPage from './pages/SolutionsPage'
function App() {
  return (
    <div className="relative min-h-screen">
      {/* Background gradients */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background" />
        <div className="absolute right-0 top-0 h-[500px] w-[500px] bg-blue-500/10 blur-[100px]" />
        <div className="absolute bottom-0 left-0 h-[500px] w-[500px] bg-purple-500/10 blur-[100px]" />
      </div>

      <MouseMoveEffect />

      <div className="relative z-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/verify-websites" element={<VerifyWebsites />} />
          <Route path="/phishing-emails" element={<PhishingEmails />} />
          <Route path="/verify-documents" element={<VerifyDocuments />} />
          <Route path="/ai-detection" element={<AIDetection />} />
          <Route path="/about" element={<AboutUsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/solutions" element={<SolutionsPage/>} />
        </Routes>
      </div>
    </div>
  )
}

export default App
