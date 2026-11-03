import os
from pathlib import Path
import sys
from threading import Event
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
import app as application
from services import indexer, rag


class StartupTests(unittest.TestCase):
    def test_api_is_available_while_initial_indexing_is_blocked(self):
        started = Event()

        def slow_indexer(stop_event):
            started.set()
            self.assertTrue(stop_event.wait(3), "Shutdown must signal indexing to stop")

        with patch.dict(os.environ, {"CONTEXT_BACKGROUND_SERVICES": "1"}), \
             patch.object(application, "init_db"), \
             patch.object(application, "close_pool") as close_pool, \
             patch.object(application, "run_indexer", side_effect=slow_indexer):
            with TestClient(application.app) as client:
                self.assertTrue(started.wait(1))
                response = client.get("/api/health")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), {"ok": True, "indexing": "running"})
                close_pool.assert_not_called()
            close_pool.assert_called_once()

    def test_indexing_failure_does_not_take_down_api(self):
        failed = Event()
        with patch.dict(os.environ, {"CONTEXT_BACKGROUND_SERVICES": "1"}), \
             patch.object(application, "init_db"), \
             patch.object(application, "close_pool"), \
             patch.object(application, "run_indexer", side_effect=ValueError("fixture")), \
             patch.object(application.logging.getLogger("app"), "error", side_effect=lambda *args: failed.set()):
            with TestClient(application.app) as client:
                self.assertTrue(failed.wait(1))
                self.assertEqual(client.get("/api/health").json(), {"ok": True, "indexing": "failed"})

    def test_successful_worker_stops_watchers_and_tracker_before_pool(self):
        ready = Event()
        tracker, observer, connection = MagicMock(), MagicMock(), MagicMock()
        connection.__enter__.return_value.execute.return_value.fetchone.return_value = [0]

        def watchers():
            ready.set()
            return observer

        with patch.dict(os.environ, {"CONTEXT_BACKGROUND_SERVICES": "1"}), \
             patch.object(application, "init_db"), \
             patch.object(application, "close_pool") as close_pool, \
             patch.object(application, "get_conn", return_value=connection), \
             patch.object(application, "run_indexer"), \
             patch.object(rag, "index_everything") as build_search, \
             patch.object(application, "detect_patterns"), \
             patch.object(application, "ActivityTracker", return_value=tracker), \
             patch.object(application, "start_watchers", side_effect=watchers):
            with TestClient(application.app):
                self.assertTrue(ready.wait(1))
                close_pool.assert_not_called()
            build_search.assert_called_once()
            tracker.start.assert_called_once()
            tracker.stop.assert_called_once()
            tracker.join.assert_called_once()
            observer.stop.assert_called_once()
            observer.join.assert_called_once()
            close_pool.assert_called_once()

    def test_background_services_can_be_disabled_for_api_only_runs(self):
        with patch.dict(os.environ, {"CONTEXT_BACKGROUND_SERVICES": "0"}), \
             patch.object(application, "init_db"), \
             patch.object(application, "close_pool"), \
             patch.object(application, "run_indexer") as run_indexer:
            with TestClient(application.app) as client:
                self.assertEqual(client.get("/api/health").json()["indexing"], "disabled")
            run_indexer.assert_not_called()

    def test_password_protected_pdf_is_closed_without_extracting_text(self):
        document = MagicMock()
        document.__enter__.return_value.needs_pass = True
        with patch.object(indexer.fitz, "open", return_value=document):
            self.assertEqual(indexer.extract_text("fixture.pdf"), "")
        document.__exit__.assert_called_once()
        document.__enter__.return_value.get_text.assert_not_called()

    def test_cancelled_folder_scan_does_not_index_more_files(self):
        stop = Event()
        stop.set()
        with patch.object(indexer.os.path, "isdir", return_value=True), \
             patch.object(indexer.os, "listdir", return_value=["fixture.txt"]), \
             patch.object(indexer, "index_file") as index_file:
            self.assertEqual(indexer.index_folder("fixture", stop_event=stop), 0)
            index_file.assert_not_called()

    def test_cancelled_search_rebuild_does_not_start_stages(self):
        stop = Event()
        stop.set()
        with patch.object(rag, "index_all_files") as index_files:
            rag.index_everything(stop_event=stop)
            index_files.assert_not_called()


if __name__ == "__main__":
    unittest.main()
