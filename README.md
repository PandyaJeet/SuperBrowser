# SuperBrowser

Backend ::
cd /workspaces/SuperBrowser/backend
pip install -r requirements.txt  # only needed once
uvicorn main:app --reload --host 0.0.0.0 --port 8000

--Kil port :: lsof -ti:8000

Frontend :: 
cd /workspaces/SuperBrowser/frontend
npm install  # only needed once
npm run dev -- --host 0.0.0.0