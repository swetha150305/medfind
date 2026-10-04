import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_endpoint(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, method=method)
    
    if data:
        req.data = json.dumps(data).encode("utf-8")
        
    for k, v in headers.items():
        req.add_header(k, v)
        
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode("utf-8")
            print(f"PASS: {method} {path} - Status: {response.status}")
            return json.loads(res_data)
    except Exception as e:
        print(f"FAIL: {method} {path} - Error: {str(e)}")
        return None

def verify_all():
    print("Starting MedFind API Verification...")
    print("-" * 50)
    
    # 1. Base URL
    test_endpoint("/")
    
    # 2. Stats
    test_endpoint("/api/dashboard/statistics")
    
    # 3. Search medicine
    search_res = test_endpoint("/api/medicines/search?q=Paracetamol")
    
    # 4. Medicine Details
    if search_res and search_res.get("results"):
        med_id = search_res["results"][0]["id"]
        test_endpoint(f"/api/medicines/{med_id}")
        
        # 5. Nearby pharmacies
        test_endpoint(f"/api/pharmacies/nearby?medicine_id={med_id}&latitude=9.9252&longitude=78.1198")
    
    # 9. Search History
    test_endpoint("/api/search", method="POST", data={
        "medicine_name": "Paracetamol 650",
        "session_id": "verify_script"
    })
    
    test_endpoint("/api/search/history")
    
    print("-" * 50)
    print("Verification completed.")

if __name__ == "__main__":
    # Give a short delay to let the server start if run programmatically
    time.sleep(1)
    verify_all()
