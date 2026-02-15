"""
Utility functions for the Performance Testing API
"""

import json


def _scenario_to_k6_script(compiled_scenario: dict, base_url: str = "") -> str:
    """Generate a k6 script from a compiled scenario (for export / CI)."""
    config = compiled_scenario.get("config", {})
    steps = compiled_scenario.get("steps", [])
    vus = config.get("virtual_users", 50)
    duration = config.get("duration_seconds", 60)
    lines = [
        "import http from 'k6/http';",
        "import { check } from 'k6';",
        "",
        "export const options = {",
        f"  vus: {vus},",
        f"  duration: '{duration}s',",
        "};",
        "",
        "export default function () {",
        f"  const baseUrl = __ENV.BASE_URL || '{base_url or 'https://example.com'}';\n",
    ]
    for step in steps:
        if step.get("type") == "http" and step.get("url"):
            method = (step.get("method") or "GET").upper()
            url = step.get("url", "")
            if url.startswith("http"):
                url_js = json.dumps(url)
            else:
                path = url if url.startswith("/") else "/" + url.lstrip("/")
                url_js = "baseUrl + " + json.dumps(path)
            if method == "GET":
                lines.append(f"  const res = http.get({url_js});")
            elif method == "POST":
                body = step.get("body") or "{}"
                if isinstance(body, dict):
                    body = json.dumps(body)
                lines.append(f"  const res = http.post({url_js}, {json.dumps(body)});")
            else:
                lines.append(f"  const res = http.request('{method}', {url_js});")
            lines.append("  check(res, { 'status is 2xx': (r) => r.status >= 200 && r.status < 300 });")
            lines.append("")
    lines.append("}")
    return "\n".join(lines)
