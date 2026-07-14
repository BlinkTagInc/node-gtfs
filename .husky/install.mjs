// Skip husky hook installation in CI, production, or when this package is
// installed as a dependency (husky is a devDependency and won't be present).
if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
  process.exit(0)
}

try {
  const husky = (await import('husky')).default
  console.log(husky())
} catch {
  // husky isn't installed — nothing to do
}