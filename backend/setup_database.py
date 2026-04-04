import os
from pathlib import Path

# Get backend directory
backend_dir = Path(__file__).parent

# Create database directory
db_dir = backend_dir / "database"
db_dir.mkdir(exist_ok=True)

# Create data directory  
data_dir = backend_dir / "data"
data_dir.mkdir(exist_ok=True)

print(f"✓ Created: {db_dir}")
print(f"✓ Created: {data_dir}")

# Create __init__.py for database module
init_file = db_dir / "__init__.py"
init_file.write_text('from .context_db import ContextDatabase, get_context_db\n\n__all__ = ["ContextDatabase", "get_context_db"]\n')
print(f"✓ Created: {init_file}")

# Create context_db.py
context_db_content = '''"""
Context Database Manager - Handles persistent storage of browsing history and context
"""
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional


class ContextDatabase:
    def __init__(self, db_path: str = None):
        """Initialize database connection"""
        if db_path is None:
            # Default to backend/data directory
            base_dir = Path(__file__).parent.parent / "data"
            base_dir.mkdir(exist_ok=True)
            db_path = str(base_dir / "browsing_context.db")
        
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()
    
    def _create_tables(self):
        """Create database schema"""
        cursor = self.conn.cursor()
        
        # Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                end_time DATETIME,
                tab_count INTEGER DEFAULT 0,
                total_queries INTEGER DEFAULT 0
            )
        """)
        
        # Queries table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS queries (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                tab_id TEXT,
                query TEXT NOT NULL,
                mode TEXT DEFAULT 'seo',
                persona TEXT DEFAULT 'default',
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES sessions(id)
            )
        """)
        
        # Search results table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS search_results (
                id TEXT PRIMARY KEY,
                query_id TEXT,
                url TEXT,
                title TEXT,
                snippet TEXT,
                content TEXT,
                rank INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(query_id) REFERENCES queries(id)
            )
        """)
        
        # Visited pages table (clicked results with full content)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS visited_pages (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                query_id TEXT,
                url TEXT,
                title TEXT,
                content TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES sessions(id),
                FOREIGN KEY(query_id) REFERENCES queries(id)
            )
        """)
        
        # Context snapshots (for AI queries with context)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS context_snapshots (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                tab_id TEXT,
                query_id TEXT,
                context_data TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES sessions(id),
                FOREIGN KEY(query_id) REFERENCES queries(id)
            )
        """)
        
        # Create indexes for faster queries
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_queries_session ON queries(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_results_query ON search_results(query_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_visited_session ON visited_pages(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_context_session ON context_snapshots(session_id)")
        
        self.conn.commit()
    
    def create_session(self, session_id: str) -> str:
        """Create a new browsing session"""
        cursor = self.conn.cursor()
        cursor.execute(
            "INSERT INTO sessions (id, start_time) VALUES (?, ?)",
            (session_id, datetime.now().isoformat())
        )
        self.conn.commit()
        return session_id
    
    def end_session(self, session_id: str):
        """Mark session as ended"""
        cursor = self.conn.cursor()
        cursor.execute(
            "UPDATE sessions SET end_time = ? WHERE id = ?",
            (datetime.now().isoformat(), session_id)
        )
        self.conn.commit()
    
    def save_query(self, query_id: str, session_id: str, tab_id: str, 
                   query: str, mode: str, persona: str = "default") -> str:
        """Save a search query"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO queries (id, session_id, tab_id, query, mode, persona, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (query_id, session_id, tab_id, query, mode, persona, datetime.now().isoformat()))
        
        # Update session query count
        cursor.execute(
            "UPDATE sessions SET total_queries = total_queries + 1 WHERE id = ?",
            (session_id,)
        )
        self.conn.commit()
        return query_id
    
    def save_search_results(self, query_id: str, results: List[Dict]):
        """Save search results for a query"""
        cursor = self.conn.cursor()
        for idx, result in enumerate(results):
            cursor.execute("""
                INSERT INTO search_results 
                (id, query_id, url, title, snippet, content, rank, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"{query_id}_result_{idx}",
                query_id,
                result.get("url", ""),
                result.get("title", ""),
                result.get("snippet", ""),
                result.get("content", ""),
                idx,
                datetime.now().isoformat()
            ))
        self.conn.commit()
    
    def save_visited_page(self, page_id: str, session_id: str, query_id: str,
                         url: str, title: str, content: str):
        """Save a visited page with full content"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO visited_pages (id, session_id, query_id, url, title, content, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (page_id, session_id, query_id, url, title, content, datetime.now().isoformat()))
        self.conn.commit()
    
    def save_context_snapshot(self, snapshot_id: str, session_id: str, 
                            tab_id: str, query_id: str, context_data: Dict):
        """Save a context snapshot (used when AI query is made)"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO context_snapshots (id, session_id, tab_id, query_id, context_data, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            snapshot_id, session_id, tab_id, query_id,
            json.dumps(context_data),
            datetime.now().isoformat()
        ))
        self.conn.commit()
    
    def get_session_context(self, session_id: str) -> Dict:
        """Retrieve full context for a session"""
        cursor = self.conn.cursor()
        
        # Get session info
        cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        session = cursor.fetchone()
        
        if not session:
            return None
        
        # Get all queries
        cursor.execute("""
            SELECT * FROM queries 
            WHERE session_id = ? 
            ORDER BY timestamp ASC
        """, (session_id,))
        queries = [dict(row) for row in cursor.fetchall()]
        
        # Get results for each query
        for query in queries:
            cursor.execute("""
                SELECT * FROM search_results 
                WHERE query_id = ? 
                ORDER BY rank ASC
            """, (query["id"],))
            query["results"] = [dict(row) for row in cursor.fetchall()]
        
        # Get visited pages
        cursor.execute("""
            SELECT * FROM visited_pages 
            WHERE session_id = ? 
            ORDER BY timestamp ASC
        """, (session_id,))
        visited_pages = [dict(row) for row in cursor.fetchall()]
        
        return {
            "session": dict(session),
            "queries": queries,
            "visited_pages": visited_pages
        }
    
    def get_tab_context(self, session_id: str, tab_id: str) -> Dict:
        """Get context for a specific tab"""
        cursor = self.conn.cursor()
        
        # Get queries for this tab
        cursor.execute("""
            SELECT * FROM queries 
            WHERE session_id = ? AND tab_id = ?
            ORDER BY timestamp ASC
        """, (session_id, tab_id))
        queries = [dict(row) for row in cursor.fetchall()]
        
        # Get results for each query
        for query in queries:
            cursor.execute("""
                SELECT * FROM search_results 
                WHERE query_id = ? 
                ORDER BY rank ASC
            """, (query["id"],))
            query["results"] = [dict(row) for row in cursor.fetchall()]
        
        return {
            "tab_id": tab_id,
            "queries": queries
        }
    
    def export_session(self, session_id: str, output_path: str):
        """Export session data to JSON file"""
        context = self.get_session_context(session_id)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(context, f, indent=2, ensure_ascii=False)
    
    def search_history(self, keyword: str, limit: int = 50) -> List[Dict]:
        """Search through browsing history"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT q.*, s.start_time as session_start
            FROM queries q
            JOIN sessions s ON q.session_id = s.id
            WHERE q.query LIKE ?
            ORDER BY q.timestamp DESC
            LIMIT ?
        """, (f"%{keyword}%", limit))
        return [dict(row) for row in cursor.fetchall()]
    
    def get_recent_sessions(self, limit: int = 10) -> List[Dict]:
        """Get recent sessions"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM sessions 
            ORDER BY start_time DESC 
            LIMIT ?
        """, (limit,))
        return [dict(row) for row in cursor.fetchall()]
    
    def close(self):
        """Close database connection"""
        self.conn.close()


# Global database instance
_db_instance: Optional[ContextDatabase] = None

def get_context_db() -> ContextDatabase:
    """Get or create global database instance"""
    global _db_instance
    if _db_instance is None:
        _db_instance = ContextDatabase()
    return _db_instance
'''

context_db_file = db_dir / "context_db.py"
context_db_file.write_text(context_db_content)
print(f"✓ Created: {context_db_file}")

print("\n✅ All database files created successfully!")
