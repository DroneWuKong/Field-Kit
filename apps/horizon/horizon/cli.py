import argparse
import json
from pathlib import Path

from .engine import analyze
from .models import AnalysisRequest, Project
from .storage import Store


def main():
    parser = argparse.ArgumentParser(prog="horizon")
    parser.add_argument("--data", default="data", help="Local data directory")
    sub = parser.add_subparsers(dest="command", required=True)
    serve = sub.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8765)
    serve.add_argument("--frontend", default="frontend/dist")
    run = sub.add_parser("analyze")
    run.add_argument("project", type=Path)
    run.add_argument("--output", type=Path, required=True)
    run.add_argument("--kind", choices=["route", "altitude"], default="route")
    sample = sub.add_parser("demo")
    sample.add_argument("--output", type=Path)
    schema = sub.add_parser("schema")
    schema.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.command == "serve":
        import uvicorn

        from .api import create_app

        uvicorn.run(create_app(args.data, args.frontend), host=args.host, port=args.port)
    elif args.command == "schema":
        value = json.dumps(Project.model_json_schema(), indent=2)
        args.output.write_text(value) if args.output else print(value)
    else:
        store = Store(args.data)
        if args.command == "demo":
            from .examples import create_demo

            p = create_demo(store)
            text = p.model_dump_json(indent=2)
            args.output.write_text(text) if args.output else print(text)
        else:
            p = Project.model_validate_json(args.project.read_text())
            result = analyze(store, AnalysisRequest(project=p, kind=args.kind))
            args.output.write_text(json.dumps(result, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
