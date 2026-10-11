from concurrent.futures import ThreadPoolExecutor

from flask import Flask, jsonify, send_from_directory

from scrapers import woolworths, coles

app = Flask(__name__, static_folder="static", static_url_path="")


def _run_scraper(name, fn):
    try:
        return name, {"status": "ok", "products": fn()}
    except Exception as exc:
        return name, {"status": "error", "message": str(exc)}


@app.get("/api/prices")
def get_prices():
    scrapers = {
        "woolworths": woolworths.search_white_monster,
        "coles": coles.search_white_monster,
    }
    results = {}
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(_run_scraper, name, fn) for name, fn in scrapers.items()]
        for future in futures:
            name, result = future.result()
            results[name] = result
    return jsonify(results)


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(debug=True)
