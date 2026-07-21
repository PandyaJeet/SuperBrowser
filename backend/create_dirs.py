import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
os.makedirs(BASE_DIR / 'database', exist_ok=True)
os.makedirs(BASE_DIR / 'data', exist_ok=True)
print("Directories created successfully")
