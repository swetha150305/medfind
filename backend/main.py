import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db import init_db
from backend.routes.api import router

app = FastAPI(
    title="MedFind API",
    description="Backend API for MedFind: A Geolocation-Based Medicine Availability, Price Comparison, and Salt-Equivalent Substitution System",
    version="1.0.0"
)

# Configure CORS to allow connection from the React frontend (usually port 5173 or 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For prototyping, allow all. In production, restrict this.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)

# Initialize database on startup
@app.on_event("startup")
def on_startup():
    init_db()
    print("Database initialized on startup.")

from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
import os

# Custom 404 handler to support React Single Page App (SPA) routing on refresh
@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request, exc):
    if exc.status_code == 404 and not request.url.path.startswith("/api"):
        index_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist", "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
    return HTMLResponse(content=str(exc.detail), status_code=exc.status_code)

@app.get("/download-app")
def download_app():
    # Paths where compiled debug or release APKs are placed
    _root = os.path.dirname(os.path.dirname(__file__))
    paths_to_check = [
        os.path.join(_root, "frontend", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
        os.path.join(_root, "frontend", "android", "app", "build", "outputs", "apk", "release", "app-release-unsigned.apk"),
        os.path.join(_root, "mobile", "build", "app", "outputs", "flutter-apk", "app-release.apk"),
    ]
    for p in paths_to_check:
        if os.path.exists(p):
            return FileResponse(p, media_type="application/vnd.android.package-archive", filename="MedFind.apk")
            
    return HTMLResponse(
        content="""
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MedFind App Download</title>
        </head>
        <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px 20px; background-color: #f8fafc; margin: 0;">
            <div style="max-width: 450px; margin: 60px auto 0 auto; background: white; padding: 40px 30px; border-radius: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <div style="font-size: 56px; margin-bottom: 24px;">📱</div>
                <h2 style="color: #1e293b; margin: 0 0 12px 0; font-weight: 800; font-size: 20px;">MedFind Mobile App Build Required</h2>
                <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin-bottom: 28px; text-align: left;">
                    To enable downloading from this page, please compile the app inside <b>Android Studio</b> first:
                    <ol style="color: #64748b; font-size: 13px; line-height: 1.6; padding-left: 20px; text-align: left; margin-top: 10px;">
                        <li style="margin-bottom: 6px;">Open Android Studio on your computer.</li>
                        <li style="margin-bottom: 6px;">Load the project at: <br><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-size: 11px;">medfind/frontend/android</code></li>
                        <li style="margin-bottom: 6px;">Click <b>Build &rarr; Build Bundle(s) / APK(s) &rarr; Build APK(s)</b>.</li>
                        <li>Once compilation completes, click the refresh button below!</li>
                    </ol>
                </p>
                <button onclick="window.location.reload()" style="background: #0d9488; color: white; border: none; padding: 12px 28px; border-radius: 14px; font-weight: bold; cursor: pointer; transition: background 0.2s; font-size: 13px; width: 100%;">
                    Refresh &amp; Check APK
                </button>
            </div>
        </body>
        </html>
        """
    )

# Mount the static React web bundle at "/"
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

if __name__ == "__main__":
    # Runs the server on localhost (127.0.0.1:8000)
    uvicorn.run("backend.main:app", host="127.0.0.1", port=int(os.environ.get("PORT", 8000)), reload=True)
