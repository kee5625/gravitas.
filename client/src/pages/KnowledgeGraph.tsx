import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import DynamicGraph from "@/components/DynamicGraph";
import type { 
  Publication, 
  KGNode, 
  SummaryResponse, 
  KGNodeResponse
} from "@/types";

const KnowledgeGraph = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // --- Get initial data from location state ---
  const initialPublication: Publication | null = location.state?.publication || null;
  const searchQuery: string | null = location.state?.query || null; // Get the original search query

  // --- State Management for Dynamic Updates ---
  const [currentPublication, setCurrentPublication] = useState<Publication | null>(initialPublication);
  const [summaryData, setSummaryData] = useState<string | null>(null);
  const [childNodes, setChildNodes] = useState<KGNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPath, setUserPath] = useState<Publication[]>(initialPublication ? [initialPublication] : []);

  // --- API Fetching Logic ---
  useEffect(() => {
    if (!currentPublication || !searchQuery) {
      setIsLoading(false);
      setError("No publication data or search query found. Please return to the previous page.");
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // The summary call is now a POST request sending both the query and the current publication's ID.
        const [summaryRes, kgNodeRes] = await Promise.all([
          fetch(`https://gravitas-nine.vercel.app/summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: searchQuery,
              id: currentPublication.pmc_id
            }),
          }),
          fetch(`https://gravitas-nine.vercel.app/kg_node/${currentPublication.pmc_id}`)
        ]);
        console.log(summaryRes);
        console.log(kgNodeRes);

        if (!summaryRes.ok || !kgNodeRes.ok) {
          throw new Error('Failed to fetch data from the server.');
        }

        const summaryData: SummaryResponse = await summaryRes.json();
        setSummaryData(summaryData.summary);

        const rawKgNodes: KGNodeResponse = await kgNodeRes.json();
        console.log(rawKgNodes);

        // --- PARSE KG_NODE RESPONSE ---
        const nodesArray = rawKgNodes.data;

        // 2. Check if the 'data' property holds the expected array structure
        if (Array.isArray(nodesArray)) {
          const rootPmcId = currentPublication.pmc_id;

          const formattedChildNodes = nodesArray
            .map((node): KGNode | null => {
              // Check if the node is an array of length 2 and the second element is an object
              if (Array.isArray(node) && node.length > 1 && typeof node[1] === 'object' && node[1] !== null) {
                const meta = node[1];

                // Use pmc_id or osd_id and ensure it's a string
                const id = String(meta.pmc_id || meta.osd_id);

                return {
                  pmc_id: id,
                  title: meta.title
                };
              }
              // Return null for invalid formats
              return null;
            })
            .filter(node => node !== null) // Remove invalid entries
            // Filter out the root node itself and ensure ID/Title exist
            .filter(node =>
              node.pmc_id &&
              node.title &&
              node.pmc_id !== rootPmcId
            );

          setChildNodes(formattedChildNodes as KGNode[]);

        } else {
          // This will now only throw if the 'data' key is missing or is not an array
          throw new Error('Unexpected kg_node API response format: "data" property is missing or is not an array.');
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentPublication, searchQuery]); // Re-run effect when the current publication changes

  // --- Node Click Handler for Interactivity ---
  const handleNodeClick = (nodeId: string) => {
    // Find the full node data from the childNodes state
    const clickedNode = childNodes.find(node => node.pmc_id === nodeId);
    // Prevent re-fetching if the same node is clicked
    if (clickedNode && clickedNode.pmc_id !== currentPublication?.pmc_id) {
      // Create a partial publication object for the new node
      const newPublication: Publication = {
        pmc_id: clickedNode.pmc_id,
        title: clickedNode.title,
        authors: '', journal: '', link: '', year: 0, abstract: '', categories: [] // Blank data to be filled by fetch
      };
      // Set it as the new current publication, which triggers the useEffect
      setCurrentPublication(newPublication);
      // Add the new publication to the user's exploration path
      setUserPath(prevPath => [...prevPath, newPublication]);
    }
  };

  const rootNodeForGraph = currentPublication ? { id: currentPublication.pmc_id, label: currentPublication.title } : null;

  return (
    <div className="min-h-screen w-full p-6">
      {/* Header */}
      <div className="max-w-[1800px] mx-auto mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 hover:bg-card/50">
          <ArrowLeft className="h-4 w-4" /> Back to Previous Page
        </Button>
      </div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto grid grid-cols-[13%_57%_25%] gap-6 h-[calc(100vh-140px)]">

        {/* Left Column - User Path */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Exploration Path</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {userPath.map((p, index) => (
              <Badge key={`${p.pmc_id}-${index}`} variant={index === userPath.length - 1 ? "default" : "secondary"} className="whitespace-normal text-left h-auto">
                {p.title}
              </Badge>
            ))}
          </CardContent>
        </Card>

        {/* Center Column - Knowledge Graph */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="h-[80%] pt-6">
            {isLoading && <div className="w-full h-full bg-muted/20 rounded-lg flex items-center justify-center"><p>Loading Graph...</p></div>}
            {error && <div className="w-full h-full bg-destructive/20 rounded-lg flex items-center justify-center p-4"><p className="text-destructive-foreground text-center">{error}</p></div>}
            {!isLoading && !error && rootNodeForGraph && (
              <DynamicGraph
                rootNode={rootNodeForGraph}
                childNodes={childNodes.map(node => ({ id: node.pmc_id, label: node.title.slice(0, 55) + "..." }))}
                onNodeClick={handleNodeClick} // Updated to use the new handler
              />
            )}
          </CardContent>
        </Card>

        {/* Right Column - Summary Panel */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Publication Summary</CardTitle>
            <CardDescription>
              Details for: <span className="font-semibold text-primary">{currentPublication?.title || "..."}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-100px)]">
            <ScrollArea className="h-full pr-4">
              <p className="text-sm">{summaryData}</p>

            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KnowledgeGraph;