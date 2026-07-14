import os
import requests
from dotenv import load_dotenv

# Try to load .env from parent directory
load_dotenv(dotenv_path='../.env')
api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    print("Error: GROQ_API_KEY not found in .env")
    exit(1)

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# Switched to llama-3.1-8b-instant
payload = {
    "model": "llama-3.1-8b-instant", 
    "messages": [
        {"role": "user", "content": "Hello! Reply with exactly 'Groq is operational.'"}
    ]
}

url = "https://api.groq.com/openai/v1/chat/completions"

print(f"Testing Groq API with key starting with {api_key[:8]}...")
try:
    response = requests.post(url, headers=headers, json=payload, timeout=15)
    print("Status Code:", response.status_code)
    if response.status_code == 200:
        print("Response:", response.json()['choices'][0]['message']['content'])
        print("SUCCESS: Groq is working perfectly.")
    else:
        print("FAILED. Response details:")
        print(response.text)
except Exception as e:
    print("Exception occurred while trying to connect to Groq:")
    print(str(e))
