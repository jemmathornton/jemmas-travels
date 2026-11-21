"""Run the travel site's tests. Nothing here changes her real files: every test works on a throwaway copy.

    python -X utf8 tests/run_tests.py            unit tests, then the page tests in headless Edge
    python -X utf8 tests/run_tests.py unit       unit tests only
    python -X utf8 tests/run_tests.py e2e        page tests only
    python -X utf8 tests/run_tests.py e2e -k map only tests whose name has "map"

unit/  the data check, the build and the map shapes, in Python
e2e/   the site itself in headless Edge (Playwright borrowed from Sim World): every page at four widths, links,
       maps, menu, posts and photo markers, figures on a made-up set of trips with known answers
"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def main():
    args = sys.argv[1:]
    which = [a for a in args if a in ("unit", "e2e")] or ["unit", "e2e"]
    pattern = args[args.index("-k") + 1] if "-k" in args else None
    if pattern:
        os.environ["TRAVELS_TEST_FILTER"] = pattern
    loader = unittest.TestLoader()
    if pattern:
        loader.testNamePatterns = [f"*{pattern}*"]
    suite = unittest.TestSuite()
    for w in which:
        suite.addTests(loader.discover(os.path.join(HERE, w), top_level_dir=os.path.join(HERE, w)))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)


if __name__ == "__main__":
    main()
