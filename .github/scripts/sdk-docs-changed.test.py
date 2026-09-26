#!/usr/bin/env python3
"""Exercise website refresh decisions on SDK source histories, without deployment."""
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('sdk-docs-changed.sh').resolve()


class DocumentationRefreshTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git('init', '-q', '-b', 'main')
        self.git('config', 'user.email', 'docs-test@example.invalid')
        self.git('config', 'user.name', 'Docs test')
        self.write('docs/developer/page.mdx')
        self.base = self.commit()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.repo, text=True,
                                       stderr=subprocess.DEVNULL).strip()

    def write(self, path):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('content\n')

    def commit(self):
        self.git('add', '.')
        self.git('commit', '-q', '-m', 'docs: change')
        return self.git('rev-parse', 'HEAD')

    def assert_refresh(self, expected, before=None, after='HEAD'):
        result = subprocess.run(['bash', str(SCRIPT), str(self.repo),
                                 self.base if before is None else before, after],
                                capture_output=True, text=True)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(f'changed={str(expected).lower()}\n', result.stdout)

    def test_markdown_mdx_and_assets_refresh(self):
        for path in ('docs/developer/new.mdx', 'docs/developer/new.md',
                     'docs/developer/image.png', 'docs/developer/diagram.svg'):
            with self.subTest(path=path):
                self.git('reset', '--hard', self.base)
                self.write(path)
                self.commit()
                self.assert_refresh(True)

    def test_unrelated_changes_do_not_refresh(self):
        for path in ('README.md', 'docs/agents/article.md', 'sdk/Example.java'):
            self.write(path)
            self.commit()
            self.assert_refresh(False)

    def test_deletions_and_moves_out_of_public_docs_refresh(self):
        self.git('mv', 'docs/developer/page.mdx', 'page.mdx')
        self.commit()
        self.assert_refresh(True)
        self.git('reset', '--hard', self.base)
        self.git('rm', 'docs/developer/page.mdx')
        self.commit()
        self.assert_refresh(True)

    def test_unknown_base_refreshes(self):
        for before in ('', '0' * 40, 'a' * 40):
            self.assert_refresh(True, before=before)

    def test_exact_target_does_not_include_newer_changes(self):
        self.write('docs/developer/later.mdx')
        self.commit()
        self.assert_refresh(False, after=self.base)

    def test_invalid_target_fails_without_unchanged_output(self):
        result = subprocess.run(['bash', str(SCRIPT), str(self.repo), self.base, 'missing'],
                                capture_output=True, text=True)
        self.assertNotEqual(0, result.returncode)
        self.assertEqual('', result.stdout)


if __name__ == '__main__':
    unittest.main()
