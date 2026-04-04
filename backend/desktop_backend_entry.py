import argparse

import uvicorn

from main import app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SuperBrowser backend launcher")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
