from unittest.mock import MagicMock

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

from scrapers._playwright_utils import goto_and_wait


def test_goto_and_wait_tolerates_networkidle_timeout_after_navigating():
    page = MagicMock()
    page.wait_for_load_state.side_effect = PlaywrightTimeoutError("timed out")

    goto_and_wait(page, "https://example.com", timeout=1000)

    page.goto.assert_called_once_with("https://example.com", wait_until="domcontentloaded", timeout=1000)


def test_goto_and_wait_does_not_swallow_navigation_timeout():
    page = MagicMock()
    page.goto.side_effect = PlaywrightTimeoutError("timed out")

    try:
        goto_and_wait(page, "https://example.com", timeout=1000)
        assert False, "expected PlaywrightTimeoutError to propagate"
    except PlaywrightTimeoutError:
        pass
