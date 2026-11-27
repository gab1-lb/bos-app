// Netlify `ignore` command: exit 0 = skip the build, non-zero = build.
// Skips the build when a push only touches docs, e2e specs, unit tests or markdown.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const NON_BUILD = [/^docs\//, /^e2e\//, /\.test\.tsx?$/, /\.md$/];

export function onlyNonBuildChanges(files) {
  return files.length > 0 && files.every((f) => NON_BUILD.some((re) => re.test(f)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { CACHED_COMMIT_REF: from, COMMIT_REF: to } = process.env;
  if (!from || !to) {
    console.log('BOS: no commit refs, building.');
    process.exit(1);
  }
  let files;
  try {
    files = execFileSync('git', ['diff', '--name-only', from, to], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    console.log('BOS: git diff failed, building.');
    process.exit(1);
  }
  const skip = onlyNonBuildChanges(files);
  console.log(skip ? 'BOS: only docs/tests changed, skipping build.' : 'BOS: app changes, building.');
  process.exit(skip ? 0 : 1);
}
