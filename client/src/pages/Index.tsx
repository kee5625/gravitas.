import { useState } from "react";
import { Search, Play, FileText, BookOpenText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import nebulaBg from "@/assets/carinanebula3-bg.jpg";
import demoPreview from "@/assets/demo-preview.png";
import type { APIResponse, Publication } from "@/types";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('https://gravitas-nine.vercel.app/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const rawData: APIResponse = await response.json();

      // **1. Process the complex API response into a clean array of objects**
      const processedResults: Publication[] = rawData.map((item) => {
        const abstractText = item[0]?.split('Abstract: ')[1] || "No abstract available.";
        const metadata = item[1];
        const categories = item[2];

        return {
          // Combine all data into a single, easy-to-use object
          abstract: abstractText,
          pmc_id: metadata.pmc_id,
          title: metadata.title,
          authors: metadata.authors,
          year: metadata.year,
          journal: metadata.journal,
          link: metadata.link,
          categories: categories || [], // Ensure categories is always an array
        };
      });

      // **2. Navigate with the newly processed, clean data**
      navigate("/network", { state: { results: processedResults, query: searchQuery } });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen w-full relative z-0 ">
      <div
        className="absolute inset-0 w-full h-full opacity-25 -z-10"
        style={{
          backgroundImage: `url(${nebulaBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      />
      {/* Hero Section with Background */}
      <div className="relative min-h-[70vh] flex flex-col items-center justify-center px-4">
        
        <div className="relative w-full max-w-4xl space-y-8 animate-fade-in">
          <div className="text-center space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Gravitas.
            </h1>
            <p className="text-muted-foreground text-xl md:text-2xl font-light max-w-2xl mx-auto">
              Discover and explore scientific literature with advanced AI-powered search
            </p>
          </div>

          <div className="flex gap-3 w-full max-w-3xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10 pointer-events-none" />
              <Input
                type="text"
                placeholder="e.g., Effects of spaceflight on the human body"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading} // Disable input while loading
                className="pl-12 h-16 text-lg bg-card/80 backdrop-blur-sm border-border/50 focus:border-primary transition-all duration-200 rounded-xl shadow-lg"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isLoading} // Disable button while loading
              size="lg"
              className="cursor-pointer h-16 px-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all duration-200 hover:shadow-[var(--shadow-glow)] rounded-xl text-lg"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>
           {error && <p className="text-center text-destructive">{error}</p>}


          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary/60" />
              1K+ Research Papers
            </span>
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary/60" />
              Real-time Results
            </span>
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary/60" />
              AI-Powered
            </span>
          </div>
        </div>
      </div>

      {/* Information Sections */}
      <div className="w-full max-w-7xl mx-auto px-4 ">
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="bg-card/50 backdrop-blur-lg border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl group">
            <CardHeader className="space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden group-hover:scale-110 transition-transform duration-300">
                <BookOpenText size={"38px"}/>
              </div>
              <CardTitle className="text-2xl font-semibold">Why This Project?</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base leading-relaxed text-muted-foreground/90">
                Bridging the gap between researchers and knowledge. We've built an intelligent platform 
                that makes navigating vast academic databases intuitive and efficient, empowering 
                scholars, students, and professionals to accelerate their research journey.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-lg border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl group">
            <CardHeader className="space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden group-hover:scale-110 transition-transform duration-300">
                <FileText size={"38px"}/>
              </div>
              <CardTitle className="text-2xl font-semibold">How To Use</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base leading-relaxed text-muted-foreground/90">
                Enter your research query using natural language or keywords. Our advanced algorithms 
                analyze millions of academic papers instantly, delivering relevant results with 
                citation metrics, abstracts, and full-text access when available.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-lg border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl group">
            <CardHeader className="space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden group-hover:scale-110 transition-transform duration-300">
                <Play className="w-10 h-10 text-primary" />
              </div>
              <CardTitle className="text-2xl font-semibold">Quick Demo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-base text-muted-foreground/90">
                See the platform in action:
              </CardDescription>
              <div className="aspect-video bg-muted/50 rounded-xl overflow-hidden border border-border/50 shadow-inner">
                <img 
                  src={demoPreview} 
                  alt="Platform demonstration" 
                  className="w-full h-full object-cover"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground text-sm">
            © 2025 Research Search. Empowering knowledge discovery.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;