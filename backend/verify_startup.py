from fastapi.testclient import TestClient
from app.main import app

def check():
    client = TestClient(app)
    res = client.get("/")
    print(f"Root endpoint: {res.status_code} -> {res.json()}")
    assert res.status_code == 200
    docs_res = client.get("/docs")
    print(f"Swagger docs endpoint: {docs_res.status_code}")
    assert docs_res.status_code == 200
    print("Backend startup verification successful!")

if __name__ == "__main__":
    check()

