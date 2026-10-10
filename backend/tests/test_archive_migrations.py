import os
import sqlite3
import subprocess
import sys
from pathlib import Path


def test_upgrade_downgrade_preserves_current_tables(tmp_path):
    backend = Path(__file__).resolve().parents[1]
    db = tmp_path / "migration.db"
    env = {**os.environ, "DATABASE_URL": "sqlite+aiosqlite:///" + db.as_posix()}

    def migrate(*args):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", *args], cwd=backend, env=env,
            capture_output=True, text=True, timeout=60,
        )
        assert result.returncode == 0, result.stdout + result.stderr

    def tables(connection):
        return {row[0] for row in connection.execute("select name from sqlite_master where type='table'")}

    legacy = {"topics", "debate_sessions", "debate_turns", "review_items", "reflection_logs", "user_profiles"}
    migrate("upgrade", "74d153f6ae20")
    with sqlite3.connect(db) as connection:
        before = {table: connection.execute(f'PRAGMA table_info("{table}")').fetchall() for table in legacy}
        connection.execute(
            "insert into users (id,email,username,hashed_password,is_active,is_superuser) "
            "values (1,'migration@example.com','migration','hash',1,0)"
        )
        connection.execute(
            "insert into archive_progress (user_id,case_code,clues_solved,reflection) "
            "values (1,'seek_truth',1,'preserve this note')"
        )
    migrate("upgrade", "head")
    with sqlite3.connect(db) as connection:
        assert not tables(connection) & legacy
        retained = {
            "users", "refresh_tokens", "archive_progress", "knowledge_points",
            "archive_activities", "archive_agent_turns",
            "chat_sessions", "chat_messages",
        }
        assert retained <= tables(connection)
        assert connection.execute("select reflection from archive_progress").fetchone() == ("preserve this note",)
    migrate("downgrade", "74d153f6ae20")
    with sqlite3.connect(db) as connection:
        assert legacy <= tables(connection)
        assert "archive_activities" not in tables(connection)
        assert "archive_agent_turns" not in tables(connection)
        after = {table: connection.execute(f'PRAGMA table_info("{table}")').fetchall() for table in legacy}
        assert before == after
        assert connection.execute("select reflection from archive_progress").fetchone() == ("preserve this note",)
    migrate("upgrade", "head")
    migrate("check")
