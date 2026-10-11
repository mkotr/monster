from playwright.sync_api import TimeoutError as PlaywrightTimeoutError


def goto_and_wait(page, url, timeout):
    page.goto(url, wait_until="domcontentloaded", timeout=timeout)
    try:
        page.wait_for_load_state("networkidle", timeout=timeout)
    except PlaywrightTimeoutError:
        pass
