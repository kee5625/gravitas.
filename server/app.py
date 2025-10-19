import os
from flask import Flask, jsonify, request

from utils import *

from pydantic import BaseModel, Field

from dotenv import load_dotenv
from groq import Groq
import instructor

from pymongo import MongoClient

# Initialize the Flask application
app = Flask(__name__)
load_dotenv()
# Enable Cross-Origin Resource Sharing (CORS)
# This is crucial to allow your React frontend (running on a different port)
# to communicate with this Flask backend.

class GeneratedSummary(BaseModel):
    summary: str = Field(
        ...,
        description="Five sentences describing the entire information"
    )

# create mongo client (reads MONGODB_URI from env; fallback to localhost)
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

# --- API Endpoints ---

@app.route('/search', methods=['POST'])
def search():
    """
    Endpoint to handle the initial user search query from the homepage.
    It takes a search term and returns the initial knowledge graph data
    and a list of related publication IDs.
    """
    data = request.get_json() 
    query = data.get('query')
    
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400
    
    embeddings = generate_embeddings(query=query)

    mongo_client = MongoClient(MONGODB_URI)
    db_name = os.getenv("MONGO_DB_NAME", "gravitas")
    mongo_db = mongo_client[db_name]

    # Choose Mongo collection
    research_papers = mongo_db.get_collection("space_biology_research_papers")
    pipeline = [
        {
            "$vectorSearch": {
                "index": "embedding-search",      # name of your vector index
                "path": "embedding",          # field where your vector is stored
                "queryVector": embeddings,  # input vector
                "numCandidates": 100,
                "limit": 25
            }
        },
        {
            "$project": {
                "_id": 1,
                "authors": 1,
                "document": 1,
                "link": 1,
                "osdr_id": 1,
                "title": 1,
                "score": { "$meta": "vectorSearchScore" }
            }
        }
    ]
    response = list(research_papers.aggregate(pipeline))

    titles = [str(doc["title"]) for doc in response]

    classification_coln = mongo_db.get_collection("space_research_classification")
    classifications = list(classification_coln.find({
        "title": {"$in": titles}
    }))

    classification_map = {str(item["title"]): item["classification"] for item in classifications}

    data = []

    for doc in response:
        doc_id = str(doc["title"])
        classification = classification_map.get(doc_id, {})
        data.append((doc, classification))

    return jsonify(data)


@app.route('/kg_node/<doc_id>', methods=['GET'])
def get_node_details(doc_id: str):
    """
    Endpoint to fetch detailed information for a specific node
    when a user clicks on it in the knowledge graph.
    """

    if not doc_id:
        return jsonify({"error": "Context for summary is required"}), 400
    

    if doc_id[:3] == "PMC":
        col = "space_biology_research_papers"
    else:
        col = "osdr_experiments"

    mongo_client = MongoClient(MONGODB_URI)
    db_name = os.getenv("MONGO_DB_NAME", "gravitas")
    mongo_db = mongo_client[db_name]

    # Choose Mongo collection
    collection = mongo_db.get_collection(col)

    response = collection.find_one({"_id": str(doc_id)})
    query = str(response["document"]) #type: ignore
    query_embedding = generate_embeddings(query=query)

    collection_rp = mongo_client = MongoClient(MONGODB_URI)
    db_name = os.getenv("MONGO_DB_NAME", "gravitas")
    mongo_db = mongo_client[db_name]

    pipeline = [
        {
            "$vectorSearch": {
                "index": "embedding-search",      # name of your vector index
                "path": "embedding",          # field where your vector is stored
                "queryVector": query_embedding,  # input vector
                "numCandidates": 100,
                "limit": 8
            }
        },
        {
            "$project": {
                "_id": 1,
                "authors": 1,
                "document": 1,
                "title": 1,
                "score": { "$meta": "vectorSearchScore" }
            }
        }
    ]

    # Choose Mongo collection
    research_papers = mongo_db.get_collection("space_biology_research_papers")
    response_rp = list(research_papers.aggregate(pipeline))

    osdr_exp = mongo_db.get_collection("osdr_experiments")
    response_oe = list(osdr_exp.aggregate(pipeline))

    data = []
    data.extend(response_rp)
    data.extend(response_oe)

    return jsonify({"data": data})


@app.route('/summary', methods=['POST'])
def get_summary():
    """
    Endpoint to generate a summary based on a selected node or user path.
    This would be the place to call a language model (LLM).
    """

    data = request.get_json()
    doc_id = str(data.get("id"))
    query = data.get("query")

    if not doc_id or not query:
        return jsonify({"error": "Context for summary is required"}), 400
    
    if doc_id[:3] == "PMC":
        col = "space_biology_research_papers"
    else:
        col = "osdr_experiments"

    mongo_client = MongoClient(MONGODB_URI)
    db_name = os.getenv("MONGO_DB_NAME", "gravitas")
    mongo_db = mongo_client[db_name]

    collection = mongo_db.get_collection(col)
    response = collection.find_one({"_id": str(doc_id)})
    
    if not response:
        return jsonify({"error": "Document not found"}), 404
    
    api_key = os.getenv("GROQ_API_KEY")
    client = Groq(api_key=api_key)
    client = instructor.from_groq(client, mode=instructor.Mode.JSON)

    prompt: str = """
    Role and Goal: You are an expert academic research analyst. Your primary goal is to synthesize and summarize a research paper's core contribution based on its provided title, abstract, and publication date.

    Structure & Content Requirements:

    1.  Core Contribution : State the single most important finding or argument of the paper.
    2.  Methodology/Approach : Briefly describe the primary method, model, or approach used to conduct the research.
    3.  Key Findings : List the most significant results or conclusions.
    4.  Significance and Context : Explain why this paper is important to its field and how the publication date might offer historical context.

    Tone and Style: The summary must be objective, formal, and strictly academic. Do not use conversational language or qualifiers unless absolutely necessary. 

    The summary should be 5 sentences in length.

    Input Data:
    """

    result = client.chat.completions.create(
        model='llama-3.1-8b-instant',  # currently working - llama-3.3-70b-versatile, llama3-8b-8192
        messages=[
            {
                "role": "user",
                "content": prompt + str(response["document"]) + "\n\n Query: query" # type:ignore
            }
        ],
        temperature=0.2,
        max_retries=3,
        response_model=GeneratedSummary
    ) # type:ignore

    summary = result.model_dump()['summary']

    return jsonify({"summary": summary})

@app.route('/status', methods=['GET'])
def status():
    """
    A simple status check endpoint to confirm the API is running.
    """
    return jsonify({"status": "API is running"})


if __name__ == '__main__':
    app.run(debug=True, port=5000)