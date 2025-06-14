import { Link , useNavigate} from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Github } from "lucide-react"


export default function Navbar() {

  function isAuthenticated() {
    const token = localStorage.getItem("token");
    if (token) {
      return true
    } else {
      return false
    }
  }

  function handleLogout(){
    const navigate = useNavigate();

    localStorage.removeItem("token");
    // Redirect after a short delay to show the toast
    setTimeout(() => {
      navigate("https://secure-sight-armandatts-projects.vercel.app/sign-in");
    }, 1500)
    // location.window.href("localhost:5173");
    // navigate("localhost:5173");

  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <Link to="/" className="mr-6 flex items-center space-x-2">
          <span className="font-bold">SecureSight</span>
        </Link>
        <nav className="flex flex-1 items-center space-x-6 text-sm font-medium">
          <Link to="/solutions" className="transition-colors hover:text-primary">
            Solutions
          </Link>
          {/* <Link to="/industries" className="transition-colors hover:text-primary">
            Industries
          </Link> */}
          <Link to="/about" className="transition-colors hover:text-primary">
            About Us
          </Link>
          <Link to="/contact" className="transition-colors hover:text-primary">
            Contact Us
          </Link>
        </nav>
        <div className="flex items-center space-x-4">
          <a href="https://github.com/armandatt" target="_blank" rel="noreferrer">
            <Button variant="ghost" size="icon">
              <Github className="h-4 w-4" />
              <span className="sr-only">GitHub</span>
            </Button>
          </a>
          {isAuthenticated() ?
            (<>
              <Button size="sm" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button onClick= {handleLogout} size="sm" >
                LogOut
              </Button>
            </>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/sign-in">Sign In</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/sign-up">Sign Up</Link>
                </Button></>
            )}

        </div>
      </div>
    </header>
  )
}


