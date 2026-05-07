import os
from google import genai
from google.genai import types

def test():
    PROJECT_ID = os.getenv("GCP_PROJECT_ID", "atomic-box-494614-r5")
    LOCATION = os.getenv("GCP_LOCATION", "us-central1")
    client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)
    
    response = client.models.generate_content(
        model="gemini-2.5-pro",
        contents="what is the weather in tokyo right now?",
        config=types.GenerateContentConfig(
            tools=[{"google_search": {}}],
            temperature=0.0
        )
    )
    print(response.text)

test()
