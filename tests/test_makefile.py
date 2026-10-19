"""Regression coverage for the generated Gallery port and private catalog selection."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class GalleryMakefileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        shutil.copyfile(ROOT / 'Makefile', self.root / 'Makefile')

    def tearDown(self):
        self.temp.cleanup()

    def make(self, *args, **env):
        process_env = dict(os.environ)
        for key in ('WEB_PORT', 'PRIVATE_INDEX_PATH', 'MAKEFLAGS', 'MFLAGS', 'MAKELEVEL'):
            process_env.pop(key, None)
        process_env.update(env)
        return subprocess.run(['make', '--no-print-directory', *args], cwd=self.root,
                              env=process_env, text=True, capture_output=True)

    def port(self, *args, **env):
        return self.make('--eval=print-port:;@echo $(WEB_PORT)', 'print-port', *args, **env)

    def test_generated_override_wins_over_environment_and_command_line(self):
        (self.root / '.project-gallery.mk').write_text('override export WEB_PORT := 43121\n')
        result = self.port('WEB_PORT=43122', WEB_PORT='43123')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), '43121')

    def test_plain_generated_assignment_and_no_generated_file_are_supported(self):
        self.assertEqual(self.port().stdout.strip(), '8000')
        (self.root / '.project-gallery.mk').write_text('WEB_PORT := 43121\n')
        result = self.port()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), '43121')

    def test_missing_or_empty_generated_port_never_falls_back(self):
        for definition in ('# port not assigned\n', 'override export WEB_PORT :=\n'):
            with self.subTest(definition=definition):
                (self.root / '.project-gallery.mk').write_text(definition)
                result = self.port(WEB_PORT='43123')
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('.project-gallery.mk must define', result.stderr)

    def test_managed_start_selects_private_catalog_only_when_present_or_explicit(self):
        absent = self.make('-n', 'start')
        self.assertEqual(absent.returncode, 0, absent.stderr)
        self.assertIn('PRIVATE_INDEX_PATH=""', absent.stdout)
        index = self.root / '.local/private-data/index.personal.json'
        index.parent.mkdir(parents=True)
        index.write_text('{"schemaVersion":1,"certifications":[]}\n')
        selected = self.make('-n', 'start')
        self.assertEqual(selected.returncode, 0, selected.stderr)
        self.assertIn('PRIVATE_INDEX_PATH=".local/private-data/index.personal.json"', selected.stdout)
        public = self.make('-n', 'start', 'PRIVATE_INDEX_PATH=')
        self.assertEqual(public.returncode, 0, public.stderr)
        self.assertIn('PRIVATE_INDEX_PATH=""', public.stdout)
        explicit = self.make('-n', 'start', 'PRIVATE_INDEX_PATH=.local/custom.json')
        self.assertIn('PRIVATE_INDEX_PATH=".local/custom.json"', explicit.stdout)


if __name__ == '__main__':
    unittest.main()
